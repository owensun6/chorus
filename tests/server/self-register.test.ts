// Author: be-api-router
import { createHash } from "crypto";
import { AgentRegistry } from "../../src/server/registry";
import { createApp } from "../../src/server/routes";
import { createActivityStream } from "../../src/server/activity";
import { createInboxManager } from "../../src/server/inbox";
import { createMessageStore } from "../../src/server/message-store";
import { createTestDb } from "../helpers/test-db";
import type Database from "better-sqlite3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const VALID_CARD = {
  card_version: "0.3",
  user_culture: "en-US",
  supported_languages: ["en"],
};

const hashCode = (code: string): string =>
  createHash("sha256").update(code).digest("hex");

const seedCodes = (db: Database.Database, codes: string[]) => {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO invite_codes (code_hash, label, created_at, max_uses)
     VALUES (?, 'test-seed', datetime('now'), NULL)`,
  );
  for (const code of codes) {
    stmt.run(hashCode(code));
  }
};

describe("Self-Registration (POST /register)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  const makeApp = (maxAgents = 100) => {
    const registry = new AgentRegistry(db, maxAgents);
    const activity = createActivityStream(db);
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

  it("rejects re-registration without auth (409)", async () => {
    const { app } = makeApp();
    const headers = { "Content-Type": "application/json" };
    const body = JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD });

    const res1 = await app.request("/register", { method: "POST", body, headers });
    expect(res1.status).toBe(201);

    const res2 = await app.request("/register", { method: "POST", body, headers });
    expect(res2.status).toBe(409);
    const json = (await res2.json()) as Json;
    expect(json.error.code).toBe("ERR_AGENT_ID_TAKEN");
  });

  it("rejects re-registration with wrong key (409)", async () => {
    const { app } = makeApp();
    const headers = { "Content-Type": "application/json" };
    const body = JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD });

    await app.request("/register", { method: "POST", body, headers });

    const res = await app.request("/register", {
      method: "POST",
      body,
      headers: { ...headers, Authorization: "Bearer ca_00000000000000000000000000000000" },
    });
    expect(res.status).toBe(409);
  });

  it("rotates key on re-registration with current key (200)", async () => {
    const { app, registry } = makeApp();
    const headers = { "Content-Type": "application/json" };
    const body = JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD });

    const res1 = await app.request("/register", { method: "POST", body, headers });
    const json1 = (await res1.json()) as { data: { api_key: string } };
    const key1 = json1.data.api_key;

    const res2 = await app.request("/register", {
      method: "POST",
      body,
      headers: { ...headers, Authorization: `Bearer ${key1}` },
    });
    expect(res2.status).toBe(200);
    const json2 = (await res2.json()) as { data: { api_key: string } };
    const key2 = json2.data.api_key;

    // New key works, old key doesn't
    expect(key1).not.toBe(key2);
    expect(registry.isValidAgentKey(key2)).toBe(true);
    expect(registry.isValidAgentKey(key1)).toBe(false);
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
    const db = createTestDb();
    const registry = new AgentRegistry(db);
    const activity = createActivityStream(db);
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
    const db = createTestDb();
    const registry = new AgentRegistry(db);
    const inbox = createInboxManager();
    const app = createApp(registry, undefined, undefined, inbox);

    const res = await app.request("/agent/inbox", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid key", async () => {
    const db = createTestDb();
    const registry = new AgentRegistry(db);
    const inbox = createInboxManager();
    const app = createApp(registry, undefined, undefined, inbox);

    const res = await app.request("/agent/inbox", {
      method: "GET",
      headers: { Authorization: "Bearer invalid-key" },
    });
    expect(res.status).toBe(401);
  });

  it("returns SSE stream for valid agent key", async () => {
    const db = createTestDb();
    const registry = new AgentRegistry(db);
    const activity = createActivityStream(db);
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
    const db = createTestDb();
    const registry = new AgentRegistry(db);
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
    const db = createTestDb();
    const registry = new AgentRegistry(db);
    const activity = createActivityStream(db);
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

  it("queues message when receiver has no endpoint and no inbox (store-and-forward)", async () => {
    const db = createTestDb();
    const registry = new AgentRegistry(db);
    const activity = createActivityStream(db);
    const inbox = createInboxManager();
    const messageStore = createMessageStore(db);
    const app = createApp(registry, undefined, activity, inbox, messageStore);

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

    expect(msgRes.status).toBe(202);
    const json = (await msgRes.json()) as { data: { delivery: string; trace_id: string } };
    expect(json.data.delivery).toBe("queued");
    expect(json.data.trace_id).toBeDefined();
  });
});

describe("Sender Identity Verification", () => {
  it("rejects message when sender_id does not match agent key", async () => {
    const db = createTestDb();
    const registry = new AgentRegistry(db);
    const activity = createActivityStream(db);
    const inbox = createInboxManager();
    const app = createApp(registry, undefined, activity, inbox);

    // Register two agents
    const aRes = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "agent-a@hub", agent_card: VALID_CARD }),
      headers: { "Content-Type": "application/json" },
    });
    const aKey = ((await aRes.json()) as { data: { api_key: string } }).data.api_key;

    await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "agent-b@hub", agent_card: VALID_CARD }),
      headers: { "Content-Type": "application/json" },
    });

    // Agent A tries to send as Agent B (impersonation)
    const msgRes = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "agent-b@hub",
        envelope: {
          chorus_version: "0.4",
          sender_id: "agent-b@hub",
          original_text: "I am pretending to be B",
          sender_culture: "en",
        },
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aKey}`,
      },
    });

    expect(msgRes.status).toBe(403);
    const json = (await msgRes.json()) as { error: { code: string } };
    expect(json.error.code).toBe("ERR_SENDER_MISMATCH");
  });

  it("allows message when sender_id matches agent key", async () => {
    const db = createTestDb();
    const registry = new AgentRegistry(db);
    const activity = createActivityStream(db);
    const inbox = createInboxManager();
    const app = createApp(registry, undefined, activity, inbox);

    // Register sender and receiver, connect receiver inbox
    const sRes = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "sender@hub", agent_card: VALID_CARD }),
      headers: { "Content-Type": "application/json" },
    });
    const sKey = ((await sRes.json()) as { data: { api_key: string } }).data.api_key;

    await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "receiver@hub", agent_card: VALID_CARD }),
      headers: { "Content-Type": "application/json" },
    });

    const mockCtrl = { enqueue: jest.fn(), close: jest.fn(), error: jest.fn(), desiredSize: 1 } as unknown as ReadableStreamDefaultController;
    inbox.connect("receiver@hub", mockCtrl);

    const msgRes = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: {
          chorus_version: "0.4",
          sender_id: "sender@hub",
          original_text: "Legit message",
          sender_culture: "en",
        },
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sKey}`,
      },
    });

    expect(msgRes.status).toBe(200);
  });
});

describe("Invite Code Gating (POST /register)", () => {
  const makeGatedApp = (codes: string[]) => {
    const db = createTestDb();
    seedCodes(db, codes);
    const registry = new AgentRegistry(db);
    const activity = createActivityStream(db);
    const inbox = createInboxManager();
    return { db, registry, activity, inbox, app: createApp(registry, undefined, activity, inbox) };
  };

  const headers = { "Content-Type": "application/json" };

  it("rejects without invite_code when gating enabled (403)", async () => {
    const { app } = makeGatedApp(["alpha-001"]);

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD }),
      headers,
    });

    expect(res.status).toBe(403);
    const json = (await res.json()) as Json;
    expect(json.error.code).toBe("ERR_INVITE_REQUIRED");
  });

  it("rejects with wrong invite_code (403)", async () => {
    const { app } = makeGatedApp(["alpha-001"]);

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD, invite_code: "wrong" }),
      headers,
    });

    expect(res.status).toBe(403);
  });

  it("accepts with valid invite_code (201)", async () => {
    const { app } = makeGatedApp(["alpha-001"]);

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD, invite_code: "alpha-001" }),
      headers,
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as Json;
    expect(json.data.api_key).toMatch(/^ca_[a-f0-9]{32}$/);
  });

  it("accepts any of multiple codes", async () => {
    const { app } = makeGatedApp(["code-a", "code-b"]);

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD, invite_code: "code-b" }),
      headers,
    });

    expect(res.status).toBe(201);
  });

  it("open when no invite codes in DB", async () => {
    const db = createTestDb();
    const registry = new AgentRegistry(db);
    const activity = createActivityStream(db);
    const inbox = createInboxManager();
    const app = createApp(registry, undefined, activity, inbox);

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD }),
      headers,
    });

    expect(res.status).toBe(201);
  });

  it("re-registration with invite code requires current key", async () => {
    const { app } = makeGatedApp(["alpha-001"]);
    const body = JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD, invite_code: "alpha-001" });

    const res1 = await app.request("/register", { method: "POST", body, headers });
    expect(res1.status).toBe(201);
    const key1 = ((await res1.json()) as { data: { api_key: string } }).data.api_key;

    // Without auth -> 409
    const res2 = await app.request("/register", { method: "POST", body, headers });
    expect(res2.status).toBe(409);

    // With current key -> 200
    const res3 = await app.request("/register", {
      method: "POST",
      body,
      headers: { ...headers, Authorization: `Bearer ${key1}` },
    });
    expect(res3.status).toBe(200);
  });

  it("increments use_count only on successful registration", async () => {
    const { app, db } = makeGatedApp(["alpha-001"]);

    // Successful registration
    await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "a@hub", agent_card: VALID_CARD, invite_code: "alpha-001" }),
      headers,
    });

    const row1 = db.prepare("SELECT use_count FROM invite_codes WHERE code_hash = ?").get(hashCode("alpha-001")) as { use_count: number };
    expect(row1.use_count).toBe(1);
  });

  it("does not increment use_count on failed ownership check", async () => {
    const { app, db } = makeGatedApp(["alpha-001"]);

    // First registration succeeds
    await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "a@hub", agent_card: VALID_CARD, invite_code: "alpha-001" }),
      headers,
    });

    // Re-registration without auth fails at ownership check
    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "a@hub", agent_card: VALID_CARD, invite_code: "alpha-001" }),
      headers,
    });
    expect(res.status).toBe(409);

    // use_count should still be 1 (transaction rolled back)
    const row = db.prepare("SELECT use_count FROM invite_codes WHERE code_hash = ?").get(hashCode("alpha-001")) as { use_count: number };
    expect(row.use_count).toBe(1);
  });

  it("rejects revoked invite code (403)", async () => {
    const { app, db } = makeGatedApp(["alpha-001"]);

    // Revoke the code
    db.prepare("UPDATE invite_codes SET revoked = 1 WHERE code_hash = ?").run(hashCode("alpha-001"));

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD, invite_code: "alpha-001" }),
      headers,
    });

    expect(res.status).toBe(403);
    const json = (await res.json()) as Json;
    expect(json.error.code).toBe("ERR_INVITE_REVOKED");
  });

  it("rejects exhausted invite code (403)", async () => {
    const { app, db } = makeGatedApp(["alpha-001"]);

    // Set max_uses = 1 and use_count = 1
    db.prepare("UPDATE invite_codes SET max_uses = 1, use_count = 1 WHERE code_hash = ?").run(hashCode("alpha-001"));

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD, invite_code: "alpha-001" }),
      headers,
    });

    expect(res.status).toBe(403);
    const json = (await res.json()) as Json;
    expect(json.error.code).toBe("ERR_INVITE_EXHAUSTED");
  });

  it("rejects expired invite code (403)", async () => {
    const { app, db } = makeGatedApp(["alpha-001"]);

    // Set expires_at to the past
    db.prepare("UPDATE invite_codes SET expires_at = '2020-01-01T00:00:00Z' WHERE code_hash = ?").run(hashCode("alpha-001"));

    const res = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD, invite_code: "alpha-001" }),
      headers,
    });

    expect(res.status).toBe(403);
    const json = (await res.json()) as Json;
    expect(json.error.code).toBe("ERR_INVITE_EXPIRED");
  });

  it("rotation succeeds without invite code when current key is valid", async () => {
    const { app } = makeGatedApp(["alpha-001"]);

    // First registration with invite code
    const res1 = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD, invite_code: "alpha-001" }),
      headers,
    });
    expect(res1.status).toBe(201);
    const key1 = ((await res1.json()) as { data: { api_key: string } }).data.api_key;

    // Rotation with current key and NO invite_code — must succeed
    const res2 = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD }),
      headers: { ...headers, Authorization: `Bearer ${key1}` },
    });
    expect(res2.status).toBe(200);
    const key2 = ((await res2.json()) as { data: { api_key: string } }).data.api_key;
    expect(key2).toMatch(/^ca_[a-f0-9]{32}$/);
    expect(key2).not.toBe(key1);
  });

  it("rotation does not consume invite use_count", async () => {
    const { app, db } = makeGatedApp(["alpha-001"]);

    // First registration with invite code
    const res1 = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD, invite_code: "alpha-001" }),
      headers,
    });
    const key1 = ((await res1.json()) as { data: { api_key: string } }).data.api_key;

    const row1 = db.prepare("SELECT use_count FROM invite_codes WHERE code_hash = ?").get(hashCode("alpha-001")) as { use_count: number };
    expect(row1.use_count).toBe(1);

    // Rotation with current key
    await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "test@hub", agent_card: VALID_CARD }),
      headers: { ...headers, Authorization: `Bearer ${key1}` },
    });

    // use_count must still be 1 — rotation does not consume invite capacity
    const row2 = db.prepare("SELECT use_count FROM invite_codes WHERE code_hash = ?").get(hashCode("alpha-001")) as { use_count: number };
    expect(row2.use_count).toBe(1);
  });
});
