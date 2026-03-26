<!-- Author: Lead -->
<!-- status: APPROVED -->

# Bridge v2 Data Models

> Design input: `docs/bridge-v2-design-freeze.md` (Candidate)
> This document defines the single durable state schema and the rules governing its mutation.
> Freeze gate items covered: #2 Route Key Rule, #3 Durable State Schema, #4 Cursor Advance Rule, #5 Local-Delivery Evidence Rule, #6 Relay Binding Rule, #7 Recovery Matrix.

## 1. Durable State Schema (Freeze Gate #3)

One schema per agent. One authority. No satellite files.

```
BridgeDurableState
├── schema_version: "2.0"
├── agent_id: string
├── cursor
│   ├── last_completed_trace_id: string | null
│   └── last_completed_timestamp: ISO8601 | null
├── continuity: { [route_key]: ContinuityEntry }
├── inbound_facts: { [trace_id]: InboundFact }
└── relay_evidence: { [outbound_id]: RelayRecord }
```

### 1.1 Cursor

```
cursor {
  last_completed_trace_id:  string | null
  last_completed_timestamp: ISO8601 | null
}
```

Tracks the most recent inbound message that Bridge has fully processed (delivery evidence recorded or terminal disposition stored).

**Total-order rule**: The cursor defines a boundary using the composite `(timestamp, trace_id)`. Ordering is: primary sort by `last_completed_timestamp` (ascending), tiebreaker by `last_completed_trace_id` (lexicographic ascending). A message is "past the cursor" if its `(hub_timestamp, trace_id)` is strictly greater than `(last_completed_timestamp, last_completed_trace_id)`.

**Hub catchup** (single recovery boundary definition — used identically in §6 Recovery Algorithm and INTERFACE.md §2.2):

1. Bridge queries `GET /agent/messages?since={last_completed_timestamp}` — Hub returns all messages with `timestamp >= since` (inclusive)
2. Bridge discards any returned message whose `(hub_timestamp, trace_id) <= (last_completed_timestamp, last_completed_trace_id)` — client-side composite filtering
3. Remaining messages enter the inbound pipeline normally (dedupe still applies)

`last_completed_timestamp` is the Hub-assigned timestamp, NOT Bridge's local `observed_at`.

### 1.2 ContinuityEntry

```
continuity[route_key] {
  remote_peer_id:    string       // e.g. "xiaox@chorus"
  local_anchor_id:   string       // host-provided conversation anchor
  conversation_id:   string | null // null until remote provides; Bridge never fabricates
  last_inbound_turn: number       // most recent inbound turn_number processed
  last_outbound_turn: number      // most recent outbound turn_number sent
  created_at:        ISO8601
  updated_at:        ISO8601
}
```

One entry per route. Binds a remote peer to a local conversation anchor. This is the only store of continuity — no active-peer.json, no transcript reconstruction.

**Continuity bootstrap rules** (when a new route_key appears for the first time):

**conversation_id** (correlation metadata, not binding key — see §5):
- First inbound envelope carries `conversation_id` → adopt that value
- First inbound envelope has no `conversation_id` (field is optional in ChorusEnvelope v0.4) → store `null`
- Subsequent inbound provides `conversation_id` while local is `null` → adopt the remote value
- Subsequent inbound provides `conversation_id` while local is non-null → do not overwrite (first-writer-wins)
- Outbound envelope includes `conversation_id` only when non-null; Bridge never fabricates a protocol identifier

**turn_number** (ordering — part of binding invariant):
- First inbound envelope carries `turn_number` → set `last_inbound_turn` to that value
- First inbound envelope has no `turn_number` (field is optional) → set `last_inbound_turn` to 1
- `last_outbound_turn` initializes to 0 (first outbound will be turn 1)
- Subsequent inbound: `last_inbound_turn` = max(current, envelope.turn_number) — monotonically non-decreasing

**Persistence timing**:
- ContinuityEntry is created and persisted BEFORE the first delivery attempt for a route
- `local_anchor_id` is resolved via `Host Adapter.resolveLocalAnchor()` during creation
- All fields are written atomically in the same state flush

**Bidirectional consistency**:
- Each Bridge independently maintains its own continuity for its own routes
- There is no cross-Bridge consensus protocol — each side tracks its own `last_inbound_turn` and `last_outbound_turn`
- The envelope's `turn_number` is an ordering hint, not a distributed counter; gaps or mismatches are tolerated
- `conversation_id` converges naturally: the first side to provide one wins; Bridge never fabricates (see §5)

**Bootstrap walkthrough** (minimal case: first-ever exchange between A and B, no prior state):

```
Case 1: A initiates with conversation_id

1. A sends to B. A's host provides conversation_id=CID-1.
   → A creates continuity: conversation_id=CID-1, last_outbound_turn=1
   → Envelope: {conversation_id: CID-1, turn_number: 1}

2. B receives. B has no continuity for route B:A.
   → B creates continuity: conversation_id=CID-1 (adopted from envelope), last_inbound_turn=1

3. B replies. conversation_id=CID-1 → included in outbound envelope.
   → Both sides converged on CID-1. ✓

Case 2: A initiates without conversation_id

1. A sends to B. No conversation_id available.
   → A creates continuity: conversation_id=null, last_outbound_turn=1
   → Envelope: {turn_number: 1} (conversation_id omitted)

2. B receives. Envelope has no conversation_id.
   → B creates continuity: conversation_id=null, last_inbound_turn=1

3. B replies. conversation_id=null → omitted from outbound envelope.
   → Neither side has fabricated a value. Binding works via route_key + turn_number. ✓

4. Later, B's host provides conversation_id=CID-2 for this route.
   → B updates continuity: conversation_id=CID-2 (was null → adopt)
   → B's next outbound includes conversation_id=CID-2
   → A receives, sees CID-2, currently null → adopts CID-2
   → Both sides converged. ✓
```

### 1.3 InboundFact

```
inbound_facts[trace_id] {
  route_key:       string
  observed_at:     ISO8601          // Bridge-local observation time (diagnostics only)
  hub_timestamp:   ISO8601          // Hub-assigned timestamp (used for cursor + catchup)
  envelope_projection: {
    original_text:     string
    sender_culture:    string
    cultural_context:  string | null
    conversation_id:   string | null
    turn_number:       number       // normalized to 1 when omitted by the inbound envelope
  }

  dedupe_result:   "new" | "duplicate" | null
    // null = observed but not yet deduped

  delivery_evidence: {
    delivered_at:  ISO8601
    method:        string         // host adapter delivery method
    ref:           string | null  // channel-specific delivery reference
  } | null

  terminal_disposition: {
    reason:        string         // "duplicate" | "delivery_failed_permanent" | "delivery_unverifiable"
    decided_at:    ISO8601
  } | null

  cursor_advanced: boolean
}
```

Records every inbound message's journey through the five-step pipeline. `envelope_projection` is the Bridge-owned durable projection of the inbound Chorus envelope needed for recovery, continuity readback, and router derivation. It is written at `bridge_observed` time and then treated as immutable. Field transitions are monotonic: `null -> value`, `false -> true`, or immutable value preservation. Bridge never clears a field or rewrites it to a conflicting value.

### 1.4 RelayRecord

```
relay_evidence[outbound_id] {
  inbound_trace_id: string | null // which inbound triggered this relay (null if session-scoped attribution)
  route_key:        string
  reply_text:       string        // the only non-derivable field; persisted for replay
  bound_turn_number: number       // turn_number bound at reply_bound time
  idempotency_key:  string        // Bridge-generated; sent to Hub for dedup
  submitted_at:     ISO8601 | null
  hub_trace_id:     string | null // trace_id returned by Hub
  confirmed:        boolean
}
```

Records each outbound relay attempt. `outbound_id` is Bridge-generated (not Hub-assigned). Only `reply_text` and `bound_turn_number` are persisted because the rest of the outbound envelope (receiver_id, conversation_id, sender_id, sender_culture) is derivable from `continuity[route_key]` + agent config at replay time. `idempotency_key` is sent to Hub as a request header so Hub can deduplicate retried submissions.

### 1.5 Schema Invariants

1. All five sections (`cursor`, `continuity`, `inbound_facts`, `relay_evidence`, `schema_version`) are subfields of one JSON object
2. Writes are atomic — the entire state file is written as a unit (write-to-temp + rename)
3. Fields in `inbound_facts` and `relay_evidence` move only forward: `null -> value`, `false -> true`, or immutable value preservation; no field is cleared or rewritten to a conflicting value
4. `continuity` entries are updated (turn numbers, timestamps) but never have conflicting authorities
5. `delivery_evidence.method` is opaque evidence for debugging and audit only — Bridge core logic MUST NOT branch on its value
6. `relay_evidence[outbound_id].idempotency_key` is immutable once written and MUST be reused on every retry of the same outbound relay
7. For a given `route_key`, no two `relay_evidence` records may share the same `bound_turn_number`; outbound binding is serialized per route

## 2. Route Key Rule (Freeze Gate #2)

### Format

```
route_key = "{local_agent_id}:{remote_peer_id}"
```

### Examples

```
"xiaov@openclaw:xiaox@chorus"     // xiaov's bridge tracking conversation with xiaox
"xiaox@chorus:xiaov@openclaw"     // xiaox's bridge tracking conversation with xiaov
```

### Properties

| Property | Guarantee |
|----------|-----------|
| Deterministic | Computed from two agent_id strings; same inputs always produce same key |
| Unique | One route_key per (local_agent, remote_peer) pair |
| Restart-safe | Both components are persistent identifiers in agent config |
| Direction-aware | Each side has its own Bridge with its own route_key |
| Transcript-independent | Does not depend on message content, prompt residue, or session state |

### 2.1 Main-Session Router Derivation

When the host main session asks to continue or summarize a Chorus exchange, Bridge derives that continuity from durable state only.

**Active route selection**:

1. Host runtime identifies the current local conversation anchor.
2. Bridge filters `continuity` to entries whose `local_anchor_id` equals that current anchor.
3. No matching entry → no Chorus continuity injection.
4. One matching entry → that entry is the active route.
5. Multiple matching entries → choose the entry with the greatest `updated_at`; break ties by lexicographically ascending `route_key`.

**Derived read model for the active route**:

- `last inbound fact` = newest `inbound_facts[trace_id]` for the active `route_key` with `dedupe_result = "new"`, ordered by `(hub_timestamp, trace_id)`
- `last inbound text` = `last inbound fact.envelope_projection.original_text`
- `last inbound summary` = runtime projection derived from `last inbound text`; Bridge MAY truncate for prompt budget, but MUST NOT read transcript files or session history to compute it
- `last outbound reply` = `relay_evidence[outbound_id].reply_text` from the record with the greatest `bound_turn_number` for the active `route_key`

This section intentionally defines derivation rules, not an extra durable summary field. Router readback must come from `continuity + inbound_facts + relay_evidence`, not from `active-peer.json`, transcript scans, or prompt residue.

### 2.2 v1 -> v2 Migration Constraint

During one-time cutover, old side files may be read only as import inputs. They are not authoritative after import.

The migrator MAY import only:

- `remote_peer_id`
- `conversation_id` when explicitly present
- `last_inbound_turn` / `last_outbound_turn` only from explicit, non-ambiguous persisted evidence

The migrator MUST NOT import `local_anchor_id` from v1 side files. v1 does not persist a stable authoritative anchor. For every imported `route_key`, the migrator MUST call `HostAdapter.resolveLocalAnchor(route_key)` and persist that result into `continuity[route_key].local_anchor_id`.

If `resolveLocalAnchor(route_key)` fails, the migrator MUST NOT fabricate an anchor or guess from transcripts. That route remains unmigrated until the host can resolve it.

### What route_key anchors

- `continuity[route_key]` — the binding between this peer and a local conversation
- `inbound_facts[trace_id].route_key` — classifies which route an inbound message belongs to
- `relay_evidence[outbound_id].route_key` — classifies which route an outbound relay targets

### Rejection criteria

A route_key derivation that uses any of the following is outside the freeze:

- reply text content
- prompt hints or markers
- session transcript entries
- channel-specific identifiers
- Hub-assigned conversation IDs as the primary key (Hub's `conversation_id` is a field in `continuity`, not the key itself)

## 3. Cursor Advance Rule (Freeze Gate #4)

### When cursor MAY advance

The cursor may advance past `trace_id` when **exactly one** of these conditions holds:

1. `inbound_facts[trace_id].delivery_evidence` is non-null (local delivery confirmed by host)
2. `inbound_facts[trace_id].terminal_disposition` is non-null (explicit reason delivery will not happen)

### When cursor MUST NOT advance

| State | delivery_evidence | terminal_disposition | cursor_advanced allowed? |
|-------|-------------------|---------------------|------------------------|
| Just observed | null | null | NO |
| Dedupe decided (new) | null | null | NO |
| Dedupe decided (duplicate) | null | set | YES (terminal disposition exists) |
| Delivery attempted, host not confirmed | null | null | NO |
| Delivery confirmed | set | null | YES |
| Delivery failed permanently | null | set | YES (terminal disposition exists) |

### Ordering guarantee

After cursor advances past `trace_id`:

- `inbound_facts[trace_id].cursor_advanced` = true
- `cursor.last_completed_trace_id` = trace_id
- `cursor.last_completed_timestamp` = `inbound_facts[trace_id].hub_timestamp`
- All three writes happen atomically in the same state flush

Cursor only advances forward in the `(timestamp, trace_id)` total order. If two messages have the same hub_timestamp, cursor advances to whichever has the lexicographically greater trace_id last.

### What does NOT justify cursor advance

- Hub accepting the message (`hub_accepted`)
- Bridge parsing the SSE payload (`bridge_observed`)
- Bridge calling the Host Adapter delivery API (call without confirmation)
- A transport-layer acknowledgment (SSE emission, HTTP 200 from Hub)
- An in-memory flag being set

## 4. Local-Delivery Evidence Rule (Freeze Gate #5)

### Definition of local delivery

A message is locally delivered when the host runtime has confirmed that the adapted content is visible in the user's live conversation, and Bridge has recorded this confirmation in durable state.

### Required evidence

```
delivery_evidence {
  delivered_at: ISO8601    // when host confirmed delivery
  method:      string      // host adapter method used (e.g., "weixin", "telegram", "cli")
  ref:         string|null // optional: channel-specific delivery reference
}
```

### Evidence lifecycle

```
Host Adapter calls host delivery API
    ↓
Host runtime confirms visibility (callback or return value)
    ↓
Host Adapter returns DeliveryReceipt to Bridge
    ↓
Bridge writes delivery_evidence to inbound_facts[trace_id]
    ↓
Bridge persists durable state (atomic write)
    ↓
ONLY NOW: cursor advance is permitted
```

### What is NOT local-delivery evidence

| Signal | Why insufficient |
|--------|-----------------|
| Hub SSE emission | Hub-side event; Bridge may not have consumed it |
| Bridge SSE payload parsed | Bridge observed it; host has not seen it yet |
| Host Adapter delivery API called | Call initiated; host has not confirmed |
| In-memory delivery flag set | Process memory; lost on crash |
| Transport HTTP 200 | Transport accepted; user may not see it |

## 5. Relay Binding Rule (Freeze Gate #6)

### Binding source

A chorus-facing reply is bound to a remote peer using ONLY these values from durable state:

```
source: continuity[route_key]

binding (invariant — determines correct peer):
  receiver_id      = continuity[route_key].remote_peer_id
  turn_number      = continuity[route_key].last_outbound_turn + 1

envelope metadata (included when non-null, omitted when null — not part of binding invariant):
  conversation_id  = continuity[route_key].conversation_id    // may be null
```

**conversation_id is not a binding key**. Route_key determines the peer. Turn_number determines ordering. conversation_id is included in the outbound envelope only when non-null, for protocol-level correlation. Bridge never fabricates this value — it is only set when the remote side provides it (see §1.2 bootstrap rules). No Bridge routing, deduplication, or recovery logic depends on conversation_id.

### Binding sequence

1. Host Adapter detects a chorus-facing reply and provides `route_key` + `inbound_trace_id` (or `null` under the session-scoped single-peer fallback)
2. Bridge reads `continuity[route_key]` from durable state
3. Bridge generates `outbound_id` (Bridge-local UUID)
4. Bridge writes `relay_evidence[outbound_id]` with binding before submission
5. Bridge builds outbound envelope with bound values
6. Bridge submits to Hub

### What is FORBIDDEN for relay binding

| Forbidden source | Why |
|-----------------|-----|
| Reply text content | Free-form text is not a reliable peer identifier |
| `[chorus_reply]` markers or similar prompt residue | Format accidents are not architecture |
| Session transcript entries | Transcripts are not Bridge truth |
| `active-peer.json` or equivalent runtime file | v1 pattern; reconstructed from transcripts |
| Runtime-only state | Lost on crash; not restart-safe |

## 6. Recovery Matrix (Freeze Gate #7)

### Inbound Recovery

| Post-Crash State | Durable Evidence | Allowed Action | Forbidden Action |
|-----------------|------------------|----------------|------------------|
| observed, no dedupe_result | inbound_fact exists, dedupe_result = null | Re-observe from Hub history, re-dedupe | Assume new or duplicate |
| dedupe = "new", no delivery_evidence | dedupe_result = "new", delivery_evidence = null | Re-attempt local delivery via Host Adapter | Advance cursor |
| dedupe = "duplicate" | terminal_disposition set | Advance cursor (disposition is the evidence) | Re-deliver |
| delivery_evidence set, cursor not advanced | delivery_evidence present, cursor_advanced = false | Advance cursor (delivery already confirmed) | Re-deliver (harmless but unnecessary) |
| delivery_unverifiable | terminal_disposition.reason = "delivery_unverifiable" | Advance cursor (disposition is stored evidence) | Re-attempt delivery (host cannot confirm; retrying has no value) |
| cursor_advanced | full pipeline complete | No action | N/A |
| No inbound_fact for a Hub message after cursor | Nothing in durable state | Process normally through full pipeline | Skip without recording |

### Outbound Recovery

| Post-Crash State | Durable Evidence | Allowed Action | Forbidden Action |
|-----------------|------------------|----------------|------------------|
| Relay bound, not submitted | relay_evidence exists with reply_text + bound_turn_number + idempotency_key, submitted_at = null | Reconstruct envelope from reply_text + bound_turn_number + continuity + agent config; submit to Hub with idempotency_key | Assume submitted; read reply from host transcript |
| Relay submitted, not confirmed | submitted_at set, confirmed = false | Retry submission with same idempotency_key (Hub deduplicates) | Assume confirmed |
| Relay confirmed | confirmed = true | No action | N/A |

**Outbound replay guarantee**: `reply_text`, `bound_turn_number`, and `idempotency_key` are persisted in durable state at bind time. On recovery, Bridge reconstructs the full outbound envelope from `reply_text` + `bound_turn_number` + `continuity[route_key]` + agent config — no host transcript or runtime state needed. The `idempotency_key` ensures Hub does not create duplicate messages on retry.

### Recovery Algorithm (startup)

```
1. Load durable state from disk
2. Advance orphaned cursors for facts that already have delivery_evidence or terminal_disposition
3. Query Hub: GET /agent/messages?since={cursor.last_completed_timestamp} (inclusive boundary, with retry/backoff)
4. Resume incomplete inbound_facts from Hub history by trace_id
5. Scan relay_evidence: retry each incomplete relay from its last completed step
6. For each returned message beyond cursor:
   - discard it if `(hub_timestamp, trace_id) <= (cursor.last_completed_timestamp, cursor.last_completed_trace_id)`
   - otherwise send it through the inbound pipeline; dedupe still applies for any surviving re-observation
7. Establish live SSE connection
8. Acquire host runtime delivery handles via Host Adapter
```

### Forbidden Recovery Behaviors

- Assuming runtime ephemeral handles (SSE connections, delivery tokens) survive restart
- Inferring target peer from transcript text or session history
- Advancing cursor because transport looked successful before crash
- Reading .jsonl history files as truth source
- Reconstructing continuity from active-peer.json or equivalent
- Reusing v1 side files as runtime authority after migration

### Observability: `delivery_unverifiable` Monitoring

When Bridge records `terminal_disposition.reason = "delivery_unverifiable"`, the message was sent to the host but delivery confirmation was not available. Bridge MUST emit a structured log entry for each such disposition. Bridge SHOULD support a configurable threshold that triggers a warning when `delivery_unverifiable` becomes the dominant disposition. Host Adapter implementations MAY wire this into host-native metrics or alerts. Concrete thresholds are implementation configuration, not architecture.

## 7. State Lifecycle Diagram

```
Message arrives via SSE
    │
    ▼
┌─────────────────┐
│ bridge_observed  │──► inbound_fact created (hub_timestamp, observed_at, route_key)
└────────┬────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────────┐
│ dedupe_decided   │──►│ duplicate?        │
└────────┬────────┘    │ YES: terminal_    │
         │             │ disposition set   │──► cursor may advance
         │ NO (new)    └──────────────────┘
         ▼
┌─────────────────────┐
│ local_delivery_      │──► delivery_evidence written
│ recorded             │
└────────┬────────────┘
         │
         ▼
┌─────────────────┐
│ cursor_advanced  │──► cursor.last_completed_trace_id updated
└─────────────────┘
```

## 8. Concurrency and Atomicity

### Write Atomicity

All mutations to durable state follow write-to-temp + atomic-rename:

```
1. Read current state from {agent_id}.json
2. Apply mutation (set field, update entry)
3. Write to {agent_id}.json.tmp
4. Rename {agent_id}.json.tmp → {agent_id}.json
```

If crash occurs between step 3 and 4: .tmp file is discarded on recovery, original state preserved.

### Route-Scoped Ordering

For a given `route_key`, Bridge serializes all continuity-mutating work:
- inbound message processing
- outbound reply binding and confirmation

Messages from different peers may be processed concurrently since they write to disjoint sections of durable state.

### State Pruning

`inbound_facts` entries older than an implementation-defined retention window and with `cursor_advanced = true` may be pruned. The chosen window MUST be documented alongside the deployment's Hub retention guarantee and MUST preserve any entries still needed for audit or incident investigation. `continuity` entries are never automatically pruned (they represent ongoing peer relationships).
