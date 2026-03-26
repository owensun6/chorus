<!-- Author: Lead -->

# Bridge v2 Execution Plan

> Design input: `pipeline/bridge-v2/1_architecture/` (APPROVED)
> Scheduling: by Blocker field only. Phase grouping is visual.

## [Phase 1] Hub Contract + Bridge Foundation (fully parallel)

- [ ] T-01 `[Assignee: be-api-router]`: Hub transport contract — add `timestamp` to SSE events; change message history to `>=` with `(timestamp, trace_id)` ordering (Blocker: None)
- [ ] T-02 `[Assignee: be-api-router]`: Hub Idempotency-Key — add idempotency table (migration v5); dedup check on POST /messages using `Idempotency-Key` header (Blocker: None)
- [ ] T-03 `[Assignee: be-domain-modeler]`: Bridge type system + DurableStateManager — define `BridgeDurableState`, `HostAdapter` interface, all schema types in `src/bridge/types.ts`; implement atomic read/write/rename in `src/bridge/state.ts` (Blocker: None)

## [Phase 2] Bridge Pipelines (depend on T-03)

- [ ] T-04 `[Assignee: be-domain-modeler]`: Inbound pipeline — observe → dedupe → adapt+deliver → cursor advance in `src/bridge/inbound.ts` (Blocker: T-03)
- [ ] T-05 `[Assignee: be-domain-modeler]`: Outbound pipeline — reply binding → relay submission → confirmation in `src/bridge/outbound.ts` (Blocker: T-03)
- [ ] T-06 `[Assignee: be-domain-modeler]`: Hub client — SSE consumer (with `timestamp` + `hub_timestamp` extraction) + relay submitter (with `Idempotency-Key`) in `src/bridge/hub-client.ts` (Blocker: T-01, T-03)

## [Phase 3] Recovery + Host Verification

- [ ] T-07 `[Assignee: be-domain-modeler]`: Recovery engine — `load -> advance orphaned cursors -> fetch history (retry/backoff) -> resume incomplete inbound -> retry incomplete relays -> process new messages -> connect SSE -> acquire handles` in `src/bridge/recovery.ts` (Blocker: T-04, T-05, T-06)
- [ ] T-08 `[Assignee: be-ai-integrator]`: A-B2 verification — assess OpenClaw delivery confirmation (A-B2-01) and reply attribution (A-B2-02) capabilities; output verification report (Blocker: T-03)

## [Phase 4] Host Adapter (depends on verification)

- [ ] T-09 `[Assignee: be-ai-integrator]`: OpenClaw Host Adapter — implement HostAdapter interface for OpenClaw runtime based on T-08 verification findings (Blocker: T-04, T-05, T-08)
