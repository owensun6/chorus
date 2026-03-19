// Author: be-api-router
import { serve } from "@hono/node-server";
import { createApp } from "../server/routes";
import { AgentRegistry } from "../server/registry";
import { startAgent } from "../agent/index";
import { createWebServer } from "./web";
import { execFile } from "child_process";
import { log, logError, extractErrorMessage } from "../shared/log";
import type { AgentHandle } from "../agent/index";

// --- Types ---

interface DemoHandle {
  readonly shutdown: () => Promise<void>;
}

interface DemoConfig {
  readonly webPort: number;
  readonly routerPort: number;
  readonly agentZhPort: number;
  readonly agentJaPort: number;
}

// --- Constants ---

const DEFAULT_CONFIG: DemoConfig = {
  webPort: 5000,
  routerPort: 3000,
  agentZhPort: 3001,
  agentJaPort: 3002,
};

// --- CLI Argument Parsing ---

const parseDemoArgs = (args: readonly string[]): { webPort: number } => {
  const idx = args.indexOf("--port");
  const port = idx !== -1 && idx + 1 < args.length
    ? Number(args[idx + 1])
    : DEFAULT_CONFIG.webPort;
  return { webPort: Number.isNaN(port) ? DEFAULT_CONFIG.webPort : port };
};

// --- Demo Orchestrator ---

const startDemo = async (webPort: number = DEFAULT_CONFIG.webPort): Promise<DemoHandle> => {
  const routerPort = DEFAULT_CONFIG.routerPort;
  const agentZhPort = DEFAULT_CONFIG.agentZhPort;
  const agentJaPort = DEFAULT_CONFIG.agentJaPort;
  const routerUrl = `http://localhost:${routerPort}`;

  // Step 1: Start routing server
  const registry = new AgentRegistry();
  const routerApp = createApp(registry);
  const routerServer = serve({ fetch: routerApp.fetch, port: routerPort });
  log("demo", `Router started on :${routerPort}`);

  // Step 2: Start agents
  const agentHandles: AgentHandle[] = [];

  const zhHandle = await startAgent({
    culture: "zh-CN",
    port: agentZhPort,
    routerUrl,
    agentId: "agent-zh-cn",
    languages: ["zh-CN", "ja"],
    personality: "热情直爽的北京大哥，说话接地气，爱用口语化表达",
  });
  agentHandles.push(zhHandle);
  log("demo", `Agent zh-CN started on :${agentZhPort}`);

  const jaHandle = await startAgent({
    culture: "ja",
    port: agentJaPort,
    routerUrl,
    agentId: "agent-ja",
    languages: ["ja", "zh-CN"],
    personality: "礼貌细腻的东京白领，注重措辞得体，表达含蓄委婉",
  });
  agentHandles.push(jaHandle);
  log("demo", `Agent ja started on :${agentJaPort}`);

  // Step 3: Build agent map for sendMessage delegation
  const agentMap = new Map<string, AgentHandle>([
    ["agent-zh-cn", zhHandle],
    ["agent-ja", jaHandle],
  ]);

  const agentIds = new Set(agentMap.keys());

  // Step 4: Create web server with SSE broadcasting
  const { app: webApp, broadcast } = createWebServer({
    sendMessage: async (from: string, to: string, text: string): Promise<void> => {
      const handle = agentMap.get(from);
      if (!handle) {
        throw new Error(`Agent not found: ${from}`);
      }

      // Broadcast message_sent event
      broadcast("message_sent", {
        from,
        to,
        text,
        timestamp: new Date().toISOString(),
      });

      // Broadcast adaptation_start for the target
      broadcast("adaptation_start", {
        agent_id: to,
        from,
      });

      try {
        const result = await handle.sendMessage(to, text);

        broadcast("adaptation_done", {
          agent_id: to,
          text: result.adaptedText,
          envelope: result.envelope,
        });
      } catch (err: unknown) {
        const errMessage = extractErrorMessage(err);
        broadcast("adaptation_error", {
          agent_id: to,
          code: "ERR_ADAPTATION_FAILED",
          message: errMessage,
        });
        throw err;
      }
    },
    agents: agentIds,
  });

  // Step 5: Start web server
  const webServer = serve({ fetch: webApp.fetch, port: webPort });
  log("demo", `Web server started on :${webPort}`);

  // Step 6: Open browser (safe: no user input in URL, only numeric port)
  const url = `http://localhost:${webPort}`;
  log("demo", `Opening browser: ${url}`);
  execFile("open", [url]);

  // Step 7: Return shutdown handle
  const shutdown = async (): Promise<void> => {
    log("demo", "Shutting down...");

    for (const handle of agentHandles) {
      try {
        await handle.shutdown();
      } catch (err: unknown) {
        const msg = extractErrorMessage(err);
        logError("demo", `Agent shutdown error: ${msg}`);
      }
    }

    webServer.close();
    routerServer.close();
    log("demo", "All servers closed");
  };

  return { shutdown };
};

// --- Main Entry ---

if (require.main === module) {
  const { webPort } = parseDemoArgs(process.argv.slice(2));

  startDemo(webPort)
    .then((handle) => {
      process.on("SIGINT", async () => {
        log("demo", "Received SIGINT");
        await handle.shutdown();
        process.exit(0);
      });
    })
    .catch((err) => {
      logError("demo", `Failed to start: ${err}`);
      process.exit(1);
    });
}

export { startDemo, parseDemoArgs };
export type { DemoHandle, DemoConfig };
