#!/usr/bin/env ts-node
// Author: be-domain-modeler
/**
 * Webhook Burst Test (Scenario C)
 *
 * Spins up a local stub HTTP server as the webhook target,
 * registers N agents pointing at it, then fires N concurrent
 * POST /messages through the webhook forwarding path.
 *
 * Usage: HUB_URL=http://localhost:3000 npx ts-node scripts/load/send-webhook-burst.ts [N] [STUB_PORT]
 */
import { createServer } from "http";
import {
  registerAgentId,
  sharedAgentId,
  sendMessage,
  fetchHealth,
  percentile,
  sleep,
  HUB_URL,
  IS_LOCAL_HUB,
} from "./lib";
import type { Agent } from "./lib";

const N = parseInt(process.argv[2] ?? "100", 10);
const STUB_PORT = parseInt(process.argv[3] ?? "4444", 10);
const WEBHOOK_URL = process.env["WEBHOOK_URL"];
const AGENT_POOL = Math.min(N, 100);
const SENDER_COUNT = Math.max(1, Math.floor(AGENT_POOL / 2));
const RECEIVER_COUNT = Math.max(1, AGENT_POOL - SENDER_COUNT);

// --- Stub Webhook Server ---

interface StubStats {
  received: number;
  errors: number;
  latencies: number[];
}

const startStub = (port: number): Promise<{ close: () => void; stats: StubStats }> => {
  const stats: StubStats = { received: 0, errors: 0, latencies: [] };

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const start = performance.now();
      const chunks: Buffer[] = [];

      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        stats.received++;
        stats.latencies.push(performance.now() - start);

        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            status: "received",
            sender_id: body.envelope?.sender_id ?? "unknown",
          }));
        } catch {
          stats.errors++;
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid json" }));
        }
      });

      req.on("error", () => {
        stats.errors++;
        res.writeHead(500);
        res.end();
      });
    });

    server.listen(port, () => {
      resolve({
        close: () => server.close(),
        stats,
      });
    });
    server.on("error", reject);
  });
};

// --- Main ---

const main = async () => {
  console.log(`\n=== Webhook Burst Test: ${N} concurrent messages ===\n`);

  let stub:
    | { close: () => void; stats: StubStats }
    | undefined;
  let stubUrl = WEBHOOK_URL;

  if (!stubUrl) {
    if (!IS_LOCAL_HUB) {
      throw new Error(
        "WEBHOOK_URL is required when HUB_URL is remote. The local stub at 127.0.0.1 is not reachable from Fly.",
      );
    }
    console.log(`Starting stub webhook server on port ${STUB_PORT}...`);
    stub = await startStub(STUB_PORT);
    stubUrl = `http://127.0.0.1:${STUB_PORT}`;
    console.log(`Stub ready at ${stubUrl}`);
  } else {
    console.log(`Using external webhook target: ${stubUrl}`);
  }

  const healthBefore = await fetchHealth();
  console.log("\nHealth before:", JSON.stringify(healthBefore, null, 2));

  // Register senders (no endpoint — they just send)
  console.log(`\nRegistering ${SENDER_COUNT} senders...`);
  const senders: Agent[] = [];
  for (let i = 0; i < SENDER_COUNT; i++) {
    senders.push(await registerAgentId(sharedAgentId(i)));
    if ((i + 1) % 25 === 0 || i + 1 === SENDER_COUNT) {
      console.log(`  senders: ${i + 1}/${SENDER_COUNT}`);
    }
  }

  // Register receivers WITH webhook endpoint (no SSE inbox)
  console.log(`Registering ${RECEIVER_COUNT} receivers (webhook endpoint: ${stubUrl})...`);
  const receivers: Agent[] = [];
  for (let i = 0; i < RECEIVER_COUNT; i++) {
    receivers.push(await registerAgentId(sharedAgentId(SENDER_COUNT + i), stubUrl));
    if ((i + 1) % 25 === 0 || i + 1 === RECEIVER_COUNT) {
      console.log(`  receivers: ${i + 1}/${RECEIVER_COUNT}`);
    }
  }

  await sleep(500);

  // Fire all messages concurrently
  console.log(`\nFiring ${N} concurrent POST /messages (webhook path)...`);
  const burstStart = performance.now();

  const results = await Promise.all(
    Array.from({ length: N }, (_, i) =>
      sendMessage(
        senders[i % senders.length],
        receivers[i % receivers.length].id,
        `Webhook burst message #${i}`,
      )
    ),
  );

  const totalTime = performance.now() - burstStart;

  // Analyze hub-side results
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const statusCounts: Record<number, number> = {};
  for (const r of results) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }

  const successes = results.filter((r) => r.ok).length;
  const fiveXx = results.filter((r) => r.status >= 500).length;
  const fourTwoNine = results.filter((r) => r.status === 429).length;
  const timeouts = results.filter((r) => r.status === 0).length;
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const pMax = percentile(latencies, 100);

  console.log("\n=== Hub-Side Results ===");
  console.log(`Wall clock: ${totalTime.toFixed(0)}ms`);
  console.log(`Success: ${successes}/${N}`);
  console.log(`Status distribution:`, statusCounts);
  console.log(`Timeouts (status=0): ${timeouts}`);

  console.log(`\nHub latency (ms):`);
  console.log(`  p50:  ${p50.toFixed(0)}`);
  console.log(`  p95:  ${p95.toFixed(0)}`);
  console.log(`  p99:  ${p99.toFixed(0)}`);
  console.log(`  max:  ${pMax.toFixed(0)}`);

  // Stub-side results
  const stubLatSorted = [...(stub?.stats.latencies ?? [])].sort((a, b) => a - b);
  console.log("\n=== Stub-Side Results ===");
  console.log(`Requests received: ${stub?.stats.received ?? "n/a"}`);
  console.log(`Parse errors: ${stub?.stats.errors ?? "n/a"}`);
  if (stubLatSorted.length > 0) {
    console.log(`Stub processing latency (ms):`);
    console.log(`  p50:  ${percentile(stubLatSorted, 50).toFixed(1)}`);
    console.log(`  p95:  ${percentile(stubLatSorted, 95).toFixed(1)}`);
    console.log(`  max:  ${percentile(stubLatSorted, 100).toFixed(1)}`);
  }

  const healthAfter = await fetchHealth();
  console.log("\nHealth after:", JSON.stringify(healthAfter, null, 2));

  const busyErrors = (healthAfter["sqlite_busy_errors"] as number ?? 0) -
    (healthBefore["sqlite_busy_errors"] as number ?? 0);

  // Verdict
  console.log("\n=== Verdict ===");
  console.log(`5xx count:        ${fiveXx}   (target: 0)        ${fiveXx === 0 ? "✅" : "❌"}`);
  console.log(`429 count:        ${fourTwoNine}   (info only)`);
  console.log(`Timeouts:         ${timeouts}   (target: 0)        ${timeouts === 0 ? "✅" : "❌"}`);
  console.log(`SQLITE_BUSY:      ${busyErrors}   (target: 0)        ${busyErrors === 0 ? "✅" : "❌"}`);
  console.log(`p95 latency:      ${p95.toFixed(0)}ms (target: ≤2000ms) ${p95 <= 2000 ? "✅" : "❌"}`);
  console.log(`p99 latency:      ${p99.toFixed(0)}ms (target: ≤5000ms) ${p99 <= 5000 ? "✅" : "❌"}`);
  if (stub) {
    console.log(`Stub received:    ${stub.stats.received}/${N}        ${stub.stats.received === N ? "✅" : "❌"}`);
  } else {
    console.log("Stub received:    n/a (external webhook target)");
  }

  const stubOk = stub ? stub.stats.received === N : true;
  const pass = fiveXx === 0 && timeouts === 0 && busyErrors === 0 &&
    p95 <= 2000 && p99 <= 5000 && stubOk;
  console.log(`\nOverall: ${pass ? "PASS ✅" : "FAIL ❌"}`);

  // Cleanup
  stub?.close();
  process.exit(pass ? 0 : 1);
};

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
