<!-- Author: Dao-Yi -->

# TASK_SPEC_EXP03_RESTART_CONSENT_RACE (IMPL-EXP03-09)

**Task**: Fix the non-atomic state machine race in `chorus-skill restart-consent approve` that leaves the gate in an inconsistent half-state when `approve` is called before `request` has written a checkpoint.
**Assignee**: be-domain-modeler
**Source**: EXP-03 Run 4 friction event — MacBook test2-air agent got stuck in `status=awaiting_approval` with `approvedAt` already populated, unable to progress.
**Blocker**: none (orthogonal to IMPL-EXP03-04, -05, -07, -08)

## Observed Symptom (Run 4, MacBook)

Timeline:

| Time | Action | Gate file state |
|---|---|---|
| 14:12:48 | `chorus-skill init --target openclaw` → gate armed | `status=armed, approvedAt=null, checkpointPath=null` |
| 14:13:38 | Gateway supervisor restart triggered by install. Telegram channel dead (separate IMPL-04b bug). Agent inactive for 30 minutes. | unchanged |
| 14:43:55 | Operator recovers telegram channel. Agent wakes, sees queued "可以重启" message, runs `restart-consent approve --reply "yes"`. | **`approvedAt` stamped (14:44:24), `approvalReply="yes"`, but `status` stays `awaiting_approval` because checkpoint was never written.** |
| 14:45:23 | Agent (realizing checkpoint missing) runs `restart-consent request --workspace ... --current-identity "none (not registered yet)" ...` | `checkpointPath`, `checkpointWrittenAt` now set. `status` still `awaiting_approval`. |
| (after) | Agent does not re-run `approve` because from its perspective it already approved (the stored `approvalReply` confirms). Agent is stuck. | permanent inconsistent state |

The gate file now has:
```json
{
  "status": "awaiting_approval",
  "checkpointPath": "...",
  "checkpointWrittenAt": "2026-04-08T06:45:23Z",
  "approvedAt": "2026-04-08T06:44:24Z",
  "approvalReply": "yes"
}
```

`approvedAt` + `approvalReply` suggest approval happened, but `status` disagrees. The bridge is watching for `status=approved` to advance, and the agent has no way of knowing the earlier `approve` was rejected.

## Root Cause

The `restart-consent approve` action writes gate fields **before** it validates the prerequisite (checkpoint existence). When the prerequisite check fails, the partial writes are not rolled back.

Specifically (`cli.mjs` restart-consent approve action, around line 744):

1. Agent calls `approve --reply "yes"`.
2. cli reads gate state.
3. cli stamps `approvedAt` and `approvalReply` into the gate object in memory.
4. cli checks `blockState.alreadyDenied` + `checkpointPath` prerequisites.
5. Check fails: `"Restart approval blocked — checkpoint must be written first via restart-consent request"`.
6. cli exits 1 with the error — **but the in-memory gate object has already been written to disk** (or the error message emerge after the write).

Result: `status` is never set to `approved` (because the failing branch exits early), but `approvedAt` and `approvalReply` survive from the pre-check stamping.

## Behavior Contract

### 1. Atomic state transitions

All gate-file writes in `approve` must be atomic with respect to the approval decision:

- **Approval succeeds**: write the gate file with `status="approved"`, `approvedAt`, `approvalReply` all set together.
- **Approval fails (missing checkpoint)**: do NOT write anything to the gate file. Exit 1 with a clear error.

No intermediate writes. No partial field updates.

### 2. Recovery path for already-inconsistent gates

Add detection logic at the start of `restart-consent approve`: if the loaded gate has `approvedAt !== null` but `status !== "approved"`, treat it as a recoverable inconsistency — log a warning and complete the approval (set `status="approved"`, preserving existing `approvedAt` and `approvalReply`). This lets agents (and operators) recover from gates written by older buggy CLI versions without manual file editing.

### 3. `request` should set status back to `armed` if re-running

If `restart-consent request` is called when the gate already has `approvedAt !== null`, it must reset `approvedAt` and `approvalReply` to null (the checkpoint re-write semantically invalidates the prior approval). This prevents a new `request` from being silently auto-approved by stale fields.

### 4. Agent documentation in SKILL.md

The Activation sequence in `skill/SKILL.md` should explicitly list the required order: **request (write checkpoint) BEFORE approve**. Any agent attempting approve-before-request must be treated as a usage error, not an implicit ordering.

## Acceptance Criteria (BDD)

- Given: a freshly armed gate (no checkpoint yet)
  When: agent runs `restart-consent approve --reply "yes"`
  Then: the command exits 1
  And: the gate file on disk still has `status="armed"`, `approvedAt=null`, `approvalReply=null`
  And: the error message tells the agent to run `restart-consent request` first

- Given: a gate with checkpoint written (`status="awaiting_approval"`, `checkpointPath` set)
  When: agent runs `restart-consent approve --reply "yes"`
  Then: the command exits 0
  And: the gate file has `status="approved"`, `approvedAt=<now>`, `approvalReply="yes"`

- Given: an inconsistent gate from a buggy older CLI (`status="awaiting_approval"` + `approvedAt=<set>` + `checkpointPath=<set>`)
  When: agent runs `restart-consent approve --reply "<anything>"`
  Then: the command exits 0
  And: the gate file has `status="approved"`, `approvedAt` preserved from the prior value
  And: stdout contains a recovery notice (e.g. "Recovering from previously-inconsistent gate state")

- Given: an approved gate
  When: agent runs `restart-consent request --workspace ... --current-identity ...` (re-request)
  Then: the new gate has `status="armed"` (or `awaiting_approval`), `approvedAt=null`, `approvalReply=null`
  And: a fresh checkpoint is written

## Write Scope

| File | Change |
|---|---|
| `packages/chorus-skill/cli.mjs` | `restart-consent approve` action: move the `writeRestartGate` call to occur only after all prerequisite checks pass. Add recovery-path detection at the top of the action. `restart-consent request` action: when overwriting an existing gate, clear `approvedAt` + `approvalReply`. |
| `tests/cli/cli.test.ts` | 4 new tests matching the 4 BDD scenarios above. |
| `skill/SKILL.md` + `skill/SKILL.zh-CN.md` | Activation sequence: make "request before approve" order explicit. |
| `packages/chorus-skill/templates/en/SKILL.md` + `templates/zh-CN/SKILL.zh-CN.md` | Sync with skill/. |

## Out of Scope

- IMPL-EXP03-04 (channel preservation — fixed in commit `7a00ab5`)
- IMPL-EXP03-05 (per-agent workspace discovery — fixed in commit `7b35fe3`)
- IMPL-EXP03-08 (user_culture inference — separate task)
- OpenClaw agent prompt / SKILL refinement (separate)

## Notes

- **Severity**: P1. Blocks EXP-03 Run 4 MacBook side. Does not affect Mac mini (Mac mini's telegram was never lost, so the agent ran request → approve in the normal order and hit no race).
- **Interaction with IMPL-EXP03-04b**: without IMPL-04b, the MacBook friction gets exposed because telegram dies and the agent is inactive for an extended period. Fix IMPL-04b first and this race may become much rarer in practice, but the race is still a real defect that should be closed.
- The recovery path (criterion 3) lets operators skip manual `~/.chorus/restart-consent.json` editing when recovering from this exact Run 4 scenario — the next `approve` call on the stuck gate just Does The Right Thing.
