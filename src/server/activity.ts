// Author: be-domain-modeler
import type Database from "better-sqlite3";

type ActivityEventType =
  | "agent_registered"
  | "agent_self_registered"
  | "agent_removed"
  | "message_submitted"
  | "message_forward_started"
  | "message_delivered"
  | "message_delivered_sse"
  | "message_failed"
  | "message_queued";

interface ActivityEvent {
  readonly id: number;
  readonly type: ActivityEventType;
  readonly timestamp: string;
  readonly data: Readonly<Record<string, unknown>>;
}

type ActivitySubscriber = (event: ActivityEvent) => void;

interface ActivityStream {
  readonly append: (type: ActivityEventType, data: Record<string, unknown>) => ActivityEvent;
  readonly list: (since?: number) => readonly ActivityEvent[];
  readonly subscribe: (fn: ActivitySubscriber) => void;
  readonly unsubscribe: (fn: ActivitySubscriber) => void;
}

const createActivityStream = (db: Database.Database, maxEvents: number = 500): ActivityStream => {
  // In-memory pub/sub for real-time SSE — not persisted
  const subscribers = new Set<ActivitySubscriber>();

  const stmtInsert = db.prepare(`
    INSERT INTO activity_events (type, timestamp, data) VALUES (?, ?, ?)
  `);

  const stmtListAll = db.prepare(`
    SELECT id, type, timestamp, data FROM activity_events ORDER BY id DESC LIMIT ?
  `);

  const stmtListSince = db.prepare(`
    SELECT id, type, timestamp, data FROM activity_events WHERE id > ? ORDER BY id ASC
  `);

  const stmtTrim = db.prepare(`
    DELETE FROM activity_events WHERE id <= (
      SELECT id FROM activity_events ORDER BY id DESC LIMIT 1 OFFSET ?
    )
  `);

  const append = (type: ActivityEventType, data: Record<string, unknown>): ActivityEvent => {
    const timestamp = new Date().toISOString();
    const result = stmtInsert.run(type, timestamp, JSON.stringify(data));

    const event: ActivityEvent = Object.freeze({
      id: Number(result.lastInsertRowid),
      type,
      timestamp,
      data: Object.freeze({ ...data }),
    });

    // Trim old events beyond maxEvents
    stmtTrim.run(maxEvents);

    // Notify real-time subscribers (SSE)
    for (const subscriber of subscribers) {
      try {
        subscriber(event);
      } catch {
        // subscriber errors must not affect other subscribers
      }
    }

    return event;
  };

  const list = (since?: number): readonly ActivityEvent[] => {
    if (since !== undefined) {
      return (stmtListSince.all(since) as ActivityRow[]).map(rowToEvent);
    }
    // Return recent events in ascending order
    const rows = (stmtListAll.all(maxEvents) as ActivityRow[]).reverse();
    return rows.map(rowToEvent);
  };

  const subscribe = (fn: ActivitySubscriber): void => {
    subscribers.add(fn);
  };

  const unsubscribe = (fn: ActivitySubscriber): void => {
    subscribers.delete(fn);
  };

  return { append, list, subscribe, unsubscribe };
};

interface ActivityRow {
  readonly id: number;
  readonly type: string;
  readonly timestamp: string;
  readonly data: string;
}

const rowToEvent = (row: ActivityRow): ActivityEvent => Object.freeze({
  id: row.id,
  type: row.type as ActivityEventType,
  timestamp: row.timestamp,
  data: Object.freeze(JSON.parse(row.data)),
});

export { createActivityStream };
export type { ActivityEvent, ActivityEventType, ActivitySubscriber, ActivityStream };
