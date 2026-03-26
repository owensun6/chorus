<!-- Author: Lead -->

# TASK_SPEC_T-07

**Task**: Bridge recovery engine
**Assignee**: be-domain-modeler
**Source**: System_Design.md §5; Data_Models.md §6 (recovery matrix), §1.1 (cursor total-order); Freeze Gate #7
**Blocker**: T-04, T-05, T-06

## Input

- Data_Models.md §6: inbound + outbound recovery matrices (exact allowed/forbidden actions per state)
- Data_Models.md §1.1: cursor total-order `(timestamp, trace_id)`, Hub catchup with inclusive boundary + client-side composite filter
- System_Design.md §5: startup sequence diagram
- T-04: InboundPipeline (for re-attempting delivery)
- T-05: OutboundPipeline (for retrying relay)
- T-06: HubClient (for fetchHistory + connectSSE)

## Output

- `src/bridge/recovery.ts`: RecoveryEngine class
  - `recover(stateManager, inboundPipeline, outboundPipeline, hubClient, hostAdapter, onSSEEvent)`:
    1. Load durable state
    2. Advance orphaned cursors for facts with delivery/disposition evidence but `cursor_advanced=false`
    3. Fetch Hub history since cursor (inclusive, with retry/backoff)
    4. Resume incomplete inbound facts from Hub history by `trace_id`
    5. Retry incomplete relays
    6. Discard history items `<= (cursor.timestamp, cursor.trace_id)` and process remaining new Hub messages through inbound pipeline
    7. Connect SSE
    8. Acquire host handles
- Tests

## Acceptance Criteria (BDD)

- Given: inbound_fact exists with dedupe_result="new", delivery_evidence=null, no terminal_disposition
  When: recovery runs
  Then: delivery is re-attempted via InboundPipeline; if Host Adapter throws (transient), fact remains retryable for next recovery cycle; if Host Adapter returns status="failed" (permanent), terminal_disposition is set by pipeline

- Given: inbound_fact exists with delivery_evidence set, cursor_advanced=false
  When: recovery runs
  Then: cursor is advanced (delivery already confirmed, safe to advance)

- Given: relay_evidence exists with submitted_at=null (bound but not submitted)
  When: recovery runs
  Then: relay is submitted via OutboundPipeline with same idempotency_key

- Given: Hub returns messages at cursor boundary (same timestamp, different trace_ids)
  When: recovery filters results
  Then: messages with `(hub_timestamp, trace_id) <= cursor` are discarded; others are processed

- Given: no durable state file exists
  When: recovery runs
  Then: starts from empty state, fetches full Hub history, processes all

## Test Specs

- Test file: `tests/bridge/recovery.test.ts` (new)
- test_resume_incomplete_delivery: incomplete inbound_fact → re-deliver
- test_advance_orphaned_cursor: delivery_evidence present but cursor not advanced → advance
- test_retry_unsubmitted_relay: bound relay → submit with same idempotency_key
- test_boundary_filter: same-timestamp messages at cursor → correct items discarded/kept
- test_fresh_start: no state file → full catchup from Hub
- test_recovery_order: `advance orphaned cursors -> fetch history -> resume incomplete inbound -> retry relays -> process new messages -> SSE connect -> acquire handles`

## Structural Constraints

- immutability: recovery produces state transitions through DurableStateManager, never mutates in-place
- error_handling: Hub unreachable during catchup → retry with backoff, do not proceed to SSE without catchup
- input_validation: N/A (internal engine, inputs are durable state + Hub responses validated by HubClient)
- auth_boundary: N/A (uses HubClient which handles auth)
- interface_alignment: `recover(...)` signature in this spec MUST match the implementation entrypoint exactly, including `hostAdapter` and `onSSEEvent`
- startup_order: implementation MUST match System_Design.md §5 and Data_Models.md §6 exactly; do not collapse intermediate steps into a generic "catchup"

## Prohibitions

- Do not read .jsonl files, transcript files, or active-peer.json (v1 patterns)
- Do not assume SSE connections or delivery handles survive restart
- Do not advance cursor speculatively
- Do not reorder or skip recovery steps defined in the architecture docs
