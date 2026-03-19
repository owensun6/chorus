// Author: be-api-router
import { Hono } from "hono";
import { AgentRegistry } from "./registry";
import { RegisterAgentBodySchema, MessagePayloadBodySchema } from "./validation";
import { successResponse, errorResponse } from "../shared/response";

const createApp = (registry: AgentRegistry): Hono => {
  const app = new Hono();

  app.post("/agents", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        errorResponse("ERR_VALIDATION", "Invalid JSON body"),
        400
      );
    }

    const parsed = RegisterAgentBodySchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
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
        errorResponse("ERR_NOT_FOUND", "Agent not found"),
        404
      );
    }
    return c.json(successResponse(agent), 200);
  });

  app.delete("/agents/:id", (c) => {
    const removed = registry.remove(c.req.param("id"));
    if (!removed) {
      return c.json(
        errorResponse("ERR_NOT_FOUND", "Agent not found"),
        404
      );
    }
    return c.json(
      successResponse({ deleted: true, agent_id: c.req.param("id") }),
      200
    );
  });

  app.post("/messages", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        errorResponse("ERR_INVALID_BODY", "Invalid JSON body"),
        400
      );
    }

    const parsed = MessagePayloadBodySchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return c.json(errorResponse("ERR_INVALID_BODY", message), 400);
    }

    const { sender_agent_id, target_agent_id, message, stream } = parsed.data;

    if (!registry.get(sender_agent_id)) {
      return c.json(
        errorResponse("ERR_INVALID_BODY", "Sender agent not registered"),
        400
      );
    }

    const target = registry.get(target_agent_id);
    if (!target) {
      return c.json(
        errorResponse("ERR_AGENT_NOT_FOUND", "Target agent not found"),
        404
      );
    }

    const TIMEOUT_MS = 120_000;

    if (stream) {
      return handleStreamForward(c, target.endpoint, sender_agent_id, message, TIMEOUT_MS);
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const targetRes = await fetch(target.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender_agent_id, message }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (targetRes.status >= 500) {
        return c.json(
          errorResponse(
            "ERR_AGENT_UNREACHABLE",
            "Target agent returned a server error"
          ),
          502
        );
      }

      const targetBody = await targetRes.json();
      return c.json(successResponse({ target_response: targetBody }), 200);
    } catch {
      return c.json(
        errorResponse(
          "ERR_AGENT_UNREACHABLE",
          "Failed to reach target agent"
        ),
        502
      );
    }
  });

  return app;
};

// --- Streaming Forward Helper ---

const buildSSEError = (code: string, message: string): string =>
  `event: error\ndata: ${JSON.stringify({ code, message })}\n\n`;

const handleStreamForward = async (
  c: { body: (stream: ReadableStream | null) => Response },
  endpoint: string,
  senderAgentId: string,
  message: unknown,
  timeoutMs: number,
): Promise<Response> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const targetRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
      },
      body: JSON.stringify({ sender_agent_id: senderAgentId, message }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (targetRes.status >= 500) {
      const encoder = new TextEncoder();
      const errStream = new ReadableStream({
        start(ctrl) {
          ctrl.enqueue(
            encoder.encode(
              buildSSEError("ERR_AGENT_UNREACHABLE", "Target agent returned a server error"),
            ),
          );
          ctrl.close();
        },
      });
      return new Response(errStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    return new Response(targetRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    const encoder = new TextEncoder();
    const errStream = new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(
          encoder.encode(
            buildSSEError("ERR_AGENT_UNREACHABLE", `Failed to reach target agent: ${errMessage}`),
          ),
        );
        ctrl.close();
      },
    });
    return new Response(errStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  }
};

export { createApp };
