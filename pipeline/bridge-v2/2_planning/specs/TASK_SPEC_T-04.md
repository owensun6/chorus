<!-- Author: Lead -->

# TASK_SPEC_T-04

**Task**: Bridge inbound pipeline
**Assignee**: be-domain-modeler
**Source**: System_Design.md §3; Data_Models.md §3 (cursor), §4 (delivery evidence); Freeze Gate #4, #5
**Blocker**: T-03

## Input

- System_Design.md §3: five-step inbound event sequence
- Data_Models.md §3: cursor advance rule (delivery_evidence OR terminal_disposition required)
- Data_Models.md §4: local-delivery evidence rule (DeliveryReceipt from Host Adapter)
- T-03 output: BridgeDurableState types, DurableStateManager, HostAdapter interface

## Output

- `src/bridge/inbound.ts`: InboundPipeline class with `processMessage(sseEvent)` method
  - Step 1: validate envelope, compute route_key, write inbound_fact (bridge_observed)
  - Step 2: check dedupe by trace_id, set dedupe_result or terminal_disposition (dedupe_decided)
  - Step 3: call HostAdapter.adaptContent + HostAdapter.deliverInbound, write delivery_evidence (local_delivery_recorded)
  - Step 4: advance cursor (cursor_advanced)
- Per-route_key processing lock (in-memory, prevents concurrent processing of same route)
- Tests

## Acceptance Criteria (BDD)

- Given: a new SSE event with trace_id=T1
  When: processMessage() is called
  Then: inbound_facts[T1] is created with observed_at, hub_timestamp, route_key, dedupe_result="new"

- Given: inbound_facts already contains trace_id=T1 with cursor_advanced=true
  When: processMessage() receives T1 again
  Then: dedupe_result="duplicate", terminal_disposition set, cursor advances; HostAdapter.deliverInbound is NOT called

- Given: HostAdapter.deliverInbound returns success=true
  When: delivery completes
  Then: delivery_evidence is recorded BEFORE cursor advances

- Given: HostAdapter.deliverInbound throws (transient error: host unavailable, network timeout)
  When: exception is caught by pipeline
  Then: no terminal_disposition is set; fact stays as dedupe="new", delivery_evidence=null; pipeline moves to next message; recovery engine will re-attempt on restart

- Given: HostAdapter.deliverInbound returns status="failed" (permanent failure per INTERFACE.md §3.2)
  When: delivery is permanently impossible
  Then: terminal_disposition="delivery_failed_permanent" is set; cursor advances with disposition as evidence

- Given: HostAdapter.deliverInbound returns status="unverifiable"
  When: host sent content but cannot confirm visibility (fire-and-forget channel)
  Then: terminal_disposition="delivery_unverifiable" is set; cursor advances with disposition as evidence; delivery_evidence is NOT written

- Given: two messages from the same peer arrive concurrently
  When: both enter processMessage()
  Then: they are processed sequentially (per-route lock), not concurrently

## Test Specs

- Test file: `tests/bridge/inbound.test.ts` (new)
- test_new_message: full pipeline → inbound_fact created, delivery_evidence set, cursor advanced
- test_dedupe: duplicate trace_id → terminal_disposition, no delivery attempt
- test_delivery_transient_throw: host adapter throws → no terminal_disposition, fact stays retryable
- test_delivery_permanent_failed: host returns status="failed" → terminal_disposition="delivery_failed_permanent", cursor advances
- test_delivery_unverifiable: host returns status="unverifiable" → terminal_disposition="delivery_unverifiable", NO delivery_evidence written
- test_pipeline_continues_after_throw: transient throw on one message does not block processing of next message from different route
- test_cursor_not_advanced_without_evidence: crash simulation between dedupe and delivery → cursor unchanged
- test_per_route_lock: concurrent messages from same peer → sequential processing

## Structural Constraints

- immutability: pipeline steps produce new state snapshots passed to DurableStateManager.save()
- error_handling: HostAdapter throws (transient) → catch, log error, leave fact retryable, move on; HostAdapter returns status="failed" (permanent) → set terminal_disposition; HostAdapter returns status="unverifiable" → set terminal_disposition
- input_validation: envelope schema validation via Zod before any state mutation
- auth_boundary: N/A (internal pipeline, auth handled by Hub Client)

## Prohibitions

- Do not implement SSE consumption (that's T-06)
- Do not implement outbound relay logic (that's T-05)
- Do not hardcode channel-specific delivery logic
