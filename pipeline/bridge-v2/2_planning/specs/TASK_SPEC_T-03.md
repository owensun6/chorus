<!-- Author: Lead -->

# TASK_SPEC_T-03

**Task**: Bridge type system + DurableStateManager
**Assignee**: be-domain-modeler
**Source**: Data_Models.md §1 (schema), §2 (route key); Freeze Gate #1, #2, #3
**Blocker**: None

## Input

- Data_Models.md §1: BridgeDurableState schema (cursor, continuity, inbound_facts, relay_evidence)
- Data_Models.md §2: route_key = `{local_agent_id}:{remote_peer_id}`
- INTERFACE.md §3: HostAdapter interface (adaptContent, deliverInbound, onReplyDetected, resolveLocalAnchor, acquireHandles)

## Output

- `src/bridge/types.ts`: TypeScript types for BridgeDurableState, ContinuityEntry, InboundFact, RelayRecord, HostAdapter interface, DeliveryReceipt
- `src/bridge/state.ts`: DurableStateManager class — `load()`, `save()` (atomic write-to-temp + rename), `getInboundFact()`, `setInboundFact()`, `getContinuity()`, `setContinuity()`, `getRelayEvidence()`, `setRelayEvidence()`, `advanceCursor()`
- `src/bridge/route-key.ts`: `computeRouteKey(localAgentId, remotePeerId)` pure function
- Tests

## Acceptance Criteria (BDD)

- Given: no state file exists for agent "xiaov@openclaw"
  When: DurableStateManager.load("xiaov@openclaw") is called
  Then: returns a valid empty BridgeDurableState with schema_version "2.0", null cursor, empty maps

- Given: a loaded state with one inbound_fact
  When: save() is called, then the process is killed before completion
  Then: the original state file is intact (atomic rename guarantees no partial write)

- Given: a loaded state
  When: advanceCursor(trace_id, hub_timestamp) is called
  Then: cursor.last_completed_trace_id and cursor.last_completed_timestamp are updated atomically

- Given: computeRouteKey("xiaov@openclaw", "xiaox@chorus")
  When: called
  Then: returns "xiaov@openclaw:xiaox@chorus"

## Test Specs

- Test file: `tests/bridge/state.test.ts` (new)
- test_load_empty: missing file → valid empty state
- test_save_load_roundtrip: save then load → identical state
- test_atomic_write: .tmp file created then renamed (mock fs to verify)
- test_advance_cursor: cursor fields updated together
- test_route_key: deterministic, direction-aware

## Structural Constraints

- immutability: BridgeDurableState fields use readonly where possible; mutations return new state copies passed to save()
- error_handling: load() with corrupted file → throw with descriptive error (do not silently return empty state)
- input_validation: schema_version mismatch on load → throw migration-required error
- auth_boundary: N/A (local file, no network)

## Prohibitions

- Do not implement pipeline logic (that's T-04, T-05)
- Do not implement SSE or HTTP client logic (that's T-06)
- Do not hardcode file paths (accept state directory as constructor parameter)
