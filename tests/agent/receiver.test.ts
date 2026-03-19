// Author: be-api-router
import { createReceiver } from "../../src/agent/receiver";
import { CHORUS_MEDIA_TYPE } from "../../src/shared/types";
import type { A2AMessage } from "../../src/shared/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const makeLLMClient = (adaptedText: string) => ({
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{ message: { content: adaptedText } }],
      }),
    },
  },
});

const makeFailingLLMClient = (errorMessage: string) => ({
  chat: {
    completions: {
      create: jest.fn().mockRejectedValue(new Error(errorMessage)),
    },
  },
});

const validEnvelopeData = {
  chorus_version: "0.2",
  original_semantic: "I want to schedule a meeting",
  sender_culture: "zh-CN",
  cultural_context: "Chinese business culture values indirect communication",
  intent_type: "request",
  formality: "formal",
  emotional_tone: "polite",
};

const validMessage: A2AMessage = {
  role: "ROLE_USER",
  parts: [
    { text: "Can we meet tomorrow?", mediaType: "text/plain" },
    { data: { ...validEnvelopeData }, mediaType: CHORUS_MEDIA_TYPE },
  ],
  extensions: ["https://chorus-protocol.org/extensions/envelope/v0.2"],
};

const validRequestBody = {
  sender_agent_id: "agent-alpha",
  message: validMessage,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /receive", () => {
  it("returns 200 and calls onMessage for valid message with Chorus DataPart", async () => {
    const adapted = "Hey, shall we catch up tomorrow?";
    const llmClient = makeLLMClient(adapted);
    const onMessage = jest.fn();

    const { app } = createReceiver({
      port: 0,
      llmClient: llmClient as any,
      receiverCulture: "en-US",
      onMessage,
    });

    const res = await app.request("/receive", {
      method: "POST",
      body: JSON.stringify(validRequestBody),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(200);
    const json: Json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.processed).toBe(true);
    expect(onMessage).toHaveBeenCalledWith(
      "agent-alpha",
      "Can we meet tomorrow?",
      adapted,
    );
  });

  it("returns 400 ERR_INVALID_ENVELOPE when no Chorus DataPart found", async () => {
    const llmClient = makeLLMClient("irrelevant");
    const onMessage = jest.fn();

    const { app } = createReceiver({
      port: 0,
      llmClient: llmClient as any,
      receiverCulture: "en-US",
      onMessage,
    });

    const noEnvelopeMessage: A2AMessage = {
      role: "ROLE_USER",
      parts: [{ text: "plain text only", mediaType: "text/plain" }],
    };

    const res = await app.request("/receive", {
      method: "POST",
      body: JSON.stringify({
        sender_agent_id: "agent-alpha",
        message: noEnvelopeMessage,
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_INVALID_ENVELOPE");
    expect(json.error.message).toContain("no Chorus DataPart found");
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("returns 400 ERR_INVALID_ENVELOPE when envelope has missing required field", async () => {
    const llmClient = makeLLMClient("irrelevant");
    const onMessage = jest.fn();

    const { app } = createReceiver({
      port: 0,
      llmClient: llmClient as any,
      receiverCulture: "en-US",
      onMessage,
    });

    const invalidEnvelopeMessage: A2AMessage = {
      role: "ROLE_USER",
      parts: [
        { text: "hello", mediaType: "text/plain" },
        {
          data: {
            chorus_version: "0.2",
            // missing original_semantic and sender_culture
          },
          mediaType: CHORUS_MEDIA_TYPE,
        },
      ],
    };

    const res = await app.request("/receive", {
      method: "POST",
      body: JSON.stringify({
        sender_agent_id: "agent-alpha",
        message: invalidEnvelopeMessage,
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_INVALID_ENVELOPE");
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("returns 500 ERR_ADAPTATION_FAILED when LLM adaptation fails", async () => {
    const llmClient = makeFailingLLMClient("model overloaded");
    const onMessage = jest.fn();

    const { app } = createReceiver({
      port: 0,
      llmClient: llmClient as any,
      receiverCulture: "en-US",
      onMessage,
    });

    const res = await app.request("/receive", {
      method: "POST",
      body: JSON.stringify(validRequestBody),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(500);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_ADAPTATION_FAILED");
    expect(json.error.message).toContain("model overloaded");
    expect(onMessage).not.toHaveBeenCalled();
  });
});
