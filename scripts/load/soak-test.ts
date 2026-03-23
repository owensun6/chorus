#!/usr/bin/env ts-node
// Author: be-domain-modeler
/**
 * Soak Test (Scenario D)
 *
 * Sustained load: N SSE connections + periodic message sending for DURATION minutes.
 * Checks for memory leaks, WAL growth, SSE stability, and latency degradation.
 *
 * Usage: HUB_URL=http://localhost:3000 npx ts-node scripts/load/soak-test.ts [N] [DURATION_MIN] [MSG_PER_MIN]
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
  formatBytes,
} from "./lib";
import type { Agent, SSEConnection } from "./lib";

const N = parseInt(process.argv[2] ?? "30", 10);
const DURATION_MIN = parseInt(process.argv[3] ?? "30", 10);
const MSG_PER_MIN = parseInt(process.argv[4] ?? "60", 10);

const main = async () => {
  console.log(`\n=== Soak Test: ${N} agents, ${DURATION_MIN} min, ${MSG_PER_MIN} msg/min ===\n`);

  const healthSnapshots: Array<{ label: string; data: Record<string, unknown> }> = [];
  const snapBefore = await fetchHealth();
  healthSnapshots.push({ label: "start", data: snapBefore });
  console.log("Health at start:", JSON.stringify(snapBefore, null, 2));

  // Register agents: half senders, half receivers
  const halfN = Math.max(1, Math.floor(N / 2));
  console.log(`\nRegistering ${halfN * 2} agents (${halfN} senders + ${halfN} receivers)...`);

  const senders: Agent[] = [];
  const receivers: Agent[] = [];
  for (let i = 0; i < halfN; i++) {
    senders.push(await registerAgentId(sharedAgentId(i)));
    receivers.push(await registerAgentId(sharedAgentId(halfN + i)));
  }

  // Connect receiver inboxes
  console.log(`Connecting ${halfN} receiver inboxes...`);
  const connections: SSEConnection[] = [];
  let disconnectTotal = 0;

  for (const receiver of receivers) {
    try {
      const conn = await connectInbox(receiver);
      drainSSE(conn);
      connections.push(conn);
    } catch {
      disconnectTotal++;
    }
  }

  await sleep(500);

  // Sustained sending loop
  const allLatencies: number[] = [];
  let totalSent = 0;
  let totalFailed = 0;
  let total5xx = 0;
  const intervalMs = 60_000 / MSG_PER_MIN;

  const startTime = Date.now();
  const endTime = startTime + DURATION_MIN * 60_000;

  console.log(`\nSending ~${MSG_PER_MIN} msg/min for ${DURATION_MIN} min...\n`);

  let minute = 0;
  while (Date.now() < endTime) {
    const minuteStart = Date.now();
    const minuteLatencies: number[] = [];

    for (let m = 0; m < MSG_PER_MIN && Date.now() < endTime; m++) {
      const sIdx = m % senders.length;
      const rIdx = m % receivers.length;

      const result = await sendMessage(
        senders[sIdx],
        receivers[rIdx].id,
        `Soak msg ${totalSent}`,
      );

      totalSent++;
      minuteLatencies.push(result.latencyMs);
      allLatencies.push(result.latencyMs);
      if (!result.ok) totalFailed++;
      if (result.status >= 500) total5xx++;

      // Pace requests
      const elapsed = Date.now() - minuteStart;
      const expected = (m + 1) * intervalMs;
      if (elapsed < expected) {
        await sleep(expected - elapsed);
      }
    }

    minute++;
    const sorted = [...minuteLatencies].sort((a, b) => a - b);
    const active = connections.filter((c) => !c.disconnected).length;
    const newDisconnects = connections.filter((c) => c.disconnected).length;
    disconnectTotal = newDisconnects;

    console.log(
      `[min ${String(minute).padStart(2)}] ` +
      `sent=${minuteLatencies.length} ` +
      `p50=${percentile(sorted, 50).toFixed(0).padStart(4)}ms ` +
      `p95=${percentile(sorted, 95).toFixed(0).padStart(4)}ms ` +
      `active_sse=${active}/${halfN} ` +
      `disconnects=${disconnectTotal} ` +
      `5xx=${total5xx}`,
    );

    // Snapshot health every 5 minutes
    if (minute % 5 === 0) {
      const snap = await fetchHealth();
      healthSnapshots.push({ label: `${minute}min`, data: snap });
    }
  }

  // Final snapshot
  const snapAfter = await fetchHealth();
  healthSnapshots.push({ label: "end", data: snapAfter });

  // Overall latency analysis
  const sortedAll = [...allLatencies].sort((a, b) => a - b);

  console.log("\n=== Soak Test Final Report ===");
  console.log(`Duration: ${DURATION_MIN} min`);
  console.log(`Messages sent: ${totalSent}`);
  console.log(`Failures: ${totalFailed}`);
  console.log(`5xx: ${total5xx}`);
  console.log(`SSE disconnections: ${disconnectTotal}`);

  console.log(`\nOverall latency (ms):`);
  console.log(`  p50:  ${percentile(sortedAll, 50).toFixed(0)}`);
  console.log(`  p95:  ${percentile(sortedAll, 95).toFixed(0)}`);
  console.log(`  p99:  ${percentile(sortedAll, 99).toFixed(0)}`);
  console.log(`  max:  ${percentile(sortedAll, 100).toFixed(0)}`);

  // Health snapshot comparison
  console.log("\n--- Health Snapshots ---");
  for (const snap of healthSnapshots) {
    const d = snap.data;
    console.log(
      `  [${snap.label.padEnd(6)}] ` +
      `rss=${formatBytes(d["process_rss_bytes"] as number ?? 0).padStart(8)} ` +
      `heap=${formatBytes(d["process_heap_used_bytes"] as number ?? 0).padStart(8)} ` +
      `db=${formatBytes(d["db_size_bytes"] as number ?? 0).padStart(8)} ` +
      `wal=${formatBytes(d["wal_size_bytes"] as number ?? 0).padStart(8)} ` +
      `busy=${d["sqlite_busy_errors"] ?? 0}`,
    );
  }

  // Leak detection
  const rssBefore = snapBefore["process_rss_bytes"] as number ?? 0;
  const rssAfter = snapAfter["process_rss_bytes"] as number ?? 0;
  if (rssBefore > 0 && rssAfter > 0) {
    const delta = rssAfter - rssBefore;
    const pct = ((delta / rssBefore) * 100).toFixed(1);
    console.log(`\nMemory delta: ${formatBytes(delta)} (${pct}%)`);
    if (Number(pct) > 50) {
      console.log("  ⚠️  RSS grew >50% — investigate for memory leak");
    }
  }

  const walBefore = snapBefore["wal_size_bytes"] as number ?? 0;
  const walAfter = snapAfter["wal_size_bytes"] as number ?? 0;
  if (walAfter > 10 * 1024 * 1024) {
    console.log(`  ⚠️  WAL file is ${formatBytes(walAfter)} — consider checkpoint`);
  }

  // Service availability check only. Real backup validation must run
  // `npm run db:backup -- <path>` after the load test.
  console.log("\n--- Service Availability Check ---");
  try {
    const backupRes = await fetch(`${(process.env["HUB_URL"] ?? "http://localhost:3000")}/health`);
    console.log(`  /health still responds: ${backupRes.ok ? "✅" : "❌"}`);
  } catch (err) {
    console.log(`  /health failed: ❌ ${err}`);
  }

  // Cleanup
  for (const conn of connections) {
    conn.abort();
  }

  // Verdict
  const p95 = percentile(sortedAll, 95);
  const p99 = percentile(sortedAll, 99);
  const busyErrors = (snapAfter["sqlite_busy_errors"] as number ?? 0) -
    (snapBefore["sqlite_busy_errors"] as number ?? 0);

  console.log("\n=== Verdict ===");
  console.log(`5xx:              ${total5xx}   (target: 0)        ${total5xx === 0 ? "✅" : "❌"}`);
  console.log(`SQLITE_BUSY:      ${busyErrors}   (target: 0)        ${busyErrors === 0 ? "✅" : "❌"}`);
  console.log(`SSE disconnects:  ${disconnectTotal}   (target: 0)        ${disconnectTotal === 0 ? "✅" : "❌"}`);
  console.log(`p95 latency:      ${p95.toFixed(0)}ms (target: ≤2000ms) ${p95 <= 2000 ? "✅" : "❌"}`);
  console.log(`p99 latency:      ${p99.toFixed(0)}ms (target: ≤5000ms) ${p99 <= 5000 ? "✅" : "❌"}`);

  const pass = total5xx === 0 && busyErrors === 0 && disconnectTotal === 0 && p95 <= 2000 && p99 <= 5000;
  console.log(`\nOverall: ${pass ? "PASS ✅" : "FAIL ❌"}`);

  process.exit(pass ? 0 : 1);
};

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
