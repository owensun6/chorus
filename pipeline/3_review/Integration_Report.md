<!-- Author: Lead -->

# Bridge v2 — Stage 6 Integration Report

> E2E connectivity, data penetration, chaos/edge-case verification outcomes.

## 1. E2E Connectivity (iv-01)

**Verdict: PASS**

| Check | Result |
|-------|--------|
| Server boot | DB init → subsystems → middleware → routes → graceful shutdown: all wired |
| Core API journeys | 6 integration tests through full createApp() stack: self-register→auth, SSE delivery, queued→poll, idempotency replay/conflict, inclusive boundary |
| Bridge pipeline integration | Inbound/outbound/recovery all tested with real DurableStateManager file I/O + mock host adapters |
| HTTP status codes | 200/201/202/400/401/403/404/409/429/502/503 all consistent across routes |
| CORS | Not configured — same-origin pages (/console, /arena) unaffected. Bridge runtime is server-to-server. |

## 2. Data Penetration & ACID (iv-02)

**Verdict: PASS (after fix)**

### Serialization Integrity
- DurableStateManager JSON round-trip: correct (no Date/BigInt/undefined loss)
- message-store envelope serialize/deserialize: JSON.stringify → JSON.parse, intact
- idempotency response serialize/deserialize: intact

### Concurrent Write Protection
- **Hub (SQLite)**: WAL mode, busy_timeout=5000ms, registerSelf wrapped in IMMEDIATE transaction
- **Bridge (JSON)**: **FIXED** — `DurableStateManager.mutate()` provides process-wide async mutex. All state writes (inbound observe+dedupe, delivery outcome, outbound submit/confirm, recovery cursor advance) go through mutate(). Cross-route writes are serialized.
- **Regression test**: `test_cross_route_no_overwrite` — two concurrent different-route messages, both inbound_facts and continuity entries survive

### Data Flow Penetration (verified traces)
| Trace | Path | Result |
|-------|------|--------|
| Envelope | POST /messages → SSE → messageStore → GET /agent/messages | Intact |
| hub_timestamp | parseSSEEvent → InboundFact → DurableState save | Intact |
| idempotency_key | bindReply → save → submitRelay → HTTP header | Intact |

## 3. Chaos & Edge Case (iv-03)

**Verdict: PASS (after fixes)**

### Timeout Semantics (Accepted)

| Path | Timeout | On Timeout | Semantics |
|------|---------|------------|-----------|
| HubClient.fetchHistory | 30s (configurable) | Throws HubClientError | Fail closed — recovery retries with backoff, SSE never connects without successful catchup |
| HubClient.submitRelay | 60s (configurable) | Throws HubClientError | Retryable — relay stays with submitted_at=null, same idempotency_key reused on retry |
| Host deliverInbound | 30s (configurable) | `terminal_disposition: delivery_unverifiable` | **Non-retryable** — underlying send may have completed, cannot prove cancellation. Cursor advances. Recovery will NOT re-deliver. |

### Duplicate Delivery Prevention
- Delivery timeout → `delivery_unverifiable` (non-retryable, cursor advances)
- Subsequent processMessage with same trace_id → dedupe detects `cursor_advanced=true` → terminal_disposition=duplicate
- **Test**: `test_timeout_no_duplicate_delivery` — proves deliverInbound called exactly once, second attempt deduped

### Boundary Injection
| Input | Protection |
|-------|-----------|
| trace_id with path separators | Used as JSON key only, not file path. Server-generated UUID. |
| Empty original_text | Zod `.min(1)` rejects |
| Oversized Idempotency-Key | `.length > 256` → 400 |
| Invalid route_key format | `resolveLocalAnchor` validates regex |

### Crash Resistance
| Scenario | Behavior |
|----------|----------|
| Crash after writeFileSync, before renameSync | Original .json preserved, .tmp orphaned, load() reads .json |
| Corrupted state file | parseJson throws with file path in message |
| DB locked by other process | busy_timeout=5000ms, then SQLITE_BUSY propagates |

### Resource Exhaustion (Deferred)
- RouteLock: entries now cleaned on release (C-1 fixed)
- mutate() lock: standard Promise-chain mutex, no leak
- messages/idempotency_keys/inbound_facts: unbounded growth accepted for alpha (deferred warnings)

## 4. Test Signal

```
Suites: 30/30 passed
Tests:  395/395 passed
Coverage: 80% thresholds met
TypeScript: tsc --noEmit clean
```
