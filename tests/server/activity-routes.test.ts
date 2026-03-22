// Author: be-api-router
import { createApp } from "../../src/server/routes";
import { AgentRegistry } from "../../src/server/registry";
import { createActivityStream } from "../../src/server/activity";
import type { ActivityStream } from "../../src/server/activity";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const validAgent = {
  agent_id: "sender@test",
  endpoint: "https://sender.example.com/receive",
  agent_card: {
    card_version: "0.3" as const,
    user_culture: "zh-CN",
    supported_languages: ["zh-CN", "en"],
  },
};

const validReceiver = {
  agent_id: "receiver@test",
  endpoint: "https://receiver.example.com/receive",
  agent_card: {
    card_version: "0.3" as const,
    user_culture: "ja",
    supported_languages: ["ja"],
  },
};

const makeEnvelope = (senderId: string, receiverId: string) => ({
  chorus_version: "0.4",
  sender_id: senderId,
  original_text: "hello from test",
  sender_culture: "zh-CN",
});

const makeMessageBody = (senderId: string, receiverId: string) => ({
  receiver_id: receiverId,
  envelope: makeEnvelope(senderId, receiverId),
});

describe("Activity Routes", () => {
  let app: ReturnType<typeof createApp>;
  let registry: AgentRegistry;
  let activity: ActivityStream;

  beforeEach(() => {
    registry = new AgentRegistry();
    activity = createActivityStream();
    app = createApp(registry, undefined, activity);
  });

  describe("GET /activity", () => {
    it("returns empty array initially", async () => {
      const res = await app.request("/activity");
      expect(res.status).toBe(200);
      const json: Json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it("contains agent_registered after POST /agents", async () => {
      await app.request("/agents", {
        method: "POST",
        body: JSON.stringify(validAgent),
        headers: { "Content-Type": "application/json" },
      });

      const res = await app.request("/activity");
      const json: Json = await res.json();

      expect(json.data).toHaveLength(1);
      expect(json.data[0].type).toBe("agent_registered");
      expect(json.data[0].data.agent_id).toBe("sender@test");
      expect(json.data[0].data.culture).toBe("zh-CN");
    });

    it("contains agent_removed after DELETE /agents/:id", async () => {
      registry.register("a@test", "https://a.example.com", {
        card_version: "0.3",
        user_culture: "en",
        supported_languages: ["en"],
      });

      await app.request("/agents/a@test", { method: "DELETE" });

      const res = await app.request("/activity");
      const json: Json = await res.json();

      const removed = json.data.find((e: Json) => e.type === "agent_removed");
      expect(removed).toBeDefined();
      expect(removed.data.agent_id).toBe("a@test");
    });

    it("filters with ?since=N", async () => {
      activity.append("agent_registered", { agent_id: "a" });
      activity.append("agent_registered", { agent_id: "b" });
      activity.append("agent_registered", { agent_id: "c" });

      const res = await app.request("/activity?since=2");
      const json: Json = await res.json();

      expect(json.data).toHaveLength(1);
      expect(json.data[0].id).toBe(3);
    });
  });

  describe("GET /activity (no activity param)", () => {
    it("returns empty data when app created without activity", async () => {
      const appNoActivity = createApp(new AgentRegistry());
      const res = await appNoActivity.request("/activity");
      const json: Json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toEqual([]);
    });
  });

  describe("GET /events", () => {
    it("returns SSE content-type", async () => {
      const res = await app.request("/events");
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
      expect(res.headers.get("Cache-Control")).toBe("no-cache");
    });

    it("first event is connected", async () => {
      const res = await app.request("/events");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      const { value } = await reader.read();
      const text = decoder.decode(value);
      reader.cancel();

      expect(text).toContain("event: connected");
      expect(text).toContain("client_id");
    });
  });

  describe("GET /console", () => {
    it("returns 200 with text/html", async () => {
      const res = await app.request("/console");
      expect(res.status).toBe(200);
      const ct = res.headers.get("Content-Type");
      expect(ct).toContain("text/html");
    });
  });

  describe("Message event chain", () => {
    beforeEach(() => {
      registry.register(validAgent.agent_id, validAgent.endpoint, validAgent.agent_card);
      registry.register(validReceiver.agent_id, validReceiver.endpoint, validReceiver.agent_card);
    });

    it("produces submitted→forward→delivered on success", async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ reply: "ok" }),
      });

      try {
        await app.request("/messages", {
          method: "POST",
          body: JSON.stringify(makeMessageBody("sender@test", "receiver@test")),
          headers: { "Content-Type": "application/json" },
        });

        const events = activity.list();
        const types = events.map((e) => e.type);

        expect(types).toContain("message_submitted");
        expect(types).toContain("message_forward_started");
        expect(types).toContain("message_delivered");

        // Verify trace_id consistency
        const traceIds = events
          .filter((e) => e.type.startsWith("message_"))
          .map((e) => e.data.trace_id);
        const uniqueTraceIds = new Set(traceIds);
        expect(uniqueTraceIds.size).toBe(1);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("produces submitted→forward→failed on 5xx", async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        status: 500,
        json: async () => ({}),
      });

      try {
        await app.request("/messages", {
          method: "POST",
          body: JSON.stringify(makeMessageBody("sender@test", "receiver@test")),
          headers: { "Content-Type": "application/json" },
        });

        const events = activity.list();
        const types = events.map((e) => e.type);

        expect(types).toContain("message_submitted");
        expect(types).toContain("message_forward_started");
        expect(types).toContain("message_failed");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("produces submitted→forward→failed on fetch error", async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error("Connection refused"));

      try {
        await app.request("/messages", {
          method: "POST",
          body: JSON.stringify(makeMessageBody("sender@test", "receiver@test")),
          headers: { "Content-Type": "application/json" },
        });

        const events = activity.list();
        const types = events.map((e) => e.type);

        expect(types).toContain("message_submitted");
        expect(types).toContain("message_forward_started");
        expect(types).toContain("message_failed");

        const failed = events.find((e) => e.type === "message_failed");
        expect(failed?.data.error).toBe("Connection refused");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("trace_id is consistent across a message chain", async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ reply: "ok" }),
      });

      try {
        await app.request("/messages", {
          method: "POST",
          body: JSON.stringify(makeMessageBody("sender@test", "receiver@test")),
          headers: { "Content-Type": "application/json" },
        });

        const messageEvents = activity.list().filter((e) => e.type.startsWith("message_"));
        expect(messageEvents).toHaveLength(3);

        const traceId = messageEvents[0].data.trace_id;
        expect(traceId).toBeDefined();
        expect(messageEvents[1].data.trace_id).toBe(traceId);
        expect(messageEvents[2].data.trace_id).toBe(traceId);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
