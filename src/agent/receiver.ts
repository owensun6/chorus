// Author: be-api-router
import { Hono } from "hono";
import { ZodError } from "zod";
import type OpenAI from "openai";
import { parseEnvelope } from "./envelope";
import { adaptMessage } from "./llm";
import { CHORUS_MEDIA_TYPE } from "../shared/types";
import type { A2AMessage, ChorusEnvelope, DataPart } from "../shared/types";

// --- Response Helpers ---

const successResponse = (data: unknown) => ({
  success: true as const,
  data,
  metadata: { timestamp: new Date().toISOString() },
});

const errorResponse = (code: string, message: string) => ({
  success: false as const,
  error: { code, message },
  metadata: { timestamp: new Date().toISOString() },
});

// --- Receiver Config ---

interface ReceiverConfig {
  readonly port: number;
  readonly llmClient: OpenAI;
  readonly receiverCulture: string;
  readonly onMessage: (from: string, original: string, adapted: string) => void;
}

// --- Internal Helpers ---

const findRawChorusDataPart = (message: A2AMessage): DataPart | null => {
  const found = message.parts.find(
    (p): p is DataPart =>
      "data" in p && p.mediaType === CHORUS_MEDIA_TYPE,
  );
  return found ?? null;
};

const extractOriginalText = (message: A2AMessage): string => {
  const textPart = message.parts.find(
    (p): p is { text: string; mediaType: string } =>
      "text" in p && p.mediaType === "text/plain",
  );
  return textPart?.text ?? "";
};

type ParseResult =
  | { readonly ok: true; readonly envelope: ChorusEnvelope }
  | { readonly ok: false; readonly errorMessage: string };

const tryParseEnvelope = (data: unknown): ParseResult => {
  try {
    const envelope = parseEnvelope(data);
    return { ok: true, envelope };
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      const fieldErrors = err.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return { ok: false, errorMessage: fieldErrors };
    }
    return { ok: false, errorMessage: "invalid envelope data" };
  }
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

    // Step 1: Find raw Chorus DataPart by mediaType
    const dataPart = findRawChorusDataPart(message);
    if (dataPart === null) {
      return c.json(
        errorResponse("ERR_INVALID_ENVELOPE", "no Chorus DataPart found"),
        400,
      );
    }

    // Step 2: Validate envelope via parseEnvelope (catches ZodError)
    const parsed = tryParseEnvelope(dataPart.data);
    if (!parsed.ok) {
      return c.json(
        errorResponse("ERR_INVALID_ENVELOPE", parsed.errorMessage),
        400,
      );
    }

    // Step 3: Extract original text
    const originalText = extractOriginalText(message);

    // Step 4: Adapt message via LLM
    try {
      const adaptedText = await adaptMessage(
        llmClient,
        parsed.envelope,
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
