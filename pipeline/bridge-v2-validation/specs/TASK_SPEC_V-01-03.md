<!-- Author: Commander -->

# TASK_SPEC_V-01-03

**Task**: Verify route-stable reply attribution
**Assignee**: be-ai-integrator
**Source**: `pipeline/bridge-v2-validation/task.md`
**Blocker**: V-00-02

## Input

- `pipeline/bridge-v2-validation/acceptance.md`
- OpenClaw session/reply pipeline

## Output

- `pipeline/bridge-v2-validation/evidence/V-01-03-route-attribution.md`

## Acceptance Criteria (BDD)

- Given: host reply detection path
  When: attribution is assessed
  Then: the evidence ends with exactly one line: `YES` or `NO`

- Given: the evidence file
  When: reviewed
  Then: it states how a reply is bound to a route_key and whether that binding is stable enough for session-level acceptance

## Test Specs

N/A — read-only verification.

## Structural Constraints

- immutability: N/A
- error_handling: if attribution depends on transcript guessing, conclude `NO`
- input_validation: state the exact route binding mechanism
- auth_boundary: N/A

## Prohibitions

- Do not assume route binding without code or runtime evidence
