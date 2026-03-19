// Author: be-domain-modeler
import type OpenAI from "openai";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Module-level mocks — must be before imports
// ---------------------------------------------------------------------------

const mockExtractSemantic = jest.fn();
const mockExtractSemanticStream = jest.fn();
const mockCreateLLMClient = jest.fn();
jest.mock("../../src/agent/llm", () => ({
  createLLMClient: mockCreateLLMClient,
  extractSemantic: mockExtractSemantic,
  extractSemanticStream: mockExtractSemanticStream,
}));

const mockCreateReceiver = jest.fn();
jest.mock("../../src/agent/receiver", () => ({
  createReceiver: mockCreateReceiver,
}));

const mockServerClose = jest.fn();
const mockServe = jest.fn().mockReturnValue({ close: mockServerClose });
jest.mock("@hono/node-server", () => ({
  serve: mockServe,
}));

// Import after mocks are wired
import { parseArgs, validateEnv, startAgent } from "../../src/agent/index";
import { parseSSEChunks } from "../../src/shared/sse";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = (responses: Array<{ status: number; body: any; sseBody?: string }>) => {
  const spy = jest.spyOn(global, "fetch");
  for (const r of responses) {
    if (r.sseBody !== undefined) {
      // SSE streaming response mock
      const encoder = new TextEncoder();
      const encoded = encoder.encode(r.sseBody);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoded);
          controller.close();
        },
      });
      spy.mockResolvedValueOnce({
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        statusText: r.status === 200 ? "OK" : "Error",
        json: () => Promise.resolve(r.body),
        body: stream,
      } as Response);
    } else {
      spy.mockResolvedValueOnce({
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        statusText: r.status === 200 ? "OK" : "Error",
        json: () => Promise.resolve(r.body),
        body: null,
      } as unknown as Response);
    }
  }
  return spy;
};

const createStartedAgent = async (overrides?: Partial<{
  culture: string;
  port: number;
  agentId: string;
}>) => {
  const fetchSpy = mockFetch([
    // POST /agents — registration
    { status: 200, body: { success: true, data: { agent_id: overrides?.agentId ?? "agent-zh-CN-3001" } } },
    // GET /agents — discovery
    { status: 200, body: { data: [] } },
  ]);

  const config = {
    culture: overrides?.culture ?? "zh-CN",
    port: overrides?.port ?? 3001,
    routerUrl: "http://localhost:3000",
    agentId: overrides?.agentId ?? "agent-zh-CN-3001",
    languages: [overrides?.culture ?? "zh-CN"],
  };

  const handle = await startAgent(config);
  fetchSpy.mockRestore();
  return handle;
};

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe("parseArgs", () => {
  it("parses all arguments correctly", () => {
    const args = [
      "--culture", "zh-CN",
      "--port", "4000",
      "--router", "http://example.com:3000",
      "--agent-id", "my-agent",
      "--languages", "zh-CN,en-US",
    ];

    const config = parseArgs(args);

    expect(config.culture).toBe("zh-CN");
    expect(config.port).toBe(4000);
    expect(config.routerUrl).toBe("http://example.com:3000");
    expect(config.agentId).toBe("my-agent");
    expect(config.languages).toEqual(["zh-CN", "en-US"]);
  });

  it("uses defaults for optional arguments", () => {
    const config = parseArgs(["--culture", "ja"]);

    expect(config.culture).toBe("ja");
    expect(config.port).toBe(3001);
    expect(config.routerUrl).toBe("http://localhost:3000");
    expect(config.agentId).toBe("agent-ja-3001");
    expect(config.languages).toEqual(["ja"]);
  });

  it("throws when --culture is missing", () => {
    expect(() => parseArgs(["--port", "3001"])).toThrow("--culture is required");
  });
});

// ---------------------------------------------------------------------------
// validateEnv
// ---------------------------------------------------------------------------

describe("validateEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns apiKey when DASHSCOPE_API_KEY is set", () => {
    process.env.DASHSCOPE_API_KEY = "test-key-123";
    const result = validateEnv();
    expect(result.apiKey).toBe("test-key-123");
  });

  it("throws when DASHSCOPE_API_KEY is missing", () => {
    delete process.env.DASHSCOPE_API_KEY;
    expect(() => validateEnv()).toThrow("DASHSCOPE_API_KEY is required");
  });
});

// ---------------------------------------------------------------------------
// parseSSEChunks
// ---------------------------------------------------------------------------

describe("parseSSEChunks", () => {
  it("parses multiple SSE events", () => {
    const raw = "event: chunk\ndata: {\"text\":\"hello\"}\n\nevent: done\ndata: {\"full_text\":\"hello world\"}\n\n";
    const events = parseSSEChunks(raw);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ event: "chunk", data: "{\"text\":\"hello\"}" });
    expect(events[1]).toEqual({ event: "done", data: "{\"full_text\":\"hello world\"}" });
  });

  it("returns empty array for empty input", () => {
    expect(parseSSEChunks("")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// startAgent
// ---------------------------------------------------------------------------

describe("startAgent", () => {
  const fakeLLMClient = { fake: true } as unknown as OpenAI;
  const fakeApp = { fetch: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DASHSCOPE_API_KEY = "test-api-key";
    mockCreateLLMClient.mockReturnValue(fakeLLMClient);
    mockCreateReceiver.mockReturnValue({ app: fakeApp });
    mockServe.mockReturnValue({ close: mockServerClose });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("registers with router and discovers agents on startup", async () => {
    const fetchSpy = mockFetch([
      // POST /agents — registration
      { status: 200, body: { success: true, data: { agent_id: "agent-zh-CN-3001" } } },
      // GET /agents — discovery
      {
        status: 200,
        body: {
          data: [
            {
              agent_id: "agent-en-US-3002",
              endpoint: "http://localhost:3002/receive",
              agent_card: {
                chorus_version: "0.2",
                user_culture: "en-US",
                supported_languages: ["en-US", "zh-CN"],
              },
              registered_at: "2026-01-01T00:00:00Z",
            },
          ],
        },
      },
    ]);

    const config = {
      culture: "zh-CN",
      port: 3001,
      routerUrl: "http://localhost:3000",
      agentId: "agent-zh-CN-3001",
      languages: ["zh-CN", "en-US"],
    };

    const handle = await startAgent(config);

    // Verify POST /agents was called
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/agents",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );

    // Verify the registration body
    const postCall = fetchSpy.mock.calls[0];
    const postBody = JSON.parse(postCall[1]?.body as string);
    expect(postBody.agent_id).toBe("agent-zh-CN-3001");
    expect(postBody.agent_card.chorus_version).toBe("0.2");
    expect(postBody.agent_card.user_culture).toBe("zh-CN");

    // Verify GET /agents was called for discovery
    expect(fetchSpy).toHaveBeenCalledWith("http://localhost:3000/agents");

    expect(handle).toHaveProperty("shutdown");
    expect(handle).toHaveProperty("sendMessage");

    fetchSpy.mockRestore();
  });

  it("creates ConversationHistory and passes it to createReceiver", async () => {
    const fetchSpy = mockFetch([
      { status: 200, body: { success: true, data: {} } },
      { status: 200, body: { data: [] } },
    ]);

    const config = {
      culture: "zh-CN",
      port: 3001,
      routerUrl: "http://localhost:3000",
      agentId: "agent-zh-CN-3001",
      languages: ["zh-CN"],
    };

    await startAgent(config);

    // Verify createReceiver was called with a history object
    expect(mockCreateReceiver).toHaveBeenCalledWith(
      expect.objectContaining({
        history: expect.objectContaining({
          addTurn: expect.any(Function),
          getTurns: expect.any(Function),
          getConversationId: expect.any(Function),
          getNextTurnNumber: expect.any(Function),
        }),
      }),
    );

    fetchSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// sendMessage (via handle) — T-06 streaming + v0.3 envelope
// ---------------------------------------------------------------------------

describe("sendMessage (via AgentHandle)", () => {
  const fakeLLMClient = { fake: true } as unknown as OpenAI;
  const fakeApp = { fetch: jest.fn() };
  let stdoutSpy: jest.SpiedFunction<typeof process.stdout.write>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DASHSCOPE_API_KEY = "test-api-key";
    mockCreateLLMClient.mockReturnValue(fakeLLMClient);
    mockCreateReceiver.mockReturnValue({ app: fakeApp });
    mockServe.mockReturnValue({ close: mockServerClose });
    stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses extractSemanticStream and creates v0.3 envelope with conversation_id and turn_number", async () => {
    const handle = await createStartedAgent();

    mockExtractSemanticStream.mockResolvedValueOnce({
      original_semantic: "I want to meet",
      cultural_context: "Direct meeting request in Chinese culture",
    });

    const sseBody = "event: chunk\ndata: {\"text\":\"Meeting\"}\n\nevent: done\ndata: {\"full_text\":\"Meeting request\"}\n\n";

    const sendFetchSpy = mockFetch([
      { status: 200, body: {}, sseBody },
    ]);

    await handle.sendMessage("agent-en-US-3002", "Let's have a meeting");

    // Verify extractSemanticStream was called (not extractSemantic)
    expect(mockExtractSemanticStream).toHaveBeenCalledWith(
      fakeLLMClient,
      "Let's have a meeting",
      "zh-CN",
      expect.any(Function),
    );
    expect(mockExtractSemantic).not.toHaveBeenCalled();

    // Verify POST /messages was called with stream: true
    const postCall = sendFetchSpy.mock.calls[0];
    const postBody = JSON.parse(postCall[1]?.body as string);
    expect(postBody.stream).toBe(true);
    expect(postBody.sender_agent_id).toBe("agent-zh-CN-3001");
    expect(postBody.target_agent_id).toBe("agent-en-US-3002");

    // Verify envelope is v0.3 with conversation_id and turn_number
    const chorusPart = postBody.message.parts.find(
      (p: any) => p.mediaType === "application/vnd.chorus.envelope+json",
    );
    expect(chorusPart).toBeDefined();
    expect(chorusPart.data.chorus_version).toBe("0.3");
    expect(chorusPart.data.conversation_id).toBeDefined();
    expect(chorusPart.data.turn_number).toBe(1);

    sendFetchSpy.mockRestore();
  });

  it("increments turn_number on consecutive sends to same target", async () => {
    const handle = await createStartedAgent();

    // First message
    mockExtractSemanticStream.mockResolvedValueOnce({
      original_semantic: "hello",
    });

    const sseBody1 = "event: done\ndata: {\"full_text\":\"hi\"}\n\n";
    const fetchSpy1 = mockFetch([{ status: 200, body: {}, sseBody: sseBody1 }]);
    await handle.sendMessage("target-1", "hello");
    const body1 = JSON.parse(fetchSpy1.mock.calls[0][1]?.body as string);
    const part1 = body1.message.parts.find(
      (p: any) => p.mediaType === "application/vnd.chorus.envelope+json",
    );
    expect(part1.data.turn_number).toBe(1);
    const convId1 = part1.data.conversation_id;
    fetchSpy1.mockRestore();

    // Second message to same target
    mockExtractSemanticStream.mockResolvedValueOnce({
      original_semantic: "how are you",
    });

    const sseBody2 = "event: done\ndata: {\"full_text\":\"fine\"}\n\n";
    const fetchSpy2 = mockFetch([{ status: 200, body: {}, sseBody: sseBody2 }]);
    await handle.sendMessage("target-1", "how are you");
    const body2 = JSON.parse(fetchSpy2.mock.calls[0][1]?.body as string);
    const part2 = body2.message.parts.find(
      (p: any) => p.mediaType === "application/vnd.chorus.envelope+json",
    );
    expect(part2.data.turn_number).toBe(2);
    expect(part2.data.conversation_id).toBe(convId1);
    fetchSpy2.mockRestore();
  });

  it("records sent turn in history after sendMessage", async () => {
    const handle = await createStartedAgent();

    mockExtractSemanticStream.mockResolvedValueOnce({
      original_semantic: "test semantic",
    });

    const sseBody = "event: done\ndata: {\"full_text\":\"adapted test\"}\n\n";
    const sendSpy = mockFetch([{ status: 200, body: {}, sseBody }]);

    await handle.sendMessage("peer-1", "test input");

    // Access history through the receiver config that was passed
    const receiverCallArgs = mockCreateReceiver.mock.calls[0][0];
    const history = receiverCallArgs.history;

    const turns = history.getTurns("peer-1");
    expect(turns).toHaveLength(1);
    expect(turns[0].role).toBe("sent");
    expect(turns[0].originalText).toBe("test input");
    expect(turns[0].adaptedText).toBe("adapted test");

    sendSpy.mockRestore();
  });

  it("records received turn in history via onMessage callback", async () => {
    const handle = await createStartedAgent();

    // Get the onMessage callback from createReceiver call
    const receiverCallArgs = mockCreateReceiver.mock.calls[0][0];
    const onMessage = receiverCallArgs.onMessage;
    const history = receiverCallArgs.history;

    // Simulate receiving a message
    onMessage("sender-agent", "original text", "adapted text");

    const turns = history.getTurns("sender-agent");
    expect(turns).toHaveLength(1);
    expect(turns[0].role).toBe("received");
    expect(turns[0].originalText).toBe("original text");
    expect(turns[0].adaptedText).toBe("adapted text");
  });

  it("writes streaming SSE chunks to stdout", async () => {
    const handle = await createStartedAgent();

    mockExtractSemanticStream.mockResolvedValueOnce({
      original_semantic: "hello",
    });

    const sseBody =
      "event: chunk\ndata: {\"text\":\"Hello \"}\n\n" +
      "event: chunk\ndata: {\"text\":\"there \"}\n\n" +
      "event: chunk\ndata: {\"text\":\"friend\"}\n\n" +
      "event: done\ndata: {\"full_text\":\"Hello there friend\"}\n\n";

    const sendSpy = mockFetch([{ status: 200, body: {}, sseBody }]);

    await handle.sendMessage("target-a", "hi");

    // Verify process.stdout.write was called for each chunk
    const chunkWrites = stdoutSpy.mock.calls.filter(
      (call) => typeof call[0] === "string" && !call[0].startsWith("\n["),
    );
    expect(chunkWrites.length).toBeGreaterThanOrEqual(3);
    expect(chunkWrites.map((c) => c[0])).toEqual(
      expect.arrayContaining(["Hello ", "there ", "friend"]),
    );

    sendSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// shutdown (via handle)
// ---------------------------------------------------------------------------

describe("shutdown (via AgentHandle)", () => {
  const fakeLLMClient = { fake: true } as unknown as OpenAI;
  const fakeApp = { fetch: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DASHSCOPE_API_KEY = "test-api-key";
    mockCreateLLMClient.mockReturnValue(fakeLLMClient);
    mockCreateReceiver.mockReturnValue({ app: fakeApp });
    mockServe.mockReturnValue({ close: mockServerClose });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("deregisters from router and closes server", async () => {
    const fetchSpy = mockFetch([
      // POST /agents (registration)
      { status: 200, body: { success: true, data: {} } },
      // GET /agents (discovery)
      { status: 200, body: { data: [] } },
    ]);

    const config = {
      culture: "en-US",
      port: 3005,
      routerUrl: "http://localhost:3000",
      agentId: "agent-en-US-3005",
      languages: ["en-US"],
    };

    const handle = await startAgent(config);
    fetchSpy.mockRestore();

    // Now test shutdown
    const shutdownFetchSpy = mockFetch([
      // DELETE /agents/:id
      { status: 200, body: { success: true, data: {} } },
    ]);

    await handle.shutdown();

    // Verify DELETE was called
    expect(shutdownFetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/agents/agent-en-US-3005",
      expect.objectContaining({ method: "DELETE" }),
    );

    // Verify server was closed
    expect(mockServerClose).toHaveBeenCalled();

    shutdownFetchSpy.mockRestore();
  });
});
