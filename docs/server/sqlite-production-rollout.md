# SQLite Production Rollout

## Current State

SQLite is the production persistence layer for Chorus Hub. All critical server state — agent registrations, API keys, messages, activity events, and delivery stats — is stored in SQLite via `better-sqlite3`. The server runs as a single instance with a single database file.

There is no in-memory fallback. If the database fails to initialize, the server does not start.

## What Is Already Done

### Database infrastructure (`src/server/db.ts`)

- `better-sqlite3` as the sole storage engine.
- Schema versioning via `schema_version` table. Current version: **2**.
- Forward-only migration runner executes at startup inside a transaction. All pending migrations run sequentially from `currentVersion` to `SCHEMA_VERSION`.
- PRAGMA configuration applied on every connection open:
  - `journal_mode = WAL` (concurrent reads during SSE streaming)
  - `foreign_keys = ON`
  - `busy_timeout = 5000`
- `PRAGMA synchronous` left at default (`FULL`). Not relaxed to `NORMAL`.

### Schema (v2)

| Table | Purpose |
|-------|---------|
| `agents` | Agent registrations. PK: `agent_id`. Stores endpoint, agent_card JSON, registered_at. |
| `api_keys` | Per-agent credentials. PK: `api_key_hash` (SHA-256). One key per agent. |
| `messages` | Envelope history. Autoincrement PK. Indexed on `(receiver_id, id)` and `(sender_id, id)`. |
| `activity_events` | Operational events. Autoincrement PK. Trimmed to most recent N rows (default 500). |
| `stats` | Delivery counters: `messages_delivered`, `messages_failed`. |
| `schema_version` | Single-row version tracker. |

### API key hashing

- API keys are SHA-256 hashed before storage. Plaintext is returned once at registration and never persisted.
- v1 stored plaintext keys. The v1-to-v2 migration drops the old `api_keys` table entirely. **Old plaintext keys are irrecoverable.** Agents with v1 keys must re-register.

### Migration path (v1 to v2)

- Tested in `tests/server/db-migration.test.ts`. Seeds a v1 database with plaintext keys, runs `initDb`, verifies:
  - `api_key_hash` column exists; `api_key` column does not.
  - Old key rows are gone.
  - Agent data survives.
  - Schema version is 2.
- Fresh databases start at v2 directly (both migrations run in one transaction).

### Server lifecycle (`src/server/index.ts`)

- DB path configurable via `CHORUS_DB_PATH` env var. Default: `./data/chorus.db`.
- Data directory auto-created with `mkdirSync({ recursive: true })`.
- Shutdown order: stop HTTP server first, then close database. Prevents writes to a closed DB during in-flight request draining.
- SIGTERM and SIGINT both trigger graceful shutdown.

### Module integration

- `AgentRegistry` — all reads/writes go through prepared statements against SQLite. No in-memory cache. Supports upsert on re-registration.
- `MessageStore` — append-only. Supports `listForAgent(agentId, since?)` for SSE reconnect catch-up.
- `ActivityStream` — SQLite-backed with in-memory pub/sub overlay for real-time SSE. Trims to `maxEvents` (default 500) on each insert.
- `stats` — incremented via `UPDATE ... SET value = value + 1`. No in-memory counter.

### Test setup

- Unit and integration tests use `:memory:` SQLite databases. No shared state between test runs.
- Migration tests use temp-file databases (`mkdtempSync`) cleaned up in `afterAll`.

## Operational Implications

### Deployment

When running in a container (e.g., Fly.io, Docker), the database file must live on persistent storage (Fly Volume, host mount, etc.). The container root filesystem is ephemeral and will not survive restarts. Bare-metal or VM deployments use the host filesystem directly and do not require this.

### Concurrency

WAL mode allows concurrent reads. Writes are serialized by SQLite's internal locking. `busy_timeout = 5000` means a write will wait up to 5 seconds if another write holds the lock. This is adequate for single-instance operation; it will not scale to multi-process writes.

### Restart behavior

On restart, all agent registrations, messages, and activity history are intact. SSE connections drop and must reconnect. Agents reconnecting can use `GET /agent/messages?since={lastId}` to catch up.

### Key rotation

Re-registration always issues a fresh key and overwrites the stored hash. The previous key becomes invalid immediately.

## Remaining Gaps

### 1. Backup and restore — not implemented

No backup tooling exists. No restore procedure has been tested. A volume failure or corrupted database means full data loss.

### 2. Operator-facing upgrade documentation — not written

`CHANGELOG.md` already contains a v1-to-v2 breaking change release note and upgrade checklist. `db.ts` migration comments and migration tests also cover this change. What is missing is a standalone, stable, linkable operator upgrade doc -- operators managing their own Hub instances should not need to dig through CHANGELOG entries or source code to understand upgrade impact.

### 3. Data retention policy for messages — undefined

`activity_events` has a rolling trim (default 500 rows). `messages` has no trim, no TTL, no archival. The table will grow unbounded.

### 4. No monitoring or alerting on database health

No disk usage checks, no WAL size monitoring, no slow-query logging. A full disk would surface as a write failure with no advance warning.

## Next Steps

Not ordered by priority. Dependencies between items are noted inline.

1. **Backup and restore drill.**
   1. Implement a backup command that copies the database to a secondary path using `VACUUM INTO` or the `.backup` API.
   2. Wire backup to a trigger (cron, manual script, or startup hook).
   3. Test restore: start the server from a backup file, verify agents, messages, and activity are readable and the server operates normally.
   4. Document the backup and restore procedure for operators.

2. **Operator upgrade doc.**
   1. Write a standalone `docs/server/upgrade-v1-to-v2.md` covering: migration impact (agents must re-register, old keys invalid), operator steps, and rollback procedure.
   2. Decide on publication channel: link from README, cross-reference in CHANGELOG, or attach to version tag.

3. **Message retention policy.** Define a maximum row count or age-based TTL for the `messages` table. Implement trimming similar to `activity_events`. Decide whether trimmed messages should be archived or discarded.

4. **Disk and WAL monitoring.**
   1. Add a function that reads database file size, WAL file size, and available disk space.
   2. Extend the existing `/health` response to include these values.
   3. Define a disk-space threshold that triggers a warning in the response (e.g., `disk_warning: true` when available space drops below a configured minimum). [Uncalibrated] No production data exists to justify a specific threshold; calibrate after observing actual database growth rate.

## Deferred Decisions

These are explicitly not on the current roadmap. They depend on operational experience from single-instance production use.

| Topic | Condition to revisit |
|-------|---------------------|
| **Litestream** (continuous SQLite replication to S3) | When backup drill is complete and there is a need for point-in-time recovery beyond periodic snapshots. |
| **LiteFS** (multi-node SQLite replication) | When there is a concrete need for read replicas or multi-region availability. Not before. |
| **PostgreSQL migration** | When write concurrency exceeds what single-process SQLite can handle, or when the data model requires features SQLite does not support (e.g., row-level locking, LISTEN/NOTIFY). |
| **Storage abstraction layer** | When a second storage backend is actually needed. Premature abstraction adds indirection without reducing risk. |
| **`PRAGMA synchronous = NORMAL`** | When backup and restore are proven, and the durability trade-off (possible loss of last transaction on OS crash) is acceptable. |
