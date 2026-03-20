// Author: be-domain-modeler
import type OpenAI from "openai";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Module-level mocks — must be before imports
// ---------------------------------------------------------------------------

const mockGenerateCulturalContext = jest.fn();
const mockCreateLLMClient = jest.fn();
jest.mock("../../src/agent/llm", () => ({
  createLLMClient: mockCreateLLMClient,
  generateCulturalContext: mockGenerateCulturalContext,
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

// Replace global.fetch with jest.fn() BEFORE any test runs.
// jest.spyOn(global, "fetch") would touch Node's native fetch, initializing
// undici's internal connection pool (keepAlive timers) that survive spy restore
// and prevent jest from exiting. Full replacement avoids this entirely.
const originalFetch = global.fetch;
const fetchMock = jest.fn() as jest.MockedFunction<typeof global.fetch>;
global.fetch = fetchMock;

afterAll(() => {
  global.fetch = originalFetch;
});

// Import after mocks are wired
import { parseArgs, validateEnv, startAgent } from "../../src/agent/index";
import { parseSSEChunks } from "../../src/shared/sse";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = (responses: Array<{ status: number; body: any; sseBody?: string }>) => {
  for (const r of responses) {
    if (r.sseBody !== undefined) {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(r.sseBody);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoded);
          controller.close();
        },
      });
      fetchMock.mockResolvedValueOnce({
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        statusText: r.status === 200 ? "OK" : "Error",
        json: () => Promise.resolve(r.body),
        body: stream,
      } as Response);
    } else {
      fetchMock.mockResolvedValueOnce({
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        statusText: r.status === 200 ? "OK" : "Error",
        json: () => Promise.resolve(r.body),
        body: null,
      } as unknown as Response);
    }
  }
  return fetchMock;
};

const createStartedAgent = async (overrides?: Partial<{
  culture: string;
  port: number;
  agentId: string;
}>) => {
  const defaultId = overrides?.agentId ?? "agent-zh-CN@localhost";
  const fetchSpy = mockFetch([
    // POST /agents — registration
    { status: 200, body: { success: true, data: { agent_id: defaultId } } },
    // GET /agents — discovery
    { status: 200, body: { data: [] } },
  ]);

  const config = {
    culture: overrides?.culture ?? "zh-CN",
    port: overrides?.port ?? 3001,
    routerUrl: "http://localhost:3000",
    agentId: defaultId,
    languages: [overrides?.culture ?? "zh-CN"],
  };

  const handle = await startAgent(config);
  fetchMock.mockClear();
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
      "--agent-id", "my-agent@example.com",
      "--languages", "zh-CN,en-US",
    ];

    const config = parseArgs(args);

    expect(config.culture).toBe("zh-CN");
    expect(config.port).toBe(4000);
    expect(config.routerUrl).toBe("http://example.com:3000");
    expect(config.agentId).toBe("my-agent@example.com");
    expect(config.languages).toEqual(["zh-CN", "en-US"]);
  });

  it("uses defaults for optional arguments with name@host format", () => {
    const config = parseArgs(["--culture", "ja"]);

    expect(config.culture).toBe("ja");
    expect(config.port).toBe(3001);
    expect(config.routerUrl).toBe("http://localhost:3000");
    expect(config.agentId).toBe("agent-ja@localhost");
    expect(config.languages).toEqual(["ja"]);
  });

  it("throws when --culture is missing", () => {
    expect(() => parseArgs(["--port", "3001"])).toThrow("--culture is required");
  });

  it("reads routerApiKey from CHORUS_ROUTER_API_KEY env var", () => {
    const prev = process.env["CHORUS_ROUTER_API_KEY"];
    process.env["CHORUS_ROUTER_API_KEY"] = "my-secret";
    const config = parseArgs(["--culture", "zh-CN"]);
    expect(config.routerApiKey).toBe("my-secret");
    if (prev === undefined) { delete process.env["CHORUS_ROUTER_API_KEY"]; } else { process.env["CHORUS_ROUTER_API_KEY"] = prev; }
  });

  it("leaves routerApiKey undefined when env var not set", () => {
    const prev = process.env["CHORUS_ROUTER_API_KEY"];
    delete process.env["CHORUS_ROUTER_API_KEY"];
    const config = parseArgs(["--culture", "zh-CN"]);
    expect(config.routerApiKey).toBeUndefined();
    if (prev !== undefined) { process.env["CHORUS_ROUTER_API_KEY"] = prev; }
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
      { status: 200, body: { success: true, data: { agent_id: "agent-zh-CN@localhost" } } },
      // GET /agents — discovery
      {
        status: 200,
        body: {
          data: [
            {
              agent_id: "agent-en-US@localhost",
              endpoint: "http://localhost:3002/receive",
              agent_card: {
                card_version: "0.3",
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
      agentId: "agent-zh-CN@localhost",
      languages: ["zh-CN", "en-US"],
    };

    const handle = await startAgent(config);


    // Verify POST /agents was called
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/agents",
      expect.objectContaining({
        method: "POST",
      }),
    );

    // Verify the registration body
    const postCall = fetchSpy.mock.calls[0];
    const postBody = JSON.parse(postCall[1]?.body as string);
    expect(postBody.agent_id).toBe("agent-zh-CN@localhost");
    expect(postBody.agent_card.card_version).toBe("0.3");
    expect(postBody.agent_card.user_culture).toBe("zh-CN");

    expect(handle).toHaveProperty("shutdown");
    expect(handle).toHaveProperty("sendMessage");

    fetchMock.mockClear();
  });

  it("sends Authorization header when routerApiKey is provided", async () => {
    const fetchSpy = mockFetch([
      { status: 200, body: { success: true, data: { agent_id: "agent-zh-CN@localhost" } } },
      { status: 200, body: { data: [] } },
    ]);

    const config = {
      culture: "zh-CN",
      port: 3001,
      routerUrl: "http://localhost:3000",
      agentId: "agent-zh-CN@localhost",
      languages: ["zh-CN"],
      routerApiKey: "test-router-key",
    };

    const handle = await startAgent(config);


    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/agents",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-router-key",
        }),
      }),
    );

    fetchMock.mockClear();
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
      agentId: "agent-zh-CN@localhost",
      languages: ["zh-CN"],
    };

    const handle = await startAgent(config);


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

    fetchMock.mockClear();
  });
});

// ---------------------------------------------------------------------------
// sendMessage (via handle) — v0.4 envelope
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

  it("creates v0.4 envelope with sender_id, original_text, conversation_id, and turn_number", async () => {
    const handle = await createStartedAgent();

    mockGenerateCulturalContext.mockResolvedValueOnce({
      cultural_context: "Direct meeting request in Chinese culture",
    });

    const sseBody = "event: chunk\ndata: {\"text\":\"Meeting\"}\n\nevent: done\ndata: {\"full_text\":\"Meeting request\"}\n\n";

    const sendFetchSpy = mockFetch([
      { status: 200, body: {}, sseBody },
    ]);

    await handle.sendMessage("agent-en-US@localhost", "Let's have a meeting");

    // Verify generateCulturalContext was called (not extractSemanticStream)
    expect(mockGenerateCulturalContext).toHaveBeenCalledWith(
      fakeLLMClient,
      "Let's have a meeting",
      "zh-CN",
      expect.any(Function),
    );

    // Verify POST /messages was called with v0.4 envelope format
    const postCall = sendFetchSpy.mock.calls[0];
    const postBody = JSON.parse(postCall[1]?.body as string);
    expect(postBody.stream).toBe(true);
    expect(postBody.receiver_id).toBe("agent-en-US@localhost");

    // Verify envelope is v0.4 with all required fields
    expect(postBody.envelope.chorus_version).toBe("0.4");
    expect(postBody.envelope.sender_id).toBe("agent-zh-CN@localhost");
    expect(postBody.envelope.original_text).toBe("Let's have a meeting");
    expect(postBody.envelope.sender_culture).toBe("zh-CN");
    expect(postBody.envelope.conversation_id).toBeDefined();
    expect(postBody.envelope.turn_number).toBe(1);

    fetchMock.mockClear();
  });

  it("increments turn_number on consecutive sends to same target", async () => {
    const handle = await createStartedAgent();

    // First message
    mockGenerateCulturalContext.mockResolvedValueOnce({});

    const sseBody1 = "event: done\ndata: {\"full_text\":\"hi\"}\n\n";
    const fetchSpy1 = mockFetch([{ status: 200, body: {}, sseBody: sseBody1 }]);
    await handle.sendMessage("target-1@host", "hello");
    const body1 = JSON.parse(fetchSpy1.mock.calls[0][1]?.body as string);
    expect(body1.envelope.turn_number).toBe(1);
    const convId1 = body1.envelope.conversation_id;
    fetchMock.mockClear();

    // Second message to same target
    mockGenerateCulturalContext.mockResolvedValueOnce({});

    const sseBody2 = "event: done\ndata: {\"full_text\":\"fine\"}\n\n";
    const fetchSpy2 = mockFetch([{ status: 200, body: {}, sseBody: sseBody2 }]);
    await handle.sendMessage("target-1@host", "how are you");
    const body2 = JSON.parse(fetchSpy2.mock.calls[0][1]?.body as string);
    expect(body2.envelope.turn_number).toBe(2);
    expect(body2.envelope.conversation_id).toBe(convId1);
    fetchMock.mockClear();
  });

  it("records sent turn in history after sendMessage", async () => {
    const handle = await createStartedAgent();

    mockGenerateCulturalContext.mockResolvedValueOnce({});

    const sseBody = "event: done\ndata: {\"full_text\":\"adapted test\"}\n\n";
    const sendSpy = mockFetch([{ status: 200, body: {}, sseBody }]);

    await handle.sendMessage("peer-1@host", "test input");

    const receiverCallArgs = mockCreateReceiver.mock.calls[0][0];
    const history = receiverCallArgs.history;

    const turns = history.getTurns("peer-1@host");
    expect(turns).toHaveLength(1);
    expect(turns[0].role).toBe("sent");
    expect(turns[0].originalText).toBe("test input");
    expect(turns[0].adaptedText).toBe("adapted test");

    fetchMock.mockClear();
  });

  it("records received turn in history via onMessage callback", async () => {
    await createStartedAgent();

    const receiverCallArgs = mockCreateReceiver.mock.calls[0][0];
    const onMessage = receiverCallArgs.onMessage;
    const history = receiverCallArgs.history;

    // Simulate receiving a message
    onMessage("sender@host", "original text", "adapted text");

    const turns = history.getTurns("sender@host");
    expect(turns).toHaveLength(1);
    expect(turns[0].role).toBe("received");
    expect(turns[0].originalText).toBe("original text");
    expect(turns[0].adaptedText).toBe("adapted text");
  });

  it("writes streaming SSE chunks to stdout", async () => {
    const handle = await createStartedAgent();

    mockGenerateCulturalContext.mockResolvedValueOnce({});

    const sseBody =
      "event: chunk\ndata: {\"text\":\"Hello \"}\n\n" +
      "event: chunk\ndata: {\"text\":\"there \"}\n\n" +
      "event: chunk\ndata: {\"text\":\"friend\"}\n\n" +
      "event: done\ndata: {\"full_text\":\"Hello there friend\"}\n\n";

    const sendSpy = mockFetch([{ status: 200, body: {}, sseBody }]);

    await handle.sendMessage("target-a@host", "hi");

    const chunkWrites = stdoutSpy.mock.calls.filter(
      (call) => typeof call[0] === "string" && !call[0].startsWith("\n["),
    );
    expect(chunkWrites.length).toBeGreaterThanOrEqual(3);
    expect(chunkWrites.map((c) => c[0])).toEqual(
      expect.arrayContaining(["Hello ", "there ", "friend"]),
    );

    fetchMock.mockClear();
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
      { status: 200, body: { success: true, data: {} } },
      { status: 200, body: { data: [] } },
    ]);

    const config = {
      culture: "en-US",
      port: 3005,
      routerUrl: "http://localhost:3000",
      agentId: "agent-en-US@localhost",
      languages: ["en-US"],
    };

    const handle = await startAgent(config);
    fetchMock.mockClear();

    const shutdownFetchSpy = mockFetch([
      { status: 200, body: { success: true, data: {} } },
    ]);

    await handle.shutdown();

    expect(shutdownFetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/agents/agent-en-US@localhost",
      expect.objectContaining({ method: "DELETE" }),
    );

    expect(mockServerClose).toHaveBeenCalled();

    fetchMock.mockClear();
  });

  it("sends Authorization header on deregister when routerApiKey is provided", async () => {
    const fetchSpy = mockFetch([
      { status: 200, body: { success: true, data: {} } },
      { status: 200, body: { data: [] } },
    ]);

    const config = {
      culture: "en-US",
      port: 3005,
      routerUrl: "http://localhost:3000",
      agentId: "agent-en-US@localhost",
      languages: ["en-US"],
      routerApiKey: "shutdown-key",
    };

    const handle = await startAgent(config);
    fetchMock.mockClear();

    const shutdownSpy = mockFetch([
      { status: 200, body: { success: true, data: {} } },
    ]);

    await handle.shutdown();

    expect(shutdownSpy).toHaveBeenCalledWith(
      "http://localhost:3000/agents/agent-en-US@localhost",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          Authorization: "Bearer shutdown-key",
        }),
      }),
    );

    fetchMock.mockClear();
  });
});
