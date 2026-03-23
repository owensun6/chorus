<!-- Author: Lead -->

# TASK_SPEC_T-06

**Task**: Bridge Hub client
**Assignee**: be-domain-modeler
**Source**: INTERFACE.md §2.1, §2.2, §2.3; System_Design.md §1 (Hub Client component)
**Blocker**: T-01, T-03

## Input

- INTERFACE.md §2.1: SSE subscription with `timestamp` in events
- INTERFACE.md §2.2: message history with inclusive boundary
- INTERFACE.md §2.3: relay submission with `Idempotency-Key`
- T-01 output: Hub SSE now includes `timestamp`
- T-03 output: types

## Output

- `src/bridge/hub-client.ts`: HubClient class
  - `connectSSE(agentId, apiKey, onEvent)`: SSE subscription to `/agent/inbox`; parses `timestamp` from event; exponential backoff on disconnect
  - `fetchHistory(apiKey, sinceTimestamp)`: GET `/agent/messages?since=` with inclusive boundary
  - `submitRelay(apiKey, receiverId, envelope, idempotencyKey)`: POST `/messages` with `Idempotency-Key` header; returns hub_trace_id
  - `disconnect()`: clean SSE teardown
- Tests

## Acceptance Criteria (BDD)

- Given: HubClient connected to SSE
  When: a message event arrives
  Then: parsed event includes `trace_id`, `sender_id`, `envelope`, and `hub_timestamp` (from event's `timestamp` field)

- Given: an SSE event arrives without a `timestamp` field
  When: HubClient parses the event
  Then: event is discarded (not forwarded to onEvent callback); error logged as Hub contract violation

- Given: SSE connection drops
  When: reconnect logic triggers
  Then: reconnection uses exponential backoff (1s → 2s → 4s → ... → 30s cap)

- Given: fetchHistory(since=T) is called
  When: Hub responds with messages
  Then: all messages with `timestamp >= T` are returned

- Given: submitRelay() is called with idempotencyKey="KEY-1"
  When: HTTP request is sent
  Then: request includes `Idempotency-Key: KEY-1` header

## Test Specs

- Test file: `tests/bridge/hub-client.test.ts` (new)
- test_sse_parse_timestamp: event with timestamp field → hub_timestamp extracted
- test_sse_missing_timestamp: event without timestamp → discarded, error logged, SSE connection continues
- test_history_inclusive: response parsing preserves all messages (client does not filter)
- test_relay_idempotency_header: Idempotency-Key header present in POST request
- test_backoff: reconnect intervals follow exponential backoff pattern

## Structural Constraints

- immutability: parsed SSE events returned as frozen objects
- error_handling: HTTP failures → throw typed errors (not swallowed); caller decides retry
- input_validation: SSE event must contain trace_id, sender_id, envelope, timestamp; missing any required field → discard event + error log (Hub contract violation); SSE connection stays alive
- auth_boundary: API key passed as parameter, never stored in HubClient state

## Prohibitions

- Do not implement pipeline logic (call onEvent callback, let caller handle)
- Do not implement recovery logic (that's T-07)
- Do not hardcode Hub URL (accept as constructor parameter)
