// Author: be-domain-modeler
import Database from "better-sqlite3";
import { initDb } from "../../src/server/db";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Schema Migration (v1 → v4)", () => {
  const tmpDirs: string[] = [];

  const createTmpDbPath = (): string => {
    const dir = mkdtempSync(join(tmpdir(), "chorus-test-"));
    tmpDirs.push(dir);
    return join(dir, "test.db");
  };

  afterAll(() => {
    for (const dir of tmpDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("initDb upgrades a v1 database: drops plaintext api_keys, creates api_key_hash table", () => {
    const dbPath = createTmpDbPath();

    // Seed a v1 database with the OLD schema (api_key column, not api_key_hash)
    const seedDb = new Database(dbPath);
    seedDb.pragma("journal_mode = WAL");
    seedDb.pragma("foreign_keys = ON");
    seedDb.exec(`
      CREATE TABLE schema_version (version INTEGER NOT NULL);
      INSERT INTO schema_version (version) VALUES (1);

      CREATE TABLE agents (
        agent_id TEXT PRIMARY KEY,
        endpoint TEXT,
        agent_card TEXT NOT NULL,
        registered_at TEXT NOT NULL
      );

      CREATE TABLE api_keys (
        api_key TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL UNIQUE,
        FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE CASCADE
      );

      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trace_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        envelope TEXT NOT NULL,
        delivered_via TEXT NOT NULL CHECK (delivered_via IN ('sse', 'webhook')),
        timestamp TEXT NOT NULL
      );

      CREATE TABLE activity_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE stats (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO stats (key, value) VALUES ('messages_delivered', 0);
      INSERT INTO stats (key, value) VALUES ('messages_failed', 0);

      INSERT INTO agents (agent_id, endpoint, agent_card, registered_at)
        VALUES ('old@hub', NULL, '{"card_version":"0.3"}', '2026-01-01T00:00:00Z');
      INSERT INTO api_keys (api_key, agent_id) VALUES ('ca_plaintext123', 'old@hub');
    `);
    seedDb.close();

    // Open via initDb — should detect v1 and run migration to v2
    const db = initDb(dbPath);

    // api_keys table now has api_key_hash column
    const cols = db.pragma("table_info(api_keys)") as Array<{ name: string }>;
    const colNames = cols.map((c) => c.name);
    expect(colNames).toContain("api_key_hash");
    expect(colNames).not.toContain("api_key");

    // Old plaintext key row is gone (DROP TABLE wiped it)
    const rows = db.prepare("SELECT * FROM api_keys").all();
    expect(rows).toHaveLength(0);

    // Agent data survived the migration
    const agent = db.prepare("SELECT agent_id FROM agents WHERE agent_id = ?").get("old@hub");
    expect(agent).toBeDefined();

    // Schema version is now 4
    const ver = db.prepare("SELECT version FROM schema_version").get() as { version: number };
    expect(ver.version).toBe(4);

    // invite_codes table exists (v4 migration)
    const inviteCols = db.pragma("table_info(invite_codes)") as Array<{ name: string }>;
    expect(inviteCols.map((c) => c.name)).toContain("code_hash");

    // messages table accepts 'queued' in delivered_via (v3 migration)
    db.prepare("INSERT INTO messages (trace_id, sender_id, receiver_id, envelope, delivered_via, timestamp) VALUES ('t1', 'a@hub', 'b@hub', '{}', 'queued', '2026-01-01')").run();
    const msg = db.prepare("SELECT delivered_via FROM messages WHERE trace_id = 't1'").get() as { delivered_via: string };
    expect(msg.delivered_via).toBe("queued");

    db.close();
  });

  it("fresh database starts at version 4 with api_key_hash, queued support, and invite_codes", () => {
    const db = initDb(":memory:");

    const ver = db.prepare("SELECT version FROM schema_version").get() as { version: number };
    expect(ver.version).toBe(4);

    const cols = db.pragma("table_info(api_keys)") as Array<{ name: string }>;
    const colNames = cols.map((c) => c.name);
    expect(colNames).toContain("api_key_hash");
    expect(colNames).not.toContain("api_key");

    const inviteCols = db.pragma("table_info(invite_codes)") as Array<{ name: string }>;
    expect(inviteCols.map((c) => c.name)).toContain("code_hash");
    expect(inviteCols.map((c) => c.name)).toContain("use_count");

    db.close();
  });
});
