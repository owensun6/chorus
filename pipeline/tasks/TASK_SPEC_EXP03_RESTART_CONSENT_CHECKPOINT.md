<!-- Author: Commander -->

# TASK_SPEC_EXP03_RESTART_CONSENT_CHECKPOINT

**Task**: Add explicit restart consent and pre-restart checkpoint rules to Chorus fresh-install activation
**Assignee**: be-domain-modeler
**Source**: EXP-03 cold-start friction analysis on 2026-03-31
**Blocker**: none
**Stage Freeze**: spec only; do not implement doc or code changes in the same pass

## Purpose

When Chorus first install requires an OpenClaw Gateway restart to load `chorus-bridge`, the agent must not restart someone else's Gateway silently. It must ask for permission first and persist enough task state to survive the restart.

This task is about the user-visible activation contract, not bridge runtime behavior.

## Input

- [SKILL.md](/Volumes/XDISK/chorus/packages/chorus-skill/templates/en/SKILL.md)
- [SKILL.zh-CN.md](/Volumes/XDISK/chorus/packages/chorus-skill/templates/zh-CN/SKILL.zh-CN.md)
- [EXP-03-human-developer-cold-start.md](/Volumes/XDISK/chorus/docs/experiments/EXP-03-human-developer-cold-start.md)
- [cli.mjs](/Volumes/XDISK/chorus/packages/chorus-skill/cli.mjs)
- [runtime-v2.ts](/Volumes/XDISK/chorus/packages/chorus-skill/templates/bridge/runtime-v2.ts)

## Output

- updated [SKILL.md](/Volumes/XDISK/chorus/packages/chorus-skill/templates/en/SKILL.md)
- updated [SKILL.zh-CN.md](/Volumes/XDISK/chorus/packages/chorus-skill/templates/zh-CN/SKILL.zh-CN.md)
- no code change in [cli.mjs](/Volumes/XDISK/chorus/packages/chorus-skill/cli.mjs)
- no code change in [runtime-v2.ts](/Volumes/XDISK/chorus/packages/chorus-skill/templates/bridge/runtime-v2.ts)

## Exact Behavior Contract

### 1. Restart is consent-gated

If Chorus is freshly installed or upgraded and the plugin is not yet loaded, the agent must not call `gateway.restart` immediately.

The agent must first tell the user, in the user's language, the equivalent of:

> Chorus is installed. To make the bridge take effect, OpenClaw Gateway may need a restart. I will save the current task first. Do you want me to restart now?

### 2. Checkpoint is written before the question is asked

Before asking for restart approval, the agent must persist a checkpoint file at workspace root:

`./chorus-restart-checkpoint.md`

Minimum required fields:

- `restart_required_for`: why restart is needed now
- `user_goal`: current user goal in one sentence
- `current_identity`: existing `agent_id` if known, else `unknown`
- `completed_steps`: what has already been finished
- `next_step_after_restart`: first action after restart
- `pending_user_decision`: `restart_now`
- `resume_message`: the first user-facing sentence to send after resume

This file is a recovery artifact, not durable identity. It does not replace `./chorus-credentials.json`.

### 3. No restart on credentials-only activation

If `chorus-bridge` is already loaded and the only missing piece is credentials, the agent must not ask for restart. It should save credentials and wait for bridge auto-activation.

### 4. Explicit yes only

Allowed restart approvals:

- `yes`
- `restart now`
- `现在重启`
- another unambiguous affirmative with the same meaning

Anything else means no restart. Silence, topic change, or vague intent is not approval.

### 5. Post-restart recovery order

If the user approves and restart happens, the first recovery sequence must be:

1. read `./chorus-restart-checkpoint.md`
2. re-read `./chorus-credentials.json` if it exists
3. restore the task state from checkpoint
4. send the `resume_message` or equivalent user-facing continuation
5. continue the activation flow

The agent must not pretend to remember the pre-restart chat from transcript residue alone.

### 6. Cleanup rule

Once bridge activation is verified and the user-visible task has resumed, the checkpoint file may be deleted or marked completed. It must not be left as an ambiguous stale recovery marker.

## Acceptance Criteria (BDD)

- Given: fresh install requires plugin load
  When: the agent reaches the point where restart is needed
  Then: it writes `./chorus-restart-checkpoint.md` before asking the user whether to restart.

- Given: the user has not explicitly approved restart
  When: Chorus activation is still pending
  Then: the agent does not call `gateway.restart`.

- Given: the plugin is already loaded and only credentials are missing
  When: credentials are saved
  Then: the agent waits for bridge auto-activation and does not request restart.

- Given: the user explicitly approves restart
  When: the session comes back after restart
  Then: the agent reads the checkpoint first and resumes from it instead of relying on lost chat context.

- Given: activation completes successfully after restart
  When: recovery is confirmed
  Then: the checkpoint is cleared or marked completed.

## Test Specs

- manual test: fresh install path asks for restart consent and writes checkpoint before any restart tool call
- manual test: credentials-only path does not ask for restart
- manual test: approve restart, then verify the first resumed action reads the checkpoint and restates the saved task
- manual test: decline restart, then verify no restart occurs and the blocker is reported clearly

## Structural Constraints

- Keep this task at the doc/prompt-contract layer
- Do not broaden scope into hot reload or runtime persistence redesign
- EN and zh-CN templates must stay semantically aligned
- The checkpoint schema must be simple enough for a human to inspect and an agent to reuse directly

## Prohibitions

- Do not silently restart someone else's Gateway
- Do not ask for restart and only then decide to save the task
- Do not rely on chat transcript memory surviving process restart
- Do not solve this by changing EXP-03 subject instructions first
- Do not mix this task with bridge runtime changes unless a separate task spec explicitly expands scope
