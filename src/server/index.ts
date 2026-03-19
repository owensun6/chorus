// Author: be-api-router
import { serve } from "@hono/node-server";
import { createApp } from "./routes";
import { AgentRegistry } from "./registry";

const registry = new AgentRegistry();
const app = createApp(registry);

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

if (require.main === module) {
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`Chorus routing server listening on port ${info.port}`);
  });
}

export { app, registry };
