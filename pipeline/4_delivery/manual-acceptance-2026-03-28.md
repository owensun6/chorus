<!-- Author: Lead -->

# Release-Now Verdict — 2026-03-28

## Scope

Decide whether Chorus can be released **now**, and whether the current live internet surface matches the release claim.

## Authoritative Evidence

- [`pipeline/bridge-v2-validation/final-verdict.md`](/Volumes/XDISK/chorus/pipeline/bridge-v2-validation/final-verdict.md)
- [`pipeline/bridge-v2-validation/evidence/S-03-13-same-route-strict-order.md`](/Volumes/XDISK/chorus/pipeline/bridge-v2-validation/evidence/S-03-13-same-route-strict-order.md)
- live `GET https://agchorus.com/health` on `2026-03-27T17:18:28.820Z` returned `"invite_gating": false`
- live anonymous `POST https://agchorus.com/register` on `2026-03-27T17:19:56.150Z` returned `201`
- [`README.md`](/Volumes/XDISK/chorus/README.md)
- frozen supporting commits: `1a6423d`, `35b16d3`

## Verdict

`FAIL`

Why:

- the release-truth corrections are now closed:
  - live gate truth is documented as `public alpha + self-registration currently enabled`
  - same-route serialization is frozen in commit `35b16d3`
  - release-gate enforcement is frozen in commit `1a6423d`
- the remaining blocking set is inherited from the frozen Bridge v2 technical verdict in [`final-verdict.md`](/Volumes/XDISK/chorus/pipeline/bridge-v2-validation/final-verdict.md)

This document does not reopen, restate, or override that technical verdict. It inherits it.

## Decision

Not approved now:

- any release action framed as "invite-only alpha"
- any wider public release
- any marketing language stronger than the live gate truth and the frozen technical verdict

Approved now:

- public-alpha truth-aligned documentation
- release-gate enforcement via explicit `--detectOpenHandles`
- committed same-route serialization proof

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

1. if you want to reopen the verdict, do it from a clean, explicitly-scoped validation state rather than this mixed workspace
2. fix the live direct SSE timestamp contract so new inbound events can be accepted on the direct path, not only via restart/catch-up replay
3. upgrade acceptance truth from downgraded semantics:
   - `delivery_unverifiable acceptable` -> stronger delivery truth
   - `session-level acceptable` -> stronger reply attribution truth
4. then rewrite [`final-verdict.md`](/Volumes/XDISK/chorus/pipeline/bridge-v2-validation/final-verdict.md) and this document together so both authoritative verdicts name the same blocker set
