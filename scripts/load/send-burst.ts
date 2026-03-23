#!/usr/bin/env ts-node
// Author: be-domain-modeler
/**
 * Burst Send Test (Scenario B)
 *
 * Registers N sender/receiver pairs, connects receiver inboxes,
 * then fires N concurrent POST /messages. Measures latency distribution
 * and checks acceptance criteria.
 *
 * Usage: HUB_URL=http://localhost:3000 npx ts-node scripts/load/send-burst.ts [N]
 */
import {
  registerAgentId,
  sharedAgentId,
  connectInbox,
  drainSSE,
  sendMessage,
  fetchHealth,
  percentile,
  sleep,
} from "./lib";
import type { Agent } from "./lib";

const N = parseInt(process.argv[2] ?? "100", 10);
const SENDER_COUNT = Math.max(1, Math.floor(Math.min(N, 100) / 2));
const RECEIVER_COUNT = Math.max(1, Math.min(N, 100) - SENDER_COUNT);

const main = async () => {
  console.log(`\n=== Burst Send Test: ${N} concurrent messages ===\n`);

  const healthBefore = await fetchHealth();
  console.log("Health before:", JSON.stringify(healthBefore, null, 2));

  // Register sender + receiver agents
  console.log(`\nRegistering ${SENDER_COUNT + RECEIVER_COUNT} agents (${SENDER_COUNT} senders + ${RECEIVER_COUNT} receivers)...`);
  const senders: Agent[] = [];
  const receivers: Agent[] = [];

  for (let i = 0; i < SENDER_COUNT; i++) {
    senders.push(await registerAgentId(sharedAgentId(i)));
    if ((i + 1) % 25 === 0 || i + 1 === SENDER_COUNT) {
      console.log(`  senders: ${i + 1}/${SENDER_COUNT}`);
    }
  }
  for (let i = 0; i < RECEIVER_COUNT; i++) {
    receivers.push(await registerAgentId(sharedAgentId(SENDER_COUNT + i)));
    if ((i + 1) % 25 === 0 || i + 1 === RECEIVER_COUNT) {
      console.log(`  receivers: ${i + 1}/${RECEIVER_COUNT}`);
    }
  }

  // Connect receiver inboxes
  console.log(`\nConnecting ${RECEIVER_COUNT} receiver inboxes...`);
  let inboxFailures = 0;
  for (const receiver of receivers) {
    try {
      const conn = await connectInbox(receiver);
      drainSSE(conn);
    } catch {
      inboxFailures++;
    }
  }
  console.log(`Inboxes connected: ${RECEIVER_COUNT - inboxFailures}, Failed: ${inboxFailures}`);

  // Let connections stabilize
  await sleep(500);

  // Fire all messages concurrently
  console.log(`\nFiring ${N} concurrent POST /messages...`);
  const burstStart = performance.now();

  const results = await Promise.all(
    senders.map((sender, i) =>
      sendMessage(sender, receivers[i % receivers.length].id, `Burst test message #${i}`),
    ).concat(
      Array.from({ length: Math.max(0, N - senders.length) }, (_, idx) => {
        const i = senders.length + idx;
        return sendMessage(
          senders[i % senders.length],
          receivers[i % receivers.length].id,
          `Burst test message #${i}`,
        );
      }),
    ),
  );

  const totalTime = performance.now() - burstStart;

  // Analyze
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const statusCounts: Record<number, number> = {};
  for (const r of results) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }

  const successes = results.filter((r) => r.ok).length;
  const fiveXx = results.filter((r) => r.status >= 500).length;
  const fourTwoNine = results.filter((r) => r.status === 429).length;
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const pMax = percentile(latencies, 100);

  console.log("\n=== Results ===");
  console.log(`Wall clock: ${totalTime.toFixed(0)}ms`);
  console.log(`Success: ${successes}/${N}`);
  console.log(`Status distribution:`, statusCounts);
  console.log(`\nLatency (ms):`);
  console.log(`  p50:  ${p50.toFixed(0)}`);
  console.log(`  p95:  ${p95.toFixed(0)}`);
  console.log(`  p99:  ${p99.toFixed(0)}`);
  console.log(`  max:  ${pMax.toFixed(0)}`);

  const healthAfter = await fetchHealth();
  console.log("\nHealth after:", JSON.stringify(healthAfter, null, 2));

  // Verdict against acceptance criteria
  const busyErrors = (healthAfter["sqlite_busy_errors"] as number ?? 0) -
    (healthBefore["sqlite_busy_errors"] as number ?? 0);

  console.log("\n=== Verdict ===");
  console.log(`5xx count:        ${fiveXx}   (target: 0)        ${fiveXx === 0 ? "✅" : "❌"}`);
  console.log(`429 count:        ${fourTwoNine}   (info only)`);
  console.log(`SQLITE_BUSY:      ${busyErrors}   (target: 0)        ${busyErrors === 0 ? "✅" : "❌"}`);
  console.log(`p95 latency:      ${p95.toFixed(0)}ms (target: ≤2000ms) ${p95 <= 2000 ? "✅" : "❌"}`);
  console.log(`p99 latency:      ${p99.toFixed(0)}ms (target: ≤5000ms) ${p99 <= 5000 ? "✅" : "❌"}`);

  const pass = fiveXx === 0 && busyErrors === 0 && p95 <= 2000 && p99 <= 5000;
  console.log(`\nOverall: ${pass ? "PASS ✅" : "FAIL ❌"}`);

  process.exit(pass ? 0 : 1);
};

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
