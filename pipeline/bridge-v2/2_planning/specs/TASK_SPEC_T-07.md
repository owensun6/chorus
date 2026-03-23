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
  - `recover(stateManager, inboundPipeline, outboundPipeline, hubClient)`:
    1. Load durable state
    2. Scan inbound_facts: resume each incomplete fact from last completed step
    3. Scan relay_evidence: retry each incomplete relay
    4. Fetch Hub history since cursor (inclusive), discard items `<= (cursor.timestamp, cursor.trace_id)`
    5. Process remaining through inbound pipeline
    6. Connect SSE
    7. Acquire host handles
- Tests

## Acceptance Criteria (BDD)

- Given: inbound_fact exists with dedupe_result="new", delivery_evidence=null, no terminal_disposition
  When: recovery runs
  Then: delivery is re-attempted via InboundPipeline (not skipped, not cursor-advanced)

- Given: inbound_fact has been re-attempted N times (configurable limit) and Host Adapter keeps returning status="failed"
  When: retry limit is reached
  Then: terminal_disposition="delivery_failed_permanent" is set; cursor advances; error logged for operator investigation

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
- test_recovery_order: inbound resume before Hub catchup before SSE connect

## Structural Constraints

- immutability: recovery produces state transitions through DurableStateManager, never mutates in-place
- error_handling: Hub unreachable during catchup → retry with backoff, do not proceed to SSE without catchup
- input_validation: N/A (internal engine, inputs are durable state + Hub responses validated by HubClient)
- auth_boundary: N/A (uses HubClient which handles auth)

## Prohibitions

- Do not read .jsonl files, transcript files, or active-peer.json (v1 patterns)
- Do not assume SSE connections or delivery handles survive restart
- Do not advance cursor speculatively
