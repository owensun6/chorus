// Author: be-domain-modeler
import { createMessageStore } from "../../src/server/message-store";
import { AgentRegistry } from "../../src/server/registry";
import { createApp } from "../../src/server/routes";
import { createActivityStream } from "../../src/server/activity";
import { createInboxManager } from "../../src/server/inbox";

const VALID_CARD = {
  card_version: "0.3" as const,
  user_culture: "en",
  supported_languages: ["en"],
};

describe("MessageStore", () => {
  it("stores and retrieves messages for receiver", () => {
    const store = createMessageStore();
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
    const store = createMessageStore();
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

  it("supports since filter", () => {
    const store = createMessageStore();
    store.append({ trace_id: "t1", sender_id: "a@hub", receiver_id: "b@hub", envelope: { chorus_version: "0.4", sender_id: "a@hub", original_text: "1", sender_culture: "en" }, delivered_via: "sse" });
    store.append({ trace_id: "t2", sender_id: "a@hub", receiver_id: "b@hub", envelope: { chorus_version: "0.4", sender_id: "a@hub", original_text: "2", sender_culture: "en" }, delivered_via: "sse" });
    store.append({ trace_id: "t3", sender_id: "a@hub", receiver_id: "b@hub", envelope: { chorus_version: "0.4", sender_id: "a@hub", original_text: "3", sender_culture: "en" }, delivered_via: "sse" });

    const since1 = store.listForAgent("b@hub", 1);
    expect(since1.length).toBe(2);
    expect(since1[0].trace_id).toBe("t2");
  });

  it("enforces per-agent max", () => {
    const store = createMessageStore(3);
    for (let i = 0; i < 5; i++) {
      store.append({ trace_id: `t${i}`, sender_id: "a@hub", receiver_id: "b@hub", envelope: { chorus_version: "0.4", sender_id: "a@hub", original_text: `msg${i}`, sender_culture: "en" }, delivered_via: "sse" });
    }

    const messages = store.listForAgent("b@hub");
    expect(messages.length).toBe(3);
    expect(messages[0].trace_id).toBe("t2");
  });

  it("returns empty array for unknown agent", () => {
    const store = createMessageStore();
    expect(store.listForAgent("nobody@hub")).toEqual([]);
  });

  it("tracks stats", () => {
    const store = createMessageStore();
    store.append({ trace_id: "t1", sender_id: "a@hub", receiver_id: "b@hub", envelope: { chorus_version: "0.4", sender_id: "a@hub", original_text: "hi", sender_culture: "en" }, delivered_via: "sse" });
    expect(store.getStats().total_stored).toBe(1);
  });
});

describe("GET /agent/messages", () => {
  const makeApp = () => {
    const registry = new AgentRegistry();
    const activity = createActivityStream();
    const inbox = createInboxManager();
    const messageStore = createMessageStore();
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

  it("supports since parameter", async () => {
    const { app, messageStore } = makeApp();

    const regRes = await app.request("/register", {
      method: "POST",
      body: JSON.stringify({ agent_id: "reader@hub", agent_card: VALID_CARD }),
      headers: { "Content-Type": "application/json" },
    });
    const key = ((await regRes.json()) as { data: { api_key: string } }).data.api_key;

    messageStore.append({ trace_id: "t1", sender_id: "x@hub", receiver_id: "reader@hub", envelope: { chorus_version: "0.4", sender_id: "x@hub", original_text: "1", sender_culture: "en" }, delivered_via: "sse" });
    messageStore.append({ trace_id: "t2", sender_id: "x@hub", receiver_id: "reader@hub", envelope: { chorus_version: "0.4", sender_id: "x@hub", original_text: "2", sender_culture: "en" }, delivered_via: "sse" });

    const res = await app.request("/agent/messages?since=1", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });

    const json = (await res.json()) as { data: Array<{ trace_id: string }> };
    expect(json.data.length).toBe(1);
    expect(json.data[0].trace_id).toBe("t2");
  });

  it("returns 503 when store not enabled", async () => {
    const registry = new AgentRegistry();
    const app = createApp(registry);

    const res = await app.request("/agent/messages", {
      method: "GET",
      headers: { Authorization: "Bearer some-key" },
    });
    expect(res.status).toBe(503);
  });
});
