<!-- Author: Lead -->

# TASK_SPEC_T-01

**Task**: Hub transport contract — SSE timestamp + inclusive history
**Assignee**: be-api-router
**Source**: INTERFACE.md §2.1, §2.2; Freeze Gate #4 (cursor advance depends on hub_timestamp)
**Blocker**: None

## Input

- INTERFACE.md §2.1: SSE events must include Hub-assigned `timestamp`
- INTERFACE.md §2.2: Message history must return `timestamp >= since`, ordered by `(timestamp ASC, trace_id ASC)`
- Current code: `src/server/inbox.ts` line 61 (SSE delivery), `src/server/message-store.ts` line 37 (`id > ?`)

## Output

- `src/server/inbox.ts`: SSE event payload includes `timestamp` (ISO8601, Hub's storage time)
- `src/server/message-store.ts`: query uses `>=` and results ordered by `(timestamp, trace_id)`
- `src/server/routes.ts`: message history response includes `timestamp` per message
- Updated tests in `tests/server/`

## Acceptance Criteria (BDD)

- Given: an agent is connected to SSE `/agent/inbox`
  When: another agent sends a message via POST /messages
  Then: the SSE event payload contains `trace_id`, `sender_id`, `envelope`, AND `timestamp` (ISO8601)

- Given: messages A(timestamp=T, trace_id=aaa) and B(timestamp=T, trace_id=bbb) exist
  When: GET /agent/messages?since=T
  Then: response includes BOTH messages (inclusive boundary, not strict-after)

- Given: messages exist with varying timestamps
  When: GET /agent/messages?since=T
  Then: results are ordered by `(timestamp ASC, trace_id ASC)`

## Test Specs

- Test file: `tests/server/messages.test.ts` (extend existing)
- test_sse_timestamp: SSE event contains `timestamp` field with valid ISO8601 value
- test_inclusive_boundary: since=T returns messages with timestamp=T (not only timestamp>T)
- test_ordering: messages with same timestamp are ordered by trace_id ascending

## Structural Constraints

- immutability: N/A (route handler, no persistent data structures created)
- error_handling: SSE delivery failure path must not crash the event loop
- input_validation: `since` parameter must be validated as ISO8601; malformed → 400
- auth_boundary: existing auth middleware unchanged

## Prohibitions

- Do not change the ChorusEnvelope schema
- Do not change the POST /messages request format
- Do not modify Bridge code
