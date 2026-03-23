#!/usr/bin/env ts-node
// Author: be-domain-modeler
/**
 * SSE Soak Test (Scenario A)
 *
 * Opens N inbox SSE connections and holds them for DURATION minutes.
 * Reports disconnections and health snapshot drift.
 *
 * Usage: HUB_URL=http://localhost:3000 npx ts-node scripts/load/sse-soak.ts [N] [DURATION_MIN]
 */
import {
  registerAgentId,
  sharedAgentId,
  connectInbox,
  drainSSE,
  fetchHealth,
  sleep,
  formatBytes,
} from "./lib";
import type { Agent, SSEConnection } from "./lib";

const N = parseInt(process.argv[2] ?? "100", 10);
const DURATION_MIN = parseInt(process.argv[3] ?? "30", 10);

const main = async () => {
  console.log(`\n=== SSE Soak Test: ${N} connections for ${DURATION_MIN} min ===\n`);

  const healthBefore = await fetchHealth();
  console.log("Health before:", JSON.stringify(healthBefore, null, 2));

  // Register agents
  console.log(`\nRegistering ${N} agents...`);
  const agents: Agent[] = [];
  for (let i = 0; i < N; i++) {
    agents.push(await registerAgentId(sharedAgentId(i)));
    if ((i + 1) % 25 === 0) console.log(`  registered ${i + 1}/${N}`);
  }

  // Connect inboxes
  console.log(`\nConnecting ${N} inboxes...`);
  const connections: SSEConnection[] = [];
  const connectFailures: string[] = [];

  for (const agent of agents) {
    try {
      const conn = await connectInbox(agent);
      drainSSE(conn);
      connections.push(conn);
    } catch (err) {
      connectFailures.push(`${agent.id}: ${err}`);
    }
  }

  console.log(`Connected: ${connections.length}, Failed: ${connectFailures.length}`);
  if (connectFailures.length > 0) {
    console.log("First 5 failures:", connectFailures.slice(0, 5));
  }

  // Hold and report periodically
  const startTime = Date.now();
  const endTime = startTime + DURATION_MIN * 60_000;

  while (Date.now() < endTime) {
    await sleep(60_000);
    const elapsed = Math.floor((Date.now() - startTime) / 60_000);
    const active = connections.filter((c) => !c.disconnected).length;
    const disconnected = connections.filter((c) => c.disconnected).length;

    let rssStr = "n/a";
    let sseStr = "n/a";
    try {
      const snap = await fetchHealth();
      rssStr = formatBytes(snap["process_rss_bytes"] as number ?? 0);
      sseStr = String(snap["inbox_connections"] ?? "n/a");
    } catch (err) {
      console.warn(`  ⚠ health fetch failed (non-fatal): ${err}`);
    }
    console.log(
      `[${elapsed} min] active=${active}/${connections.length} ` +
      `disconnected=${disconnected} ` +
      `rss=${rssStr} sse=${sseStr}`
    );
  }

  // Final report
  const disconnectCount = connections.filter((c) => c.disconnected).length;
  let healthAfter: Record<string, unknown> = {};
  try {
    healthAfter = await fetchHealth();
  } catch (err) {
    console.warn(`⚠ Final health fetch failed: ${err}`);
  }

  console.log("\n=== SSE Soak Final Report ===");
  console.log(`Duration: ${DURATION_MIN} min`);
  console.log(`Connections attempted: ${N}`);
  console.log(`Connect failures: ${connectFailures.length}`);
  console.log(`Disconnections during soak: ${disconnectCount}`);
  console.log(`Active at end: ${connections.length - disconnectCount}`);
  if (Object.keys(healthAfter).length > 0) {
    console.log("\nHealth after:", JSON.stringify(healthAfter, null, 2));
  }

  // Memory drift
  const rssBefore = healthBefore["process_rss_bytes"] as number ?? 0;
  const rssAfter = (healthAfter["process_rss_bytes"] as number) ?? 0;
  if (rssBefore > 0 && rssAfter > 0) {
    const delta = rssAfter - rssBefore;
    const pct = ((delta / rssBefore) * 100).toFixed(1);
    console.log(`\nRSS drift: ${formatBytes(delta)} (${pct}%)`);
  }

  // Verdict
  const pass = connectFailures.length === 0 && disconnectCount === 0;
  console.log(`\nVerdict: ${pass ? "PASS ✅" : "FAIL ❌"}`);
  if (!pass) {
    console.log("Failure reasons:");
    if (connectFailures.length > 0) console.log(`  - ${connectFailures.length} connect failures`);
    if (disconnectCount > 0) console.log(`  - ${disconnectCount} disconnections`);
  }

  // Cleanup
  for (const conn of connections) {
    conn.abort();
  }

  process.exit(pass ? 0 : 1);
};

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
