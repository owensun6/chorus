// Author: be-api-router
import { createApp } from "../../src/server/routes";
import { AgentRegistry } from "../../src/server/registry";
import { createActivityStream } from "../../src/server/activity";
import { createInboxManager } from "../../src/server/inbox";
import { createMessageStore } from "../../src/server/message-store";
import { createIdempotencyStore } from "../../src/server/idempotency";
import { createTestDb } from "../helpers/test-db";
import type Database from "better-sqlite3";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const originalFetch = global.fetch;
const fetchMock = jest.fn() as jest.MockedFunction<typeof global.fetch>;
global.fetch = fetchMock;

afterAll(() => {
  global.fetch = originalFetch;
});

const CARD_EN = { card_version: "0.3" as const, user_culture: "en", supported_languages: ["en"] };
const CARD_ZH = { card_version: "0.3" as const, user_culture: "zh-CN", supported_languages: ["zh-CN"] };

const makeEnvelope = (text: string) => ({
  chorus_version: "0.4",
  sender_id: "sender@hub",
  original_text: text,
  sender_culture: "en",
});

const makeApp = (db: Database.Database) => {
  const registry = new AgentRegistry(db);
  const activity = createActivityStream(db);
  const inbox = createInboxManager();
  const messageStore = createMessageStore(db);
  const idempotencyStore = createIdempotencyStore(db);
  const app = createApp(registry, undefined, activity, inbox, messageStore, idempotencyStore);
  return { registry, activity, inbox, messageStore, idempotencyStore, app };
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

// ---------------------------------------------------------------------------
// test_migration: db migration v5 creates idempotency_keys table
// ---------------------------------------------------------------------------

describe("Migration v5: idempotency_keys table", () => {
  it("creates idempotency_keys table with expected columns (test_migration)", () => {
    const db = createTestDb();
    const tableInfo = db.prepare("PRAGMA table_info(idempotency_keys)").all() as Array<{ name: string }>;
    const columnNames = tableInfo.map((c) => c.name);

    expect(columnNames).toContain("key");
    expect(columnNames).toContain("payload_hash");
    expect(columnNames).toContain("trace_id");
    expect(columnNames).toContain("response");
    expect(columnNames).toContain("created_at");

    db.close();
  });
});

// ---------------------------------------------------------------------------
// test_no_header: missing header -> normal processing
// ---------------------------------------------------------------------------

describe("POST /messages without Idempotency-Key", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    fetchMock.mockClear();
    db.close();
  });

  it("processes normally when no Idempotency-Key header is present (test_no_header)", async () => {
    const { app } = makeApp(db);
    await registerAgent(app, "sender@hub", CARD_EN);
    await registerAgent(app, "receiver@hub", CARD_ZH);

    const res = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: makeEnvelope("Hello without key"),
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(202);
    const json: Json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.trace_id).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// test_idempotent_replay: same key -> same response, no duplicate
// ---------------------------------------------------------------------------

describe("POST /messages with Idempotency-Key replay", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    fetchMock.mockClear();
    db.close();
  });

  it("returns stored response on replay with same key and payload (test_idempotent_replay)", async () => {
    const { app, messageStore } = makeApp(db);
    await registerAgent(app, "sender@hub", CARD_EN);
    await registerAgent(app, "receiver@hub", CARD_ZH);

    const envelope = makeEnvelope("Idempotent hello");
    const body = { receiver_id: "receiver@hub", envelope };
    const idempotencyKey = "KEY-REPLAY-001";

    // First request
    const res1 = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
    });

    expect(res1.status).toBe(202);
    const json1: Json = await res1.json();
    const traceId1 = json1.data.trace_id;

    // Second request — same key, same payload
    const res2 = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
    });

    const json2: Json = await res2.json();

    // Must return the ORIGINAL trace_id — no new message created
    expect(json2.data.trace_id).toBe(traceId1);

    // Message count should be 1, not 2
    const stats = messageStore.getStats();
    expect(stats.total_stored).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// test_conflict: same key, different payload_hash -> 409
// ---------------------------------------------------------------------------

describe("POST /messages with Idempotency-Key conflict", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    fetchMock.mockClear();
    db.close();
  });

  it("returns 409 when same key is used with different payload (test_conflict)", async () => {
    const { app } = makeApp(db);
    await registerAgent(app, "sender@hub", CARD_EN);
    await registerAgent(app, "receiver@hub", CARD_ZH);

    const idempotencyKey = "KEY-CONFLICT-001";

    // First request
    const res1 = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: makeEnvelope("First payload"),
      }),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
    });
    expect(res1.status).toBe(202);

    // Second request — same key, DIFFERENT payload
    const res2 = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: makeEnvelope("Different payload"),
      }),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
    });

    expect(res2.status).toBe(409);
    const json2: Json = await res2.json();
    expect(json2.success).toBe(false);
    expect(json2.error.code).toBe("ERR_IDEMPOTENCY_CONFLICT");
  });
});

// ---------------------------------------------------------------------------
// test_fail_closed: idempotency insert failure -> 503
// ---------------------------------------------------------------------------

describe("POST /messages idempotency fail-closed", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    fetchMock.mockClear();
    db.close();
  });

  it("returns 503 when idempotency table insert fails (test_fail_closed)", async () => {
    const { app } = makeApp(db);
    await registerAgent(app, "sender@hub", CARD_EN);
    await registerAgent(app, "receiver@hub", CARD_ZH);

    // Drop the idempotency_keys table to force insert failure
    db.prepare("DROP TABLE idempotency_keys").run();

    const res = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: makeEnvelope("Should fail closed"),
      }),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "KEY-FAIL-001",
      },
    });

    expect(res.status).toBe(503);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_IDEMPOTENCY_FAILED");
  });
});

// ---------------------------------------------------------------------------
// Input validation: Idempotency-Key header max length 256
// ---------------------------------------------------------------------------

describe("POST /messages Idempotency-Key validation", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    fetchMock.mockClear();
    db.close();
  });

  it("returns 400 when Idempotency-Key exceeds 256 characters", async () => {
    const { app } = makeApp(db);
    await registerAgent(app, "sender@hub", CARD_EN);
    await registerAgent(app, "receiver@hub", CARD_ZH);

    const longKey = "K".repeat(257);

    const res = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: makeEnvelope("Too long key"),
      }),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": longKey,
      },
    });

    expect(res.status).toBe(400);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
  });

  it("returns 503 when idempotency store fails on successful queued path (test_persist_fail_closed)", async () => {
    const { app, idempotencyStore } = makeApp(db);
    await registerAgent(app, "sender@hub", CARD_EN);
    await registerAgent(app, "receiver@hub", CARD_ZH);

    // Sabotage store() to throw on persist — check() still works (returns "new")
    const originalStore = idempotencyStore.store;
    (idempotencyStore as any).store = () => { throw new Error("disk full"); };

    const res = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: makeEnvelope("Persist should fail closed"),
      }),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "KEY-PERSIST-FAIL-001",
      },
    });

    expect(res.status).toBe(503);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_IDEMPOTENCY_PERSIST_FAILED");

    // Restore
    (idempotencyStore as any).store = originalStore;
  });

  it("returns 503 when idempotency store fails on successful SSE path (test_persist_fail_closed_sse)", async () => {
    const { app, idempotencyStore, inbox } = makeApp(db);
    await registerAgent(app, "sender@hub", CARD_EN);
    await registerAgent(app, "receiver@hub", CARD_ZH);

    // Connect receiver to SSE
    const mockController = {
      enqueue: () => {},
      close: () => {},
    } as unknown as ReadableStreamDefaultController;
    inbox.connect("receiver@hub", mockController);

    // Sabotage store() to throw on persist
    const originalStore = idempotencyStore.store;
    (idempotencyStore as any).store = () => { throw new Error("disk full"); };

    const res = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: makeEnvelope("SSE persist should fail closed"),
      }),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "KEY-PERSIST-FAIL-SSE-001",
      },
    });

    expect(res.status).toBe(503);
    const json: Json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ERR_IDEMPOTENCY_PERSIST_FAILED");

    // Restore
    (idempotencyStore as any).store = originalStore;
  });

  it("accepts Idempotency-Key of exactly 256 characters", async () => {
    const { app } = makeApp(db);
    await registerAgent(app, "sender@hub", CARD_EN);
    await registerAgent(app, "receiver@hub", CARD_ZH);

    const exactKey = "K".repeat(256);

    const res = await app.request("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: "receiver@hub",
        envelope: makeEnvelope("Exact length key"),
      }),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": exactKey,
      },
    });

    // Should succeed (202 for queued), not 400
    expect(res.status).toBe(202);
  });
});

// ---------------------------------------------------------------------------
// test_cleanup: cleanup purges expired keys
// ---------------------------------------------------------------------------

describe("Idempotency cleanup", () => {
  it("purges keys older than maxAgeMs and keeps recent ones", () => {
    const db = createTestDb();
    const store = createIdempotencyStore(db);

    // Insert a key with a timestamp 25 hours ago
    const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    db.prepare(
      "INSERT INTO idempotency_keys (key, payload_hash, trace_id, response, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("old-key", "hash1", "trace-old", "{}", oldTimestamp);

    // Insert a recent key via the store
    store.store("new-key", "hash2", "trace-new", { status: 200, body: {} });

    // Cleanup with 24-hour max age
    const deleted = store.cleanup(24 * 60 * 60 * 1000);
    expect(deleted).toBe(1);

    // Old key gone, new key remains
    const oldCheck = store.check("old-key", "hash1");
    expect(oldCheck.kind).toBe("new"); // gone

    const newCheck = store.check("new-key", "hash2");
    expect(newCheck.kind).toBe("replay"); // still there
  });
});
