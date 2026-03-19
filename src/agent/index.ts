// Author: be-domain-modeler
import { serve } from "@hono/node-server";
import { createLLMClient, extractSemantic, extractSemanticStream } from "./llm";
import { createReceiver } from "./receiver";
import { createEnvelope, createChorusMessage } from "./envelope";
import { discoverCompatibleAgents } from "./discovery";
import { ConversationHistory } from "./history";
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

// --- SSE Response Parser ---

const parseSSEChunks = (raw: string): Array<{ event: string; data: string }> => {
  const events: Array<{ event: string; data: string }> = [];
  const lines = raw.split("\n");
  let currentEvent = "";
  let currentData = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      currentEvent = line.slice(7);
    } else if (line.startsWith("data: ")) {
      currentData = line.slice(6);
    } else if (line === "" && currentEvent !== "") {
      events.push({ event: currentEvent, data: currentData });
      currentEvent = "";
      currentData = "";
    }
  }

  return events;
};

// --- Agent Lifecycle ---

const startAgent = async (config: AgentConfig): Promise<AgentHandle> => {
  const { culture, port, routerUrl, agentId, languages } = config;

  // Step a: validate environment
  const { apiKey } = validateEnv();

  // Step b: create LLM client
  const llmClient = createLLMClient(apiKey);

  // Step c: create conversation history
  const history = new ConversationHistory();

  // Step d: create receiver
  const { app } = createReceiver({
    port,
    llmClient,
    receiverCulture: culture,
    onMessage: (from: string, original: string, adapted: string) => {
      console.log(`[${agentId}] Message from ${from}:`);
      console.log(`  Original: ${original}`);
      console.log(`  Adapted:  ${adapted}`);

      history.addTurn(from, {
        role: "received",
        originalText: original,
        adaptedText: adapted,
        envelope: {
          chorus_version: "0.3",
          original_semantic: original,
          sender_culture: "unknown",
        },
        timestamp: new Date().toISOString(),
      });
    },
    history,
  });

  // Step e: start HTTP server
  const server = serve({ fetch: app.fetch, port });

  console.log(`[${agentId}] Receiver listening on port ${port}`);

  // Step f: register with router
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

  // Step g: discover compatible agents
  const compatible = await discoverCompatibleAgents(routerUrl, {
    chorus_version: "0.2",
    user_culture: culture,
    supported_languages: [...languages],
  });

  console.log(
    `[${agentId}] Discovered ${compatible.length} compatible agent(s):`,
    compatible.map((a) => a.agent_id),
  );

  // Step h: return handle

  const sendMessage = async (targetId: string, text: string): Promise<void> => {
    const semantics = await extractSemanticStream(
      llmClient,
      text,
      culture,
      (token: string) => {
        process.stdout.write(token);
      },
    );

    const conversationId = history.getConversationId(targetId);
    const turnNumber = history.getNextTurnNumber(targetId);

    const envelope: ChorusEnvelope = createEnvelope(
      semantics.original_semantic,
      culture,
      semantics.cultural_context,
      {
        intent_type: semantics.intent_type as ChorusEnvelope["intent_type"],
        formality: semantics.formality as ChorusEnvelope["formality"],
        emotional_tone: semantics.emotional_tone as ChorusEnvelope["emotional_tone"],
        conversation_id: conversationId,
        turn_number: turnNumber,
      },
    );

    const message = createChorusMessage(text, envelope);

    const payload = {
      sender_agent_id: agentId,
      target_agent_id: targetId,
      message,
      stream: true,
    };

    const response = await fetch(`${routerUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Read SSE streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullAdaptedText = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const rawText = decoder.decode(value);
        const events = parseSSEChunks(rawText);

        for (const evt of events) {
          if (evt.event === "chunk") {
            try {
              const parsed = JSON.parse(evt.data) as { text: string };
              process.stdout.write(parsed.text);
              fullAdaptedText += parsed.text;
            } catch {
              // skip malformed chunk
            }
          } else if (evt.event === "done") {
            try {
              const parsed = JSON.parse(evt.data) as { full_text: string };
              fullAdaptedText = parsed.full_text;
            } catch {
              // skip
            }
          }
        }
      }
    }

    // Save to history after successful send
    history.addTurn(targetId, {
      role: "sent",
      originalText: text,
      adaptedText: fullAdaptedText,
      envelope,
      timestamp: new Date().toISOString(),
    });

    console.log(`\n[${agentId}] Message sent to ${targetId}`);
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

export { parseArgs, validateEnv, startAgent, parseSSEChunks };
export type { AgentConfig, AgentHandle };
