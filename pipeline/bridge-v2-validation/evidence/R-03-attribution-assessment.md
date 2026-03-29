<!-- Author: Lead -->
<!-- status: CLOSED 2026-03-28 -->

# R-03 Reply Attribution Assessment

## Current Level

`per-message attribution` (upgraded from `session-level acceptable` on 2026-03-28)

## Question

Can reply attribution be upgraded from `session-level acceptable` to `per-message attribution`?

## Conclusion

**CLOSED** -- per-message attribution is proven at all levels: code path (7-link chain), unit tests (4 tests), and live production state (69 relay records across 2 agents, 100% non-null `inbound_trace_id`, zero mismatches). The live observation that was the sole remaining requirement under HOLD has been obtained and documented in `R-03-live-roundtrip.md`.

## Analysis

### What "per-message attribution" means

Per-message attribution means: a specific outbound relay (reply) can be traced back to the specific inbound message (by `trace_id`) that caused it, not just to the session/route that the conversation belongs to.

### Code evidence for per-message mechanics

**activeTraces in OpenClawAdapter** (`openclaw.ts` L72, L103, L138):
- `private activeTraces = new Map<string, string>()` maps `route_key` to the most recent `trace_id`.
- On `deliverInbound()` (L103): `this.activeTraces.set(params.route_key, params.metadata.trace_id)` -- every delivery records which inbound trace is active for that route.
- On `emitReply()` (L138): `const inboundTraceId = this.activeTraces.get(routeKey) ?? null` -- the reply picks up the active inbound trace ID.
- The callback fires with `{ route_key, reply_text, inbound_trace_id }`.

**RelayRecord persistence** (`outbound.ts` L85-118, `types.ts` L71):
- `bindReply()` accepts `inboundTraceId: string | null` and stores it as `record.inbound_trace_id`.
- The `RelayRecord` type (types.ts L71) has `readonly inbound_trace_id: string | null`.
- This field is persisted in durable state before any HTTP submission.

**Outbound envelope and Hub submission** (`outbound.ts` L141-147):
- `submitRelay()` sends the envelope to Hub via `hubClient.submitRelay(apiKey, continuity.remote_peer_id, envelope, record.idempotency_key)`.
- The `idempotency_key` includes the `outbound_id`, and `hub_trace_id` is recorded on success.
- The `inbound_trace_id` is in the `RelayRecord` but is NOT included in the outbound `ChorusEnvelope` (L200-216). The envelope contains `sender_id`, `original_text`, `sender_culture`, `turn_number`, and `conversation_id`.

### Test evidence for per-message mechanics

**test_reply_attribution** (`openclaw.test.ts` L178-200):
- Delivers an inbound with `trace_id: 'trace-inbound-1'`.
- Calls `emitReply()` on the same route.
- Asserts `received[0].inbound_trace_id === 'trace-inbound-1'`.
- This proves the adapter correctly binds reply to inbound trace.

**test null inbound_trace_id** (`openclaw.test.ts` L203-217):
- `emitReply()` without prior delivery yields `inbound_trace_id: null`.
- Proves the mechanism does not fabricate attribution.

**test_bind_persists_before_submit** (`outbound.test.ts` L52-68):
- `pipeline.bindReply(ROUTE_KEY, 'My reply', 'inbound-t1')` persists `record.inbound_trace_id === 'inbound-t1'`.
- Proves the trace binding is durable before any network I/O.

### Evidence summary

| Link in chain | Evidence | Status |
|---------------|----------|--------|
| Adapter records active trace on delivery | `openclaw.ts` L103, `openclaw.test.ts` L178-200 | PROVEN |
| Adapter provides trace to reply callback | `openclaw.ts` L138, `openclaw.test.ts` L178-200 | PROVEN |
| Null trace when no prior delivery | `openclaw.test.ts` L203-217 | PROVEN |
| RelayRecord persists inbound_trace_id | `outbound.ts` L105, `outbound.test.ts` L52-68 | PROVEN |
| Session-level isolation (no cross-peer bleed) | `V-01-04-session-bleed.md` = NO bleed | PROVEN |
| Route attribution stable (deterministic key) | `V-01-03-route-attribution.md` = YES | PROVEN |
| Live relay records carry non-null inbound_trace_id | 69 production relay records, 100% attributed. `R-03-live-roundtrip.md` | PROVEN |

### Design note: activeTraces is last-writer-wins

`activeTraces` (`openclaw.ts` L72) maps `route_key -> trace_id`, storing only the most recent inbound trace per route. Under concurrent inbound messages on the same route, the reply would be attributed to the latest inbound. However, `RouteLock` in `inbound.ts` (L23-44) serializes same-route processing, making this overwrite scenario unreachable under normal operation.

## Verdict

**CLOSED**

| Dimension | Status | Detail |
|-----------|--------|--------|
| Adapter trace binding (code) | PROVEN | `openclaw.ts` L103, L138 |
| Adapter trace binding (unit test) | PROVEN | `openclaw.test.ts` L178-200 |
| RelayRecord trace persistence (code) | PROVEN | `outbound.ts` L105 |
| RelayRecord trace persistence (unit test) | PROVEN | `outbound.test.ts` L52-68 |
| Session-level isolation (live) | PROVEN | `V-01-04-session-bleed.md` = NO |
| Route determinism (live) | PROVEN | `V-01-03-route-attribution.md` = YES |
| Per-message trace in live relay | PROVEN | 69 production relay records, all with non-null `inbound_trace_id` matching `inbound_facts` entries. See `R-03-live-roundtrip.md` |
| Last-writer-wins safe under RouteLock | ACCEPTABLE | RouteLock serializes same-route processing; concurrent overwrite unlikely |

**Reply attribution upgraded to `per-message attribution`.** 69 live relay records across 2 production agents (xiaoyin@chorus, xiaox@chorus) all carry non-null `inbound_trace_id` matching the originating inbound `trace_id`. Zero null attributions, zero route_key mismatches. 7-link code path verified from SSE event through relay confirmation. Full evidence: [`R-03-live-roundtrip.md`](R-03-live-roundtrip.md).
