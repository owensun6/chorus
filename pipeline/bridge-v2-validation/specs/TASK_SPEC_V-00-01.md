<!-- Author: Commander -->

# TASK_SPEC_V-00-01

**Task**: Freeze delivery acceptance
**Assignee**: commander
**Source**: `pipeline/bridge-v2-validation/task.md`
**Blocker**: None

## Input

- `pipeline/bridge-v2-validation/task.md`
- `pipeline/bridge-v2/2_planning/specs/A-B2-verification-report.md`

## Output

- `pipeline/bridge-v2-validation/acceptance.md`

## Acceptance Criteria (BDD)

- Given: current host reality evidence
  When: delivery acceptance is frozen
  Then: `acceptance.md` states exactly one of:
  - `confirmed required`
  - `unverifiable acceptable`

- Given: the decision is written
  When: reviewed
  Then: the decision includes one short reason tied to real host/runtime evidence

## Test Specs

N/A — decision artifact only.

## Structural Constraints

- immutability: existing acceptance decisions must be overwritten explicitly, not appended ambiguously
- error_handling: do not leave both options present
- input_validation: use exact wording from task
- auth_boundary: N/A

## Prohibitions

- Do not write both options
- Do not defer the decision with vague wording
