// Author: be-api-router
import { createApp } from "../../src/server/routes";
import { AgentRegistry } from "../../src/server/registry";
import { createActivityStream } from "../../src/server/activity";
import { createInboxManager } from "../../src/server/inbox";
import { createMessageStore } from "../../src/server/message-store";
import { createTestDb } from "../helpers/test-db";
import type Database from "better-sqlite3";

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
    card_version: "0.3" as const,
    user_culture: "en-US",
    supported_languages: ["en"],
  },
};

const RECEIVER_AGENT = {
  id: "agent-beta@chorus.example",
  endpoint: "https://beta.example.com/receive",
  card: {
    card_version: "0.3" as const,
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
  let db: Database.Database;
  let app: ReturnType<typeof createApp>;
  let registry: AgentRegistry;
  let fetchSpy: jest.MockedFunction<typeof global.fetch>;

  beforeEach(() => {
    db = createTestDb();
    registry = new AgentRegistry(db);
    registry.register(SENDER_AGENT.id, SENDER_AGENT.endpoint, SENDER_AGENT.card);
    registry.register(RECEIVER_AGENT.id, RECEIVER_AGENT.endpoint, RECEIVER_AGENT.card);
    app = createApp(registry);

    fetchMock.mockClear();
    fetchSpy = fetchMock;
  });

  afterEach(() => {
    fetchMock.mockClear();
    db.close();
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

  it("returns 502 when receiver returns 400 (non-2xx is failure)", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "error", error_code: "INVALID_ENVELOPE" }), { status: 400 })
    );

    const res = await postMessage(validMessage);

    expect(res.status).toBe(502);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_AGENT_UNREACHABLE");
    expect(json.error.message).toContain("400");
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

// ---------------------------------------------------------------------------
// Store-and-forward: offline receiver gets queued delivery
// ---------------------------------------------------------------------------

describe("POST /messages (store-and-forward)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  const makeApp = () => {
    const registry = new AgentRegistry(db);
    const activity = createActivityStream(db);
    const inbox = createInboxManager();
    const messageStore = createMessageStore(db);
    return { registry, activity, inbox, messageStore, app: createApp(registry, undefined, activity, inbox, messageStore) };
  };

  const registerAgent = async (app: ReturnType<typeof createApp>, agentId: string, card: object) => {
    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: agentId, agent_card: card }),
      headers: { "Content-Type": "application/json" },
    });
    const json = (await res.json()) as { data: { api_key: string } };
    return json.data.api_key;
  };

  const CARD_EN = { card_version: "0.3", user_culture: "en", supported_languages: ["en"] };
  const CARD_ZH = { card_version: "0.3", user_culture: "zh-CN", supported_languages: ["zh-CN"] };

  it("queues message when receiver is offline (no SSE, no endpoint)", async () => {
    const { app } = makeApp();
    const senderKey = await registerAgent(app, "sender@hub", CARD_EN);
    await registerAgent(app, "receiver@hub", CARD_ZH);

    const res = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: { chorus_version: "0.4", sender_id: "sender@hub", original_text: "Are you there?", sender_culture: "en" },
      }),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${senderKey}` },
    });

    expect(res.status).toBe(202);
    const json: Json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.delivery).toBe("queued");
    expect(json.data.trace_id).toBeDefined();
  });

  it("queued message is retrievable via GET /agent/messages", async () => {
    const { app } = makeApp();
    const senderKey = await registerAgent(app, "sender@hub", CARD_EN);
    const receiverKey = await registerAgent(app, "receiver@hub", CARD_ZH);

    // Send while receiver is offline
    await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: { chorus_version: "0.4", sender_id: "sender@hub", original_text: "Queued hello", sender_culture: "en" },
      }),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${senderKey}` },
    });

    // Receiver polls
    const pollRes = await app.request("/agent/messages", {
      method: "GET",
      headers: { Authorization: `Bearer ${receiverKey}` },
    });

    expect(pollRes.status).toBe(200);
    const json: Json = await pollRes.json();
    expect(json.data.length).toBe(1);
    expect(json.data[0].envelope.original_text).toBe("Queued hello");
    expect(json.data[0].delivered_via).toBe("queued");
  });

  it("queued message is not re-delivered via SSE when receiver connects later", async () => {
    const { app, inbox } = makeApp();
    const senderKey = await registerAgent(app, "sender@hub", CARD_EN);
    const receiverKey = await registerAgent(app, "receiver@hub", CARD_ZH);

    // Send while offline → queued
    const queueRes = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: { chorus_version: "0.4", sender_id: "sender@hub", original_text: "First (queued)", sender_culture: "en" },
      }),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${senderKey}` },
    });
    const queuedTraceId = ((await queueRes.json()) as Json).data.trace_id;

    // Receiver connects SSE (simulate by opening inbox)
    const inboxRes = await app.request("/agent/inbox", {
      method: "GET",
      headers: { Authorization: `Bearer ${receiverKey}` },
    });
    // Give SSE connection a moment to establish
    await new Promise((r) => setTimeout(r, 50));

    // Send a NEW message while receiver is online → should be delivered_sse
    const liveRes = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: { chorus_version: "0.4", sender_id: "sender@hub", original_text: "Second (live)", sender_culture: "en" },
      }),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${senderKey}` },
    });

    expect(liveRes.status).toBe(200);
    const liveJson: Json = await liveRes.json();
    expect(liveJson.data.delivery).toBe("delivered_sse");

    // Poll: receiver sees both messages — queued + live, no duplicates
    const pollRes = await app.request("/agent/messages", {
      method: "GET",
      headers: { Authorization: `Bearer ${receiverKey}` },
    });
    const messages: Json = ((await pollRes.json()) as Json).data;
    expect(messages.length).toBe(2);
    expect(messages[0].delivered_via).toBe("queued");
    expect(messages[0].trace_id).toBe(queuedTraceId);
    expect(messages[1].delivered_via).toBe("sse");

    // Clean up SSE stream
    if (inboxRes.body) {
      try { await inboxRes.body.cancel(); } catch { /* ignore */ }
    }
  });

  it("sender also sees queued message in their own history", async () => {
    const { app } = makeApp();
    const senderKey = await registerAgent(app, "sender@hub", CARD_EN);
    await registerAgent(app, "receiver@hub", CARD_ZH);

    await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: { chorus_version: "0.4", sender_id: "sender@hub", original_text: "Check my outbox", sender_culture: "en" },
      }),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${senderKey}` },
    });

    const pollRes = await app.request("/agent/messages", {
      method: "GET",
      headers: { Authorization: `Bearer ${senderKey}` },
    });

    const json: Json = await pollRes.json();
    expect(json.data.length).toBe(1);
    expect(json.data[0].envelope.original_text).toBe("Check my outbox");
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
  let db: Database.Database;
  let app: ReturnType<typeof createApp>;
  let registry: AgentRegistry;
  let fetchSpy: jest.MockedFunction<typeof global.fetch>;

  const streamMessage = {
    ...validMessage,
    stream: true,
  };

  beforeEach(() => {
    db = createTestDb();
    registry = new AgentRegistry(db);
    registry.register(SENDER_AGENT.id, SENDER_AGENT.endpoint, SENDER_AGENT.card);
    registry.register(RECEIVER_AGENT.id, RECEIVER_AGENT.endpoint, RECEIVER_AGENT.card);
    app = createApp(registry);
    fetchMock.mockClear();
    fetchSpy = fetchMock;
  });

  afterEach(() => {
    fetchMock.mockClear();
    db.close();
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

// ---------------------------------------------------------------------------
// T-01: Hub transport contract — SSE timestamp + inclusive history
// ---------------------------------------------------------------------------

describe("T-01: SSE timestamp + inclusive history", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  const makeApp = () => {
    const registry = new AgentRegistry(db);
    const activity = createActivityStream(db);
    const inbox = createInboxManager();
    const messageStore = createMessageStore(db);
    return { registry, activity, inbox, messageStore, app: createApp(registry, undefined, activity, inbox, messageStore) };
  };

  const registerAgent = async (app: ReturnType<typeof createApp>, agentId: string, card: object) => {
    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: agentId, agent_card: card }),
      headers: { "Content-Type": "application/json" },
    });
    const json = (await res.json()) as { data: { api_key: string } };
    return json.data.api_key;
  };

  const CARD_EN = { card_version: "0.3", user_culture: "en", supported_languages: ["en"] };
  const CARD_ZH = { card_version: "0.3", user_culture: "zh-CN", supported_languages: ["zh-CN"] };

  it("test_sse_timestamp: SSE event contains timestamp field with valid ISO8601", async () => {
    const { app, inbox } = makeApp();
    const senderKey = await registerAgent(app, "sender@hub", CARD_EN);
    await registerAgent(app, "receiver@hub", CARD_ZH);

    // Use a mock controller to capture what inbox.deliver enqueues
    const enqueued: Uint8Array[] = [];
    const mockController = {
      enqueue: (chunk: Uint8Array) => { enqueued.push(chunk); },
      close: () => {},
    } as unknown as ReadableStreamDefaultController;
    inbox.connect("receiver@hub", mockController);

    // Send message via SSE
    const sendRes = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: { chorus_version: "0.4", sender_id: "sender@hub", original_text: "Timestamp check", sender_culture: "en" },
      }),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${senderKey}` },
    });

    expect(sendRes.status).toBe(200);
    const sendJson: Json = await sendRes.json();
    expect(sendJson.data.delivery).toBe("delivered_sse");

    // Decode the enqueued SSE frames
    const decoder = new TextDecoder();
    const sseText = enqueued.map((chunk) => decoder.decode(chunk)).join("");
    const events = parseSSEEvents(sseText);
    const messageEvents = events.filter((e) => e.event === "message");
    expect(messageEvents.length).toBe(1);

    const messageData = JSON.parse(messageEvents[0].data);
    expect(messageData.timestamp).toBeDefined();
    // Verify ISO8601 format
    expect(new Date(messageData.timestamp).toISOString()).toBe(messageData.timestamp);
    // Verify other fields still present
    expect(messageData.trace_id).toBeDefined();
    expect(messageData.sender_id).toBe("sender@hub");
    expect(messageData.envelope).toBeDefined();
  });

  it("test_inclusive_boundary: since=T returns messages with timestamp=T", async () => {
    const { app, messageStore } = makeApp();
    const senderKey = await registerAgent(app, "sender@hub", CARD_EN);
    const receiverKey = await registerAgent(app, "receiver@hub", CARD_ZH);

    // Send a message to create a stored record
    await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: { chorus_version: "0.4", sender_id: "sender@hub", original_text: "Boundary test", sender_culture: "en" },
      }),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${senderKey}` },
    });

    // Get the message to know its timestamp
    const pollRes = await app.request("/agent/messages", {
      method: "GET",
      headers: { Authorization: `Bearer ${receiverKey}` },
    });
    const pollJson: Json = await pollRes.json();
    expect(pollJson.data.length).toBe(1);
    const msgTimestamp = pollJson.data[0].timestamp;

    // Now query with since=exact_timestamp — should include the message (inclusive >=)
    const sinceRes = await app.request(`/agent/messages?since=${encodeURIComponent(msgTimestamp)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${receiverKey}` },
    });
    const sinceJson: Json = await sinceRes.json();
    expect(sinceJson.data.length).toBe(1);
    expect(sinceJson.data[0].envelope.original_text).toBe("Boundary test");
  });

  it("test_ordering: messages with same timestamp ordered by trace_id ASC", async () => {
    const { messageStore } = makeApp();

    // Directly insert messages with identical timestamps but different trace_ids
    const fixedTime = "2026-03-24T00:00:00.000Z";
    const insertStmt = db.prepare(`
      INSERT INTO messages (trace_id, sender_id, receiver_id, envelope, delivered_via, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run("zzz-trace", "sender@hub", "receiver@hub", JSON.stringify({ chorus_version: "0.4", sender_id: "sender@hub", original_text: "Z msg", sender_culture: "en" }), "queued", fixedTime);
    insertStmt.run("aaa-trace", "sender@hub", "receiver@hub", JSON.stringify({ chorus_version: "0.4", sender_id: "sender@hub", original_text: "A msg", sender_culture: "en" }), "queued", fixedTime);
    insertStmt.run("mmm-trace", "sender@hub", "receiver@hub", JSON.stringify({ chorus_version: "0.4", sender_id: "sender@hub", original_text: "M msg", sender_culture: "en" }), "queued", fixedTime);

    const messages = messageStore.listForAgent("receiver@hub", fixedTime);
    expect(messages.length).toBe(3);
    expect(messages[0].trace_id).toBe("aaa-trace");
    expect(messages[1].trace_id).toBe("mmm-trace");
    expect(messages[2].trace_id).toBe("zzz-trace");
  });

  it("test_timestamp_consistency: SSE timestamp matches stored message timestamp for same trace_id", async () => {
    const { app, inbox, messageStore } = makeApp();
    const senderKey = await registerAgent(app, "sender@hub", CARD_EN);
    const receiverKey = await registerAgent(app, "receiver@hub", CARD_ZH);

    // Capture SSE payload via mock controller
    const enqueued: Uint8Array[] = [];
    const mockController = {
      enqueue: (chunk: Uint8Array) => { enqueued.push(chunk); },
      close: () => {},
    } as unknown as ReadableStreamDefaultController;
    inbox.connect("receiver@hub", mockController);

    // Send message via SSE path
    const sendRes = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: { chorus_version: "0.4", sender_id: "sender@hub", original_text: "Timestamp consistency", sender_culture: "en" },
      }),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${senderKey}` },
    });

    expect(sendRes.status).toBe(200);
    const sendJson: Json = await sendRes.json();
    const traceId = sendJson.data.trace_id;

    // Extract SSE timestamp
    const decoder = new TextDecoder();
    const sseText = enqueued.map((chunk) => decoder.decode(chunk)).join("");
    const events = parseSSEEvents(sseText);
    const messageData = JSON.parse(events.filter((e) => e.event === "message")[0].data);
    const sseTimestamp = messageData.timestamp;

    // Extract stored message timestamp
    const stored = messageStore.listForAgent("receiver@hub");
    const match = stored.find((m) => m.trace_id === traceId);

    expect(match).toBeDefined();
    expect(match!.timestamp).toBe(sseTimestamp);
  });

  it("test_since_iso8601_validation: malformed since param returns 400", async () => {
    const { app } = makeApp();
    const receiverKey = await registerAgent(app, "receiver@hub", CARD_ZH);

    const res = await app.request("/agent/messages?since=not-a-date", {
      method: "GET",
      headers: { Authorization: `Bearer ${receiverKey}` },
    });

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_VALIDATION");
  });
});
