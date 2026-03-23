# Bridge v2 Design Freeze

> Status: Candidate
> Scope: freeze the problem definition and rejection criteria for Bridge v2 before architecture and implementation.
> Non-scope: this document is not an implementation spec, migration plan, or release claim.
> Evidence base: `docs/verification-report-2026-03-23.md`, `pipeline/handoffs/260323-recv-chain-handoff.md`

## 1. Purpose

Bridge v2 exists to make one user action reliable:

- when a remote Chorus peer sends a turn to a local agent, that turn must appear in the correct live host conversation without leaking protocol formatting into the user's main session
- when the local agent produces a chorus-facing reply, Bridge must bind that reply to the correct remote peer without guessing from transcript residue

If this fails, the user sees one of three unacceptable outcomes:

- the host looks "amnesic" because chorus continuity is split from the live user conversation
- the system claims success even though no local visible delivery happened
- a reply binds to the wrong remote peer or cannot be resumed after restart

Bridge v1 exposed all three classes of failure in runtime evidence:

1. session isolation solved format leakage but split human-session continuity from chorus turns
2. `delivered_sse` and similar transport signals were not proof that the bridge had consumed or locally delivered a message
3. recovery depended on truth spread across transcripts, sidecar files, and runtime memory

The purpose of this freeze is to prevent Bridge v2 architecture from being vague about:

- what Bridge is
- what state it owns
- what event boundaries it must respect
- what evidence is required before it may claim local delivery, dedupe, relay, or recovery

## 2. Non-Goals

Bridge v2 does not do these things:

- redefine the Chorus protocol
- replace Skill with host-specific prompt logic
- redesign the host runtime
- start from any single channel's behavior
- use any session transcript as a universal truth source
- infer control flow from prompt residue or reply formatting accidents
- promise restart-safe delivery when the host only exposes runtime-only delivery capability
- keep Bridge v1 storage names, topology, or patch history as design constraints

If a later proposal needs any of the above, it is outside this freeze.

## 3. Core Terms

Each core term below includes a definition, an invariant, and a rejection rule.

### Bridge

Definition:
Bridge is the integration runtime between Chorus and the host runtime. It turns a remote Chorus turn into a host-visible local turn and turns a host-produced chorus-facing reply into a Hub relay.

Invariant:
Bridge owns integration state and event ordering. It does not redefine the protocol, the Hub, or the host runtime.

Reject when:
A proposal makes Bridge depend on a single channel definition, or moves protocol semantics into Bridge prompt logic.

### Route Identity

Definition:
Route identity is the unique binding between a local human-facing conversation anchor and the bridge-managed continuity that targets it.

Invariant:
One local live conversation anchor has one authoritative route identity. Bridge may reference that identity but may not create a second shadow mapping from transcript text.

Reject when:
A proposal derives route binding from reply text, prompt hints, or multiple competing stores.

### Main Session

Definition:
Main session is the host-visible, user-facing conversation anchor.

Invariant:
The user's live conversation continuity belongs here and nowhere else.

Reject when:
A proposal treats any chorus-isolated transcript as the canonical record of the user's live conversation.

### Chorus Session

Definition:
Chorus session is the isolated execution surface for Chorus-side prompt and transcript handling.

Invariant:
Its job is isolation, not ownership of the user's live conversation memory.

Reject when:
A proposal uses chorus session as the authoritative source for route identity or human-facing continuity.

### Durable Bridge State

Definition:
Durable bridge state is the bridge-owned persistent state that survives restart and records bridge truth outside transcripts.

Invariant:
All bridge-managed dedupe, cursor position, continuity binding, and local-delivery evidence live here under one schema.

Reject when:
A proposal spreads these facts across multiple authoritative stores without a single declared truth source.

### Runtime Ephemeral State

Definition:
Runtime ephemeral state is process-local state that disappears on restart.

Invariant:
If a behavior depends on it, that behavior is not durable by default.

Reject when:
A proposal treats live handles, in-memory tokens, or transient locks as restart-safe truth.

### Local Delivery

Definition:
Local delivery means a remote Chorus turn has been turned into a host-visible local turn, and Bridge has recorded evidence of that fact in durable bridge state.

Invariant:
Transport acceptance, SSE emission, or in-process handling alone are not local delivery.

Reject when:
A proposal advances durable success state without durable local-delivery evidence.

### Relay

Definition:
Relay means a chorus-facing reply has been bound to a remote peer by explicit continuity state and submitted back to Hub.

Invariant:
Relay binding must come from durable bridge state, not transcript guesswork.

Reject when:
A proposal infers the remote target from free-form reply text or unstored session context.

### Continuity

Definition:
Continuity is the durable binding between a remote Chorus peer and the local route identity that should continue that interaction.

Invariant:
Continuity is explicit bridge state keyed by a declared identity rule.

Reject when:
A proposal allows continuity to be reconstructed only from transcripts, prompt residue, or runtime-only state.

## 4. State Ownership

Bridge v2 may use many files or objects internally, but it only gets five ownership buckets.

### 4.1 Main Session State

Owns:

- route identity anchor
- user conversation context

Invariant:
This bucket is the only canonical home of the local human-facing conversation.

### 4.2 Chorus Session State

Owns:

- chorus protocol context
- isolated prompt and transcript handling for Chorus-side execution

Invariant:
This bucket exists for isolation only.

### 4.3 Durable Bridge State

Owns one schema with at least these subfields:

- continuity binding
- inbound message facts
- dedupe facts
- cursor position
- local-delivery evidence
- relay evidence

Invariant:
These are subfields of one authoritative durable state class, not independent truth silos.

Reject when:
A proposal treats `seen`, `cursor`, `inbox`, or `delivery ledger` as separate authoritative systems without a declared parent schema and ordering rule.

### 4.4 Runtime Ephemeral State

Owns:

- live connections
- transient delivery handles
- in-process locks
- runtime-only host capabilities

Invariant:
Nothing in this bucket may be used as restart-stable truth unless the host itself persists it.

### 4.5 Hub Transport State

Owns:

- transport acceptance
- queueing
- stream emission

Invariant:
This bucket belongs to Hub, not Bridge.
Bridge may observe it, but may not rename it as local delivery.

## 5. Event Boundaries And Ordering

This section freezes the minimum event model Bridge v2 must preserve.

### 5.1 Inbound Events

| Event | Meaning | Durable evidence required | Forbidden claim |
|------|---------|---------------------------|-----------------|
| `hub_accepted` | Hub accepted the remote turn | none in bridge yet | "bridge processed" |
| `bridge_observed` | Bridge parsed and recognized the turn | inbound message fact stored | "deduped" |
| `dedupe_decided` | Bridge decided whether this turn is new or duplicate | dedupe fact stored | "local delivered" |
| `local_delivery_recorded` | host-visible local turn created and recorded | local-delivery evidence stored | "relay complete" |
| `cursor_advanced` | Bridge advanced durable read position | cursor rule satisfied in durable state | any earlier event implies this automatically |

Ordering rule:
`cursor_advanced` is forbidden before either:

- `local_delivery_recorded`, or
- an explicit terminal disposition is stored in durable bridge state for why local delivery will not happen

### 5.2 Relay Events

| Event | Meaning | Durable evidence required | Forbidden claim |
|------|---------|---------------------------|-----------------|
| `reply_bound` | local chorus-facing reply bound to a remote peer | continuity key and route identity recorded | "relay submitted" |
| `relay_submitted` | Bridge submitted normalized reply to Hub | relay submission evidence stored | "remote received" |
| `relay_confirmed` | Hub acknowledged the relay | hub confirmation stored if available | "local continuity updated by transcript guess" |

Ordering rule:
`reply_bound` must use explicit continuity state. Transcript-derived shadow mapping is forbidden.

### 5.3 Crash Recovery Rules

Allowed recovery behavior:

- replay from durable bridge state
- resume from cursor position plus stored terminal dispositions
- retry relay only from stored continuity and relay evidence

Forbidden recovery behavior:

- assuming runtime ephemeral handles still exist after restart
- inferring target peer from transcript text
- advancing cursor because transport looked successful before crash

## 6. Hard Constraints

Hard constraints are facts the later architecture cannot violate.

### 6.1 Host Facts

- host memory grain is session-scoped rather than agent-global
- main session is the host-visible anchor of local user continuity
- chorus session exists for isolation, not as the canonical memory of the user's live conversation
- some host delivery capabilities are runtime-only and disappear on restart

### 6.2 Event Facts

- Hub acceptance, stream emission, bridge observation, dedupe decision, local delivery, and relay are distinct events
- transport-level success is not proof of user-visible delivery
- durable bridge state is the only valid basis for restart-safe recovery claims

### 6.3 Design Disciplines

- each state class has one authoritative truth source
- bridge control flow must be derived from explicit state, not transcript accidents
- channel-specific limits may constrain a delivery path, but may not define Bridge itself
- if a host capability is not durable, product and runtime semantics must say so honestly

## 7. Freeze Gate

No Bridge v2 architecture or implementation proposal may pass unless it includes all of the following.

| Check | Required content | Reject when |
|------|------------------|-------------|
| Truth source table | one table listing every state class and its single authority | any state class has multiple authorities |
| Route key rule | unique key for route identity and continuity binding | route binding can be guessed from transcript text |
| Durable state schema | one declared durable schema containing continuity, inbound facts, dedupe facts, cursor, local-delivery evidence, relay evidence | durable truth is split across unrelated stores |
| Cursor advance rule | exact condition for advancing cursor | cursor can move before local delivery or stored terminal disposition |
| Local-delivery evidence rule | exact evidence that upgrades a turn to local delivery | stream or transport signals alone count as local delivery |
| Relay binding rule | exact rule for binding a local reply to a remote peer | relay target depends on prompt residue or manual guess |
| Recovery matrix | allowed and forbidden post-crash states and compensation actions | recovery depends on runtime-only state pretending to be durable |

If a proposal misses any row in this table, it is outside the freeze.
