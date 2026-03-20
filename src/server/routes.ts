// Author: be-api-router
import { Hono } from "hono";
import { AgentRegistry } from "./registry";
import { RegisterAgentBodySchema, MessagePayloadBodySchema } from "./validation";
import { successResponse, errorResponse, formatZodErrors } from "../shared/response";
import { singleSSEStream } from "../shared/sse";
import { extractErrorMessage } from "../shared/log";

const createApp = (registry: AgentRegistry): Hono => {
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

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const targetRes = await fetch(target.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envelope }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (targetRes.status >= 500) {
        return c.json(
          errorResponse(
            "ERR_AGENT_UNREACHABLE",
            "Receiver agent returned a server error"
          ),
          502
        );
      }

      const targetBody = await targetRes.json();
      return c.json(
        successResponse({ delivery: "delivered", receiver_response: targetBody }),
        200
      );
    } catch {
      return c.json(
        errorResponse(
          "ERR_AGENT_UNREACHABLE",
          "Failed to reach receiver agent"
        ),
        502
      );
    }
  });

  app.get("/health", (c) => {
    return c.json(
      successResponse({
        status: "ok",
        version: "1.0.0",
        uptime_seconds: Math.floor(process.uptime()),
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
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const targetRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
      body: JSON.stringify({ envelope }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (targetRes.status >= 500) {
      return sseErrorResponse("ERR_AGENT_UNREACHABLE", "Receiver agent returned a server error");
    }

    return new Response(targetRes.body, { headers: SSE_HEADERS });
  } catch (err: unknown) {
    const errMessage = extractErrorMessage(err);
    return sseErrorResponse("ERR_AGENT_UNREACHABLE", `Failed to reach receiver agent: ${errMessage}`);
  }
};

export { createApp };
