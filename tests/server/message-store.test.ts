// Author: be-domain-modeler
import { createMessageStore } from "../../src/server/message-store";
import { AgentRegistry } from "../../src/server/registry";
import { createApp } from "../../src/server/routes";
import { createActivityStream } from "../../src/server/activity";
import { createInboxManager } from "../../src/server/inbox";
import { createTestDb } from "../helpers/test-db";
import type Database from "better-sqlite3";

const VALID_CARD = {
  card_version: "0.3" as const,
  user_culture: "en",
  supported_languages: ["en"],
};

describe("MessageStore", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("stores and retrieves messages for receiver", () => {
    const store = createMessageStore(db);
    store.append({
      trace_id: "t1",
      sender_id: "a@hub",
      receiver_id: "b@hub",
      envelope: { chorus_version: "0.4", sender_id: "a@hub", original_text: "hi", sender_culture: "en" },
      delivered_via: "sse",
    });

    const messages = store.listForAgent("b@hub");
    expect(messages.length).toBe(1);
    expect(messages[0].sender_id).toBe("a@hub");
    expect(messages[0].id).toBe(1);
  });

  it("stores for both sender and receiver", () => {
    const store = createMessageStore(db);
    store.append({
      trace_id: "t1",
      sender_id: "a@hub",
      receiver_id: "b@hub",
      envelope: { chorus_version: "0.4", sender_id: "a@hub", original_text: "hi", sender_culture: "en" },
      delivered_via: "sse",
    });

    expect(store.listForAgent("a@hub").length).toBe(1);
    expect(store.listForAgent("b@hub").length).toBe(1);
  });

  it("supports since filter with ISO8601 timestamp (inclusive >=)", () => {
    const store = createMessageStore(db);
    // Insert messages with controlled timestamps via direct DB insert
    const insertStmt = db.prepare(
      "INSERT INTO messages (trace_id, sender_id, receiver_id, envelope, delivered_via, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
    );
    insertStmt.run("t1", "a@hub", "b@hub", JSON.stringify({ chorus_version: "0.4", sender_id: "a@hub", original_text: "1", sender_culture: "en" }), "sse", "2026-01-01T00:00:00.000Z");
    insertStmt.run("t2", "a@hub", "b@hub", JSON.stringify({ chorus_version: "0.4", sender_id: "a@hub", original_text: "2", sender_culture: "en" }), "sse", "2026-01-02T00:00:00.000Z");
    insertStmt.run("t3", "a@hub", "b@hub", JSON.stringify({ chorus_version: "0.4", sender_id: "a@hub", original_text: "3", sender_culture: "en" }), "sse", "2026-01-03T00:00:00.000Z");

    // since is inclusive: >= "2026-01-02" should return t2 and t3
    const sinceJan2 = store.listForAgent("b@hub", "2026-01-02T00:00:00.000Z");
    expect(sinceJan2.length).toBe(2);
    expect(sinceJan2[0].trace_id).toBe("t2");
    expect(sinceJan2[1].trace_id).toBe("t3");
  });

  it("returns empty array for unknown agent", () => {
    const store = createMessageStore(db);
    expect(store.listForAgent("nobody@hub")).toEqual([]);
  });

  it("tracks stats", () => {
    const store = createMessageStore(db);
    store.append({ trace_id: "t1", sender_id: "a@hub", receiver_id: "b@hub", envelope: { chorus_version: "0.4", sender_id: "a@hub", original_text: "hi", sender_culture: "en" }, delivered_via: "sse" });
    expect(store.getStats().total_stored).toBe(1);
  });
});

describe("GET /agent/messages", () => {
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
    const app = createApp(registry, undefined, activity, inbox, messageStore);
    return { registry, activity, inbox, messageStore, app };
  };

  it("returns 401 without auth", async () => {
    const { app } = makeApp();
    const res = await app.request("/agent/messages", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns messages for authenticated agent", async () => {
    const { app, messageStore } = makeApp();

    // Register agent
    const regRes = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "reader@hub", agent_card: VALID_CARD }),
      headers: { "Content-Type": "application/json" },
    });
    const key = ((await regRes.json()) as { data: { api_key: string } }).data.api_key;

    // Insert a message directly
    messageStore.append({
      trace_id: "t1",
      sender_id: "other@hub",
      receiver_id: "reader@hub",
      envelope: { chorus_version: "0.4", sender_id: "other@hub", original_text: "hello", sender_culture: "en" },
      delivered_via: "sse",
    });

    const res = await app.request("/agent/messages", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: Array<{ trace_id: string }> };
    expect(json.data.length).toBe(1);
    expect(json.data[0].trace_id).toBe("t1");
  });

  it("supports since parameter (ISO8601 timestamp, inclusive)", async () => {
    const { app } = makeApp();

    const regRes = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "reader@hub", agent_card: VALID_CARD }),
      headers: { "Content-Type": "application/json" },
    });
    const key = ((await regRes.json()) as { data: { api_key: string } }).data.api_key;

    // Insert messages with controlled timestamps
    const insertStmt = db.prepare(
      "INSERT INTO messages (trace_id, sender_id, receiver_id, envelope, delivered_via, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
    );
    insertStmt.run("t1", "x@hub", "reader@hub", JSON.stringify({ chorus_version: "0.4", sender_id: "x@hub", original_text: "1", sender_culture: "en" }), "sse", "2026-01-01T00:00:00.000Z");
    insertStmt.run("t2", "x@hub", "reader@hub", JSON.stringify({ chorus_version: "0.4", sender_id: "x@hub", original_text: "2", sender_culture: "en" }), "sse", "2026-01-02T00:00:00.000Z");

    const res = await app.request(`/agent/messages?since=${encodeURIComponent("2026-01-02T00:00:00.000Z")}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });

    const json = (await res.json()) as { data: Array<{ trace_id: string }> };
    // Inclusive >= : only t2 has timestamp >= 2026-01-02
    expect(json.data.length).toBe(1);
    expect(json.data[0].trace_id).toBe("t2");
  });

  it("returns 503 when store not enabled", async () => {
    const registry = new AgentRegistry(db);
    const app = createApp(registry);

    const res = await app.request("/agent/messages", {
      method: "GET",
      headers: { Authorization: "Bearer some-key" },
    });
    expect(res.status).toBe(503);
  });
});
