<!-- Author: Commander -->

# TASK_SPEC_EXP03_RESTART_CONSENT_HARD_GATE

**Task**: Implement a code-enforced restart consent gate for delegated Chorus activation
**Assignee**: be-ai-integrator
**Source**: EXP-03 Run 1 NF-2 + EXP-03 delegated-path revision on 2026-04-01
**Blocker**: none
**Stage Freeze**: implementation scope only; do not widen into publish or Run 2 execution in the same pass

## Purpose

EXP-03 Run 1 proved that SKILL.md-only restart rules are not binding. Both agents called `gateway.restart` without permission and without writing a checkpoint. That is a user safety / trust failure.

This task implements a **code-enforced** gate so delegated Chorus setup cannot silently restart someone else's OpenClaw Gateway.

## Critical framing

The incorrect restart happens during fresh install, before the newly installed `chorus-bridge` plugin has necessarily been loaded by the next Gateway process.

**Therefore: a fix that only changes `runtime-v2.ts` or any other post-restart bridge hook is insufficient.**

The enforcement point must exist on the install / agent-facing path that is active **before** the first restart decision.

## Input

- [EXP-03-human-developer-cold-start.md](/Volumes/XDISK/chorus/docs/experiments/EXP-03-human-developer-cold-start.md)
- [TASK_SPEC_EXP03_RESTART_CONSENT_CHECKPOINT.md](/Volumes/XDISK/chorus/pipeline/tasks/TASK_SPEC_EXP03_RESTART_CONSENT_CHECKPOINT.md)
- [cli.mjs](/Volumes/XDISK/chorus/packages/chorus-skill/cli.mjs)
- [SKILL.md](/Volumes/XDISK/chorus/packages/chorus-skill/templates/en/SKILL.md)
- [SKILL.zh-CN.md](/Volumes/XDISK/chorus/packages/chorus-skill/templates/zh-CN/SKILL.zh-CN.md)
- [EXP-03-friction-log.md](/Volumes/XDISK/chorus/docs/experiment-results/EXP-03-friction-log.md)
- [EXP-03-summary.md](/Volumes/XDISK/chorus/docs/experiment-results/EXP-03-summary.md)

## Output

- code changes that make unauthorized Gateway restart impossible or explicitly blocked on the delegated setup path
- automated regression tests for the enforcement mechanism
- if implementation requires a new installed asset, that asset must be installed by [cli.mjs](/Volumes/XDISK/chorus/packages/chorus-skill/cli.mjs)
- minimal doc/template sync only if needed to describe the new enforced behavior

## Exact Behavior Contract

### 1. Fresh install restart is physically gated

If Chorus has just been installed and a Gateway restart is required to load `chorus-bridge`, the delegated path must not be able to execute `gateway.restart` until the user has explicitly approved restart.

### 2. Checkpoint precedes approval request

Before restart approval is requested, the system must persist `./chorus-restart-checkpoint.md` in the active workspace with the fields already frozen in [TASK_SPEC_EXP03_RESTART_CONSENT_CHECKPOINT.md](/Volumes/XDISK/chorus/pipeline/tasks/TASK_SPEC_EXP03_RESTART_CONSENT_CHECKPOINT.md).

### 3. No bridge-runtime-only solution

An implementation that relies solely on `chorus-bridge` runtime hooks fails this task. The gate must work on the first install path, before bridge post-restart hooks can be trusted.

### 4. Credentials-only path must not ask for restart

If the bridge/plugin is already loaded and the only missing step is credentials, the code gate must not force or request restart.

### 5. Explicit approval only

Allowed restart approvals remain the explicit-yes set from the checkpoint spec. Silence, topic drift, or ambiguous language is not approval.

### 6. Observable failure mode

If restart is attempted without approval, the user must see a clear blocked state, not a silent no-op and not a fake success message.

### 7. Cleanup after successful recovery

Once restart is approved, activation succeeds, and the user-facing task resumes, the checkpoint file must be deleted or marked completed.

## Acceptance Criteria (BDD)

- Given: fresh install requires plugin load
  When: delegated setup reaches the restart decision
  Then: checkpoint exists before approval is requested
  And: restart cannot execute without explicit approval

- Given: no explicit approval was given
  When: the agent attempts the delegated activation flow
  Then: `gateway.restart` does not complete
  And: the user sees a blocked / waiting-for-approval state

- Given: explicit approval was given
  When: restart is performed
  Then: the saved checkpoint is used for recovery
  And: the resumed flow continues from saved state, not fabricated memory

- Given: bridge is already loaded and only credentials are missing
  When: credentials are saved
  Then: no restart request is made
  And: no restart gate is triggered

## Test Specs

- automated test: fresh-install delegated path cannot pass the restart boundary without explicit approval
- automated test: checkpoint artifact is created before the approval request state is emitted
- automated test: credentials-only path does not enter restart-gated mode
- automated test: approved restart path clears or completes the checkpoint after recovery
- manual proof: from a clean OpenClaw environment, delegated install asks for approval before restart and exposes checkpoint evidence

## Suggested Write Scope

- [cli.mjs](/Volumes/XDISK/chorus/packages/chorus-skill/cli.mjs)
- [tests/cli/cli.test.ts](/Volumes/XDISK/chorus/tests/cli/cli.test.ts)
- new install-time guard asset(s) under `packages/chorus-skill/templates/` only if required
- [SKILL.md](/Volumes/XDISK/chorus/packages/chorus-skill/templates/en/SKILL.md) and [SKILL.zh-CN.md](/Volumes/XDISK/chorus/packages/chorus-skill/templates/zh-CN/SKILL.zh-CN.md) only for minimal contract sync

## Structural Constraints

- Do not redesign hot reload, process supervision, or general runtime persistence
- Do not introduce a solution that requires manual shell takeover by the subject
- Keep EN and zh-CN user-facing behavior aligned
- Keep the enforcement mechanism inspectable: a reviewer must be able to point to the code path that blocks unauthorized restart

## Prohibitions

- Do not claim success with SKILL.md text changes alone
- Do not solve this only inside `runtime-v2.ts`
- Do not silently swallow unauthorized restart attempts
- Do not turn credentials-only activation into a mandatory restart path
- Do not bundle npm publish, version bump, or Run 2 execution into this task
