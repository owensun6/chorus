// Author: be-api-router
// L3 Reference Implementation — Chorus 接收端参考实现。协议行为规范见 skill/SKILL.md。
import { Hono } from "hono";
import type OpenAI from "openai";
import { validateEnvelopeData } from "./envelope";
import { adaptMessage, adaptMessageStream } from "./llm";
import { formatSSE, SSE_ENCODER } from "../shared/sse";
import { extractErrorMessage } from "../shared/log";
import type { ChorusEnvelope } from "../shared/types";
import type { ConversationHistory } from "./history";

// --- Receiver Config ---

interface ReceiverConfig {
  readonly port: number;
  readonly llmClient: OpenAI;
  readonly receiverCulture: string;
  readonly onMessage: (from: string, original: string, adapted: string) => void;
  readonly history?: ConversationHistory;
  readonly personality?: string;
}

// --- Public API ---

const createReceiver = (config: ReceiverConfig) => {
  const { llmClient, receiverCulture, onMessage, history, personality } = config;
  const app = new Hono();

  app.post("/receive", async (c) => {
    const body = await c.req.json().catch(() => null) as { envelope: unknown } | null;
    if (body === null) {
      return c.json(
        { status: "error", error_code: "INVALID_ENVELOPE", detail: "Invalid JSON body" },
        400,
      );
    }

    // Validate envelope
    const result = validateEnvelopeData(body.envelope);

    if (result.status === "not_found") {
      return c.json(
        { status: "error", error_code: "INVALID_ENVELOPE", detail: "no envelope found in request" },
        400,
      );
    }

    if (result.status === "invalid") {
      return c.json(
        { status: "error", error_code: "INVALID_ENVELOPE", detail: result.error },
        400,
      );
    }

    const { envelope } = result;
    const senderId = envelope.sender_id;

    // Check streaming mode
    const wantsStream =
      c.req.header("Accept")?.includes("text/event-stream") === true;

    if (wantsStream) {
      return handleStreaming(
        c,
        llmClient,
        envelope,
        receiverCulture,
        senderId,
        onMessage,
        history,
        personality,
      );
    }

    // Non-streaming
    try {
      const adaptedText = await adaptMessage(
        llmClient,
        envelope,
        receiverCulture,
        personality,
      );

      onMessage(senderId, envelope.original_text, adaptedText);

      return c.json({ status: "ok" }, 200);
    } catch (err: unknown) {
      return c.json(
        { status: "error", error_code: "ADAPTATION_FAILED", detail: extractErrorMessage(err) },
        500,
      );
    }
  });

  return { app };
};

// --- Streaming Helper ---

const handleStreaming = (
  c: { body: (stream: ReadableStream) => Response },
  llmClient: OpenAI,
  envelope: ChorusEnvelope,
  receiverCulture: string,
  senderId: string,
  onMessage: (from: string, original: string, adapted: string) => void,
  history?: ConversationHistory,
  senderPersonality?: string,
): Response => {
  const historyTurns = history
    ? history.getTurns(senderId)
    : undefined;

  const stream = new ReadableStream({
    start(controller) {
      adaptMessageStream(
        llmClient,
        envelope,
        receiverCulture,
        historyTurns,
        senderPersonality,
        (chunk: string) => {
          controller.enqueue(SSE_ENCODER.encode(formatSSE("chunk", { text: chunk })));
        },
      )
        .then((fullText) => {
          controller.enqueue(SSE_ENCODER.encode(formatSSE("done", { full_text: fullText, envelope })));
          onMessage(senderId, envelope.original_text, fullText);
          controller.close();
        })
        .catch((err: unknown) => {
          controller.enqueue(SSE_ENCODER.encode(formatSSE("error", { code: "ERR_ADAPTATION_FAILED", message: extractErrorMessage(err) })));
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
};

export { createReceiver };
export type { ReceiverConfig };
