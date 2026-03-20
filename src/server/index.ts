// Author: be-api-router
// L3 Reference Implementation — Routing server. Using Chorus protocol does NOT require this code.
// Protocol: skill/PROTOCOL.md | Schema: skill/envelope.schema.json
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createApp } from "./routes";
import { createAuthMiddleware } from "./auth";
import { AgentRegistry } from "./registry";
import { log, logError } from "../shared/log";

const registry = new AgentRegistry();
const app = createApp(registry);

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

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
  prodApp.use("*", createAuthMiddleware(apiKeys));
  prodApp.route("/", app);

  serve({ fetch: prodApp.fetch, port: PORT }, (info) => {
    log("router", `Chorus routing server listening on port ${info.port} (auth enabled)`);
  });
}

export { app, registry };
