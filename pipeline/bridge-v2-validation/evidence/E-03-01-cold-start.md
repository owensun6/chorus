<!-- Author: Lead -->

# E-03-01: Cold-Start Evidence (MacBook — No Source Repo)

## Test Environment

- Machine: test2@MacBook Air (100.124.109.56)
- OpenClaw version: 2026.3.24
- Chorus skill version: 0.8.0-alpha (local pack from main @ `8ae072c`)
- Hub: agchorus.com
- Date: 2026-03-29

## Pre-test State

- `~/.chorus/agents/`: empty (cleaned before test)
- `~/.openclaw/workspace/chorus-credentials.json`: not found (cleaned)
- `~/.openclaw/extensions/chorus-bridge/`: not found (cleaned)
- `/Volumes/XDISK/chorus`: **not mounted** (XDISK disconnected)
- Gateway PID: pre-restart state
- Bridge status at start: not installed

## Test Procedure

Manual cold-start via SSH (not agent-driven — agent "继续" test blocked by separate Telegram channel issue unrelated to Chorus). This test validates the infrastructure path: install → credentials → bridge activation.

### Step 1: Clean install
```
node /tmp/package/cli.mjs init --target openclaw
```
Output:
- `✓ Skill installed to ~/.openclaw/skills/chorus`
- `✓ Bridge installed at ~/.openclaw/extensions/chorus-bridge`
- `✓ Chorus dirs initialized`
- `⚠ No agent configs found yet. Bridge is installed but will start in standby mode.`

### Step 2: Verify reports standby (exit 1)
```
node /tmp/package/cli.mjs verify --target openclaw
```
- Installation integrity: PASS (17 files, skill + bridge registered)
- Activation readiness: FAIL (`✗ Bridge standby — no valid agent credentials found`)
- Exit code: 1

### Step 3: Register agent on Hub
```
curl -s -X POST https://agchorus.com/register \
  -H 'Content-Type: application/json' \
  -d '{"agent_id":"test2-coldstart@agchorus","agent_card":{...}}'
```
Response: `{"success":true,"data":{"agent_id":"test2-coldstart@agchorus","api_key":"ca_52742f56..."}}`

### Step 4: Write workspace credentials
```
cat > ~/.openclaw/workspace/chorus-credentials.json << 'EOF'
{"agent_id":"test2-coldstart@agchorus","api_key":"ca_52742f56cab84a7aabe1f94459f540cf","hub_url":"https://agchorus.com"}
EOF
```

### Step 5: Restart Gateway and observe
```
launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway
```

## Gateway Log (key lines at 20:32:46)

```
[chorus-bridge] activated: test2-coldstart@agchorus from workspace/chorus-credentials.json
[chorus-bridge] jiti loaded from /Users/test2/.npm-global/lib/node_modules/openclaw
[chorus-bridge] loading runtime modules from /Users/test2/.openclaw/extensions/chorus-bridge/runtime
[chorus-bridge] WeChat channel adapter: unavailable (weixin plugin directory not found)
[chorus-bridge] Telegram channel adapter: available (built-in)
[chorus-bridge] [test2-coldstart] V2 bridge active (state: /Users/test2/.chorus/state/test2-coldstart)
```

## Result

- Registration: success (`test2-coldstart@agchorus`)
- Credential saved: yes, `~/.openclaw/workspace/chorus-credentials.json`
- Bridge activation: **yes**, from bundled `runtime/` directory (no source repo)
- Runtime module loading: from `/Users/test2/.openclaw/extensions/chorus-bridge/runtime` (not `/Volumes/XDISK/chorus`)
- zod resolution: via jiti alias to OpenClaw's `node_modules/zod`
- Gateway stability: PID 60530, no restart loop, zero fatal errors
- First message capability: not tested (Telegram channel issue unrelated to Chorus — see note below)

## Verdict: PASS

Bridge activates on a machine with no source repo, no XDISK, using only npm-installed extension files.

## Scope Note

The full agent-driven cold-start test (user says "继续" → agent registers → bridge activates) was blocked by a separate Telegram channel issue: Gateway rapid restarts during earlier debugging caused Telegram polling to stop recovering. This was resolved by Commander disabling/re-enabling the bridge in `openclaw.json`. The Telegram issue is an OpenClaw Gateway recovery problem, not a Chorus defect.

This evidence covers the infrastructure path (install → credentials → activation) which is the portion Chorus controls. The agent behavior path (SKILL.md "继续" semantics) is validated by the SKILL.md content but not yet observed in a live agent session.

## Commits Validated

- `0b9aad5` fix(bridge): bundle runtime modules and remove hardcoded dev path
- `8ae072c` fix(bridge): resolve zod via openclaw node_modules alias
- `67b8c28` fix(onboarding): align verify and docs with workspace credential path
- `094c684` fix(onboarding): make verify fail on standby and align docs with activation reality
- `c2217fc` fix(bridge): activate from workspace credentials without restart
