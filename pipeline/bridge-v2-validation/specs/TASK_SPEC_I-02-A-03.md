<!-- Author: Commander -->

# TASK_SPEC_I-02-A-03

**Task**: Make timeout duplicate-safety explicit and provable
**Assignee**: be-domain-modeler
**Source**: `pipeline/bridge-v2-validation/task.md`
**Blocker**: V-01-05

## Input

- `pipeline/bridge-v2-validation/evidence/V-01-05-timeout-late-send.md`
- current timeout semantics in Bridge inbound / host adapter code

## Output

- code or contract update that makes timeout duplicate-safety explicit
- proof that timeout cannot re-enter retryable duplicate-local-delivery semantics

## Acceptance Criteria (BDD)

- Given: host send may succeed after Bridge timeout
  When: timeout handling is reviewed
  Then: the system truth is explicit: timeout cannot remain retryable in a way that permits duplicate local delivery

- Given: the implementation or contract is reviewed
  When: following the timeout path end to end
  Then: there is one clear duplicate-safe outcome and a test or proof for it

## Test Specs

- add or cite a test that proves timeout does not produce a second local delivery for the same trace

## Structural Constraints

- immutability: preserve durable fact truth; do not overwrite it ambiguously
- error_handling: timeout semantics must be fail-safe, not optimistic
- input_validation: tie the result to V-01-05 evidence
- auth_boundary: N/A

## Prohibitions

- Do not classify timeout as retryable unless cancellation is provable
- Do not rely on operator intuition as proof
