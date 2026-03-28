<!-- Author: Codex -->

# S-03-13 Same-Route Strict Order

## Goal

Prove that two overlapping replies on the same `route_key` no longer race through:

- `reply_bound`
- `relay_submitted`
- `relay_confirmed`

The acceptance target is strict per-route ordering for the runtime's outbound relay path.

## Why This Proof Exists

Bridge v2 previously exposed three separate outbound steps:

- `bindReply()`
- `submitRelay()`
- `confirmRelay()`

That shape left a real gap: same-route replies could interleave between bind and confirm, which means `bound_turn_number` ordering was not physically protected by the runtime itself.

The repo-side fix adds:

- `RouteLock`
- `OutboundPipeline.relayReply()`

and moves the runtime call sites onto that single route-scoped atomic path.

## Repo Change Surface

Changed files:

- [`src/bridge/outbound.ts`](/Volumes/XDISK/chorus/src/bridge/outbound.ts)
- [`packages/chorus-skill/templates/bridge/runtime-v2.ts`](/Volumes/XDISK/chorus/packages/chorus-skill/templates/bridge/runtime-v2.ts)
- [`tests/bridge/outbound.test.ts`](/Volumes/XDISK/chorus/tests/bridge/outbound.test.ts)
- [`tests/bridge/runtime-v2.test.ts`](/Volumes/XDISK/chorus/tests/bridge/runtime-v2.test.ts)

Functional change:

- `OutboundPipeline.relayReply()` now acquires a per-route lock, then performs bind -> submit -> confirm inside one guarded path.
- runtime-v2 no longer calls `bindReply()` / `submitRelay()` / `confirmRelay()` separately for reply relay paths.

## Repo Verification

Executed on `main` with the uncommitted fix applied:

- `npx tsc --noEmit` -> PASS
- `npx jest --runInBand --coverage=false tests/bridge/outbound.test.ts tests/bridge/runtime-v2.test.ts` -> `20/20` PASS
- `npx jest --runInBand --coverage=false tests/bridge` -> `122/122` PASS

Residual note:

- Jest still prints an existing open-handle warning after completion. This is a test-harness cleanliness issue, not a failing assertion in the same-route proof itself.

## Live Sample

One real sender sent two messages on the same conversation and route:

- sender: `same-route-probe-1774532711053@chorus`
- receiver: `xiaoyin@chorus`
- conversation: `same-route-1774532711053`

Inbound traces:

1. `ec748774-b6f8-408f-a519-d959484594ff`
2. `4cf9c5a5-f61b-46a4-a2ea-99cf3a52ef23`

Relay traces:

1. `072767b9-9acd-4f23-abbc-ca1f764362b3`
2. `8ba1be3c-b67b-4220-b748-cff2c7985e0c`

## State Proof

State file:

- [`/Users/owenmacmini/.chorus/state/xiaoyin/xiaoyin@chorus.json`](/Users/owenmacmini/.chorus/state/xiaoyin/xiaoyin@chorus.json)

Observed facts:

- continuity row at line 54 shows route `xiaoyin@chorus:same-route-probe-1774532711053@chorus`
- continuity on that route ended with:
  - `last_inbound_turn = 2`
  - `last_outbound_turn = 2`
- inbound fact `ec748774-b6f8-408f-a519-d959484594ff` stores turn `1`
- inbound fact `4cf9c5a5-f61b-46a4-a2ea-99cf3a52ef23` stores turn `2`
- relay evidence bound to the same route shows:
  - first reply -> `bound_turn_number = 1`, `hub_trace_id = 072767b9-9acd-4f23-abbc-ca1f764362b3`
  - second reply -> `bound_turn_number = 2`, `hub_trace_id = 8ba1be3c-b67b-4220-b748-cff2c7985e0c`

Relevant line anchors from the captured state:

- [`xiaoyin@chorus.json:54`](/Users/owenmacmini/.chorus/state/xiaoyin/xiaoyin@chorus.json:54)
- [`xiaoyin@chorus.json:160`](/Users/owenmacmini/.chorus/state/xiaoyin/xiaoyin@chorus.json:160)
- [`xiaoyin@chorus.json:179`](/Users/owenmacmini/.chorus/state/xiaoyin/xiaoyin@chorus.json:179)
- [`xiaoyin@chorus.json:251`](/Users/owenmacmini/.chorus/state/xiaoyin/xiaoyin@chorus.json:251)
- [`xiaoyin@chorus.json:261`](/Users/owenmacmini/.chorus/state/xiaoyin/xiaoyin@chorus.json:261)

## Log Proof

Gateway log:

- [`/Users/owenmacmini/.openclaw/logs/gateway.log`](/Users/owenmacmini/.openclaw/logs/gateway.log)

Relevant lines:

- first terminal delivery on inbound trace `ec748774-b6f8-408f-a519-d959484594ff`
- second terminal delivery on inbound trace `4cf9c5a5-f61b-46a4-a2ea-99cf3a52ef23`
- first outbound relay OK on trace `072767b9-9acd-4f23-abbc-ca1f764362b3`
- second outbound relay OK on trace `8ba1be3c-b67b-4220-b748-cff2c7985e0c`

Anchors:

- [`gateway.log:2439`](/Users/owenmacmini/.openclaw/logs/gateway.log:2439)
- [`gateway.log:2440`](/Users/owenmacmini/.openclaw/logs/gateway.log:2440)
- [`gateway.log:2448`](/Users/owenmacmini/.openclaw/logs/gateway.log:2448)
- [`gateway.log:2449`](/Users/owenmacmini/.openclaw/logs/gateway.log:2449)
- [`gateway.log:2450`](/Users/owenmacmini/.openclaw/logs/gateway.log:2450)
- [`gateway.log:2451`](/Users/owenmacmini/.openclaw/logs/gateway.log:2451)

## Acceptance

Accepted if all of the following are true:

- two inbound facts on the same route land with turn numbers `1` then `2`
- two relay confirmations on the same route land with `bound_turn_number` `1` then `2`
- route continuity ends at `last_inbound_turn = 2` and `last_outbound_turn = 2`
- runtime logs exactly two ordered relay completions for the same `route_key`

Observed result:

- all four conditions are satisfied

## Verdict

`S-03-13 = PASS`

What this upgrades:

- same-route reply ordering is now physically protected by runtime structure, not just by convention

What this does not upgrade:

- the frozen Bridge v2 validation package still remains [`CONDITIONAL`](/Volumes/XDISK/chorus/pipeline/bridge-v2-validation/final-verdict.md) because that package is limited by downgraded delivery semantics and the direct SSE boundary already documented there
