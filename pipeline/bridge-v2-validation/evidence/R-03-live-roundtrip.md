<!-- Author: validation-worker -->
# R-03: Per-Message Reply Attribution -- Live Round-Trip Evidence

## Observation Method

Live durable state files from two production agents (`xiaoyin@chorus`, `xiaox@chorus`) were read directly from `~/.chorus/state/`. These files are written by the Bridge runtime during actual Hub SSE message processing and outbound relay submission. No code was modified to produce this evidence -- the state files are the natural output of the Bridge v2 pipeline operating against the live agchorus.com Hub.

Additionally, an exhaustive code-path trace was performed to prove the attribution chain is structurally unbroken from SSE event receipt through relay submission.

## Evidence Chain -- Observation 1 (xiaoyin@chorus, probe round-trip)

| Field | Value |
|-------|-------|
| inbound trace_id | `e4e393c9-c43c-47cb-a63d-9d5d1b5e508f` |
| route_key | `xiaoyin@chorus:live-xiaoyin-probe-1774526454304@chorus` |
| inbound observed_at | `2026-03-26T12:00:56.175Z` |
| inbound hub_timestamp | `2026-03-26T12:00:56.034Z` |
| inbound cursor_advanced | `true` |
| inbound disposition | `delivery_unverifiable` |
| relay_record_id | `8997ffde-2d2f-4b46-950b-a340a7c2f539` |
| relay_evidence.inbound_trace_id | `e4e393c9-c43c-47cb-a63d-9d5d1b5e508f` |
| relay_evidence.route_key | `xiaoyin@chorus:live-xiaoyin-probe-1774526454304@chorus` |
| hub_trace_id | `302f8165-9c70-4ca2-9397-882794624d73` |
| relay confirmed | `true` |
| relay submitted_at | `2026-03-26T12:01:08.801Z` |
| reply_text (prefix) | `"xiaoyin probe acknowledged. I'm online and ready."` |

**Match check**: `inbound_facts["e4e393c9..."].route_key` === `relay_evidence["8997ffde..."].route_key` === `relay_evidence["8997ffde..."].inbound_trace_id` points back to `inbound_facts["e4e393c9..."]`. Chain is closed.

## Evidence Chain -- Observation 2 (xiaoyin@chorus, bridge-live-probe)

| Field | Value |
|-------|-------|
| inbound trace_id | `a8c32d02-011b-445c-b360-4329cc8e70a9` |
| route_key | `xiaoyin@chorus:bridge-live-probe-1774527642142@chorus` |
| relay_record_id | `60422af4-8a24-4e1b-8cda-bb49ee4160fc` |
| relay_evidence.inbound_trace_id | `a8c32d02-011b-445c-b360-4329cc8e70a9` |
| hub_trace_id | `e5a4e847-7421-4716-bb5d-4f5c3629ce51` |
| relay confirmed | `true` |
| reply_text (prefix) | `"Probe received. Connection active. Acknowledged."` |

**Match check**: inbound trace_id === relay inbound_trace_id. Route keys match. Chain is closed.

## Comprehensive Audit -- All Live Relay Records

### xiaoyin@chorus (7 relays)

All 7 relay records have non-null `inbound_trace_id` matching a real `inbound_facts` entry with matching `route_key`. Zero null attributions, zero mismatches.

| # | relay_record_id (prefix) | inbound_trace_id (prefix) | route_key_match | confirmed | hub_trace_id (prefix) |
|---|--------------------------|---------------------------|-----------------|-----------|----------------------|
| 1 | `8997ffde` | `e4e393c9` | YES | true | `302f8165` |
| 2 | `60422af4` | `a8c32d02` | YES | true | `e5a4e847` |
| 3 | `c4c064c0` | `67d5a2d8` | YES | true | `7f3f3de3` |
| 4 | `721fb72b` | `89dc1f3e` | YES | true | `38e70fe4` |
| 5 | `1c72d967` | `f7e451a3` | YES | true | `6d810cb6` |
| 6 | `b6cb6465` | `ec748774` | YES | true | `072767b9` |
| 7 | `d6dcd123` | `4cf9c5a5` | YES | true | `8ba1be3c` |

### xiaox@chorus (62 relays)

All 62 relay records have non-null `inbound_trace_id` matching a real `inbound_facts` entry with matching `route_key`. Zero null attributions, zero mismatches.

### Combined totals

- **69 live relay records** across 2 agents
- **69 per-message attributed** (100%)
- **0 null attributions**
- **0 route_key mismatches**

## Code Path Analysis

The attribution chain is implemented across four source files. Every link was verified in code and confirmed by the live state evidence above.

### Link 1: Inbound SSE event carries trace_id into InboundPipeline

`src/bridge/inbound.ts` L82-96: `processMessage(event: HubSSEEvent)` receives `event.trace_id` from the Hub SSE stream. This trace_id is persisted as the key in `inbound_facts[trace_id]` at observe step (L134-155).

### Link 2: HostAdapter.deliverInbound receives trace_id in metadata

`src/bridge/inbound.ts` L254-265: The `deliverInbound()` call passes `metadata: { ..., trace_id: event.trace_id }` to the host adapter. This is the same trace_id from the SSE event.

### Link 3: OpenClawAdapter records active trace per route

`src/bridge/adapters/openclaw.ts` L103: `this.activeTraces.set(params.route_key, params.metadata.trace_id)` -- on every delivery, the adapter records which inbound trace_id is active for the route.

### Link 4: Reply emission carries inbound_trace_id

`src/bridge/adapters/openclaw.ts` L138: `const inboundTraceId = this.activeTraces.get(routeKey) ?? null` -- when the host generates a reply, the adapter looks up the active trace for the route and passes it to the reply callback.

### Link 5: Runtime wires reply callback to OutboundPipeline.relayReply

`packages/chorus-skill/templates/bridge/runtime-v2.ts` L1207-1216: `hostAdapter.onReplyDetected((params) => { outboundPipeline.relayReply(params.route_key, params.reply_text, params.inbound_trace_id, hubClient, apiKey) })` -- the reply callback forwards `inbound_trace_id` directly to the outbound pipeline.

### Link 6: OutboundPipeline persists inbound_trace_id in RelayRecord

`src/bridge/outbound.ts` L104-105: `const record: RelayRecord = { inbound_trace_id: inboundTraceId, ... }` -- the trace binding is written to durable state BEFORE any network submission (bind-before-submit safety).

### Link 7: RelayRecord survives through submission and confirmation

`src/bridge/outbound.ts` L150-158 (submitRelay) and L178-179 (confirmRelay): Both operations spread the existing record (`{ ...record, ... }`) preserving `inbound_trace_id` through all state transitions.

### RouteLock serialization guarantee

`src/bridge/inbound.ts` L23-44: `RouteLock` serializes same-route processing, preventing concurrent `activeTraces` overwrites. This means the last-writer-wins semantic of `activeTraces` (Map, not Queue) is safe under normal operation -- only one inbound is processed per route at a time.

## Test Evidence

### Unit tests proving per-message mechanics

| Test | File | What it proves |
|------|------|----------------|
| `test_reply_attribution` | `tests/bridge/adapters/openclaw.test.ts` L178-200 | Adapter delivers inbound with `trace_id='trace-inbound-1'`, emitReply returns `inbound_trace_id='trace-inbound-1'` |
| `null inbound_trace_id` | `tests/bridge/adapters/openclaw.test.ts` L203-217 | emitReply without prior delivery yields `inbound_trace_id=null` (no fabrication) |
| `bindReply persists inbound_trace_id` | `tests/bridge/outbound.test.ts` L52-68 | `bindReply(routeKey, 'My reply', 'inbound-t1')` persists `record.inbound_trace_id === 'inbound-t1'` |
| `extractStateEvidence binds inbound to relay` | `tests/bridge/live-acceptance.test.ts` L59-68 | State evidence extractor matches relay to inbound by `inbound_trace_id` and `route_key` |

### Integration test fixture proving state structure

`tests/bridge/runtime-v2.test.ts` L186-206: The test fixture seeds durable state with relay_evidence entries like `{ inbound_trace_id: "trace-new", route_key: "xiaov@openclaw:xiaox@chorus", ... confirmed: true }` -- structurally identical to the live state observed above.

## Verdict

**PASS**

Per-message reply attribution is proven at all levels:

1. **Code path**: 7-link chain from SSE event through relay confirmation, each link verified in source.
2. **Unit tests**: 4 tests covering adapter trace binding, null safety, relay persistence, and state evidence extraction.
3. **Live state**: 69 relay records across 2 production agents, all with non-null `inbound_trace_id` matching corresponding `inbound_facts` entries. Zero null attributions, zero mismatches.

R-03 can be upgraded from `session-level acceptable` to `per-message attribution`.
