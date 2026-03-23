// Author: be-domain-modeler
import type Database from "better-sqlite3";
import type { ChorusEnvelope } from "../shared/types";

interface StoredMessage {
  readonly id: number;
  readonly trace_id: string;
  readonly sender_id: string;
  readonly receiver_id: string;
  readonly envelope: ChorusEnvelope;
  readonly delivered_via: "sse" | "webhook" | "queued";
  readonly timestamp: string;
}

interface MessageStore {
  readonly append: (msg: Omit<StoredMessage, "id" | "timestamp">) => StoredMessage;
  readonly listForAgent: (agentId: string, since?: string) => readonly StoredMessage[];
  readonly getStats: () => { total_stored: number };
}

const createMessageStore = (db: Database.Database): MessageStore => {
  const stmtInsert = db.prepare(`
    INSERT INTO messages (trace_id, sender_id, receiver_id, envelope, delivered_via, timestamp)
    VALUES (@trace_id, @sender_id, @receiver_id, @envelope, @delivered_via, @timestamp)
  `);

  const stmtListAll = db.prepare(`
    SELECT id, trace_id, sender_id, receiver_id, envelope, delivered_via, timestamp
    FROM messages
    WHERE receiver_id = ? OR sender_id = ?
    ORDER BY timestamp ASC, trace_id ASC
  `);

  const stmtListSince = db.prepare(`
    SELECT id, trace_id, sender_id, receiver_id, envelope, delivered_via, timestamp
    FROM messages
    WHERE (receiver_id = ? OR sender_id = ?) AND timestamp >= ?
    ORDER BY timestamp ASC, trace_id ASC
  `);

  const stmtCount = db.prepare("SELECT COUNT(*) as count FROM messages");

  const append = (msg: Omit<StoredMessage, "id" | "timestamp">): StoredMessage => {
    const timestamp = new Date().toISOString();
    const result = stmtInsert.run({
      trace_id: msg.trace_id,
      sender_id: msg.sender_id,
      receiver_id: msg.receiver_id,
      envelope: JSON.stringify(msg.envelope),
      delivered_via: msg.delivered_via,
      timestamp,
    });

    return {
      ...msg,
      id: Number(result.lastInsertRowid),
      timestamp,
    };
  };

  const listForAgent = (agentId: string, since?: string): readonly StoredMessage[] => {
    const rows = since === undefined
      ? stmtListAll.all(agentId, agentId) as MessageRow[]
      : stmtListSince.all(agentId, agentId, since) as MessageRow[];
    return rows.map(rowToMessage);
  };

  const getStats = () => ({
    total_stored: (stmtCount.get() as { count: number }).count,
  });

  return { append, listForAgent, getStats };
};

interface MessageRow {
  readonly id: number;
  readonly trace_id: string;
  readonly sender_id: string;
  readonly receiver_id: string;
  readonly envelope: string;
  readonly delivered_via: "sse" | "webhook" | "queued";
  readonly timestamp: string;
}

const rowToMessage = (row: MessageRow): StoredMessage => ({
  id: row.id,
  trace_id: row.trace_id,
  sender_id: row.sender_id,
  receiver_id: row.receiver_id,
  envelope: JSON.parse(row.envelope),
  delivered_via: row.delivered_via,
  timestamp: row.timestamp,
});

export { createMessageStore };
export type { StoredMessage, MessageStore };
