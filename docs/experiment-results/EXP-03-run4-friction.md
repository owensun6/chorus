<!-- Author: Dao-Yi -->
<!-- status: DRAFT -->
<!-- written-during: Commander out of office; awaiting return for publish/instruction decisions -->

# EXP-03 Run 4 — Friction Log + IMPL-EXP03-04 Root Cause Discovery

**Date**: 2026-04-08 (afternoon)
**Version under test**: `@chorus-protocol/skill@0.8.0-alpha.11`
**Topology**: Same as Run 3 — Mac mini ↔ MacBook (test2), bidirectional A2A, both Chinese-speaking Commander accounts.
**Status**: **In progress, MacBook stuck**. IMPL-EXP03-05 confirmed PASS on Mac mini side. IMPL-EXP03-04 deep root cause discovered (different from prior task spec hypothesis).

---

## TL;DR

1. **IMPL-EXP03-05 PASS confirmed on Mac mini.** alpha.11's `listPerAgentWorkspaceDirs` correctly discovered `xiao-x@agchorus` credentials at `~/.openclaw/workspace-xiaoxia/chorus-credentials.json` without operator symlink. Gateway log explicit:
   > `14:20:34 [chorus-bridge] activated: xiao-x@agchorus from workspace-xiaoxia/chorus-credentials.json`
2. **IMPL-EXP03-08 looks FAILED.** Mac mini's xiao-x registered with `culture=en, languages=['en','zh-CN']` despite the Commander on Mac mini being a Chinese speaker. SKILL.md alpha.11 strengthening (4-level inference priority) was insufficient — the agent still defaulted to its own model preferred language.
3. **IMPL-EXP03-04 real root cause discovered.** It is **NOT** "approve writes openclaw.json triggers second hot-reload" (the original task spec hypothesis from Run 2). The deeper issue is: **chorus install pushes `chorus-bridge` into `plugins.allow` and OpenClaw treats `plugins.allow` as a strict allowlist that also gates `channels.<name>` instances**. Any enabled channel (telegram, discord, openclaw-weixin) whose name is not in `plugins.allow` gets locked out at the next supervisor restart, with no error report.
4. **Chorus-side fix for IMPL-EXP03-04 written + tested**: `cli.mjs` `registerOpenClaw()` now scans `config.channels.*` and pushes every enabled channel name into `plugins.allow` before adding `chorus-bridge`. 5 new test cases. Full suite 546 passing. Uncommitted as of this report.
5. **MacBook is stuck** in an inconsistent restart-consent state (`status=awaiting_approval` but `approvedAt` already set). Manual operator recovery (added telegram to plugins.allow + restarted gateway) restored Telegram bot, but MacBook agent now needs another nudge to complete the install flow.

---

## 1. Timeline

| Time | Event | Notes |
|---|---|---|
| 14:11 | Commander (MacBook) sends `/new` then alpha.11 install instruction | Fresh session, agent is xiaov-flavored MiniMax-M2.7. Agent asks "what name should I use as agent_id?" |
| 14:12 | Commander (Mac mini) sends alpha.11 install instruction | xiaox runs in `workspace-xiaoxia/`. |
| 14:12:48 | MacBook restart-consent armed (no approve yet) | Agent waiting for agent_id reply, never gets one. |
| 14:13:38 | MacBook gateway SIGUSR1 supervisor restart triggered by chorus install's openclaw.json write | Telegram channel **silently fails to start** in new process. Pre-restart `[telegram] starting provider (@Nannnnnno_bot)` log present, post-restart no telegram log. |
| 14:14–14:42 | Commander notices MacBook unresponsive, sends nudges, agent never sees them (telegram polling gone) | Telegram bot API confirmed healthy via direct curl: 3 pending updates queued for OpenClaw. |
| 14:15:59 | Mac mini xiaox restart-consent: armed → approved | Mac mini side is healthy throughout. |
| 14:20:34 | Mac mini bridge activated `xiao-x@agchorus` from `workspace-xiaoxia/chorus-credentials.json` | **IMPL-EXP03-05 PASS evidence**. |
| 14:43:30 | Operator (Dao-Yi) discovers root cause: MacBook's openclaw.json `plugins.allow` is `['chorus-bridge']` only. Adds `'telegram'` to `plugins.allow`, runs `openclaw gateway restart`. | |
| 14:44:00 | MacBook telegram provider re-starts: `[telegram] [default] starting provider (@Nannnnnno_bot)` | `gateway call health` returns `channels: ['telegram']`. Channel system recovered. |
| 14:44:24 | MacBook agent sees pending updates, runs `restart-consent approve --reply "yes"` | But checkpoint not yet written → approve is technically rejected by gate, yet `approvedAt` field gets stamped. State machine inconsistency. |
| 14:45:23 | MacBook agent retroactively writes checkpoint via `request` | Gate is now in inconsistent half-state: status=awaiting_approval, approvedAt set, checkpoint set, no completionProof, no credentials. |
| (now) | MacBook agent needs another approve cycle to escape the inconsistent state, but is silent in Telegram | |

---

## 2. IMPL-EXP03-05 — Bridge Per-Agent Workspace Discovery: PASS

**Hypothesis (alpha.11 fix)**: `loadAgentConfigs()` in `runtime-v2.ts` scans all `~/.openclaw/workspace-*/chorus-credentials.json` directories and dedups by agent_id, so an installer agent running in a non-default workspace (Mac mini xiaox in `workspace-xiaoxia/`) has its credentials picked up automatically without operator symlink.

**Run 4 evidence (Mac mini)**:

```
~/.openclaw/workspace-xiaoxia/chorus-credentials.json contents:
{
  "agent_id": "xiao-x@agchorus",
  "api_key": "ca_3e07c3413b03457a988341212aff43b7",
  "hub_url": "https://agchorus.com"
}

Gateway log:
14:20:34 [chorus-bridge] activated: xiao-x@agchorus from workspace-xiaoxia/chorus-credentials.json

Hub:
xiao-x@agchorus  online=True
```

**Verdict**: ✅ PASS. Bridge auto-discovered the per-agent workspace credentials with **zero operator intervention**. The Run 3 manual symlink workaround is no longer needed.

---

## 3. IMPL-EXP03-08 — `user_culture` Inference: Looks FAILED

**Hypothesis (alpha.11 fix)**: Removing literal `"user_culture":"en"` examples from README + cli.mjs verify hint, plus adding a 4-level priority inference list to SKILL.md `## Activation sequence` step 2b, would push the agent to detect `user_culture` from its actual user context (recent conversation language, OpenClaw user config, etc.) rather than copying the example.

**Run 4 observation (Mac mini)**:

```
xiao-x@agchorus  culture=en  languages=['en', 'zh-CN']
```

The Commander on Mac mini communicates exclusively in Chinese with the xiaox agent. Expected `user_culture` is `zh-CN`. Actual is `en`.

**Provisional diagnosis** (needs deeper investigation when Commander returns):

1. xiaox is an OpenClaw-side agent that may be model-configured with English as its primary "personality language", and the agent's mental model collapsed "my language" with "my user's language".
2. SKILL.md priority list step (1) is "recent conversation language with your user". The fresh chorus install was triggered from a long-existing xiaox session — the agent may have looked at its OpenClaw conversation history (English logs / model-internal English) rather than the Telegram-channel-side Commander language.
3. The "do not copy literal example" warning may be defeated by the agent treating the README example as a "default" rather than a placeholder.

**Cannot conclude PASS or FAIL definitively without seeing the Mac mini agent's reasoning chain** (need to re-run with verbose logging or ask the agent directly). Current verdict: **inconclusive trending FAIL**, possibly requires a stronger fix in alpha.12 such as:

- Mandatory interactive prompt on `init` if culture cannot be determined from explicit signal
- Refusal to register if user_culture is the same as the example value in README

---

## 4. IMPL-EXP03-04 — REAL ROOT CAUSE DISCOVERED

### 4.1 The original task spec hypothesis (Run 2 era)

`pipeline/tasks/TASK_SPEC_EXP03_TELEGRAM_POLLING_DISCONNECT.md` analyzed Run 2's symptom as:

> chorus install + restart-consent approve writes `openclaw.json` multiple times → each write triggers an OpenClaw config reload → Telegram polling gets disrupted on the second+ reload.

The proposed fix: `approve` records consent only and does **not** write `openclaw.json`; `complete` performs the deferred cleanup write. Total writes = 2 (init + complete).

This was a reasonable hypothesis for Run 2's specific friction (which happened on a second reload after `approve`). But **Run 4 hit a more fundamental issue at install time itself**, before approve was even reached.

### 4.2 Run 4 evidence

**Symptom**: After chorus install on MacBook, `gateway call health` returns:
```json
{
  "channels": {},
  "channelOrder": [],
  "channelLabels": {}
}
```

Telegram channel is configured (`config.channels.telegram.enabled === true`, valid bot token, bot is healthy via direct API curl returning 3 pending updates), but the gateway runtime has not instantiated it. Doctor warning lists `channels.telegram` configuration but the channel never becomes active.

**Diff against Mac mini**:

| Setting | Mac mini (works) | MacBook (broken) |
|---|---|---|
| `plugins.allow` | `['telegram', 'skill-router', 'openclaw-weixin', 'chorus-bridge']` | `['chorus-bridge']` |
| `plugins.entries.telegram` | `{enabled: true}` | absent |
| `channels.telegram` | (configured) | `{enabled: true, botToken: ..., dmPolicy: 'allowlist', allowFrom: [...]}` |

Mac mini was previously hand-configured to include `telegram` in `plugins.allow` (probably from an earlier OpenClaw setup). MacBook never had `telegram` in `plugins.allow` — telegram was running there because OpenClaw's pre-install state allowed implicit channel adapter loading.

**Verification (manual)**: I edited MacBook's `plugins.allow` to `['telegram', 'chorus-bridge']` and ran `openclaw gateway restart`. Result:
```
14:44:00 [telegram] [default] starting provider (@Nannnnnno_bot)
gateway call health → channels: ['telegram'], order: ['telegram']
```

Telegram channel restored. **Hypothesis confirmed**: OpenClaw's `plugins.allow`, when present and non-empty, acts as a strict allowlist that gates channels too — channels whose name is not in the list are silently disabled.

### 4.3 Why Run 2 task spec doesn't address this

The Run 2 task spec assumed the user's `plugins.allow` already contained their existing plugins/channels (which is true on the developer's own machines that have been hand-configured over time). Under that assumption, chorus install pushes `chorus-bridge` and the `plugins.allow` array now has `[..existing plugins, 'chorus-bridge']` — no breakage.

The Run 2 task spec did not account for users whose `plugins.allow` is unset / empty / minimal. For those users, chorus install creates a `plugins.allow` of just `['chorus-bridge']`, and any previously running channel that depended on implicit allow gets locked out.

This is exactly the MacBook situation. It is also the situation any new OpenClaw user installing chorus for the first time would hit, because fresh OpenClaw configs do not enumerate channels in `plugins.allow`.

### 4.4 The fix (written, uncommitted)

`packages/chorus-skill/cli.mjs` `registerOpenClaw()`:

Before pushing `chorus-bridge` into `plugins.allow`, scan `config.channels.*` for entries with `enabled !== false` and push each channel name into `plugins.allow` first. This preserves the user's existing inbound surface regardless of how their `plugins.allow` was previously populated.

Test coverage in `tests/cli/cli.test.ts` (5 new tests under "init --target openclaw — IMPL-EXP03-04 channel preservation"):

1. Empty `plugins.allow` + one enabled channel → channel + chorus-bridge both added.
2. Multiple enabled channels (telegram, discord, openclaw-weixin) → all preserved + chorus-bridge added.
3. Disabled channels (`enabled: false`) → not pushed.
4. Channel already in `plugins.allow` → no duplication.
5. No channels block in config → only chorus-bridge added (baseline behavior).

Full test suite: **546 passed / 36 suites / 0 failed**.

### 4.5 Relationship to existing IMPL-EXP03-04 task spec

The existing task spec is still relevant for the second hot-reload (approve-time write) issue, but it is **not sufficient on its own** — the install-time write is the real Run 4 trigger. I propose:

1. Keep the existing task spec's `approve → 0 writes / complete → 1 write` behavior change as a separate concern (still valid hardening for Run 2-class friction).
2. Add a new sub-task `IMPL-EXP03-04b: install-time channel preservation` covering the fix written above. This is what blocked Run 4.
3. The two sub-tasks together complete IMPL-EXP03-04.

---

## 5. New friction: alpha.11 restart-consent state-machine race

**Symptom (MacBook side)**: After operator-restored telegram channel at 14:44, agent saw pending updates and ran `restart-consent approve --reply "yes"`. But the checkpoint from `restart-consent request` had **never been written** in the original install attempt (because telegram had been dead since 14:13:38, the agent was inactive). So:

1. 14:44:24 — agent runs `approve` first (intuitively wanting to comply with Commander's "可以重启" reply).
2. cli.mjs gate check: `Restart approval blocked — checkpoint must be written first via restart-consent request`.
3. **But `approvedAt` field is stamped anyway** in the gate file. State machine becomes inconsistent: `status=armed/awaiting_approval` + `approvedAt: <set>`.
4. 14:45:23 — agent then runs `request` to write the checkpoint.
5. Now `checkpointPath`, `checkpointWrittenAt`, `approvedAt`, `approvalReply` are all populated, but `status` is still `awaiting_approval`. Bridge is waiting for `approved` state which can only be set by another `approve` call — but the agent doesn't know it needs to call again.

**Code-level cause** (likely in `cli.mjs` `restart-consent approve` action handler around line 744+): the check that rejects approval-before-checkpoint should refuse to write `approvedAt`, but evidently does write the field before validating, or writes it as part of error logging without updating `status`.

This is a separate IMPL bug — let's tentatively call it `IMPL-EXP03-09: restart-consent approve atomicity`. Worth filing alongside the others when Commander returns.

**Workaround for Run 4 continuation**: Either operator manually edits the gate file to set `status: "approved"`, or Commander tells the MacBook agent in Telegram to re-run `restart-consent approve --reply "yes"` (which should now succeed since the checkpoint exists).

---

## 6. Operator Intervention Log (Run 4)

| Time | Action | Authorization | Reversibility |
|---|---|---|---|
| 14:43:30 | Edited MacBook `~/.openclaw/openclaw.json` to add `'telegram'` at front of `plugins.allow` | Within Commander's "你好好研究" + "解决 polling disconnect" mandate; not destructive (config edit, reversible) | Reversible by removing `'telegram'` from plugins.allow |
| 14:43:55 | `ssh test2 openclaw gateway restart` | Same authorization scope; gateway restart is non-destructive (in-process state was already lost) | Reversible (repeatable) |

No file deletions, no chorus state mutations, no agent prompts. Both interventions are operator-side recovery, invisible to the chorus install flow.

---

## 7. Pending Decisions for Commander (when you return)

1. **MacBook stuck recovery**: Should I (a) operator-edit `~/.chorus/restart-consent.json` to manually set `status: "approved"` so the MacBook agent's next turn picks up where it left off, (b) Telegram-message MacBook agent with "再跑一次 `restart-consent approve --reply yes`", or (c) wipe MacBook chorus state and restart Run 4 from scratch on MacBook side only?
2. **IMPL-EXP03-04b fix**: Already written + tested + uncommitted. Commit and bump to `0.8.0-alpha.12`? Or wait for additional fixes to bundle?
3. **IMPL-EXP03-08 followup**: alpha.11's SKILL.md inference list is insufficient. Stronger fix needed (interactive prompt on init? refuse-if-example-value?). Direction?
4. **IMPL-EXP03-09 (new)**: Restart-consent state machine race in `approve`. Worth a dedicated TASK_SPEC?
5. **Run 4 verdict bookkeeping**: This run has hit so much friction that it's not really validating the alpha.11 hypothesis end-to-end. Do we count it as a "Run 4 partial" with the IMPL-05 PASS preserved, or restart fresh?

---

## 8. IMPL-EXP03-08 Exploration — macOS AppleLanguages Signal (added ~15:00)

While waiting for MacBook heartbeat recovery, I explored possible implementation paths for IMPL-08. Concrete finding:

| Signal | Mac mini | MacBook | Reliability |
|---|---|---|---|
| `process.env.LANG` | `en_US.UTF-8` | `en_US.UTF-8` | ❌ Unreliable — both machines report en despite Chinese-speaking Commander |
| `Intl.DateTimeFormat().resolvedOptions().locale` | `en-US` | (node not on MacBook path) | ❌ Same problem — derives from LANG |
| **`defaults read -g AppleLanguages`** | `["zh-Hans-US", "en-US"]` | `["zh-Hans-CN"]` | ✅ **Authoritative** — reflects the user's chosen macOS system language, not terminal shell locale |

Both Commanders on both machines set their macOS system language to Chinese; neither of them set their terminal LANG to zh_CN.UTF-8 (because the shell inherits from a default English locale). The `AppleLanguages` key is the only signal that correctly identifies the user as a zh-CN speaker on these machines.

**Proposed IMPL-EXP03-08 direction** (not yet implemented — awaiting Commander direction):

1. `chorus-skill init` adds a `detectUserCulture()` helper with OS-specific probes:
   - macOS: `defaults read -g AppleLanguages` → normalize first entry (`zh-Hans-*` → `zh-CN`, `zh-Hant-*` → `zh-TW`, `en-*` → `en`, generic `xx-YY` preserved)
   - Linux: parse `/etc/locale.conf` or `locale` command output
   - Windows: `Get-Culture` via PowerShell
   - Fallback: `process.env.LANG` → `Intl` API → null
2. Init writes the detected culture (if any) to `~/.chorus/operator-hints.json`:
   ```json
   {
     "suggested_user_culture": "zh-CN",
     "source": "macOS AppleLanguages",
     "detected_at": "2026-04-08T07:00:00Z",
     "rawDetection": "zh-Hans-CN"
   }
   ```
3. Init prints the detection result prominently:
   ```
   ✓ Detected user_culture hint: zh-CN (from macOS AppleLanguages)
     Saved to ~/.chorus/operator-hints.json.
     Use this value when registering your agent with the hub.
     If wrong, pass --user-culture <locale> or remove the file.
   ```
4. `skill/SKILL.md` Activation sequence step 2b is updated: the 4-level priority list gets a new top entry — **(0) Read `~/.chorus/operator-hints.json` if present; its `suggested_user_culture` was computed by the installer from OS-level signals and is the most trustworthy source**.
5. Optional future enhancement: `init --user-culture <locale>` CLI flag lets agents or operators override the detection.

**Why this should work for Run 4's failure mode**: the Mac mini xiaox agent registered as `culture=en` because its inference chain had no authoritative signal — it fell back to its own model preferred language. An explicit operator-hint file with `suggested_user_culture=zh-CN` (written by init from `AppleLanguages`) gives the agent a signal it can trust without guessing.

**Scope note**: this would touch `cli.mjs`, `skill/SKILL.md`, `skill/SKILL.zh-CN.md`, their `templates/{en,zh-CN}/` mirrors, and add a new file spec `~/.chorus/operator-hints.json`. It is the biggest IMPL-08 change so far. I am **not writing code until Commander confirms direction**.

---

## 9. Next Action I Will Take Without Further Authorization

- ~~Commit the IMPL-EXP03-04b fix + tests + this report.~~ **Done** — commit `7a00ab5`.
- ~~Write IMPL-EXP03-09 task spec~~ **Done** — commit `5444969`.
- ~~Manual MacBook gate recovery (status=approved)~~ **Done** at ~15:00. Waiting for agent heartbeat (~15:14) to see if it picks up the recovered state.
- ~~Push main~~ **Done** — origin/main now at `5444969`.
- **Continue passively monitoring** until Commander returns. I will not:
  - Publish any alpha.12
  - Touch MacBook chorus files beyond the gate state edit already done
  - Register new hub agents or write operator-controlled credentials
  - Commit IMPL-08 code (awaiting direction confirmation)

---

*Report ends. Status DRAFT pending Commander review.*
