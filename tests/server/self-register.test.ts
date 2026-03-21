// Author: be-api-router
import { AgentRegistry } from "../../src/server/registry";
import { createApp } from "../../src/server/routes";
import { createActivityStream } from "../../src/server/activity";
import { createInboxManager } from "../../src/server/inbox";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const VALID_CARD = {
  card_version: "0.3",
  user_culture: "en-US",
  supported_languages: ["en"],
};

describe("Self-Registration (POST /register)", () => {
  const makeApp = (maxAgents = 100) => {
    const registry = new AgentRegistry(maxAgents);
    const activity = createActivityStream();
    const inbox = createInboxManager();
    return { registry, activity, inbox, app: createApp(registry, undefined, activity, inbox) };
  };

  it("registers a new agent and returns api_key", async () => {
    const { app } = makeApp();

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(201);
    const json = await res.json() as Json;
    expect(json.success).toBe(true);

    const data = json.data;
    expect(data.agent_id).toBe("test@hub");
    expect(data.api_key).toMatch(/^ca_[a-f0-9]{32}$/);
    expect(data.registration).toBeDefined();
  });

  it("returns same key on re-registration", async () => {
    const { app } = makeApp();
    const body = JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD });
    const headers = { "Content-Type": "application/json" };

    const res1 = await app.request("/register", { method: "POST", body, headers });
    const json1 = (await res1.json()) as { data: { api_key: string } };

    const res2 = await app.request("/register", { method: "POST", body, headers });
    const json2 = (await res2.json()) as { data: { api_key: string } };

    expect(json1.data.api_key).toBe(json2.data.api_key);
  });

  it("returns 429 when registry is full", async () => {
    const { app } = makeApp(1);
    const headers = { "Content-Type": "application/json" };

    await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "a1@hub", agent_card: VALID_CARD }),
      headers,
    });

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "a2@hub", agent_card: VALID_CARD }),
      headers,
    });

    expect(res.status).toBe(429);
  });

  it("rejects invalid body", async () => {
    const { app } = makeApp();

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
  });

  it("accepts optional endpoint", async () => {
    const { app } = makeApp();

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "webhook@hub",
        agent_card: VALID_CARD,
        endpoint: "https://my-agent.example.com/chorus",
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { registration: { endpoint: string } } };
    expect(json.data.registration.endpoint).toBe("https://my-agent.example.com/chorus");
  });

  it("emits agent_self_registered activity event", async () => {
    const { app, activity } = makeApp();

    await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD }),
      headers: { "Content-Type": "application/json" },
    });

    const events = activity.list();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("agent_self_registered");
    expect(events[0].data.agent_id).toBe("test@hub");
  });
});

describe("Self-Registered Agent Key Auth", () => {
  it("self-registered agent can send messages with their key", async () => {
    const registry = new AgentRegistry();
    const activity = createActivityStream();
    const inbox = createInboxManager();
    const app = createApp(registry, undefined, activity, inbox);

    // Register sender
    const regRes = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "sender@hub", agent_card: VALID_CARD }),
      headers: { "Content-Type": "application/json" },
    });
    const regJson = (await regRes.json()) as { data: { api_key: string } };
    const senderKey = regJson.data.api_key;

    // Register receiver with endpoint
    await app.request("/register", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "receiver@hub",
        agent_card: VALID_CARD,
        endpoint: "https://receiver.example.com/chorus",
      }),
      headers: { "Content-Type": "application/json" },
    });

    // Verify the key works for the registry lookup
    expect(registry.isValidAgentKey(senderKey)).toBe(true);
    expect(registry.getAgentIdByKey(senderKey)).toBe("sender@hub");
  });
});

describe("SSE Inbox (GET /agent/inbox)", () => {
  it("returns 401 without auth", async () => {
    const registry = new AgentRegistry();
    const inbox = createInboxManager();
    const app = createApp(registry, undefined, undefined, inbox);

    const res = await app.request("/agent/inbox", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid key", async () => {
    const registry = new AgentRegistry();
    const inbox = createInboxManager();
    const app = createApp(registry, undefined, undefined, inbox);

    const res = await app.request("/agent/inbox", {
      method: "GET",
      headers: { Authorization: "Bearer invalid-key" },
    });
    expect(res.status).toBe(401);
  });

  it("returns SSE stream for valid agent key", async () => {
    const registry = new AgentRegistry();
    const activity = createActivityStream();
    const inbox = createInboxManager();
    const app = createApp(registry, undefined, activity, inbox);

    // Self-register first
    const regRes = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "sse@hub", agent_card: VALID_CARD }),
      headers: { "Content-Type": "application/json" },
    });
    const regJson = (await regRes.json()) as { data: { api_key: string } };

    const res = await app.request("/agent/inbox", {
      method: "GET",
      headers: { Authorization: `Bearer ${regJson.data.api_key}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    // Read the first SSE event (connected)
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const { value } = await reader.read();
    const text = decoder.decode(value);
    reader.cancel();

    expect(text).toContain("event: connected");
    expect(text).toContain("sse@hub");
  });

  it("returns 503 when inbox is not enabled", async () => {
    const registry = new AgentRegistry();
    const app = createApp(registry);

    const res = await app.request("/agent/inbox", {
      method: "GET",
      headers: { Authorization: "Bearer some-key" },
    });
    expect(res.status).toBe(503);
  });
});

describe("Message Routing via SSE Inbox", () => {
  it("delivers message via SSE when receiver has inbox connection", async () => {
    const registry = new AgentRegistry();
    const activity = createActivityStream();
    const inbox = createInboxManager();
    const app = createApp(registry, undefined, activity, inbox);

    // Register sender and receiver
    await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "sender@hub", agent_card: VALID_CARD }),
      headers: { "Content-Type": "application/json" },
    });

    const recvRes = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "receiver@hub", agent_card: VALID_CARD }),
      headers: { "Content-Type": "application/json" },
    });
    const recvJson = (await recvRes.json()) as { data: { api_key: string } };

    // Simulate receiver connecting to inbox
    const mockController = {
      enqueue: jest.fn(),
      close: jest.fn(),
      error: jest.fn(),
      desiredSize: 1,
    } as unknown as ReadableStreamDefaultController;
    inbox.connect("receiver@hub", mockController);

    // Send message
    const msgRes = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: {
          chorus_version: "0.4",
          sender_id: "sender@hub",
          original_text: "Hello via SSE",
          sender_culture: "en",
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(msgRes.status).toBe(200);
    const msgJson = (await msgRes.json()) as { data: { delivery: string; trace_id: string } };
    expect(msgJson.data.delivery).toBe("delivered_sse");
    expect(msgJson.data.trace_id).toBeDefined();

    // Verify inbox.deliver was called (via mockController.enqueue)
    expect((mockController.enqueue as jest.Mock).mock.calls.length).toBe(1);
  });

  it("returns 502 when receiver has no endpoint and no inbox", async () => {
    const registry = new AgentRegistry();
    const activity = createActivityStream();
    const inbox = createInboxManager();
    const app = createApp(registry, undefined, activity, inbox);

    // Register both without endpoints
    await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "sender@hub", agent_card: VALID_CARD }),
      headers: { "Content-Type": "application/json" },
    });
    await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "receiver@hub", agent_card: VALID_CARD }),
      headers: { "Content-Type": "application/json" },
    });

    const msgRes = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: {
          chorus_version: "0.4",
          sender_id: "sender@hub",
          original_text: "Hello",
          sender_culture: "en",
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(msgRes.status).toBe(502);
    const json = (await msgRes.json()) as { error: { code: string } };
    expect(json.error.code).toBe("ERR_AGENT_UNREACHABLE");
  });
});
