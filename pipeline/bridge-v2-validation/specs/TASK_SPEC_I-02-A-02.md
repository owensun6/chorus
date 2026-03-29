<!-- Author: Commander -->

# TASK_SPEC_I-02-A-02

**Task**: Add observability for `delivery_unverifiable`
**Assignee**: be-domain-modeler
**Source**: `pipeline/bridge-v2-validation/task.md`
**Blocker**: V-01-01, V-01-02

## Input

- `pipeline/bridge-v2-validation/evidence/V-01-01-wechat-delivery.md`
- `pipeline/bridge-v2-validation/evidence/V-01-02-telegram-delivery.md`
- current Bridge inbound/runtime code

## Output

- code diff implementing observable logging/metrics for every `delivery_unverifiable`
- test proof or runtime proof

## Acceptance Criteria (BDD)

- Given: a delivery path results in `delivery_unverifiable`
  When: the pipeline records that outcome
  Then: Bridge emits a structured observable signal that includes at least route identity, trace identity, and outcome type

- Given: the implementation is reviewed
  When: searching for `delivery_unverifiable`
  Then: every terminal path is observable without relying on ad hoc console output

## Test Specs

- add or update a test proving the observable signal is emitted on `delivery_unverifiable`

## Structural Constraints

- immutability: do not mutate prior evidence records in-place
- error_handling: observability must not suppress the terminal outcome
- input_validation: the signal must be machine-readable enough to grep/assert
- auth_boundary: do not leak message content

## Prohibitions

- Do not log `original_text`
- Do not implement observability as only a comment or TODO
