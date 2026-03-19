// Author: be-domain-modeler
import type OpenAI from "openai";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Module-level mocks — must be before imports
// ---------------------------------------------------------------------------

const mockExtractSemantic = jest.fn();
const mockCreateLLMClient = jest.fn();
jest.mock("../../src/agent/llm", () => ({
  createLLMClient: mockCreateLLMClient,
  extractSemantic: mockExtractSemantic,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = (responses: Array<{ status: number; body: any }>) => {
  const spy = jest.spyOn(global, "fetch");
  for (const r of responses) {
    spy.mockResolvedValueOnce({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      statusText: r.status === 200 ? "OK" : "Error",
      json: () => Promise.resolve(r.body),
    } as Response);
  }
  return spy;
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
});

// ---------------------------------------------------------------------------
// sendMessage (via handle)
// ---------------------------------------------------------------------------

describe("sendMessage (via AgentHandle)", () => {
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

  it("extracts semantics, creates envelope, and POSTs to /messages", async () => {
    // Setup: start agent first
    const fetchSpy = mockFetch([
      // POST /agents (registration)
      { status: 200, body: { success: true, data: {} } },
      // GET /agents (discovery)
      { status: 200, body: { data: [] } },
    ]);

    const config = {
      culture: "zh-CN",
      port: 3001,
      routerUrl: "http://localhost:3000",
      agentId: "agent-zh-CN-3001",
      languages: ["zh-CN"],
    };

    const handle = await startAgent(config);
    fetchSpy.mockRestore();

    // Now test sendMessage
    mockExtractSemantic.mockResolvedValueOnce({
      original_semantic: "I want to meet",
      cultural_context: "Direct meeting request in Chinese culture",
      intent_type: "request",
      formality: "formal",
      emotional_tone: "polite",
    });

    const sendFetchSpy = mockFetch([
      // POST /messages
      { status: 200, body: { success: true, data: { delivered: true } } },
    ]);

    await handle.sendMessage("agent-en-US-3002", "Let's have a meeting");

    // Verify extractSemantic was called
    expect(mockExtractSemantic).toHaveBeenCalledWith(
      fakeLLMClient,
      "Let's have a meeting",
      "zh-CN",
    );

    // Verify POST /messages was called
    expect(sendFetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );

    // Verify the message body structure
    const postCall = sendFetchSpy.mock.calls[0];
    const postBody = JSON.parse(postCall[1]?.body as string);
    expect(postBody.sender_agent_id).toBe("agent-zh-CN-3001");
    expect(postBody.target_agent_id).toBe("agent-en-US-3002");
    expect(postBody.message).toHaveProperty("role", "ROLE_USER");
    expect(postBody.message.parts).toHaveLength(2);

    sendFetchSpy.mockRestore();
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
