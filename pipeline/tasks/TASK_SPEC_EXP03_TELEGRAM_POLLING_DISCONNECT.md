<!-- Author: Commander -->

# TASK_SPEC_EXP03_TELEGRAM_POLLING_DISCONNECT (IMPL-EXP03-04)

**Task**: Fix Telegram polling disconnect caused by cascading openclaw.json writes during Chorus install/consent flow
**Assignee**: be-domain-modeler
**Source**: EXP-03 Run 2 friction event — Telegram channel stopped responding after Chorus message delivery
**Blocker**: none
**Stage Freeze**: implementation scope only; do not bundle npm publish or EXP-03 retest

## Root Cause

Chorus install and restart-consent flow writes `openclaw.json` multiple times. Each write triggers OpenClaw's hybrid config reload watcher (debounce 1s), causing cascading gateway restarts. Telegram polling fails to recover after the second+ restart.

Observed timeline (EXP-03 Run 2, 2026-04-03):

| Time | Trigger | openclaw.json write | Effect |
|------|---------|-------------------|--------|
| 18:10:59 | `init` → `registerOpenClaw()` | skill + plugin + deny | Auto reload #1, Telegram polling starts |
| 18:41:15 | `restart-consent approve` → `restoreRestartGateBlock()` | Remove deny | Auto reload #2, Telegram polling lost |
| 18:46:18 | Chorus message delivery | None (plugin re-registration via hooks) | Plugin registered x5 in single cycle |

Core contradiction: the restart consent gate is designed to control restart timing, but OpenClaw's hot-reload bypasses it — any `openclaw.json` change triggers automatic restart regardless of consent state.

## Behavior Contract

### 1. approve does not write openclaw.json

`restart-consent approve` must only update `~/.chorus/restart-consent.json` (gate state file). It must NOT call `restoreRestartGateBlock()` or write to `openclaw.json`. This eliminates the reload #2 trigger.

### 2. complete merges cleanup into one write

`restart-consent complete` performs the deferred cleanup:
1. Remove `gateway` from `tools.deny` in `openclaw.json`
2. Write `openclaw.json` once
3. Remove gate file
4. Remove checkpoint

This is the only post-init write to `openclaw.json`, and it happens after bridge is fully stable.

### 3. Total openclaw.json writes = 2

- `init` → 1 write (skill + plugin + deny)
- `complete` → 1 write (remove deny)
- `approve` → 0 writes to openclaw.json

### 4. gateway.restart remains the only explicit restart source

After removing the approve-time write, the only restart between init and complete is the agent's explicit `gateway.restart` call (after user approval). OpenClaw's hot-reload does not interfere during the consent window.

## Acceptance Criteria (BDD)

- Given: fresh install completed
  When: `restart-consent approve --reply "yes"` is executed
  Then: `openclaw.json` is NOT modified
  And: `restart-consent.json` status is "approved"
  And: `tools.deny` in `openclaw.json` still contains "gateway"

- Given: restart approved and bridge activated
  When: `restart-consent complete` is executed
  Then: `openclaw.json` is modified once (deny removed)
  And: gate file is deleted
  And: checkpoint is deleted

- Given: full install → approve → restart → complete cycle
  When: counting `openclaw.json` writes
  Then: total = 2 (init + complete)

## Write Scope

| File | Change |
|------|--------|
| `packages/chorus-skill/cli.mjs` | approve: remove `restoreRestartGateBlock()` + `writeJSON(OPENCLAW_CONFIG_PATH)`; complete: add `restoreRestartGateBlock()` + `writeJSON(OPENCLAW_CONFIG_PATH)` before gate cleanup |
| `tests/cli/cli.test.ts` | Update approve assertions (deny still present after approve); update complete assertions (deny removed after complete) |

## Out of Scope

- OpenClaw reload watcher behavior (not this project)
- Telegram polling recovery internals (OpenClaw)
- EXP-03 verdict (PASS stands; this is a recorded friction event)
- npm publish or version bump
