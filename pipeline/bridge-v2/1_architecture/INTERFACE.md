<!-- Author: Lead -->
<!-- status: APPROVED -->

# Bridge v2 Interface Contracts

> Design input: `docs/bridge-v2-design-freeze.md` (Candidate)
> This document defines the contracts between Bridge v2 and its two neighbors: Hub and Host Runtime.
> Bridge v2 does not define Hub API or host runtime internals; it defines what it expects from each.

## 1. Freeze Gate Coverage

| Freeze Gate Item | Covered In |
|-----------------|------------|
| FG-1: Truth source table | System_Design.md §2 |
| FG-2: Route key rule | Data_Models.md §2 |
| FG-3: Durable state schema | Data_Models.md §1 |
| FG-4: Cursor advance rule | Data_Models.md §3 |
| FG-5: Local-delivery evidence rule | Data_Models.md §4 |
| FG-6: Relay binding rule | Data_Models.md §5 |
| FG-7: Recovery matrix | Data_Models.md §6 |

This table is a coverage index, not a validation claim.

## 2. Bridge → Hub Contract

Bridge v2 consumes Hub API with three new requirements. Hub is in the same repo (`src/server/`); all three are implementable without Hub redesign.

| # | Requirement | Hub Change | Acceptance |
|---|-------------|-----------|------------|
| 1 | SSE events include Hub-assigned `timestamp` (§2.1) | Add `timestamp` field to SSE event payload in `routes.ts` | ✅ Commander 2026-03-24 |
| 2 | Message history supports `timestamp >= since` with `(timestamp, trace_id)` ordering (§2.2) | Change query operator from `>` to `>=` in `message-store.ts`; add `ORDER BY timestamp, trace_id` | ✅ Commander 2026-03-24 |
| 3 | Relay submission supports `Idempotency-Key` header (§2.3) | Add idempotency table + dedup check in `routes.ts` | ✅ Commander 2026-03-24 |

Hub sequence numbers (A-B2-05) are not required: the inclusive boundary contract (`>= since`) combined with the composite cursor `(timestamp, trace_id)` ensures no same-timestamp message loss. Hub sequences would eliminate boundary re-observation cost but are additive.

### 2.1 SSE Subscription (Inbound)

```
GET /agent/inbox
Authorization: Bearer {api_key}

Response: text/event-stream
Each event:
  data: {"trace_id": string, "sender_id": string, "envelope": ChorusEnvelope, "timestamp": ISO8601}
```

**Hub requirement**: Each SSE event MUST include `timestamp` — the Hub-assigned storage time of the message. Bridge uses this as `hub_timestamp` in inbound_facts and as the basis for cursor positioning. Without this field, Bridge cannot construct a catchup query in Hub's time domain.

Bridge expects:
- Events arrive in Hub-determined order
- Each event contains a unique `trace_id` and a Hub-assigned `timestamp`
- `envelope` conforms to ChorusEnvelope v0.4 schema
- Stream may disconnect; Bridge reconnects with exponential backoff

Bridge does NOT expect:
- Guaranteed exactly-once delivery (Bridge handles dedupe)
- Ordering guarantees across sender agents
- Persistence beyond Hub's own retention policy

### 2.2 Message History (Catchup)

```
GET /agent/messages?since={ISO8601_timestamp}
Authorization: Bearer {api_key}

Response: 200 { messages: [{trace_id, sender_id, envelope, timestamp}] }
```

Bridge expects:
- Returns messages with `timestamp >= since`
- Messages are ordered by `(timestamp ASC, trace_id ASC)`
- Used on startup to catch up from cursor position

**Hub requirement**: The history query MUST be inclusive at the boundary timestamp. If Hub returned only `timestamp > since`, any message that shares the cursor timestamp but has a lexicographically greater `trace_id` could be lost after a crash. Bridge uses the composite cursor `(last_completed_timestamp, last_completed_trace_id)` to discard already-completed boundary items locally.

Bridge uses `cursor.last_completed_timestamp` directly for the `since` parameter. This value is stored alongside `last_completed_trace_id` in the cursor schema, making the Hub query self-contained and immune to `inbound_facts` pruning.

### 2.3 Relay Submission (Outbound)

```
POST /messages
Authorization: Bearer {api_key}
Idempotency-Key: {bridge_generated_key}
Content-Type: application/json

{
  "receiver_id": string,
  "envelope": ChorusEnvelope
}

Response: 200 { "trace_id": string, "delivery": string }
```

Bridge expects:
- Hub accepts the envelope and returns a `trace_id`
- Hub handles routing to the receiver (SSE, queue, or webhook)
- **Hub honors `Idempotency-Key` header**: if the same key is submitted twice, Hub returns the original response without creating a duplicate message

**Hub requirement**: Hub MUST support `Idempotency-Key` for relay idempotency. Without this, the outbound recovery claim ("bound-but-not-submitted can be replayed") has no deduplication guarantee on the Hub side. This is one of the required Hub contract changes for Bridge v2.

Bridge records:
- `relay_evidence[outbound_id].idempotency_key` at bind time (before submission)
- `relay_evidence[outbound_id].submitted_at` on API call
- `relay_evidence[outbound_id].hub_trace_id` from response
- `relay_evidence[outbound_id].confirmed = true` on success

## 3. Bridge → Host Runtime Contract (Host Adapter)

This is the key new abstraction in Bridge v2. Each host runtime (OpenClaw, Claude Code, custom) implements this contract.

### 3.1 adaptContent (Cultural Adaptation)

```
adaptContent(params: {
  original_text:     string        // sender's message in original language
  sender_culture:    string        // BCP47 tag
  receiver_culture:  string        // local agent's culture (BCP47)
  cultural_context:  string | null // sender's cultural note
}) → string (adapted_content)
```

**Contract rules:**
- Host Adapter is responsible for producing `adapted_content` from the raw envelope fields
- The adaptation mechanism is host-specific (LLM + Skill prompt, translation API, passthrough, etc.)
- Bridge calls `adaptContent` before `deliverInbound`; Bridge does not define how adaptation works
- If no adaptation is needed (same culture), Host Adapter MAY return `original_text` unchanged

**Why Host Adapter owns this:**
Bridge is an integration runtime, not a language processor. The host runtime controls which LLM, which prompt, and which Skill drives the adaptation. Bridge provides the metadata; the host decides what to do with it.

### 3.2 deliverInbound

```
deliverInbound(params: {
  route_key:        string         // e.g. "xiaov@openclaw:xiaox@chorus"
  local_anchor_id:  string         // host conversation anchor
  adapted_content:  string         // output of adaptContent()
  metadata: {
    sender_id:      string         // remote peer agent_id
    sender_culture: string         // BCP47 tag
    cultural_context: string|null  // sender's cultural note
    conversation_id: string | null  // null until remote provides; omit from envelope when null
    turn_number:    number         // inbound turn number
    trace_id:       string         // Hub trace_id
  }
}) → DeliveryReceipt

DeliveryReceipt {
  status:     "confirmed" | "unverifiable" | "failed"
  method:     string               // delivery method name (e.g. "weixin", "telegram")
  ref:        string | null        // channel-specific delivery reference (only meaningful when confirmed)
  timestamp:  ISO8601              // when host processed the delivery attempt
}
```

**Contract rules:**
- `status="confirmed"`: content is visible in the user's live conversation; Bridge records delivery_evidence
- `status="unverifiable"`: content was sent to host but confirmation is unavailable (fire-and-forget channel); Bridge records terminal_disposition="delivery_unverifiable" — NOT delivery_evidence
- `status="failed"`: delivery failed permanently; Bridge records terminal_disposition="delivery_failed_permanent"
- `method` identifies the delivery mechanism (opaque evidence for debugging, Bridge MUST NOT branch on it)
- `ref` is optional host-specific proof (message ID, API response reference); only meaningful when status="confirmed"
- Host Adapter MAY retry internally before reporting failure; Bridge does not prescribe retry policy to the host

### 3.3 onReplyDetected

```
onReplyDetected(callback: (params: {
  route_key:         string             // which peer conversation this reply belongs to
  reply_text:        string             // the chorus-facing reply content
  inbound_trace_id:  string | null      // which inbound message triggered this reply
}) → void)
```

**Contract rules:**
- Host Adapter detects when the host produces a chorus-facing reply (mechanism is host-specific)
- `route_key` is always required — relay binding depends on it
- `inbound_trace_id` is required when Host Adapter supports per-message reply attribution; null when only session-scoped attribution is available
- When `inbound_trace_id` is null, the single-peer constraint from A-B2-02 applies: the host MUST guarantee at most one active chorus conversation per session at that time. If this cannot be guaranteed, per-message attribution is required and `inbound_trace_id` must be non-null
- Bridge uses `route_key` to look up continuity and bind the relay — it does NOT parse reply_text for peer identity

### 3.4 resolveLocalAnchor

```
resolveLocalAnchor(route_key: string) → string (local_anchor_id)
```

**Contract rules:**
- Returns the host-specific identifier for the conversation anchor that should receive inbound Chorus turns for this route
- Bridge stores this as `continuity[route_key].local_anchor_id`
- Bridge does not define what `local_anchor_id` means to the host (session ID, channel ID, user ID — host decides)
- Called on first inbound message for a new route, or when continuity entry has no `local_anchor_id`

### 3.5 acquireHandles (Lifecycle)

```
acquireHandles() → void
releaseHandles() → void
```

**Contract rules:**
- Called on startup (after recovery) and on shutdown
- Host Adapter acquires whatever runtime handles it needs (tokens, sessions, connections)
- These handles are runtime ephemeral — Bridge does not store them in durable state
- If handles cannot be acquired, Host Adapter reports failure; Bridge records that delivery capability is unavailable

## 4. Envelope Schema Reference

Bridge v2 validates inbound envelopes against ChorusEnvelope v0.4 (defined in Chorus Protocol, not by Bridge):

```
ChorusEnvelope v0.4 {
  chorus_version:    "0.4"
  sender_id:         string  (agent@host format)
  original_text:     string  (non-empty)
  sender_culture:    string  (BCP47)
  cultural_context:  string  (10-500 chars, optional)
  conversation_id:   string  (optional)
  turn_number:       number  (optional)
}
```

Bridge validates but does not modify the envelope schema. Adaptation (translation, cultural adjustment) is prompted by metadata, not by Bridge logic.

## 5. Architecture Layer Assumptions

| ID | Assumption | Impact | Risk | Conflicts with Freeze? |
|----|-----------|--------|------|----------------------|
| A-B2-01 | Host runtime provides a reliable delivery confirmation mechanism (not just fire-and-forget) | H | M | No — freeze requires delivery evidence |
| A-B2-02 | Host Adapter can detect chorus-facing replies and attribute them to a specific route_key | H | M | No — freeze requires explicit relay binding |
| A-B2-03 | Atomic file rename is available on the target filesystem | M | L | No — implementation detail |
| A-B2-04 | Hub message history API returns all messages since a given timestamp without gaps | M | M | No — Bridge handles gaps via dedupe. If Bridge downtime exceeds Hub's retention window, messages are irrecoverably lost (operational constraint, not Bridge defect). |
| A-B2-05 | Hub does not currently expose a per-recipient monotonic sequence number | M | L | No — inclusive boundary contract (`>=`) + composite cursor `(timestamp, trace_id)` ensures no loss. Hub sequence would eliminate boundary re-observation cost (additive). |

### A-B2-01 Verification Plan

If a host runtime cannot confirm delivery (fire-and-forget only), Bridge v2 has two options:
1. Record `terminal_disposition = "delivery_unverifiable"` — honest about the gap
2. Require host adapter implementors to add confirmation capability

**Observability contract**: Bridge MUST emit a structured log entry for each `delivery_unverifiable` terminal disposition. Bridge SHOULD support a configurable warning threshold (percentage of inbound messages in a time window). Host Adapter implementations MAY wire this into host-native metrics or alerts. Silent degradation (many unverifiable deliveries with no alert) is an anti-pattern.

Verification is assigned to T-08 (A-B2 verification task). Results determine T-09 (OpenClaw adapter) implementation path.

### A-B2-02 Verification Plan

If a host runtime cannot detect chorus replies and attribute them to routes, Bridge v2 falls back to:
1. Session-scoped reply detection (all replies from the chorus session belong to the active route)
2. This is weaker than per-message attribution but still explicit (not transcript-derived)

**Single-peer constraint**: Session-scoped reply detection is valid ONLY when the host runtime guarantees at most one active chorus conversation per session at any given time. If two peers send messages in rapid succession and the host processes both in the same session, reply attribution becomes ambiguous. For multi-peer concurrency, per-message reply attribution (the primary mechanism via `inbound_trace_id`) is required. This constraint MUST be documented in each Host Adapter implementation guide.

Verification is assigned to T-08. Results determine whether T-09 uses per-message or session-scoped attribution.
