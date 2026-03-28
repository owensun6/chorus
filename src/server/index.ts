// Author: be-api-router
// L3 Reference Implementation — Routing server. Using Chorus protocol does NOT require this code.
// Protocol: skill/PROTOCOL.md | Schema: skill/envelope.schema.json
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createApp } from "./routes";
import { createAuthMiddleware } from "./auth";
import { createRateLimitMiddleware } from "./rate-limit";
import { AgentRegistry } from "./registry";
import { createActivityStream } from "./activity";
import { createInboxManager } from "./inbox";
import { createMessageStore } from "./message-store";
import { createIdempotencyStore } from "./idempotency";
import { initDb, seedInviteCodes } from "./db";
import { log, logError } from "../shared/log";
import { mkdirSync } from "fs";
import { dirname } from "path";

const readEnvInt = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const PORT = readEnvInt("PORT", 3000);
const MAX_AGENTS = readEnvInt("CHORUS_MAX_AGENTS", 100);
const MAX_BODY_BYTES = readEnvInt("CHORUS_MAX_BODY_BYTES", 65536);
const RATE_LIMIT_PER_MIN = readEnvInt("CHORUS_RATE_LIMIT_PER_MIN", 60);
const RATE_LIMIT_PER_KEY_MIN = readEnvInt("CHORUS_RATE_LIMIT_PER_KEY_MIN", 120);
const DB_PATH = process.env["CHORUS_DB_PATH"] ?? "./data/chorus.db";
const INVITE_CODES: ReadonlySet<string> = (() => {
  const raw = process.env["CHORUS_INVITE_CODES"];
  if (!raw) return new Set<string>();
  return new Set(raw.split(",").map((c) => c.trim()).filter(Boolean));
})();

// Ensure data directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = initDb(DB_PATH);
seedInviteCodes(db, INVITE_CODES);
const registry = new AgentRegistry(db, MAX_AGENTS);
const activity = createActivityStream(db);
const inbox = createInboxManager();
const messageStore = createMessageStore(db);
const idempotencyStore = createIdempotencyStore(db);
const app = createApp(registry, {
  maxAgents: MAX_AGENTS,
  maxBodyBytes: MAX_BODY_BYTES,
  rateLimitPerMin: RATE_LIMIT_PER_MIN,
}, activity, inbox, messageStore, idempotencyStore);

if (require.main === module) {
  const apiKeysRaw = process.env["CHORUS_API_KEYS"];
  if (!apiKeysRaw) {
    logError("router", "CHORUS_API_KEYS environment variable is required");
    process.exit(1);
  }

  const apiKeys = new Set(
    apiKeysRaw.split(",").map((k) => k.trim()).filter(Boolean),
  );

  const prodApp = new Hono();
  prodApp.use("*", createRateLimitMiddleware(RATE_LIMIT_PER_MIN, RATE_LIMIT_PER_KEY_MIN));
  prodApp.use("*", bodyLimit({ maxSize: MAX_BODY_BYTES }));
  prodApp.use("*", createAuthMiddleware(
    apiKeys,
    (token) => registry.isValidAgentKey(token),
    new Set(["/register"]),
  ));
  prodApp.route("/", app);

  const server = serve({ fetch: prodApp.fetch, port: PORT }, (info) => {
    log("router", `Chorus Hub listening on port ${info.port} (auth + rate-limit enabled)`);
    log("router", `Database: ${DB_PATH} (SQLite, WAL mode)`);
    log("router", `Limits: ${MAX_AGENTS} agents, ${MAX_BODY_BYTES}B body, ${RATE_LIMIT_PER_MIN} req/min/IP`);
    log("router", registry.hasInviteCodes()
      ? `Self-registration gated by invite code (DB-backed)`
      : `Self-registration open at POST /register (no invite codes in DB)`);
  });

  // Idempotency key cleanup: purge records older than 24 hours, every hour
  const IDEM_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const IDEM_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
  const idempotencyCleanupTimer = setInterval(() => {
    const deleted = idempotencyStore.cleanup(IDEM_MAX_AGE_MS);
    if (deleted > 0) {
      log("router", `Idempotency cleanup: purged ${deleted} expired keys`);
    }
  }, IDEM_CLEANUP_INTERVAL_MS);

  const shutdown = () => {
    log("router", "Shutting down...");
    clearInterval(idempotencyCleanupTimer);
    server.close(() => {
      db.close();
      log("router", "Database closed. Exiting.");
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

export { app, registry, activity, inbox, messageStore };
