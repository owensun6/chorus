<!-- Author: Commander -->

# TASK_SPEC_P-04

**Task**: Finalize authoritative verdict pair after worker gates clear
**Assignee**: commander
**Source**: `pipeline/bridge-v2-validation/task.md`
**Blocker**: clean, explicitly-scoped validation state; upgraded delivery truth; upgraded reply attribution truth; Worker 1 direct SSE contract proof; Worker 3 clean Jest shutdown; Worker 3 coverage >= 80%

## Input

- `pipeline/bridge-v2-validation/acceptance.md`
- `pipeline/bridge-v2-validation/final-verdict.md`
- `pipeline/4_delivery/manual-acceptance-2026-03-28.md`
- a clean, explicitly-scoped validation state for finalization
- upgraded delivery truth that no longer stops at `delivery_unverifiable acceptable`
- upgraded reply attribution truth that no longer stops at `session-level acceptable`
- Worker 1 runtime evidence for the direct SSE timestamp contract
- Worker 3 evidence for plain Jest shutdown
- Worker 3 evidence for `npm run test:coverage`

## Output

- `pipeline/bridge-v2-validation/final-verdict.md`
- `pipeline/4_delivery/manual-acceptance-2026-03-28.md`

## Exact Evidence Structure

- `final-verdict.md` and `manual-acceptance-2026-03-28.md` must cite the same blocker set.
- the finalization pass must start from a clean, explicitly-scoped validation state.
- the finalization pass must carry the upgraded delivery truth and upgraded reply attribution truth into both docs before any verdict rewrite.
- If Worker 1 proves the direct SSE timestamp contract, that proof becomes the runtime boundary evidence referenced by both docs.
- If Worker 3 proves clean shutdown and `npm run test:coverage` reaches at least 80%, those results become the test boundary evidence referenced by both docs.
- The final verdict remains frozen until all three inputs exist.

## Acceptance Criteria (BDD)

- Given: Worker 1 and Worker 3 evidence is available
  When: the verdict is finalized
  Then: both docs are updated in the same pass and name the same upgraded truth boundary.

- Given: only partial inputs are available
  When: reviewed
  Then: keep the current frozen truth and do not assert `PASS`.

- Given: the docs are compared
  When: blocker lists are read
  Then: the blocker set is identical and no blocker is restated in contradictory prose.

- Given: delivery truth or reply attribution truth still reads as downgraded acceptance only
  When: the finalization pass is attempted
  Then: the verdict must not be rewritten yet.

## Test Specs

N/A — decision artifact only.

## Structural Constraints

- immutability: update both authoritative docs together, not one at a time
- error_handling: if any worker input is missing, preserve the current verdict
- input_validation: do not use moving `HEAD~` ranges as the baseline for finalization
- auth_boundary: N/A

## Prohibitions

- Do not weaken the frozen truth before the worker inputs exist
- Do not write divergent blocker summaries
- Do not assert `PASS` from scaffold state
