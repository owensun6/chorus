// Author: be-api-router
import { Hono } from "hono";
import type OpenAI from "openai";
import { findChorusDataPart } from "./envelope";
import { adaptMessage } from "./llm";
import { successResponse, errorResponse } from "../shared/response";
import type { A2AMessage } from "../shared/types";

// --- Receiver Config ---

interface ReceiverConfig {
  readonly port: number;
  readonly llmClient: OpenAI;
  readonly receiverCulture: string;
  readonly onMessage: (from: string, original: string, adapted: string) => void;
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
  const { llmClient, receiverCulture, onMessage } = config;
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

    // Step 4: Adapt message via LLM
    try {
      const adaptedText = await adaptMessage(
        llmClient,
        result.envelope,
        originalText,
        receiverCulture,
      );

      // Step 5: Notify callback
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

export { createReceiver };
export type { ReceiverConfig };
