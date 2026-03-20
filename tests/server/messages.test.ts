// Author: be-api-router
import { createApp } from "../../src/server/routes";
import { AgentRegistry } from "../../src/server/registry";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

// Replace global.fetch before any test touches it. jest.spyOn would
// initialize Node's undici connection pool (keepAlive timers) that
// survive spy restore and prevent jest from exiting.
const originalFetch = global.fetch;
const fetchMock = jest.fn() as jest.MockedFunction<typeof global.fetch>;
global.fetch = fetchMock;

afterAll(() => {
  global.fetch = originalFetch;
});

const SENDER_AGENT = {
  id: "agent-alpha@chorus.example",
  endpoint: "https://alpha.example.com/receive",
  card: {
    chorus_version: "0.2" as const,
    user_culture: "en-US",
    supported_languages: ["en"],
  },
};

const RECEIVER_AGENT = {
  id: "agent-beta@chorus.example",
  endpoint: "https://beta.example.com/receive",
  card: {
    chorus_version: "0.2" as const,
    user_culture: "zh-CN",
    supported_languages: ["zh-CN", "en"],
  },
};

const validEnvelope = {
  chorus_version: "0.4",
  sender_id: SENDER_AGENT.id,
  original_text: "Hello from alpha",
  sender_culture: "en-US",
};

const validMessage = {
  receiver_id: RECEIVER_AGENT.id,
  envelope: validEnvelope,
};

describe("POST /messages", () => {
  let app: ReturnType<typeof createApp>;
  let registry: AgentRegistry;
  let fetchSpy: jest.MockedFunction<typeof global.fetch>;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register(SENDER_AGENT.id, SENDER_AGENT.endpoint, SENDER_AGENT.card);
    registry.register(RECEIVER_AGENT.id, RECEIVER_AGENT.endpoint, RECEIVER_AGENT.card);
    app = createApp(registry);

    fetchMock.mockClear();
    fetchSpy = fetchMock;
  });

  afterEach(() => {
    fetchMock.mockClear();
  });

  const postMessage = (body: unknown) =>
    app.request("/messages", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

  it("forwards envelope to receiver and wraps response (test_case_1)", async () => {
    const receiverReply = { status: "ok" };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(receiverReply), { status: 200 })
    );

    const res = await postMessage(validMessage);

    expect(res.status).toBe(200);
    const json: Json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.delivery).toBe("delivered");
    expect(json.data.receiver_response).toEqual(receiverReply);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe(RECEIVER_AGENT.endpoint);
    expect(opts?.method).toBe("POST");
    const sentBody = JSON.parse(opts?.body as string);
    expect(sentBody.envelope).toEqual(validEnvelope);
  });

  it("returns 400 when sender is not registered (test_case_2)", async () => {
    const body = {
      receiver_id: RECEIVER_AGENT.id,
      envelope: { ...validEnvelope, sender_id: "unknown@host" },
    };

    const res = await postMessage(body);

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_SENDER_NOT_REGISTERED");
  });

  it("returns 404 when receiver is not registered (test_case_3)", async () => {
    const body = { ...validMessage, receiver_id: "unknown@host" };

    const res = await postMessage(body);

    expect(res.status).toBe(404);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_AGENT_NOT_FOUND");
  });

  it("returns 502 when receiver is unreachable (test_case_4)", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const res = await postMessage(validMessage);

    expect(res.status).toBe(502);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_AGENT_UNREACHABLE");
  });

  it("returns 200 with receiver error when receiver returns 400 (test_case_5)", async () => {
    const receiverError = { status: "error", error_code: "INVALID_ENVELOPE" };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(receiverError), { status: 400 })
    );

    const res = await postMessage(validMessage);

    expect(res.status).toBe(200);
    const json: Json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.delivery).toBe("delivered");
    expect(json.data.receiver_response).toEqual(receiverError);
  });

  it("returns 502 when receiver returns 500 (server error)", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 })
    );

    const res = await postMessage(validMessage);

    expect(res.status).toBe(502);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_AGENT_UNREACHABLE");
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await app.request("/messages", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_VALIDATION");
  });

  it("returns 400 when envelope is missing", async () => {
    const body = {
      receiver_id: RECEIVER_AGENT.id,
    };

    const res = await postMessage(body);

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_VALIDATION");
  });
});

describe("Server entry point (test_case_7)", () => {
  it("exports a valid app from index", async () => {
    const { app } = await import("../../src/server/index");
    expect(app).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Streaming forwarding tests
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

const makeMockSSEStream = (events: string): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(events));
      controller.close();
    },
  });
};

describe("POST /messages (streaming)", () => {
  let app: ReturnType<typeof createApp>;
  let registry: AgentRegistry;
  let fetchSpy: jest.MockedFunction<typeof global.fetch>;

  const streamMessage = {
    ...validMessage,
    stream: true,
  };

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register(SENDER_AGENT.id, SENDER_AGENT.endpoint, SENDER_AGENT.card);
    registry.register(RECEIVER_AGENT.id, RECEIVER_AGENT.endpoint, RECEIVER_AGENT.card);
    app = createApp(registry);
    fetchMock.mockClear();
    fetchSpy = fetchMock;
  });

  afterEach(() => {
    fetchMock.mockClear();
  });

  const postMessage = (body: unknown) =>
    app.request("/messages", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

  it("stream=true pipes SSE from receiver agent", async () => {
    const ssePayload =
      `event: chunk\ndata: {"text":"Hello"}\n\n` +
      `event: done\ndata: {"full_text":"Hello world"}\n\n`;

    fetchSpy.mockResolvedValueOnce(
      new Response(makeMockSSEStream(ssePayload), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const res = await postMessage(streamMessage);

    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    const text = await res.text();
    const events = parseSSEEvents(text);
    expect(events.some((e) => e.event === "chunk")).toBe(true);
    expect(events.some((e) => e.event === "done")).toBe(true);

    const [, opts] = fetchSpy.mock.calls[0];
    const headers = opts?.headers as Record<string, string>;
    expect(headers["Accept"]).toBe("text/event-stream");
  });

  it("stream=false returns JSON response", async () => {
    const receiverReply = { status: "ok" };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(receiverReply), { status: 200 }),
    );

    const res = await postMessage({ ...validMessage, stream: false });

    expect(res.status).toBe(200);
    const json: Json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.delivery).toBe("delivered");
  });

  it("stream=true with unreachable agent returns SSE error", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const res = await postMessage(streamMessage);

    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    const text = await res.text();
    const events = parseSSEEvents(text);

    const errorEvents = events.filter((e) => e.event === "error");
    expect(errorEvents.length).toBe(1);
    const errorData = JSON.parse(errorEvents[0].data);
    expect(errorData.code).toBe("ERR_AGENT_UNREACHABLE");
  });

  it("stream=true with agent 500 returns SSE error", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    );

    const res = await postMessage(streamMessage);

    const text = await res.text();
    const events = parseSSEEvents(text);
    const errorData = JSON.parse(events.filter((e) => e.event === "error")[0].data);
    expect(errorData.code).toBe("ERR_AGENT_UNREACHABLE");
  });

  it("validation error returns 400 JSON regardless of stream flag", async () => {
    const body = {
      // missing receiver_id and envelope
      stream: true,
    };

    const res = await postMessage(body);

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_VALIDATION");
  });
});
