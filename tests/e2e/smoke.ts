// Author: Lead — Phase 1 E2E smoke test
// Usage: DASHSCOPE_API_KEY=xxx npx ts-node tests/e2e/smoke.ts
import { serve } from "@hono/node-server";
import { AgentRegistry } from "../../src/server/registry";
import { createApp } from "../../src/server/routes";
import { createReceiver } from "../../src/agent/receiver";
import { createLLMClient, extractSemantic } from "../../src/agent/llm";
import { createEnvelope, createChorusMessage } from "../../src/agent/envelope";
import type { ChorusEnvelope } from "../../src/shared/types";

// --- Config ---
const ROUTER_PORT = 4000;
const AGENT_A_PORT = 4001; // zh-CN sender
const AGENT_B_PORT = 4002; // ja receiver

const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) {
  console.error("DASHSCOPE_API_KEY is required");
  process.exit(1);
}

const llmClient = createLLMClient(apiKey);

// --- Test Cases ---
const TEST_CASES = [
  {
    name: "中国式寒暄→日本文化适配",
    input: "你吃了吗？",
    senderCulture: "zh-CN",
    receiverCulture: "ja",
  },
  {
    name: "日本谦逊→中国文化适配",
    input: "つまらないものですが、お受け取りください。",
    senderCulture: "ja",
    receiverCulture: "zh-CN",
  },
];

// --- Orchestrate ---
const run = async () => {
  console.log("=== Phase 1 E2E Smoke Test ===\n");

  // 1. Start routing server
  const registry = new AgentRegistry();
  const routerApp = createApp(registry);
  const routerServer = serve({ fetch: routerApp.fetch, port: ROUTER_PORT });
  console.log(`[Router] Listening on :${ROUTER_PORT}`);

  // 2. Start Agent B (ja) receiver
  const receivedMessages: Array<{ from: string; original: string; adapted: string }> = [];
  const { app: receiverApp } = createReceiver({
    port: AGENT_B_PORT,
    llmClient,
    receiverCulture: "ja",
    onMessage: (from, original, adapted) => {
      receivedMessages.push({ from, original, adapted });
    },
  });
  const agentBServer = serve({ fetch: receiverApp.fetch, port: AGENT_B_PORT });
  console.log(`[Agent-ja] Receiver on :${AGENT_B_PORT}`);

  // 3. Start Agent A (zh-CN) receiver (for reverse test)
  const receivedByA: Array<{ from: string; original: string; adapted: string }> = [];
  const { app: receiverAppA } = createReceiver({
    port: AGENT_A_PORT,
    llmClient,
    receiverCulture: "zh-CN",
    onMessage: (from, original, adapted) => {
      receivedByA.push({ from, original, adapted });
    },
  });
  const agentAServer = serve({ fetch: receiverAppA.fetch, port: AGENT_A_PORT });
  console.log(`[Agent-zh] Receiver on :${AGENT_A_PORT}`);

  // 4. Register both agents
  const routerUrl = `http://localhost:${ROUTER_PORT}`;

  await fetch(`${routerUrl}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: "agent-zh-cn",
      endpoint: `http://localhost:${AGENT_A_PORT}/receive`,
      agent_card: { chorus_version: "0.2", user_culture: "zh-CN", supported_languages: ["zh-CN", "ja", "en"] },
    }),
  });

  await fetch(`${routerUrl}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: "agent-ja",
      endpoint: `http://localhost:${AGENT_B_PORT}/receive`,
      agent_card: { chorus_version: "0.2", user_culture: "ja", supported_languages: ["ja", "zh", "en"] },
    }),
  });

  console.log("[Router] Both agents registered\n");

  // 5. Run test cases
  for (const tc of TEST_CASES) {
    console.log(`--- ${tc.name} ---`);
    console.log(`Input: "${tc.input}" (${tc.senderCulture} → ${tc.receiverCulture})`);

    // Step A: Extract semantic + cultural context via LLM
    const t0 = Date.now();
    const semantics = await extractSemantic(llmClient, tc.input, tc.senderCulture);
    const extractMs = Date.now() - t0;

    console.log(`\n[LLM extractSemantic] (${extractMs}ms)`);
    console.log(`  original_semantic: ${semantics.original_semantic}`);
    console.log(`  cultural_context:  ${semantics.cultural_context ?? "(none)"}`);
    console.log(`  intent_type:       ${semantics.intent_type ?? "(none)"}`);

    // Step B: Create envelope + message
    const envelope: ChorusEnvelope = createEnvelope(
      semantics.original_semantic,
      tc.senderCulture,
      semantics.cultural_context,
      {
        intent_type: semantics.intent_type as ChorusEnvelope["intent_type"],
        formality: semantics.formality as ChorusEnvelope["formality"],
        emotional_tone: semantics.emotional_tone as ChorusEnvelope["emotional_tone"],
      },
    );
    const message = createChorusMessage(tc.input, envelope);

    // Step C: Send via router
    const senderId = tc.senderCulture === "zh-CN" ? "agent-zh-cn" : "agent-ja";
    const targetId = tc.receiverCulture === "ja" ? "agent-ja" : "agent-zh-cn";

    const t1 = Date.now();
    const routerRes = await fetch(`${routerUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_agent_id: senderId, target_agent_id: targetId, message }),
    });
    const forwardMs = Date.now() - t1;

    const routerBody = await routerRes.json() as Record<string, unknown>;
    console.log(`\n[Router forward] (${forwardMs}ms) status=${routerRes.status}`);

    // Step D: Check received message
    const received = tc.receiverCulture === "ja"
      ? receivedMessages[receivedMessages.length - 1]
      : receivedByA[receivedByA.length - 1];

    if (received) {
      console.log(`\n[Adapted output for ${tc.receiverCulture}]:`);
      console.log(`  "${received.adapted}"`);
    } else {
      console.log("\n[ERROR] No message received by target agent");
      console.log("  Router response:", JSON.stringify(routerBody, null, 2));
    }

    console.log("");
  }

  // 6. Cleanup
  routerServer.close();
  agentAServer.close();
  agentBServer.close();

  console.log("=== Smoke test complete ===");
  process.exit(0);
};

run().catch((err) => {
  console.error("E2E failed:", err);
  process.exit(1);
});
