// Author: be-api-router
import { Hono } from "hono";
import { AgentRegistry } from "./registry";
import { RegisterAgentBodySchema, MessagePayloadBodySchema } from "./validation";
import { successResponse, errorResponse, formatZodErrors } from "../shared/response";
import { singleSSEStream } from "../shared/sse";
import { extractErrorMessage } from "../shared/log";

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

const createApp = (registry: AgentRegistry, config: ServerConfig = DEFAULT_SERVER_CONFIG): Hono => {
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

    if (stream) {
      return handleStreamForward(c, target.endpoint, envelope, TIMEOUT_MS);
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
      return c.json(
        successResponse({ delivery: "delivered", receiver_response: targetBody }),
        200
      );
    } catch {
      registry.recordFailure();
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
