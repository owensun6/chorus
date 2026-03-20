// Author: be-api-router
import { createReceiver } from "../../src/agent/receiver";

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

const validEnvelope = {
  chorus_version: "0.4",
  sender_id: "agent-alpha@chorus.example",
  original_text: "Can we meet tomorrow?",
  sender_culture: "zh-CN",
  cultural_context: "Chinese business culture values indirect communication",
};

const validRequestBody = {
  envelope: validEnvelope,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /receive", () => {
  beforeEach(() => {
    mockAdaptMessage.mockReset();
  });

  it("returns 200 { status: ok } for valid envelope", async () => {
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
    expect(json.status).toBe("ok");
    expect(onMessage).toHaveBeenCalledWith(
      "agent-alpha@chorus.example",
      "Can we meet tomorrow?",
      adapted,
    );
  });

  it("returns 400 INVALID_ENVELOPE when no envelope in request", async () => {
    const llmClient = makeLLMClient("irrelevant");
    const onMessage = jest.fn();

    const { app } = createReceiver({
      port: 0,
      llmClient: llmClient as any,
      receiverCulture: "en-US",
      onMessage,
    });

    const res = await app.request("/receive", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.status).toBe("error");
    expect(json.error_code).toBe("INVALID_ENVELOPE");
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_ENVELOPE when envelope has missing required field", async () => {
    const llmClient = makeLLMClient("irrelevant");
    const onMessage = jest.fn();

    const { app } = createReceiver({
      port: 0,
      llmClient: llmClient as any,
      receiverCulture: "en-US",
      onMessage,
    });

    const res = await app.request("/receive", {
      method: "POST",
      body: JSON.stringify({
        envelope: {
          chorus_version: "0.4",
          // missing sender_id, original_text, sender_culture
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.status).toBe("error");
    expect(json.error_code).toBe("INVALID_ENVELOPE");
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("returns 500 ADAPTATION_FAILED when LLM fails", async () => {
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
    expect(json.status).toBe("error");
    expect(json.error_code).toBe("ADAPTATION_FAILED");
    expect(json.detail).toContain("model overloaded");
    expect(onMessage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Streaming SSE tests
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

describe("POST /receive (streaming)", () => {
  beforeEach(() => {
    mockAdaptMessageStream.mockReset();
  });

  it("streaming response with Accept: text/event-stream", async () => {
    const fullText = "Adapted streaming text";
    mockAdaptMessageStream.mockImplementation(
      async (_client, _env, _culture, _hist, _personality, onChunk) => {
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

    const text = await res.text();
    const events = parseSSEEvents(text);

    const chunks = events.filter((e) => e.event === "chunk");
    expect(chunks.length).toBeGreaterThanOrEqual(1);

    const doneEvents = events.filter((e) => e.event === "done");
    expect(doneEvents.length).toBe(1);
    const doneData = JSON.parse(doneEvents[0].data);
    expect(doneData.full_text).toBe(fullText);
  });

  it("non-streaming returns protocol JSON { status: ok }", async () => {
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
    expect(json.status).toBe("ok");
    expect(onMessage).toHaveBeenCalled();
  });

  it("streaming error sends SSE error event", async () => {
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
  });

  it("history turns passed to adaptMessageStream", async () => {
    const { ConversationHistory } = await import("../../src/agent/history");
    const history = new ConversationHistory();
    history.addTurn("agent-alpha@chorus.example", {
      role: "received",
      originalText: "prev original",
      adaptedText: "prev adapted",
      envelope: {
        chorus_version: "0.4",
        sender_id: "agent-alpha@chorus.example",
        original_text: "prev",
        sender_culture: "zh-CN",
      },
      timestamp: new Date().toISOString(),
    });

    mockAdaptMessageStream.mockImplementation(
      async (_client, _env, _culture, _hist, _personality, onChunk) => {
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
    // arg[3] = historyTurns
    expect(callArgs[3]).toBeDefined();
    expect((callArgs[3] as any).length).toBe(1);
  });

  it("invalid body returns 400", async () => {
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
    expect(json.status).toBe("error");
    expect(json.error_code).toBe("INVALID_ENVELOPE");
  });
});
