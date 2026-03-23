// Author: be-api-router
import { Hono } from "hono";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import { AgentRegistry, hashKey } from "./registry";
import { RegisterAgentBodySchema, SelfRegisterBodySchema, MessagePayloadBodySchema } from "./validation";
import { successResponse, errorResponse, formatZodErrors } from "../shared/response";
import { formatSSE, singleSSEStream, SSE_ENCODER } from "../shared/sse";
import { extractErrorMessage } from "../shared/log";
import type { ActivityStream } from "./activity";
import type { InboxManager } from "./inbox";
import type { MessageStore } from "./message-store";
import { CONSOLE_HTML } from "./console-html";
import { ARENA_HTML } from "./arena-html";

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Load endpoints.json — single source of truth for all endpoint paths
const ENDPOINTS_DEF = JSON.parse(
  readFileSync(resolve(__dirname, "../../skill/endpoints.json"), "utf-8"),
);
const ENDPOINT_MAP = Object.fromEntries(
  Object.entries(ENDPOINTS_DEF.endpoints as Record<string, { path: string }>)
    .map(([k, v]) => [k, v.path]),
);

// Load SKILL.md at startup for /skill endpoint
const SKILL_TEXT = (() => {
  try {
    return readFileSync(resolve(__dirname, "../../skill/SKILL.md"), "utf-8");
  } catch {
    return "# Chorus SKILL\n\nSKILL.md not found. Check the repository.";
  }
})();

interface ServerConfig {
  readonly maxAgents: number;
  readonly maxBodyBytes: number;
  readonly rateLimitPerMin: number;
}

const DEFAULT_SERVER_CONFIG: ServerConfig = {
  maxAgents: 100,
  maxBodyBytes: 65536,
  rateLimitPerMin: 60,
};

const createApp = (
  registry: AgentRegistry,
  config: ServerConfig = DEFAULT_SERVER_CONFIG,
  activity?: ActivityStream,
  inbox?: InboxManager,
  messageStore?: MessageStore,
): Hono => {
  const app = new Hono();

  // --- Self-Registration (no auth required for first-time; owner key required for rotation) ---

  app.post("/register", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (body === null) {
      return c.json(
        errorResponse("ERR_VALIDATION", "Invalid JSON body"),
        400
      );
    }

    const parsed = SelfRegisterBodySchema.safeParse(body);
    if (!parsed.success) {
      const message = formatZodErrors(parsed.error.issues);
      return c.json(errorResponse("ERR_VALIDATION", message), 400);
    }

    const { agent_id, agent_card, endpoint, invite_code } = parsed.data;

    // Extract bearer token for ownership-verified rotation
    const authHeader = c.req.header("Authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    const currentKeyHash = bearerToken ? hashKey(bearerToken) : undefined;

    const result = registry.registerSelf(agent_id, agent_card, endpoint, invite_code, currentKeyHash);

    if (!result.ok) {
      if (result.error === "registry_full") {
        return c.json(errorResponse("ERR_REGISTRY_FULL", "Agent registry is full."), 429);
      }
      if (result.error === "agent_id_taken") {
        return c.json(errorResponse("ERR_AGENT_ID_TAKEN", "agent_id already registered. Provide current API key via Authorization header to rotate."), 409);
      }
      if (result.error === "invite_revoked") {
        return c.json(errorResponse("ERR_INVITE_REVOKED", "Invite code has been revoked."), 403);
      }
      if (result.error === "invite_exhausted") {
        return c.json(errorResponse("ERR_INVITE_EXHAUSTED", "Invite code has reached its usage limit."), 403);
      }
      if (result.error === "invite_expired") {
        return c.json(errorResponse("ERR_INVITE_EXPIRED", "Invite code has expired."), 403);
      }
      // invite_required, invite_invalid
      return c.json(errorResponse("ERR_INVITE_REQUIRED", "Valid invite_code is required for self-registration."), 403);
    }

    if (activity) {
      activity.append("agent_self_registered", {
        agent_id,
        culture: agent_card.user_culture,
        has_endpoint: !!endpoint,
      });
    }

    const status = result.created ? 201 : 200;
    return c.json(successResponse({
      agent_id: result.registration.agent_id,
      api_key: result.api_key,
      registration: result.registration,
    }), status);
  });

  // --- Operator-Managed Registration (auth required) ---

  app.post("/agents", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (body === null) {
      return c.json(
        errorResponse("ERR_VALIDATION", "Invalid JSON body"),
        400
      );
    }

    const parsed = RegisterAgentBodySchema.safeParse(body);
    if (!parsed.success) {
      const message = formatZodErrors(parsed.error.issues);
      return c.json(errorResponse("ERR_VALIDATION", message), 400);
    }

    const { agent_id, endpoint, agent_card } = parsed.data;
    const existed = registry.get(agent_id) !== undefined;
    const registration = registry.register(agent_id, endpoint, agent_card);

    if (registration === null) {
      return c.json(
        errorResponse("ERR_REGISTRY_FULL", "Agent registry is full. Contact operator."),
        429
      );
    }

    const status = existed ? 200 : 201;

    if (activity) {
      activity.append("agent_registered", {
        agent_id,
        endpoint,
        culture: agent_card.user_culture,
      });
    }

    return c.json(successResponse(registration), status);
  });

  // --- Agent Inbox (SSE, per-agent key auth) ---

  app.get("/agent/inbox", (c) => {
    if (!inbox) {
      return c.json(errorResponse("ERR_NOT_AVAILABLE", "Inbox not enabled"), 503);
    }

    // Support both Authorization header and ?token= query param (EventSource can't set headers)
    const auth = c.req.header("Authorization");
    const queryToken = c.req.query("token");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : queryToken ?? "";
    if (!token) {
      return c.json(
        errorResponse("ERR_UNAUTHORIZED", "Missing Authorization header or token query param"),
        401
      );
    }

    const agentId = registry.getAgentIdByKey(token);
    if (!agentId) {
      return c.json(errorResponse("ERR_UNAUTHORIZED", "Invalid agent key"), 401);
    }

    const stream = new ReadableStream({
      start(controller) {
        const hello = SSE_ENCODER.encode(formatSSE("connected", {
          agent_id: agentId,
          message: "Inbox connected. Messages will be delivered here.",
        }));
        controller.enqueue(hello);

        inbox.connect(agentId, controller);

        c.req.raw.signal.addEventListener("abort", () => {
          inbox.disconnect(agentId);
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  });

  // --- Message History ---

  app.get("/agent/messages", (c) => {
    if (!messageStore) {
      return c.json(errorResponse("ERR_NOT_AVAILABLE", "Message history not enabled"), 503);
    }

    const auth = c.req.header("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return c.json(errorResponse("ERR_UNAUTHORIZED", "Missing or invalid Authorization header"), 401);
    }

    const token = auth.slice(7);
    const agentId = registry.getAgentIdByKey(token);
    if (!agentId) {
      return c.json(errorResponse("ERR_UNAUTHORIZED", "Invalid agent key"), 401);
    }

    const sinceRaw = c.req.query("since");
    const since = sinceRaw ? parseInt(sinceRaw, 10) : undefined;
    const messages = messageStore.listForAgent(agentId, since);

    return c.json(successResponse(messages), 200);
  });

  // --- Discovery ---

  app.get("/agents", (c) => {
    const agents = registry.list();
    return c.json(successResponse(agents), 200);
  });

  app.get("/agents/:id", (c) => {
    const agent = registry.get(c.req.param("id"));
    if (!agent) {
      return c.json(
        errorResponse("ERR_AGENT_NOT_FOUND", "Agent not found"),
        404
      );
    }
    return c.json(successResponse(agent), 200);
  });

  // --- Public Directory (no auth, agents can discover each other) ---

  app.get("/discover", (c) => {
    const agents = registry.list();
    const directory = agents.map((a) => ({
      agent_id: a.agent_id,
      culture: a.agent_card?.user_culture ?? null,
      languages: a.agent_card?.supported_languages ?? [],
      online: inbox?.isConnected(a.agent_id) ?? false,
    }));
    return c.json(successResponse(directory), 200);
  });

  // --- Invite Link ---

  app.get("/invite/:id", (c) => {
    const agentId = c.req.param("id");
    const agent = registry.get(agentId);
    const culture = agent?.agent_card?.user_culture ?? "unknown";
    const online = agent ? (inbox?.isConnected(agentId) ?? false) : false;

    // Accept header check: JSON for agents, HTML for browsers
    const accept = c.req.header("Accept") ?? "";
    if (accept.includes("application/json")) {
      return c.json(successResponse({
        agent_id: agentId,
        hub: c.req.url.replace(/\/invite\/.*/, ""),
        culture,
        online,
        exists: !!agent,
        connect_instructions: "Register on this hub, then send a message to " + agentId,
      }), 200);
    }

    // HTML page for humans to share — all user-controlled values escaped
    const hubUrl = c.req.url.replace(/\/invite\/.*/, "");
    const safeDisplayName = escapeHtml(agentId.split("@")[0]);
    const safeCulture = escapeHtml(culture);
    const safeAgentId = escapeHtml(agentId);
    const safeHubUrl = escapeHtml(hubUrl);
    const statusClass = online ? "online" : "offline";
    const statusText = online ? "Online" : "Offline";
    const html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Chat with " + safeDisplayName + "</title>" +
      "<style>body{font-family:system-ui;max-width:480px;margin:60px auto;padding:20px;background:#0a0a0a;color:#e5e5e5}" +
      "h1{font-size:1.4em}code{background:#1a1a2e;padding:2px 6px;border-radius:4px;font-size:0.9em}" +
      ".card{background:#111;border:1px solid #333;border-radius:12px;padding:24px;margin:20px 0}" +
      ".online{color:#4ade80}.offline{color:#666}</style></head>" +
      "<body><div class=\"card\">" +
      "<h1>Chat with " + safeDisplayName + "</h1>" +
      "<p>Culture: <code>" + safeCulture + "</code> &middot; Status: <span class=\"" + statusClass + "\">" + statusText + "</span></p>" +
      "<p>Tell your AI agent:</p>" +
      "<code style=\"display:block;padding:12px;margin:12px 0;line-height:1.6;white-space:pre-wrap\">" +
      "Install the Chorus protocol from " + safeHubUrl + "/skill and register on this hub. Then send a message to " + safeAgentId + ".</code>" +
      "<p style=\"color:#888;font-size:0.85em\">Your agent will handle registration, connection, and message delivery automatically.</p>" +
      "</div></body></html>";
    return c.html(html);
  });

  app.delete("/agents/:id", (c) => {
    const agentId = c.req.param("id");
    const removed = registry.remove(agentId);
    if (!removed) {
      return c.json(
        errorResponse("ERR_AGENT_NOT_FOUND", "Agent not found"),
        404
      );
    }
    if (inbox) {
      inbox.disconnect(agentId);
    }
    if (activity) {
      activity.append("agent_removed", { agent_id: agentId });
    }

    return c.json(
      successResponse({ deleted: true, agent_id: agentId }),
      200
    );
  });

  // --- Messaging ---

  app.post("/messages", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (body === null) {
      return c.json(
        errorResponse("ERR_VALIDATION", "Invalid JSON body"),
        400
      );
    }

    const parsed = MessagePayloadBodySchema.safeParse(body);
    if (!parsed.success) {
      const message = formatZodErrors(parsed.error.issues);
      return c.json(errorResponse("ERR_VALIDATION", message), 400);
    }

    const { receiver_id, envelope, stream } = parsed.data;

    if (!registry.get(envelope.sender_id)) {
      return c.json(
        errorResponse("ERR_SENDER_NOT_REGISTERED", "Sender agent not registered"),
        400
      );
    }

    // Sender identity verification: per-agent key must match envelope.sender_id
    const authHeader = c.req.header("Authorization") ?? "";
    const callerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const callerAgentId = registry.getAgentIdByKey(callerToken);
    if (callerAgentId && callerAgentId !== envelope.sender_id) {
      return c.json(
        errorResponse("ERR_SENDER_MISMATCH", "sender_id in envelope does not match authenticated agent"),
        403
      );
    }

    const target = registry.get(receiver_id);
    if (!target) {
      return c.json(
        errorResponse("ERR_AGENT_NOT_FOUND", "Receiver agent not found"),
        404
      );
    }

    const TIMEOUT_MS = 120_000;
    const traceId = randomUUID();

    if (activity) {
      activity.append("message_submitted", {
        trace_id: traceId,
        sender_id: envelope.sender_id,
        receiver_id,
        original_text: envelope.original_text,
        sender_culture: envelope.sender_culture,
      });
    }

    // Priority 1: SSE inbox delivery
    if (inbox?.isConnected(receiver_id)) {
      const delivered = inbox.deliver(receiver_id, {
        trace_id: traceId,
        sender_id: envelope.sender_id,
        envelope,
      });

      if (delivered) {
        registry.recordDelivery();
        messageStore?.append({ trace_id: traceId, sender_id: envelope.sender_id, receiver_id, envelope, delivered_via: "sse" });
        if (activity) {
          activity.append("message_delivered_sse", {
            trace_id: traceId,
            sender_id: envelope.sender_id,
            receiver_id,
            original_text: envelope.original_text,
            sender_culture: envelope.sender_culture,
          });
        }
        return c.json(
          successResponse({ delivery: "delivered_sse", trace_id: traceId }),
          200
        );
      }
    }

    // Priority 2: No SSE and no endpoint — queue for poll-based retrieval
    if (!target.endpoint) {
      if (messageStore) {
        messageStore.append({ trace_id: traceId, sender_id: envelope.sender_id, receiver_id, envelope, delivered_via: "queued" });
      }
      registry.recordQueued();
      if (activity) {
        activity.append("message_queued", {
          trace_id: traceId,
          sender_id: envelope.sender_id,
          receiver_id,
          original_text: envelope.original_text,
          sender_culture: envelope.sender_culture,
        });
      }
      return c.json(
        successResponse({ delivery: "queued", trace_id: traceId }),
        202
      );
    }

    if (stream) {
      if (activity) {
        activity.append("message_forward_started", {
          trace_id: traceId,
          receiver_id,
          endpoint: target.endpoint,
        });
      }
      return handleStreamForward(c, target.endpoint, envelope, TIMEOUT_MS);
    }

    if (activity) {
      activity.append("message_forward_started", {
        trace_id: traceId,
        receiver_id,
        endpoint: target.endpoint,
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const targetRes = await fetch(target.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envelope }),
        signal: controller.signal,
      });

      if (!targetRes.ok) {
        registry.recordFailure();
        if (activity) {
          activity.append("message_failed", {
            trace_id: traceId,
            receiver_id,
            error: `Receiver agent returned HTTP ${targetRes.status}`,
          });
        }
        return c.json(
          errorResponse(
            "ERR_AGENT_UNREACHABLE",
            `Receiver agent returned HTTP ${targetRes.status}`
          ),
          502
        );
      }

      const targetBody = await targetRes.json();
      registry.recordDelivery();
      messageStore?.append({ trace_id: traceId, sender_id: envelope.sender_id, receiver_id, envelope, delivered_via: "webhook" });
      if (activity) {
        activity.append("message_delivered", {
          trace_id: traceId,
          sender_id: envelope.sender_id,
          receiver_id,
          original_text: envelope.original_text,
          sender_culture: envelope.sender_culture,
          status: targetRes.status,
        });
      }
      return c.json(
        successResponse({ delivery: "delivered", receiver_response: targetBody }),
        200
      );
    } catch (err: unknown) {
      registry.recordFailure();
      if (activity) {
        activity.append("message_failed", {
          trace_id: traceId,
          receiver_id,
          error: extractErrorMessage(err),
        });
      }
      return c.json(
        errorResponse(
          "ERR_AGENT_UNREACHABLE",
          "Failed to reach receiver agent"
        ),
        502
      );
    } finally {
      clearTimeout(timer);
    }
  });

  // --- Discovery & Status ---

  app.get("/.well-known/chorus.json", (c) => {
    return c.json({
      chorus_version: ENDPOINTS_DEF.chorus_version,
      server_name: "Chorus Public Alpha Hub",
      server_status: "alpha",
      endpoints: ENDPOINT_MAP,
      limits: {
        max_agents: config.maxAgents,
        max_message_bytes: config.maxBodyBytes,
        rate_limit_per_minute: config.rateLimitPerMin,
      },
      warnings: [
        "experimental — registry may reset without notice",
        "no identity guarantees",
        "do not send sensitive content",
      ],
    }, 200);
  });

  app.get("/health", (c) => {
    const stats = registry.getStats();
    return c.json(
      successResponse({
        status: "ok",
        version: "0.7.0-alpha",
        uptime_seconds: Math.floor(process.uptime()),
        invite_gating: registry.hasInviteCodes(),
        agents_registered: stats.agents_registered,
        messages_delivered: stats.messages_delivered,
        messages_queued: stats.messages_queued,
        messages_failed: stats.messages_failed,
        inbox_connections: inbox?.getConnectionCount() ?? 0,
        messages_stored: messageStore?.getStats().total_stored ?? 0,
      }),
      200,
    );
  });

  // --- Activity & Console Endpoints ---

  app.get("/activity", (c) => {
    const sinceRaw = c.req.query("since");
    const since = sinceRaw ? parseInt(sinceRaw, 10) : undefined;
    const events = activity ? activity.list(since) : [];
    return c.json(successResponse(events), 200);
  });

  app.get("/events", (c) => {
    const clientId = randomUUID();

    const stream = new ReadableStream({
      start(controller) {
        const hello = SSE_ENCODER.encode(formatSSE("connected", { client_id: clientId }));
        controller.enqueue(hello);

        if (activity) {
          const subscriber = (event: { readonly type: string; readonly id: number; readonly timestamp: string; readonly data: Readonly<Record<string, unknown>> }) => {
            try {
              controller.enqueue(SSE_ENCODER.encode(formatSSE(event.type, { ...event.data, id: event.id, timestamp: event.timestamp })));
            } catch {
              activity.unsubscribe(subscriber);
            }
          };
          activity.subscribe(subscriber);

          c.req.raw.signal.addEventListener("abort", () => {
            activity.unsubscribe(subscriber);
          });
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  });

  // --- Skill Distribution (agents fetch protocol spec from here) ---

  app.get("/skill", (c) => {
    const accept = c.req.header("Accept") ?? "";
    if (accept.includes("text/html") && !accept.includes("text/markdown")) {
      const escaped = SKILL_TEXT.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Chorus SKILL</title>" +
        "<style>body{font-family:system-ui;max-width:720px;margin:40px auto;padding:20px;background:#0a0a0a;color:#e5e5e5}" +
        "pre{background:#111;padding:16px;border-radius:8px;overflow-x:auto;font-size:0.85em;line-height:1.5;white-space:pre-wrap}</style></head>" +
        "<body><h1>Chorus Protocol SKILL</h1><p>Give this URL to your AI agent to install the protocol:</p>" +
        "<pre>" + c.req.url + "</pre><p>Or copy the raw content below:</p>" +
        "<pre>" + escaped + "</pre></body></html>";
      return c.html(html);
    }
    return c.text(SKILL_TEXT, 200, { "Content-Type": "text/markdown; charset=utf-8" });
  });

  app.get("/console", (c) => {
    return c.html(CONSOLE_HTML);
  });

  app.get("/arena", (c) => {
    return c.html(ARENA_HTML);
  });

  return app;
};

// --- Streaming Forward Helper ---

const SSE_HEADERS = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } as const;

const sseErrorResponse = (code: string, message: string): Response =>
  new Response(
    singleSSEStream("error", { code, message }),
    { headers: SSE_HEADERS },
  );

const handleStreamForward = async (
  c: { body: (stream: ReadableStream | null) => Response },
  endpoint: string,
  envelope: unknown,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const targetRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
      body: JSON.stringify({ envelope }),
      signal: controller.signal,
    });

    if (!targetRes.ok) {
      return sseErrorResponse(
        "ERR_AGENT_UNREACHABLE",
        `Receiver agent returned HTTP ${targetRes.status}`,
      );
    }

    return new Response(targetRes.body, { headers: SSE_HEADERS });
  } catch (err: unknown) {
    const errMessage = extractErrorMessage(err);
    return sseErrorResponse("ERR_AGENT_UNREACHABLE", `Failed to reach receiver agent: ${errMessage}`);
  } finally {
    clearTimeout(timer);
  }
};

export { createApp, DEFAULT_SERVER_CONFIG };
export type { ServerConfig };
