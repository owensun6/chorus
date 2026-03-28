<!-- Author: Lead -->

# Chorus Security Vulnerability Audit — 2026-03-28

> Auditor: 道一 (Claude Opus 4.6)
> Scope: `src/server/`, `src/bridge/`, `src/agent/`, `src/shared/`, `bin/`
> Baseline: `main` @ `3fa03a7`
> Method: 4 parallel audit agents (server / bridge / scripts / test-coverage) + manual cross-validation

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| HIGH | 7 |
| MEDIUM | 8 |
| LOW | 8 |
| **Security subtotal** | **28** |
| Security-adjacent correctness | 1 |
| **Grand total** | **29** |

> Dedup/reclassification log:
> - M-01 (x-forwarded-for trust) removed as duplicate of H-01
> - H-09 (unverifiable delivery advances cursor) moved to "Security-Adjacent Correctness" — reliability issue per `final-verdict.md`
> - H-04 (relay rate limiting) downgraded to M-09 — server-side HTTP + key rate limits already apply to relay path; finding is "Bridge lacks additional local throttle," not "no rate control"

**Branch coverage**: 74.8% (below 80% threshold — `H-01` from Codex review still open)

**Top 3 systemic risks**:
1. GET endpoints bypass auth entirely (`auth.ts:15`) — `/activity`, `/events`, `/console`, `/arena` all public
2. `ChorusEnvelopeSchema.passthrough()` (`types.ts:37`) + no `original_text` max length — unbounded data propagation
3. API key in SSE query param (`hub-client.ts:237`, `routes.ts:174`) — key leaks in logs/referrers

---

## CRITICAL (5)

### C-01: All GET Endpoints Bypass Authentication

**File**: `src/server/auth.ts:15`
```typescript
if (c.req.method === "GET") return next();
```

**Impact**: Sensitive endpoints exposed without auth:
- `GET /activity` (routes.ts:620) — full operational event log
- `GET /events` (routes.ts:627) — real-time SSE activity stream
- `GET /agents` (routes.ts:246) — agent registry enumeration
- `GET /agents/:id` (routes.ts:251) — agent details incl. endpoint URLs
- `GET /discover` (routes.ts:264) — directory with online/offline status
- `GET /console` (routes.ts:674) — admin UI
- `GET /arena` (routes.ts:678) — admin UI

**Remediation**: Replace blanket GET exemption with explicit public-path allowlist:
```typescript
const PUBLIC_GETS = new Set(["/health", "/skill", "/.well-known/agent.json"]);
if (c.req.method === "GET" && PUBLIC_GETS.has(c.req.path)) return next();
```

---

### C-02: API Key Exposed in SSE Query Parameter

**Files**: `src/server/routes.ts:174`, `src/bridge/hub-client.ts:237`

Hub server accepts `?token=ca_xxx` for SSE EventSource (which can't set headers). Bridge client uses this path.

**Impact**: API key appears in:
- HTTP access logs (proxy, CDN, server)
- Browser history / autocomplete
- Referrer headers to external sites

**Remediation**: Replace with short-lived session token exchange:
1. `POST /agent/session` (auth'd) → returns ephemeral `session_token` (TTL 5 min)
2. `GET /agent/inbox?session=<ephemeral>` — validates session, not API key

---

### C-03: Envelope Schema Accepts Arbitrary Fields + No Text Size Limit

**File**: `src/shared/types.ts:22-37`

```typescript
const ChorusEnvelopeSchema = z.object({
  // ...
  original_text: z.string().min(1), // ← No max length!
}).passthrough();                     // ← Accepts unknown fields!
```

**Impact**:
- Hub enforces `bodyLimit({ maxSize: 65536 })` at `src/server/index.ts:29,68`, capping each request to 64 KiB. This limits per-message `original_text` to ~64 KiB minus envelope overhead (~63 KiB practical max). However, the Bridge side (`src/bridge/inbound.ts`) has no equivalent limit — messages from Hub history replay bypass the HTTP body limit.
- `.passthrough()` allows injected fields (`{"malicious_key": "..."}`) to be silently stored in state and forwarded to webhook endpoints. This is the primary concern: the schema does not reject unknown data.
- On the Bridge path: 63 KiB × 500 inbound_facts (pruning cap) = ~31 MB state file — significant but not catastrophic. The real risk is schema laxness, not size.

**Mitigating factor**: `src/server/index.ts:68` body limit prevents the Hub from accepting >64 KiB payloads. The vulnerability direction (no `original_text` max + passthrough) is real, but the quantified worst-case must account for this existing control.

**Remediation**:
```typescript
original_text: z.string().min(1).max(10_000),
// ...
}).strict(); // Reject unknown fields
```

---

### C-04: SSRF via Unvalidated Webhook Endpoint

**File**: `src/server/routes.ts:512-517` (and :705-710)

Agent registration accepts any URL as `endpoint`. The Hub then does `fetch(target.endpoint, ...)` to deliver messages.

**Impact**: Attacker registers agent with `endpoint: "http://169.254.169.254/latest/meta-data/"` (cloud metadata) or `http://localhost:5432/` (internal DB).

**Remediation**: Validate endpoint URL before registration:
- Block RFC 1918 ranges (10.x, 172.16-31.x, 192.168.x), loopback (127.x), link-local (169.254.x)
- Block `localhost`, `0.0.0.0`
- Require HTTPS in production
- DNS rebinding protection: resolve hostname at registration, re-resolve at delivery, reject if IP changed to private range

---

### C-05: Idempotency Store Grows Unbounded

**File**: `src/server/idempotency.ts:31-56`

Records inserted via `stmtInsert` but never deleted. No TTL, no cleanup.

**Impact**: Disk exhaustion. Every message creates a permanent idempotency record.

**Remediation**: Add periodic cleanup:
```sql
DELETE FROM idempotency_keys WHERE created_at < datetime('now', '-24 hours');
```
Run on a timer (e.g., every hour) or at startup.

---

## HIGH (7)

### H-01: Rate Limit Bypass via X-Forwarded-For Spoofing

**File**: `src/server/rate-limit.ts:18-21`

Trusts `X-Forwarded-For` header directly. Attacker sets `X-Forwarded-For: 1.2.3.4` to get fresh rate limit bucket.

**Remediation**: Only trust proxy headers from known proxy IPs, or add per-API-key rate limiting independent of IP.

---

### H-02: SSE Buffer Unbounded Memory

**File**: `src/bridge/hub-client.ts:277-310`

```typescript
let buffer = '';
// ...
buffer += decoder.decode(value, { stream: true });
```

Malicious Hub sends endless data without `\n\n` delimiter → OOM crash.

**Remediation**: `if (buffer.length > 64_000) throw new Error("SSE event exceeds max size");`

---

### H-03: No Envelope Signature / Replay Protection

**Files**: `src/bridge/inbound.ts:82-87`, `src/agent/receiver.ts:38-53`

Envelopes validated for format only, not authenticity. Any party that can reach the Hub can fabricate messages from any sender.

**Remediation**: Phase 2 protocol addition: Ed25519 signature + timestamp_signed_at field. Reject messages > 5 min old.

---

### H-05: State Pruning Can Balloon Indefinitely

**File**: `src/bridge/state.ts:125-144`

If all relay_evidence entries are unconfirmed, none are pruned, and state grows without bound.

**Remediation**: If deficit > prunable.length, begin evicting oldest unconfirmed relays by `submitted_at` with a warning log.

---

### H-06: Shell Script Command Injection

**File**: `bin/alpha-smoke.sh:24`

`expected_field` embedded directly into Python code via shell expansion:
```bash
print(d$(echo "$expected_field"))
```

**Remediation**: Use `jq` or pass field path as separate argument to a safe JSON accessor.

---

### H-07: Temp Log File Symlink Attack

**File**: `bin/alpha-probe-light.sh:19`

Writes to `/tmp/chorus-alpha-probe.jsonl` without checking for symlinks or setting secure permissions.

**Remediation**: Use `mktemp` for unique log path, or write to project-local directory.

---

### H-08: agent_id Format Not Enforced at Registration

**File**: `src/server/validation.ts:6,14`

`SENDER_ID_REGEX` exists in `types.ts` but is NOT applied in `RegisterAgentBodySchema` or `SelfRegisterBodySchema`. Agent can register as `"anything"` without `name@host` format.

**Remediation**: Add `.regex(SENDER_ID_REGEX)` to both registration schemas.

---

---

## MEDIUM (8)

| ID | File:Line | Finding | Remediation |
|----|-----------|---------|-------------|
| M-02 | `activity.ts:53-55` | Activity events accept arbitrary `data` object, no schema | Define per-event-type Zod schemas |
| M-03 | `routes.ts:525,531` | Error messages expose downstream HTTP status codes | Generic messages to clients, log details server-side |
| M-04 | `state.ts:17-28` | Cursor comparison uses string lexicographic, not Date semantics | Use `new Date().getTime()` for comparison |
| M-05 | `openclaw.ts:72-73` | `activeTraces` Map never expires entries | Add TTL cleanup (24h) |
| M-06 | `inbound.ts:215` | `remote_peer_id` set from `event.sender_id` without re-validating regex | Validate against `SENDER_ID_REGEX` |
| M-07 | `inbound.ts:210-211` | No turn_number monotonicity enforcement | Log + reject out-of-order turns |
| M-08 | `probe-sse-timestamp.sh:1-11` | Domain parameter used directly in curl URL without validation | Validate hostname format |
| M-09 | `outbound.ts:125-147` | Bridge lacks local per-route throttle before hitting Hub (server-side HTTP+key rate limits still apply via `index.ts:67`, `rate-limit.ts:97-108`) | Add local per-route limiter as defense-in-depth |

## LOW (8)

| ID | File:Line | Finding |
|----|-----------|---------|
| L-01 | `registry.ts:91` | API key prefix `ca_` makes keys identifiable |
| L-02 | `routes.ts:15-16` | Hardcoded rate limit windows (not configurable) |
| L-03 | `outbound.ts:101` | Predictable idempotency key format |
| L-04 | `inbound.ts:89` | No self-message rejection |
| L-05 | `recovery.ts:189-214` | History envelopes not re-validated against schema |
| L-06 | `hub-client.ts:322-339` | No Content-Length validation on history response |
| L-07 | `fusion-lint.sh:30,55` | `find` output in unquoted for-loop (space-in-path bug) |
| L-08 | `comm-send.sh:14-15` | Path traversal possible via `TO` parameter |

---

## Test Coverage Gap Summary

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Statements | 82.85% | 80% | PASS |
| Branches | **74.8%** | 80% | **FAIL** |
| Functions | 82.92% | 80% | PASS |
| Lines | 84.95% | 80% | PASS |

**Weakest modules** (by branch coverage):
- `src/demo/index.ts` — 23.61% (demo code, low priority)
- `src/server/index.ts` — 60.27% (entry point, needs startup/shutdown tests)
- `src/agent/index.ts` — 62.71% (entry point, needs error-path tests)
- `src/bridge/runtime-v2.test.ts` — 58.65% branches (integration test target)

**Missing test categories**:
- No explicit body size limit tests (maxBodyBytes enforcement)
- No concurrent invite code race condition test
- No SQL injection regression tests (safe due to prepared statements, but no proof)
- No SSE reconnection behavior tests

---

## Remediation Priority

### Immediate (before next deploy)

1. **C-01**: Replace blanket GET auth bypass with allowlist
2. **C-03**: Add `original_text` max length + remove `.passthrough()`
3. **C-05**: Add idempotency key cleanup timer
4. **H-06**: Fix shell injection in `alpha-smoke.sh`

### Short-term (within 1 sprint)

5. **C-02**: Replace query-param token with session token exchange
6. **C-04**: Add SSRF protection (block private IPs)
7. **H-02**: Add SSE buffer size limit
8. **H-08**: Enforce `SENDER_ID_REGEX` in registration schemas

### Medium-term (within 1 month)

10. **H-01**: Per-API-key rate limiting
11. **H-03**: Envelope signatures (protocol v0.5)
12. **H-05**: Fix state pruning for unconfirmed relays
13. Branch coverage → 80% (close the 5.2% gap)

---

## Security-Adjacent Correctness (Not Security Vulnerabilities)

### SAC-01: Unverifiable Delivery Advances Cursor

**File**: `src/bridge/inbound.ts:276-286`

Timeout-marked-unverifiable messages still advance the cursor. If the delivery actually succeeded but timed out, recovery won't reprocess. If it failed, the message is permanently lost.

**Why not a security issue**: This is a reliability/acceptance semantics decision, already documented in `final-verdict.md` as the accepted runtime truth (`delivery_unverifiable acceptable`). It affects message durability, not confidentiality/integrity/availability from an attacker's perspective.

**Remediation**: Consider not advancing cursor for `unverifiable` — treat as retryable until host confirms or max-retries reached. This is a correctness improvement, not a security fix.

---

## Methodology Notes

- 4 parallel audit agents ran independently on server/bridge/scripts/test dimensions
- Cross-validated CRITICAL and HIGH findings against source code
- Deduplicated overlapping findings (e.g., API-key-in-query found by both server and bridge audits)
- Severity rated by impact × exploitability, not theoretical worst-case
- Findings like "cursor string comparison" (M-04) rated MEDIUM because ISO8601 is designed for lexicographic ordering — the risk is real but narrow (timezone format variants, leap seconds)
