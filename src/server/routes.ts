// Author: be-api-router
import { Hono } from "hono";
import { randomUUID } from "crypto";
import { AgentRegistry } from "./registry";
import { RegisterAgentBodySchema, MessagePayloadBodySchema } from "./validation";
import { successResponse, errorResponse, formatZodErrors } from "../shared/response";
import { formatSSE, singleSSEStream, SSE_ENCODER } from "../shared/sse";
import { extractErrorMessage } from "../shared/log";
import type { ActivityStream } from "./activity";
import { CONSOLE_HTML } from "./console-html";

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

const createApp = (registry: AgentRegistry, config: ServerConfig = DEFAULT_SERVER_CONFIG, activity?: ActivityStream): Hono => {
  const app = new Hono();

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

  app.delete("/agents/:id", (c) => {
    const removed = registry.remove(c.req.param("id"));
    if (!removed) {
      return c.json(
        errorResponse("ERR_AGENT_NOT_FOUND", "Agent not found"),
        404
      );
    }
    if (activity) {
      activity.append("agent_removed", { agent_id: c.req.param("id") });
    }

    return c.json(
      successResponse({ deleted: true, agent_id: c.req.param("id") }),
      200
    );
  });

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
      });
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

      if (targetRes.status >= 500) {
        registry.recordFailure();
        if (activity) {
          activity.append("message_failed", {
            trace_id: traceId,
            receiver_id,
            error: "Receiver agent returned a server error",
          });
        }
        return c.json(
          errorResponse(
            "ERR_AGENT_UNREACHABLE",
            "Receiver agent returned a server error"
          ),
          502
        );
      }

      const targetBody = await targetRes.json();
      registry.recordDelivery();
      if (activity) {
        activity.append("message_delivered", {
          trace_id: traceId,
          receiver_id,
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

  app.get("/.well-known/chorus.json", (c) => {
    return c.json({
      chorus_version: "0.4",
      server_name: "Chorus Public Alpha Hub",
      server_status: "alpha",
      endpoints: {
        register: "/agents",
        discover: "/agents",
        send: "/messages",
        health: "/health",
        activity: "/activity",
        events: "/events",
        console: "/console",
      },
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
        version: "0.4.0-alpha",
        uptime_seconds: Math.floor(process.uptime()),
        agents_registered: stats.agents_registered,
        messages_delivered: stats.messages_delivered,
        messages_failed: stats.messages_failed,
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

          // Clean up on client disconnect
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

  app.get("/console", (c) => {
    return c.html(CONSOLE_HTML);
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

    if (targetRes.status >= 500) {
      return sseErrorResponse("ERR_AGENT_UNREACHABLE", "Receiver agent returned a server error");
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
