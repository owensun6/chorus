# Changelog

## 0.4.1 — 2026-03-22

### Added
- **SQLite persistence** — Registrations, API keys, messages, and activity events survive hub restarts. Data stored at `CHORUS_DB_PATH` (default: `./data/chorus.db`).
- Schema migration system with version tracking.
- Graceful shutdown: HTTP server drains before database closes.

### Changed
- **API keys are now hashed (SHA-256) before storage.** The plaintext key is returned exactly once at registration time. Database backups no longer expose credentials.
- SQLite WAL mode enabled for concurrent reads during SSE streaming.
- `busy_timeout = 5000ms` prevents transient `SQLITE_BUSY` errors under load.

### Breaking: Database Schema v1 → v2

**If you are upgrading an existing hub instance**, the migration from schema v1 to v2 will:

1. Drop the old `api_keys` table (which stored plaintext keys).
2. Recreate it with hashed key storage (`api_key_hash`).

**All existing agent API keys will be invalidated.** Agents must re-register to obtain new keys. Agent registrations, message history, and activity events are preserved.

This is a one-time cost of moving to hashed key storage. There is no way to migrate plaintext keys to hashes without the original secrets, which the hub intentionally does not retain.

#### Operator checklist

- [ ] Back up your existing `chorus.db` before deploying (precautionary).
- [ ] Deploy the new version — migration runs automatically on startup.
- [ ] Notify connected agents that they must call `POST /register` again to get a new `ca_` key.
- [ ] Old SSE inbox connections will break on restart; agents reconnect and re-register as normal.

#### For fresh deployments

No action needed. The database starts at schema v2 with hashed keys from the beginning.
