<!-- Author: Lead -->

# TASK_SPEC_T-05

**Task**: Bridge outbound pipeline
**Assignee**: be-domain-modeler
**Source**: System_Design.md §4; Data_Models.md §5 (relay binding), §1.4 (RelayRecord); Freeze Gate #6
**Blocker**: T-03

## Input

- System_Design.md §4: four-step outbound event sequence
- Data_Models.md §5: relay binding rule (receiver_id + turn_number from continuity, NOT transcript)
- Data_Models.md §1.4: RelayRecord with reply_text, bound_turn_number, idempotency_key
- T-03 output: types, DurableStateManager

## Output

- `src/bridge/outbound.ts`: OutboundPipeline class
  - `bindReply(route_key, reply_text, inbound_trace_id)`: reads continuity, generates outbound_id + idempotency_key, persists relay_evidence with reply_text BEFORE submission
  - `submitRelay(outbound_id, hubClient)`: reconstructs envelope from relay_evidence + continuity + agent config, submits with Idempotency-Key header
  - `confirmRelay(outbound_id, hub_trace_id)`: records confirmation, updates continuity.last_outbound_turn
- Tests

## Acceptance Criteria (BDD)

- Given: continuity exists for route_key with remote_peer_id="xiaox@chorus", last_outbound_turn=2
  When: bindReply() is called
  Then: relay_evidence is created with bound_turn_number=3, reply_text persisted, idempotency_key generated

- Given: relay_evidence exists with reply_text and idempotency_key, submitted_at=null
  When: submitRelay() is called
  Then: outbound envelope is reconstructed from reply_text + continuity + config; POST /messages includes Idempotency-Key header

- Given: relay submitted successfully
  When: confirmRelay() is called
  Then: relay_evidence.confirmed=true, continuity.last_outbound_turn incremented

- Given: continuity[route_key].conversation_id is null
  When: outbound envelope is built
  Then: conversation_id field is omitted from envelope (not fabricated)

## Test Specs

- Test file: `tests/bridge/outbound.test.ts` (new)
- test_bind_persists_before_submit: relay_evidence written with reply_text before any HTTP call
- test_envelope_reconstruction: outbound envelope matches expected fields from continuity + config
- test_idempotency_key_immutable: same outbound_id always uses same idempotency_key
- test_null_conversation_id: omitted from envelope when continuity has null
- test_turn_increment: last_outbound_turn incremented only on confirmation

## Structural Constraints

- immutability: envelope construction returns new object, never mutates continuity in-place
- error_handling: Hub submission failure → relay_evidence retains submitted_at=null (retry-safe)
- input_validation: reply_text must be non-empty string; empty → reject binding
- auth_boundary: N/A (internal pipeline)

## Prohibitions

- Do not infer relay target from reply text content
- Do not read transcript or session state for binding
- Do not implement Hub HTTP client (that's T-06)
