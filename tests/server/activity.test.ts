// Author: be-domain-modeler
import { createActivityStream } from "../../src/server/activity";
import type { ActivityEvent, ActivitySubscriber } from "../../src/server/activity";
import { createTestDb } from "../helpers/test-db";
import type Database from "better-sqlite3";

describe("ActivityStream", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  describe("append", () => {
    it("returns auto-incrementing IDs starting from 1", () => {
      const stream = createActivityStream(db);
      const e1 = stream.append("agent_registered", { agent_id: "a" });
      const e2 = stream.append("agent_registered", { agent_id: "b" });
      const e3 = stream.append("message_submitted", { trace_id: "t1" });

      expect(e1.id).toBe(1);
      expect(e2.id).toBe(2);
      expect(e3.id).toBe(3);
    });

    it("returns correct type, timestamp (ISO), and data", () => {
      const stream = createActivityStream(db);
      const event = stream.append("message_delivered", { trace_id: "t1", status: 200 });

      expect(event.type).toBe("message_delivered");
      expect(event.data).toEqual({ trace_id: "t1", status: 200 });
      expect(() => new Date(event.timestamp).toISOString()).not.toThrow();
    });

    it("creates immutable event data (spread copy)", () => {
      const stream = createActivityStream(db);
      const originalData = { agent_id: "a", extra: "value" };
      const event = stream.append("agent_registered", originalData);

      // Mutating original should not affect stored event
      originalData.agent_id = "mutated";

      const listed = stream.list();
      expect(listed[0].data.agent_id).toBe("a");
      expect(event.data.agent_id).toBe("a");
    });
  });

  describe("list", () => {
    it("returns all events when called without arguments", () => {
      const stream = createActivityStream(db);
      stream.append("agent_registered", { agent_id: "a" });
      stream.append("agent_registered", { agent_id: "b" });
      stream.append("message_submitted", { trace_id: "t1" });

      const events = stream.list();
      expect(events).toHaveLength(3);
      expect(events[0].id).toBe(1);
      expect(events[2].id).toBe(3);
    });

    it("filters events with since parameter (id > since)", () => {
      const stream = createActivityStream(db);
      stream.append("agent_registered", { agent_id: "a" });
      stream.append("agent_registered", { agent_id: "b" });
      stream.append("message_submitted", { trace_id: "t1" });
      stream.append("message_delivered", { trace_id: "t1" });
      stream.append("message_failed", { trace_id: "t2" });

      const events = stream.list(3);
      expect(events).toHaveLength(2);
      expect(events[0].id).toBe(4);
      expect(events[1].id).toBe(5);
    });

    it("returns empty array for empty stream", () => {
      const stream = createActivityStream(db);
      expect(stream.list()).toEqual([]);
    });

    it("returns a new array each time", () => {
      const stream = createActivityStream(db);
      stream.append("agent_registered", { agent_id: "a" });

      const list1 = stream.list();
      const list2 = stream.list();
      expect(list1).not.toBe(list2);
      expect(list1).toEqual(list2);
    });
  });

  describe("event trimming (max events)", () => {
    it("retains only maxEvents most recent events", () => {
      const stream = createActivityStream(db, 500);

      for (let i = 0; i < 502; i++) {
        stream.append("message_submitted", { index: i });
      }

      const events = stream.list();
      expect(events).toHaveLength(500);
      // First two events (id 1, 2) should be evicted
      expect(events[0].id).toBe(3);
      expect(events[events.length - 1].id).toBe(502);
    });

    it("works with small buffer size", () => {
      const stream = createActivityStream(db, 3);

      stream.append("agent_registered", { agent_id: "a" });
      stream.append("agent_registered", { agent_id: "b" });
      stream.append("agent_registered", { agent_id: "c" });
      stream.append("agent_registered", { agent_id: "d" });

      const events = stream.list();
      expect(events).toHaveLength(3);
      expect(events[0].id).toBe(2);
      expect(events[0].data.agent_id).toBe("b");
    });
  });

  describe("subscribe / unsubscribe", () => {
    it("subscriber receives new events", () => {
      const stream = createActivityStream(db);
      const received: ActivityEvent[] = [];
      const subscriber: ActivitySubscriber = (e) => received.push(e);

      stream.subscribe(subscriber);
      stream.append("agent_registered", { agent_id: "a" });
      stream.append("message_submitted", { trace_id: "t1" });

      expect(received).toHaveLength(2);
      expect(received[0].type).toBe("agent_registered");
      expect(received[1].type).toBe("message_submitted");
    });

    it("unsubscribe stops receiving events", () => {
      const stream = createActivityStream(db);
      const received: ActivityEvent[] = [];
      const subscriber: ActivitySubscriber = (e) => received.push(e);

      stream.subscribe(subscriber);
      stream.append("agent_registered", { agent_id: "a" });
      stream.unsubscribe(subscriber);
      stream.append("agent_registered", { agent_id: "b" });

      expect(received).toHaveLength(1);
    });

    it("all subscribers receive events", () => {
      const stream = createActivityStream(db);
      const received1: ActivityEvent[] = [];
      const received2: ActivityEvent[] = [];
      const received3: ActivityEvent[] = [];

      stream.subscribe((e) => received1.push(e));
      stream.subscribe((e) => received2.push(e));
      stream.subscribe((e) => received3.push(e));

      stream.append("agent_registered", { agent_id: "a" });

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
      expect(received3).toHaveLength(1);
    });

    it("subscriber error does not affect other subscribers", () => {
      const stream = createActivityStream(db);
      const received: ActivityEvent[] = [];

      stream.subscribe(() => { throw new Error("boom"); });
      stream.subscribe((e) => received.push(e));

      stream.append("agent_registered", { agent_id: "a" });

      expect(received).toHaveLength(1);
      expect(received[0].data.agent_id).toBe("a");
    });
  });
});
