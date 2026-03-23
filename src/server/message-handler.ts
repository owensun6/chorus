// Author: be-api-router
// Extracted from routes.ts — handles /messages endpoint logic
import { randomUUID } from "crypto";
import type { Context } from "hono";
import type { AgentRegistry } from "./registry";
import { MessagePayloadBodySchema } from "./validation";
import { successResponse, errorResponse, formatZodErrors } from "../shared/response";
import { formatSSE, singleSSEStream, SSE_ENCODER } from "../shared/sse";
import { extractErrorMessage } from "../shared/log";
import type { ActivityStream } from "./activity";
import type { InboxManager } from "./inbox";
import type { MessageStore } from "./message-store";

const TIMEOUT_MS = 120_000;

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

interface MessageDeps {
  readonly registry: AgentRegistry;
  readonly activity?: ActivityStream;
  readonly inbox?: InboxManager;
  readonly messageStore?: MessageStore;
}

const handleMessage = async (
  c: Context,
  deps: MessageDeps,
) => {
  const { registry, activity, inbox, messageStore } = deps;

  const body = await c.req.json().catch(() => null);
  if (body === null) {
    return c.json(errorResponse("ERR_VALIDATION", "Invalid JSON body"), 400);
  }

  const parsed = MessagePayloadBodySchema.safeParse(body);
  if (!parsed.success) {
    const message = formatZodErrors(parsed.error.issues);
    return c.json(errorResponse("ERR_VALIDATION", message), 400);
  }

  const { receiver_id, envelope, stream } = parsed.data;

  if (!registry.get(envelope.sender_id)) {
    return c.json(errorResponse("ERR_SENDER_NOT_REGISTERED", "Sender agent not registered"), 400);
  }

  // Sender identity verification: per-agent key must match envelope.sender_id
  const authHeader = c.req.header("Authorization") ?? "";
  const callerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const callerAgentId = registry.getAgentIdByKey(callerToken);
  if (callerAgentId && callerAgentId !== envelope.sender_id) {
    return c.json(errorResponse("ERR_SENDER_MISMATCH", "sender_id in envelope does not match authenticated agent"), 403);
  }

  const target = registry.get(receiver_id);
  if (!target) {
    return c.json(errorResponse("ERR_AGENT_NOT_FOUND", "Receiver agent not found"), 404);
  }

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
          trace_id: traceId, sender_id: envelope.sender_id, receiver_id,
          original_text: envelope.original_text, sender_culture: envelope.sender_culture,
        });
      }
      return c.json(successResponse({ delivery: "delivered_sse", trace_id: traceId }), 200);
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
        trace_id: traceId, sender_id: envelope.sender_id, receiver_id,
        original_text: envelope.original_text, sender_culture: envelope.sender_culture,
      });
    }
    return c.json(successResponse({ delivery: "queued", trace_id: traceId }), 202);
  }

  if (stream) {
    if (activity) {
      activity.append("message_forward_started", { trace_id: traceId, receiver_id, endpoint: target.endpoint });
    }
    return handleStreamForward(c, target.endpoint, envelope, TIMEOUT_MS);
  }

  if (activity) {
    activity.append("message_forward_started", { trace_id: traceId, receiver_id, endpoint: target.endpoint });
  }

  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), TIMEOUT_MS);

  try {
    const targetRes = await fetch(target.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelope }),
      signal: abortController.signal,
    });

    if (!targetRes.ok) {
      registry.recordFailure();
      if (activity) {
        activity.append("message_failed", { trace_id: traceId, receiver_id, error: `Receiver agent returned HTTP ${targetRes.status}` });
      }
      return c.json(errorResponse("ERR_AGENT_UNREACHABLE", `Receiver agent returned HTTP ${targetRes.status}`), 502);
    }

    const targetBody = await targetRes.json();
    registry.recordDelivery();
    messageStore?.append({ trace_id: traceId, sender_id: envelope.sender_id, receiver_id, envelope, delivered_via: "webhook" });
    if (activity) {
      activity.append("message_delivered", {
        trace_id: traceId, sender_id: envelope.sender_id, receiver_id,
        original_text: envelope.original_text, sender_culture: envelope.sender_culture, status: targetRes.status,
      });
    }
    return c.json(successResponse({ delivery: "delivered", receiver_response: targetBody }), 200);
  } catch (err: unknown) {
    registry.recordFailure();
    if (activity) {
      activity.append("message_failed", { trace_id: traceId, receiver_id, error: extractErrorMessage(err) });
    }
    return c.json(errorResponse("ERR_AGENT_UNREACHABLE", "Failed to reach receiver agent"), 502);
  } finally {
    clearTimeout(timer);
  }
};

export { handleMessage };
export type { MessageDeps };
