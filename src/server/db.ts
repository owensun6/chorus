// Author: be-domain-modeler
import Database from "better-sqlite3";
import { createHash } from "crypto";

const SCHEMA_VERSION = 4;

const MIGRATIONS: readonly string[] = [
  // Version 1: initial schema (plaintext api_key — superseded by v2)
  `
  CREATE TABLE IF NOT EXISTS agents (
    agent_id TEXT PRIMARY KEY,
    endpoint TEXT,
    agent_card TEXT NOT NULL,
    registered_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    api_key TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL UNIQUE,
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    envelope TEXT NOT NULL,
    delivered_via TEXT NOT NULL CHECK (delivered_via IN ('sse', 'webhook')),
    timestamp TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, id);
  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, id);

  CREATE TABLE IF NOT EXISTS activity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
  );

  INSERT OR IGNORE INTO stats (key, value) VALUES ('messages_delivered', 0);
  INSERT OR IGNORE INTO stats (key, value) VALUES ('messages_queued', 0);
  INSERT OR IGNORE INTO stats (key, value) VALUES ('messages_failed', 0);
  `,

  // Version 2: hash api_keys (old plaintext keys cannot be migrated — agents must re-register)
  `
  DROP TABLE IF EXISTS api_keys;

  CREATE TABLE api_keys (
    api_key_hash TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL UNIQUE,
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE CASCADE
  );
  `,

  // Version 3: allow 'queued' in delivered_via for store-and-forward
  `
  CREATE TABLE messages_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    envelope TEXT NOT NULL,
    delivered_via TEXT NOT NULL CHECK (delivered_via IN ('sse', 'webhook', 'queued')),
    timestamp TEXT NOT NULL
  );

  INSERT INTO messages_new SELECT * FROM messages;
  DROP TABLE messages;
  ALTER TABLE messages_new RENAME TO messages;

  CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, id);
  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, id);

  INSERT OR IGNORE INTO stats (key, value) VALUES ('messages_queued', 0);
  `,

  // Version 4: invite codes table (DB-backed, replaces env-only gating)
  `
  CREATE TABLE IF NOT EXISTS invite_codes (
    code_hash  TEXT PRIMARY KEY,
    label      TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    max_uses   INTEGER,
    use_count  INTEGER NOT NULL DEFAULT 0,
    revoked    INTEGER NOT NULL DEFAULT 0
  );
  `,
];

const initDb = (dbPath: string): Database.Database => {
  const db = new Database(dbPath);

  // WAL mode: concurrent reads during SSE streaming
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  // Check current version
  db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
  const row = db.prepare("SELECT version FROM schema_version LIMIT 1").get() as
    | { version: number }
    | undefined;
  const currentVersion = row?.version ?? 0;

  // Run pending migrations
  if (currentVersion < SCHEMA_VERSION) {
    db.transaction(() => {
      for (let i = currentVersion; i < SCHEMA_VERSION; i++) {
        db.exec(MIGRATIONS[i]);
      }
      if (currentVersion === 0) {
        db.exec(`INSERT INTO schema_version (version) VALUES (${SCHEMA_VERSION})`);
      } else {
        db.exec(`UPDATE schema_version SET version = ${SCHEMA_VERSION}`);
      }
    })();
  }

  return db;
};

const seedInviteCodes = (db: Database.Database, codes: ReadonlySet<string>): void => {
  if (codes.size === 0) return;
  const hashCode = (code: string): string =>
    createHash("sha256").update(code).digest("hex");
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO invite_codes (code_hash, label, created_at, max_uses)
     VALUES (?, 'env-seed', datetime('now'), NULL)`,
  );
  const insertAll = db.transaction(() => {
    for (const code of codes) {
      stmt.run(hashCode(code));
    }
  });
  insertAll();
};

export { initDb, seedInviteCodes };
export type { Database };
