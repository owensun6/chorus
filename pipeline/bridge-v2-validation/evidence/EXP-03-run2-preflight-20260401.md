# EXP-03 Run 2 Pre-Flight Record

> Date: 2026-04-01
> Verdict: **BLOCKED**
> Scope freeze: pre-flight only; no Run 2 subject execution started

---

## Run Version Freeze

| Field | Value |
|-------|-------|
| Package under test | `@chorus-protocol/skill@0.8.0-alpha.8` |
| npm dist-tag | `alpha -> 0.8.0-alpha.8` |
| dist.shasum | `af7732068ce9afe018f895fd87fd8c5ee3ec1a1e` |
| dist.integrity | `sha512-v9/eikmYQv1BmAlWV6y8kxYyk49iV/cfIY2ORR8qAycWjVR1j9jDOVm06i82AcrZDRxV9umDUDy7DQA7cGDyEQ==` |
| dist.tarball | `https://registry.npmjs.org/@chorus-protocol/skill/-/skill-0.8.0-alpha.8.tgz` |
| Release mapping | base `HEAD 2dfa4997` + dirty worktree publish |
| Telegram fallback ancestry | `bd8e7bd` is ancestor of publish base: `yes` |

---

## Pinned Install Rule

Run 2 may only treat the published-package path as authentic if every install/verify step stays pinned to `@chorus-protocol/skill@0.8.0-alpha.8`.

- Valid examples:
  - `npx @chorus-protocol/skill@0.8.0-alpha.8 init --target openclaw`
  - `npx @chorus-protocol/skill@0.8.0-alpha.8 verify --target openclaw`
- Protocol deviation examples:
  - `npx @chorus-protocol/skill init --target openclaw`
  - `npx @chorus-protocol/skill@latest ...`
  - local tarball / local path / git URL / source-repo install / copied files

If any unpinned install occurs during Run 2:

1. Record `PROTOCOL DEVIATION: UNPINNED INSTALL`.
2. Preserve all artifacts exactly.
3. Do not use downstream install/activation/Telegram artifacts as proof that the published package path was authentic.

---

## Checks Run

### 1. Published package metadata

- `npm view @chorus-protocol/skill@0.8.0-alpha.8 version` → `0.8.0-alpha.8`
- `npm view @chorus-protocol/skill@0.8.0-alpha.8 dist.shasum dist.integrity dist.tarball --json` → exact values above
- `npx @chorus-protocol/skill@0.8.0-alpha.8 --help` → PASS

### 2. Published package smoke test (isolated temp HOME)

Environment:

- temp HOME seeded with clean `.openclaw/openclaw.json`
- no reuse of local repo or existing OpenClaw state

Commands:

```bash
HOME="$TMP_HOME" npx @chorus-protocol/skill@0.8.0-alpha.8 init --target openclaw
HOME="$TMP_HOME" npx @chorus-protocol/skill@0.8.0-alpha.8 verify --target openclaw
```

Observed result:

- `init` exit code = `0`
- `verify` exit code = `1`
- verify passed installation integrity and then blocked on restart consent gate, which is the expected fresh-install behavior for alpha.8

Evidence points from output:

- `✓ Registered skill + bridge in ~/.openclaw/openclaw.json`
- `✓ Restart consent gate armed — gateway tool blocked until checkpoint + explicit approval`
- `✓ Installation integrity: all files present, skill and bridge registered.`
- `✗ Restart consent gate active — fresh install pending checkpoint + approval`

### 3. Hub infrastructure

- `curl -s https://agchorus.com/health` → PASS
  - status = `ok`
  - version = `0.7.0-alpha`
- `curl -s https://agchorus.com/discover` → reachable
  - rerun after credential restoration (`2026-04-01T14:09:52Z`): `xiaoyin@chorus` is `online=true`

### 4. Subject / conductor execution readiness

- Subject screening: pending
  - ready-to-fill packet prepared: `pipeline/bridge-v2-validation/evidence/EXP-03-run2-subject-precheck-20260401.md`
- Subject environment pre-check: pending
  - subject-side commands and pass/fail fields are prepared in the packet above
- Screen recording + shell/browser history capture setup: pending
  - artifact-capture checklist is prepared in the packet above
- Conductor self-test: completed (`2026-04-01T14:38:44.633Z` hub send timestamp)
  - self-test sender: `run2-selftest-1775054319392@chorus`
  - direct Hub response: `success=true`, `delivery=delivered_sse`, `trace_id=6ce7e751-abd5-41e1-aa52-38beb8d547e2`
  - gateway delivery evidence: `2026-04-01T22:38:55.329+08:00 [bridge:delivery] ... trace_id="6ce7e751-abd5-41e1-aa52-38beb8d547e2" ... method="telegram_server_ack" ... ref="150"`
  - state evidence: `~/.chorus/state/xiaoyin/xiaoyin@chorus.json` records the inbound trace on route `xiaoyin@chorus:run2-selftest-1775054319392@chorus`
  - reply evidence: relay record `53c23e48-3f24-464c-8a36-fc3ec441fb50` is `confirmed=true` with `hub_trace_id=cb0460ed-2d99-4f0b-a7d3-657496cbf597`
- Browser console check: completed
  - headless Chrome loaded `https://agchorus.com/console`
  - HTTP status `200`
  - page title / H1: `Chorus Alpha Console`
  - screenshot artifact: `pipeline/bridge-v2-validation/evidence/EXP-03-run2-console-check-20260401.png`

### 5. Local conductor diagnosis

- `openclaw status` shows the local gateway service is up (`LaunchAgent ... running`), so the blocker is not "gateway process absent"
- `~/.openclaw/logs/gateway.err.log` is repeatedly reporting:
  - `[chorus-bridge] malformed config skipped: workspace/chorus-credentials.json (missing required fields)`
- Current default workspace credential file is stale / old-format:
  - `~/.openclaw/workspace/chorus-credentials.json`
  - content only has `agent_id` + `api_key` for `xiaox@chorus`
  - missing required `hub_url`, so Bridge v2 rejects it
- `~/.openclaw/workspace-xiaoyin/chorus-credentials.json` is absent
- Historical gateway logs prove the conductor agent previously depended on `~/.chorus/agents/01-xiaoyin.json`
  - example: `2026-03-30T23:59:34.230+08:00 [gateway] [chorus-bridge] activated: xiaoyin@chorus from agents/01-xiaoyin.json`
- Current disk state no longer has that credential chain:
  - `~/.chorus/agents/` is empty
  - no `~/.chorus/state/xiaoyin/*` files remain
- Directory-level snapshot captured before restoration attempt:

```text
$ ls -la ~/.chorus/agents
total 0
drwx------@ 2 owenmacmini  staff   64 Mar 31 16:18 .
drwx------@ 5 owenmacmini  staff  160 Mar 31 16:19 ..

$ find ~/.chorus/agents -maxdepth 2 -print | sort
/Users/owenmacmini/.chorus/agents
```

Conclusion from local diagnosis:

- The current pre-flight blocker is specifically: **conductor identity credential loss / stale local credential state**
- Until `xiaoyin@chorus` credentials are restored (or the experiment spec is explicitly re-pinned to a different conductor identity), Section 13.2 cannot close

### 6. Section 13.2 rerun after credential restoration

- Restored conductor credential chain at `~/.chorus/agents/01-xiaoyin.json`
  - restoration preserved the original conductor identity (`xiaoyin@chorus`); no spec rebind was used
- Current restored directory-level snapshot:

```text
$ ls -la ~/.chorus/agents
total 8
drwx------@ 3 owenmacmini  staff   96 Apr  1 22:08 .
drwx------@ 5 owenmacmini  staff  160 Mar 31 16:19 ..
-rw-------@ 1 owenmacmini  staff  179 Apr  1 22:08 01-xiaoyin.json

$ find ~/.chorus/agents -maxdepth 2 -print | sort
/Users/owenmacmini/.chorus/agents
/Users/owenmacmini/.chorus/agents/01-xiaoyin.json
```

- Gateway auto-activated the conductor without a manual restart
  - example log: `2026-04-01T22:08:21.341+08:00 [gateway] [chorus-bridge] activated: xiaoyin@chorus from agents/01-xiaoyin.json`
  - later runtime evidence still shows the same conductor path is active: `2026-04-01T22:11:53.385+08:00 [gateway] [chorus-bridge] [xiaoyin] V2 bridge active (state: /Users/owenmacmini/.chorus/state/xiaoyin)`
- Hub infrastructure rerun:
  - `curl -s https://agchorus.com/health` at `2026-04-01T14:09:55.142Z` still returns `status=ok`
  - `curl -s https://agchorus.com/discover` at `2026-04-01T14:09:52.244Z` shows `xiaoyin@chorus online=true`
  - current recheck at `2026-04-01T14:26:14.700Z` confirms the live JSON shape is `data[]`, and `curl -s https://agchorus.com/discover | jq '.data[] | select(.agent_id=="xiaoyin@chorus")'` still shows `online=true`
- Section 13.2 status after rerun:
  - `Hub health`: PASS
  - `Conductor agent online`: PASS
  - `Conductor agent can receive`: PASS
    - self-test send response returned `delivery=delivered_sse`
    - inbound trace `6ce7e751-abd5-41e1-aa52-38beb8d547e2` reached `xiaoyin@chorus`
    - reply relay `cb0460ed-2d99-4f0b-a7d3-657496cbf597` was confirmed
  - `Console accessible`: PASS
    - browser load returned HTTP `200`
    - title / H1 = `Chorus Alpha Console`
    - screenshot saved to `pipeline/bridge-v2-validation/evidence/EXP-03-run2-console-check-20260401.png`

Conclusion from rerun:

- The original conductor identity is back online, so the credential-loss blocker is closed
- Section 13.2 is now fully closed
- Overall run pre-flight is still not cleared, because Section 13.4 subject/session logistics remain pending

---

## Blocking Findings

1. Section 13.4 subject/session logistics are still pending.
   - No subject selected in this record.
   - The ready-to-fill run packet exists, but no live subject data has been entered yet.
   - No recording / shell history / browser history capture has been armed yet.
   - Subject environment pre-check has not been executed.

2. Run 2 itself has not started.
   - This record remains pre-flight only.

3. Stale workspace credential evidence still exists locally.
   - `~/.openclaw/workspace/chorus-credentials.json` is still an old-format `xiaox@chorus` credential without `hub_url`, and Bridge v2 continues to log it as malformed.
   - The active conductor path is now the restored `~/.chorus/agents/01-xiaoyin.json`, so this stale workspace file is no longer the online blocker for `xiaoyin@chorus`.
   - Keep this stale file untouched for evidence fidelity unless a later cleanup task explicitly scopes it.

---

## Decision

Pre-flight is **entered but not cleared**.

- Package gate: PASS
- Published-package smoke: PASS
- Hub health: PASS
- Conductor identity restoration: PASS
- Section 13.2 rerun: PASS
- Subject/session logistics gate: PENDING

Do not start Run 2 until the subject/session logistics gate is closed.

Allowed next actions under current freeze:

1. Re-judge whether pre-flight is cleared once Section 13.4 is closed for the chosen subject.
2. Arm recording / shell history / browser history capture for the actual run.
3. Start Run 2 only after those subject-side checks pass.

Until a new explicit release is given:

- do not modify the experiment spec
- do not switch conductor identity
- do not start Run 2
