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
import { log, logError } from "../shared/log";

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

const registry = new AgentRegistry(MAX_AGENTS);
const activity = createActivityStream();
const inbox = createInboxManager();
const app = createApp(registry, {
  maxAgents: MAX_AGENTS,
  maxBodyBytes: MAX_BODY_BYTES,
  rateLimitPerMin: RATE_LIMIT_PER_MIN,
}, activity, inbox);

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

  serve({ fetch: prodApp.fetch, port: PORT }, (info) => {
    log("router", `Chorus Alpha Hub listening on port ${info.port} (auth + rate-limit enabled)`);
    log("router", `Limits: ${MAX_AGENTS} agents, ${MAX_BODY_BYTES}B body, ${RATE_LIMIT_PER_MIN} req/min/IP`);
    log("router", `Self-registration enabled at POST /register (no auth required)`);
  });
}

export { app, registry, activity, inbox };
