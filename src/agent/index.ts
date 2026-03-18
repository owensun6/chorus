// Author: be-domain-modeler
import { serve } from "@hono/node-server";
import { createLLMClient, extractSemantic } from "./llm";
import { createReceiver } from "./receiver";
import { createEnvelope, createChorusMessage } from "./envelope";
import { discoverCompatibleAgents } from "./discovery";
import type { ChorusEnvelope } from "../shared/types";

// --- Types ---

interface AgentConfig {
  readonly culture: string;
  readonly port: number;
  readonly routerUrl: string;
  readonly agentId: string;
  readonly languages: readonly string[];
}

interface AgentHandle {
  readonly shutdown: () => Promise<void>;
  readonly sendMessage: (targetId: string, text: string) => Promise<void>;
}

// --- CLI Argument Parsing ---

const parseArgs = (args: readonly string[]): AgentConfig => {
  const flagIndex = (flag: string): number => args.indexOf(flag);

  const flagValue = (flag: string): string | undefined => {
    const idx = flagIndex(flag);
    return idx !== -1 && idx + 1 < args.length
      ? args[idx + 1]
      : undefined;
  };

  const culture = flagValue("--culture");
  if (culture === undefined) {
    throw new Error("--culture is required");
  }

  const port = Number(flagValue("--port") ?? "3001");
  const routerUrl = flagValue("--router") ?? "http://localhost:3000";
  const agentId = flagValue("--agent-id") ?? `agent-${culture}-${port}`;
  const languagesRaw = flagValue("--languages");
  const languages = languagesRaw
    ? languagesRaw.split(",")
    : [culture];

  return { culture, port, routerUrl, agentId, languages };
};

// --- Environment Validation ---

const validateEnv = (): { readonly apiKey: string } => {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (apiKey === undefined || apiKey === "") {
    throw new Error("DASHSCOPE_API_KEY is required");
  }
  return { apiKey };
};

// --- Agent Lifecycle ---

const startAgent = async (config: AgentConfig): Promise<AgentHandle> => {
  const { culture, port, routerUrl, agentId, languages } = config;

  // Step a: validate environment
  const { apiKey } = validateEnv();

  // Step b: create LLM client
  const llmClient = createLLMClient(apiKey);

  // Step c: create receiver
  const { app } = createReceiver({
    port,
    llmClient,
    receiverCulture: culture,
    onMessage: (from: string, original: string, adapted: string) => {
      console.log(`[${agentId}] Message from ${from}:`);
      console.log(`  Original: ${original}`);
      console.log(`  Adapted:  ${adapted}`);
    },
  });

  // Step d: start HTTP server
  const server = serve({ fetch: app.fetch, port });

  console.log(`[${agentId}] Receiver listening on port ${port}`);

  // Step e: register with router
  const registrationBody = {
    agent_id: agentId,
    endpoint: `http://localhost:${port}/receive`,
    agent_card: {
      chorus_version: "0.2" as const,
      user_culture: culture,
      supported_languages: [...languages],
    },
  };

  const regResponse = await fetch(`${routerUrl}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(registrationBody),
  });

  if (!regResponse.ok) {
    throw new Error(
      `Failed to register with router at ${routerUrl}: ${regResponse.status}`,
    );
  }

  console.log(`[${agentId}] Registered with router at ${routerUrl}`);

  // Step f: discover compatible agents
  const compatible = await discoverCompatibleAgents(routerUrl, {
    chorus_version: "0.2",
    user_culture: culture,
    supported_languages: [...languages],
  });

  console.log(
    `[${agentId}] Discovered ${compatible.length} compatible agent(s):`,
    compatible.map((a) => a.agent_id),
  );

  // Step g: return handle

  const sendMessage = async (targetId: string, text: string): Promise<void> => {
    const semantics = await extractSemantic(llmClient, text, culture);

    const envelope: ChorusEnvelope = createEnvelope(
      semantics.original_semantic,
      culture,
      semantics.cultural_context,
      {
        intent_type: semantics.intent_type as ChorusEnvelope["intent_type"],
        formality: semantics.formality as ChorusEnvelope["formality"],
        emotional_tone: semantics.emotional_tone as ChorusEnvelope["emotional_tone"],
      },
    );

    const message = createChorusMessage(text, envelope);

    const payload = {
      sender_agent_id: agentId,
      target_agent_id: targetId,
      message,
    };

    const response = await fetch(`${routerUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log(`[${agentId}] Message sent to ${targetId}:`, result);
  };

  const shutdown = async (): Promise<void> => {
    console.log(`[${agentId}] Shutting down...`);

    try {
      await fetch(`${routerUrl}/agents/${agentId}`, { method: "DELETE" });
      console.log(`[${agentId}] Deregistered from router`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${agentId}] Failed to deregister: ${msg}`);
    }

    server.close();
    console.log(`[${agentId}] Server closed`);
  };

  return { shutdown, sendMessage };
};

// --- Main Entry ---

if (require.main === module) {
  const config = parseArgs(process.argv.slice(2));

  startAgent(config)
    .then((handle) => {
      const readline = require("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      // Find first compatible agent for convenience
      const target = { id: "" };
      discoverCompatibleAgents(config.routerUrl, {
        chorus_version: "0.2",
        user_culture: config.culture,
        supported_languages: [...config.languages],
      }).then((agents) => {
        if (agents.length > 0) {
          target.id = agents[0].agent_id;
          console.log(`Default target: ${target.id}`);
        }
      });

      const prompt = (): void => {
        rl.question("chorus> ", async (input: string) => {
          const trimmed = input.trim();
          if (trimmed === "exit") {
            await handle.shutdown();
            rl.close();
            process.exit(0);
          }
          if (trimmed === "" || target.id === "") {
            prompt();
            return;
          }
          try {
            await handle.sendMessage(target.id, trimmed);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`Error: ${msg}`);
          }
          prompt();
        });
      };

      prompt();

      process.on("SIGINT", async () => {
        console.log("\nReceived SIGINT");
        await handle.shutdown();
        rl.close();
        process.exit(0);
      });
    })
    .catch((err) => {
      console.error("Failed to start agent:", err);
      process.exit(1);
    });
}

export { parseArgs, validateEnv, startAgent };
export type { AgentConfig, AgentHandle };
