// Author: be-api-router
import { createReceiver } from "../../src/agent/receiver";
import { CHORUS_MEDIA_TYPE } from "../../src/shared/types";
import type { A2AMessage } from "../../src/shared/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

// ---------------------------------------------------------------------------
// Mock adaptMessageStream (T-04)
// ---------------------------------------------------------------------------
jest.mock("../../src/agent/llm", () => {
  const actual = jest.requireActual("../../src/agent/llm");
  return {
    ...actual,
    adaptMessage: jest.fn(),
    adaptMessageStream: jest.fn(),
  };
});

import { adaptMessage, adaptMessageStream } from "../../src/agent/llm";
const mockAdaptMessage = adaptMessage as jest.MockedFunction<typeof adaptMessage>;
const mockAdaptMessageStream = adaptMessageStream as jest.MockedFunction<typeof adaptMessageStream>;

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
  beforeEach(() => {
    mockAdaptMessage.mockReset();
  });

  it("returns 200 and calls onMessage for valid message with Chorus DataPart", async () => {
    const adapted = "Hey, shall we catch up tomorrow?";
    mockAdaptMessage.mockResolvedValue(adapted);
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
    mockAdaptMessage.mockRejectedValue(new Error("model overloaded"));
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

// ---------------------------------------------------------------------------
// T-04: Streaming SSE tests
// ---------------------------------------------------------------------------

const parseSSEEvents = (raw: string): Array<{ event: string; data: string }> => {
  const events: Array<{ event: string; data: string }> = [];
  const blocks = raw.split("\n\n").filter((b) => b.trim().length > 0);
  for (const block of blocks) {
    const lines = block.split("\n");
    let event = "";
    let data = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) event = line.slice(7);
      if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (event || data) events.push({ event, data });
  }
  return events;
};

describe("POST /receive (streaming — T-04)", () => {
  beforeEach(() => {
    mockAdaptMessageStream.mockReset();
  });

  it("test_case_1: streaming response with Accept: text/event-stream contains chunk + done events", async () => {
    const fullText = "Adapted streaming text";
    mockAdaptMessageStream.mockImplementation(
      async (_client, _env, _orig, _culture, _hist, onChunk) => {
        if (onChunk) {
          onChunk("Adapted ");
          onChunk("streaming ");
          onChunk("text");
        }
        return fullText;
      },
    );

    const onMessage = jest.fn();
    const { app } = createReceiver({
      port: 0,
      llmClient: makeLLMClient("unused") as any,
      receiverCulture: "en-US",
      onMessage,
    });

    const res = await app.request("/receive", {
      method: "POST",
      body: JSON.stringify(validRequestBody),
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");

    const text = await res.text();
    const events = parseSSEEvents(text);

    const chunks = events.filter((e) => e.event === "chunk");
    expect(chunks.length).toBeGreaterThanOrEqual(1);

    const doneEvents = events.filter((e) => e.event === "done");
    expect(doneEvents.length).toBe(1);

    const doneData = JSON.parse(doneEvents[0].data);
    expect(doneData.full_text).toBe(fullText);
    expect(doneData.envelope).toBeDefined();
  });

  it("test_case_2: non-streaming response without Accept header returns JSON (Phase 1 compat)", async () => {
    const adapted = "Adapted non-streaming text";
    mockAdaptMessage.mockResolvedValue(adapted);
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
    expect(onMessage).toHaveBeenCalled();
  });

  it("test_case_3: streaming error sends SSE error event", async () => {
    mockAdaptMessageStream.mockRejectedValue(new Error("LLM exploded"));

    const onMessage = jest.fn();
    const { app } = createReceiver({
      port: 0,
      llmClient: makeLLMClient("unused") as any,
      receiverCulture: "en-US",
      onMessage,
    });

    const res = await app.request("/receive", {
      method: "POST",
      body: JSON.stringify(validRequestBody),
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    const events = parseSSEEvents(text);

    const errorEvents = events.filter((e) => e.event === "error");
    expect(errorEvents.length).toBe(1);
    const errorData = JSON.parse(errorEvents[0].data);
    expect(errorData.code).toBe("ERR_ADAPTATION_FAILED");
    expect(errorData.message).toContain("LLM exploded");
  });

  it("test_case_4: history turns passed to adaptMessageStream when config.history set", async () => {
    const { ConversationHistory } = await import("../../src/agent/history");
    const history = new ConversationHistory();
    history.addTurn("agent-alpha", {
      role: "received",
      originalText: "prev original",
      adaptedText: "prev adapted",
      envelope: {
        chorus_version: "0.2",
        original_semantic: "prev",
        sender_culture: "zh-CN",
      },
      timestamp: new Date().toISOString(),
    });

    mockAdaptMessageStream.mockImplementation(
      async (_client, _env, _orig, _culture, _hist, onChunk) => {
        if (onChunk) onChunk("ok");
        return "ok";
      },
    );

    const onMessage = jest.fn();
    const { app } = createReceiver({
      port: 0,
      llmClient: makeLLMClient("unused") as any,
      receiverCulture: "en-US",
      onMessage,
      history,
    });

    const res = await app.request("/receive", {
      method: "POST",
      body: JSON.stringify(validRequestBody),
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
    });

    expect(res.status).toBe(200);
    expect(mockAdaptMessageStream).toHaveBeenCalledTimes(1);

    const callArgs = mockAdaptMessageStream.mock.calls[0];
    // arg[4] = historyTurns
    expect(callArgs[4]).toBeDefined();
    expect((callArgs[4] as any).length).toBe(1);
  });

  it("test_case_5: invalid body returns 400 in streaming mode", async () => {
    const onMessage = jest.fn();
    const { app } = createReceiver({
      port: 0,
      llmClient: makeLLMClient("unused") as any,
      receiverCulture: "en-US",
      onMessage,
    });

    const res = await app.request("/receive", {
      method: "POST",
      body: "not valid json",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
    });

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_VALIDATION");
  });
});
