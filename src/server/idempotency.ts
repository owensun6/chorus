// Author: be-api-router
import { createHash } from "crypto";
import type Database from "better-sqlite3";

interface IdempotencyRecord {
  readonly key: string;
  readonly payload_hash: string;
  readonly trace_id: string;
  readonly response: string;
  readonly created_at: string;
}

interface StoredResponse {
  readonly status: number;
  readonly body: unknown;
}

interface IdempotencyCheck {
  readonly kind: "new" | "replay" | "conflict";
  readonly record?: IdempotencyRecord;
}

interface IdempotencyStore {
  readonly check: (key: string, payloadHash: string) => IdempotencyCheck;
  readonly store: (key: string, payloadHash: string, traceId: string, response: StoredResponse) => void;
  readonly cleanup: (maxAgeMs: number) => number;
}

const computePayloadHash = (body: unknown): string =>
  createHash("sha256").update(JSON.stringify(body)).digest("hex");

const createIdempotencyStore = (db: Database.Database): IdempotencyStore => {
  const stmtGet = db.prepare(
    "SELECT key, payload_hash, trace_id, response, created_at FROM idempotency_keys WHERE key = ?",
  );

  const stmtInsert = db.prepare(
    "INSERT INTO idempotency_keys (key, payload_hash, trace_id, response, created_at) VALUES (?, ?, ?, ?, ?)",
  );

  const stmtCleanup = db.prepare(
    "DELETE FROM idempotency_keys WHERE created_at < ?",
  );

  const check = (key: string, payloadHash: string): IdempotencyCheck => {
    const row = stmtGet.get(key) as IdempotencyRecord | undefined;
    if (!row) {
      return { kind: "new" };
    }
    if (row.payload_hash === payloadHash) {
      return { kind: "replay", record: row };
    }
    return { kind: "conflict", record: row };
  };

  const store = (key: string, payloadHash: string, traceId: string, response: StoredResponse): void => {
    stmtInsert.run(key, payloadHash, traceId, JSON.stringify(response), new Date().toISOString());
  };

  const cleanup = (maxAgeMs: number): number => {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    const result = stmtCleanup.run(cutoff);
    return result.changes;
  };

  return { check, store, cleanup };
};

export { createIdempotencyStore, computePayloadHash };
export type { IdempotencyStore, IdempotencyCheck, IdempotencyRecord, StoredResponse };
