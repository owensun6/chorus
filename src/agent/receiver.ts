// Author: be-api-router
import { Hono } from "hono";
import type OpenAI from "openai";
import { findChorusDataPart } from "./envelope";
import { adaptMessage, adaptMessageStream } from "./llm";
import { successResponse, errorResponse } from "../shared/response";
import type { A2AMessage, ChorusEnvelope } from "../shared/types";
import type { ConversationHistory } from "./history";

// --- Receiver Config ---

interface ReceiverConfig {
  readonly port: number;
  readonly llmClient: OpenAI;
  readonly receiverCulture: string;
  readonly onMessage: (from: string, original: string, adapted: string) => void;
  readonly history?: ConversationHistory;
}

// --- Internal Helper ---

const extractOriginalText = (message: A2AMessage): string => {
  const textPart = message.parts.find(
    (p): p is { text: string; mediaType: string } =>
      "text" in p && p.mediaType === "text/plain",
  );
  return textPart?.text ?? "";
};

// --- Public API ---

const createReceiver = (config: ReceiverConfig) => {
  const { llmClient, receiverCulture, onMessage, history } = config;
  const app = new Hono();

  app.post("/receive", async (c) => {
    let body: { sender_agent_id: string; message: A2AMessage };
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        errorResponse("ERR_VALIDATION", "Invalid JSON body"),
        400,
      );
    }

    const { sender_agent_id, message } = body;

    // Step 1-2: Find and validate Chorus DataPart
    const result = findChorusDataPart(message);

    if (result.status === "not_found") {
      return c.json(
        errorResponse("ERR_INVALID_ENVELOPE", "no Chorus DataPart found"),
        400,
      );
    }

    if (result.status === "invalid") {
      return c.json(
        errorResponse("ERR_INVALID_ENVELOPE", result.error),
        400,
      );
    }

    // Step 3: Extract original text
    const originalText = extractOriginalText(message);

    // Step 4: Check streaming mode
    const wantsStream =
      c.req.header("Accept")?.includes("text/event-stream") === true;

    if (wantsStream) {
      return handleStreaming(
        c,
        llmClient,
        result.envelope,
        originalText,
        receiverCulture,
        sender_agent_id,
        onMessage,
        history,
      );
    }

    // Non-streaming: Phase 1 behavior
    try {
      const adaptedText = await adaptMessage(
        llmClient,
        result.envelope,
        originalText,
        receiverCulture,
      );

      onMessage(sender_agent_id, originalText, adaptedText);

      return c.json(successResponse({ processed: true }), 200);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      return c.json(
        errorResponse("ERR_ADAPTATION_FAILED", errMessage),
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
  originalText: string,
  receiverCulture: string,
  senderAgentId: string,
  onMessage: (from: string, original: string, adapted: string) => void,
  history?: ConversationHistory,
): Response => {
  const historyTurns = history
    ? history.getTurns(senderAgentId)
    : undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      adaptMessageStream(
        llmClient,
        envelope,
        originalText,
        receiverCulture,
        historyTurns,
        (chunk: string) => {
          const sseChunk = `event: chunk\ndata: ${JSON.stringify({ text: chunk })}\n\n`;
          controller.enqueue(encoder.encode(sseChunk));
        },
      )
        .then((fullText) => {
          const sseDone = `event: done\ndata: ${JSON.stringify({ full_text: fullText, envelope })}\n\n`;
          controller.enqueue(encoder.encode(sseDone));
          onMessage(senderAgentId, originalText, fullText);
          controller.close();
        })
        .catch((err: unknown) => {
          const errMessage = err instanceof Error ? err.message : String(err);
          const sseError = `event: error\ndata: ${JSON.stringify({ code: "ERR_ADAPTATION_FAILED", message: errMessage })}\n\n`;
          controller.enqueue(encoder.encode(sseError));
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
