<!-- Author: Codex -->

# Release-Now Verdict — 2026-03-28

## Scope

Decide whether Chorus can be released **now**, and whether the current live internet surface matches the release claim.

## Authoritative Evidence

- [`pipeline/bridge-v2-validation/final-verdict.md`](/Volumes/XDISK/chorus/pipeline/bridge-v2-validation/final-verdict.md)
- [`pipeline/bridge-v2-validation/evidence/S-03-13-same-route-strict-order.md`](/Volumes/XDISK/chorus/pipeline/bridge-v2-validation/evidence/S-03-13-same-route-strict-order.md)
- live `GET https://agchorus.com/health` on `2026-03-27T17:18:28.820Z` returned `"invite_gating": false`
- live anonymous `POST https://agchorus.com/register` on `2026-03-27T17:19:56.150Z` returned `201`
- [`README.md`](/Volumes/XDISK/chorus/README.md)

## Context Log

- [`memory-bank/progress.md`](/Volumes/XDISK/chorus/memory-bank/progress.md)
- [`docs/handoff-2026-03-23-bridge-state.md`](/Volumes/XDISK/chorus/docs/handoff-2026-03-23-bridge-state.md)

Fresh verification run on 2026-03-28:

- `npx tsc --noEmit` -> PASS
- `npx jest --runInBand --coverage=false tests/bridge/outbound.test.ts tests/bridge/runtime-v2.test.ts` -> `20/20` PASS
- `npx jest --runInBand --coverage=false tests/bridge` -> `122/122` PASS

## Verdict

`FAIL`

Why:

- the previous "invite-only alpha" claim is false against the live system:
  - `/health` says `invite_gating = false`
  - anonymous `/register` succeeds with `201`
- the frozen Bridge v2 validation package is still [`CONDITIONAL`](/Volumes/XDISK/chorus/pipeline/bridge-v2-validation/final-verdict.md), not unconditional `PASS`
- the same-route proof is real, but it is still based on repo changes that have not yet been frozen into a commit
- plain Jest still emits a heuristic "did not exit" warning on some bridge-suite combinations, but explicit `--detectOpenHandles` does not identify a concrete non-stdio handle; release gating should rely on explicit handle detection, not stderr string matching

## Decision

Not approved now:

- any release action framed as "invite-only alpha"
- any wider public release
- any marketing language stronger than the live gate truth and the frozen technical verdict

Approved now:

- release-ready change set preparation
- gate-truth correction across docs
- freezing the same-route fix into a reproducible commit

## Live Gate Truth

What is true on the internet-facing surface right now:

- Hub status is public alpha
- self-registration is live
- invite gating is currently off

What is not true right now:

- "invite-only alpha"
- "controlled access" as a live gate property

## Required Next Step Before Wider Public Launch

Do these first:

1. commit the current same-route fix and remove the unsubmitted-state ambiguity
2. unify release truth so authoritative docs say `public alpha + self-registration` unless invite gating is turned back on
3. unify the bridge verdict language so `CONDITIONAL` and `PASS` are no longer both presented as final truth
4. freeze the release gate on explicit handle detection (`--detectOpenHandles`) instead of grepping Jest's heuristic warning text
