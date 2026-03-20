// Author: be-domain-modeler
// L3 Reference Implementation — CLI agent. Using Chorus protocol does NOT require this code.
// Protocol: skill/PROTOCOL.md | Schema: skill/envelope.schema.json
import { serve } from "@hono/node-server";
import { createLLMClient, generateCulturalContext } from "./llm";
import { createReceiver } from "./receiver";
import { createEnvelope } from "./envelope";
import { discoverCompatibleAgents } from "./discovery";
import { ConversationHistory } from "./history";
import { parseSSEChunks } from "../shared/sse";
import { parseArgs, validateEnv } from "./config";
import { log, logError, extractErrorMessage } from "../shared/log";
import type { AgentConfig, AgentHandle, SendResult } from "./config";
import type { ChorusEnvelope } from "../shared/types";

// --- Agent Lifecycle ---

const routerHeaders = (apiKey?: string): Record<string, string> =>
  apiKey
    ? { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }
    : { "Content-Type": "application/json" };

const startAgent = async (config: AgentConfig): Promise<AgentHandle> => {
  const { culture, port, routerUrl, agentId, languages, routerApiKey } = config;

  const { apiKey } = validateEnv();
  const llmClient = createLLMClient(apiKey);
  const history = new ConversationHistory();

  const { app } = createReceiver({
    port,
    llmClient,
    receiverCulture: culture,
    personality: config.personality,
    onMessage: (from: string, original: string, adapted: string) => {
      log(agentId, `Message from ${from}:`);
      log(agentId, `  Original: ${original}`);
      log(agentId, `  Adapted:  ${adapted}`);
      history.addTurn(from, {
        role: "received",
        originalText: original,
        adaptedText: adapted,
        envelope: { chorus_version: "0.4", sender_id: from, original_text: original, sender_culture: "unknown" },
        timestamp: new Date().toISOString(),
      });
    },
    history,
  });

  const server = serve({ fetch: app.fetch, port });
  log(agentId, `Receiver listening on port ${port}`);

  const registrationBody = {
    agent_id: agentId,
    endpoint: `http://localhost:${port}/receive`,
    agent_card: { chorus_version: "0.2" as const, user_culture: culture, supported_languages: [...languages] },
  };

  const regResponse = await fetch(`${routerUrl}/agents`, {
    method: "POST",
    headers: routerHeaders(routerApiKey),
    body: JSON.stringify(registrationBody),
  });

  if (!regResponse.ok) {
    throw new Error(`Failed to register with router at ${routerUrl}: ${regResponse.status}`);
  }
  log(agentId, `Registered with router at ${routerUrl}`);

  const compatible = await discoverCompatibleAgents(routerUrl, {
    chorus_version: "0.2",
    user_culture: culture,
    supported_languages: [...languages],
  });
  log(agentId, `Discovered ${compatible.length} compatible agent(s): ${compatible.map((a) => a.agent_id).join(", ")}`);

  // --- Send Message ---

  const sendMessage = async (targetId: string, text: string): Promise<SendResult> => {
    const context = await generateCulturalContext(llmClient, text, culture, (token: string) => {
      process.stdout.write(token);
    });

    const conversationId = history.getConversationId(targetId);
    const turnNumber = history.getNextTurnNumber(targetId);

    const envelope: ChorusEnvelope = createEnvelope(agentId, text, culture, context.cultural_context, {
      conversation_id: conversationId,
      turn_number: turnNumber,
    });

    const response = await fetch(`${routerUrl}/messages`, {
      method: "POST",
      headers: routerHeaders(routerApiKey),
      body: JSON.stringify({ receiver_id: targetId, envelope, stream: true }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullAdaptedText = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const events = parseSSEChunks(decoder.decode(value));
        for (const evt of events) {
          if (evt.event === "chunk") {
            try {
              const parsed = JSON.parse(evt.data) as { text: string };
              process.stdout.write(parsed.text);
              fullAdaptedText += parsed.text;
            } catch { /* skip malformed */ }
          } else if (evt.event === "done") {
            try {
              const parsed = JSON.parse(evt.data) as { full_text: string };
              fullAdaptedText = parsed.full_text;
            } catch { /* skip */ }
          }
        }
      }
    }

    history.addTurn(targetId, {
      role: "sent",
      originalText: text,
      adaptedText: fullAdaptedText,
      envelope,
      timestamp: new Date().toISOString(),
    });

    log(agentId, `\nMessage sent to ${targetId}`);
    return { adaptedText: fullAdaptedText, envelope };
  };

  // --- Shutdown ---

  const shutdown = async (): Promise<void> => {
    log(agentId, "Shutting down...");
    try {
      await fetch(`${routerUrl}/agents/${agentId}`, {
        method: "DELETE",
        headers: routerHeaders(routerApiKey),
      });
      log(agentId, "Deregistered from router");
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      logError(agentId, `Failed to deregister: ${msg}`);
    }
    server.close();
    log(agentId, "Server closed");
  };

  return { shutdown, sendMessage };
};

// --- Main Entry ---

if (require.main === module) {
  const config = parseArgs(process.argv.slice(2));

  startAgent(config)
    .then((handle) => {
      const readline = require("readline");
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      const target = { id: "" };
      discoverCompatibleAgents(config.routerUrl, {
        chorus_version: "0.2",
        user_culture: config.culture,
        supported_languages: [...config.languages],
      }).then((agents) => {
        if (agents.length > 0) {
          target.id = agents[0].agent_id;
          log("cli", `Default target: ${target.id}`);
        }
      });

      const prompt = (): void => {
        rl.question("chorus> ", async (input: string) => {
          const trimmed = input.trim();
          if (trimmed === "exit") { await handle.shutdown(); rl.close(); process.exit(0); }
          if (trimmed === "" || target.id === "") { prompt(); return; }
          try { await handle.sendMessage(target.id, trimmed); } catch (err: unknown) {
            const msg = extractErrorMessage(err);
            logError("cli", msg);
          }
          prompt();
        });
      };
      prompt();

      process.on("SIGINT", async () => { log("cli", "Received SIGINT"); await handle.shutdown(); rl.close(); process.exit(0); });
    })
    .catch((err) => { logError("cli", `Failed to start agent: ${err}`); process.exit(1); });
}

export { parseArgs, validateEnv, startAgent };
export type { AgentConfig, AgentHandle, SendResult };
