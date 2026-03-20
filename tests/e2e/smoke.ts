// Author: Lead — Phase 1 E2E smoke test (v0.4)
// Usage: DASHSCOPE_API_KEY=xxx npx ts-node tests/e2e/smoke.ts
import { serve } from "@hono/node-server";
import { AgentRegistry } from "../../src/server/registry";
import { createApp } from "../../src/server/routes";
import { createReceiver } from "../../src/agent/receiver";
import { createLLMClient, generateCulturalContext } from "../../src/agent/llm";
import { createEnvelope } from "../../src/agent/envelope";
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
    senderId: "agent-zh-cn@localhost",
    receiverCulture: "ja",
    targetId: "agent-ja@localhost",
  },
  {
    name: "日本谦逊→中国文化适配",
    input: "つまらないものですが、お受け取りください。",
    senderCulture: "ja",
    senderId: "agent-ja@localhost",
    receiverCulture: "zh-CN",
    targetId: "agent-zh-cn@localhost",
  },
];

// --- Orchestrate ---
const run = async () => {
  console.log("=== E2E Smoke Test (v0.4) ===\n");

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
      agent_id: "agent-zh-cn@localhost",
      endpoint: `http://localhost:${AGENT_A_PORT}/receive`,
      agent_card: { card_version: "0.3", user_culture: "zh-CN", supported_languages: ["zh-CN", "ja", "en"] },
    }),
  });

  await fetch(`${routerUrl}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: "agent-ja@localhost",
      endpoint: `http://localhost:${AGENT_B_PORT}/receive`,
      agent_card: { card_version: "0.3", user_culture: "ja", supported_languages: ["ja", "zh-CN", "en"] },
    }),
  });

  console.log("[Router] Both agents registered\n");

  // 5. Run test cases
  for (const tc of TEST_CASES) {
    console.log(`--- ${tc.name} ---`);
    console.log(`Input: "${tc.input}" (${tc.senderCulture} → ${tc.receiverCulture})`);

    // Step A: Generate cultural context via LLM
    const t0 = Date.now();
    const context = await generateCulturalContext(llmClient, tc.input, tc.senderCulture);
    const contextMs = Date.now() - t0;

    console.log(`\n[LLM generateCulturalContext] (${contextMs}ms)`);
    console.log(`  cultural_context: ${context.cultural_context ?? "(none)"}`);

    // Step B: Create v0.4 envelope
    const envelope: ChorusEnvelope = createEnvelope(
      tc.senderId,
      tc.input,
      tc.senderCulture,
      context.cultural_context,
    );

    // Step C: Send via router (v0.4 naked envelope format)
    const t1 = Date.now();
    const routerRes = await fetch(`${routerUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiver_id: tc.targetId, envelope }),
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
