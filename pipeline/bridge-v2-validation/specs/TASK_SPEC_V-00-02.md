<!-- Author: Commander -->

# TASK_SPEC_V-00-02

**Task**: Freeze reply attribution acceptance
**Assignee**: commander
**Source**: `pipeline/bridge-v2-validation/task.md`
**Blocker**: None

## Input

- `pipeline/bridge-v2-validation/task.md`
- `pipeline/bridge-v2/2_planning/specs/A-B2-verification-report.md`

## Output

- `pipeline/bridge-v2-validation/acceptance.md`

## Acceptance Criteria (BDD)

- Given: current route/session attribution evidence
  When: reply attribution acceptance is frozen
  Then: `acceptance.md` states exactly one of:
  - `per-message required`
  - `session-level acceptable`

- Given: the decision is written
  When: reviewed
  Then: it includes one short reason tied to route attribution evidence

## Test Specs

N/A — decision artifact only.

## Structural Constraints

- immutability: existing attribution decision must be replaced explicitly if changed
- error_handling: do not leave both options active
- input_validation: use exact wording from task
- auth_boundary: N/A

## Prohibitions

- Do not rely on preference language like "ideally"
- Do not leave attribution scope implicit
