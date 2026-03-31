# P0-01: Published Package Usability Gate

> Date: 2026-03-30 (initial), 2026-03-31 (bidirectional + human verification)
> Verdict: **PASS**

---

## Summary

`@chorus-protocol/skill@0.8.0-alpha.1` completes **bidirectional** E2E content conversation between two OpenClaw agents (`xiaoyin@chorus` ↔ `xiaox@chorus`) through the Chorus Hub, with chorus-bridge and Telegram channels coexisting in the same Gateway process.

- **Unidirectional** (2026-03-30): curl → xiaoyin → Telegram delivery + outbound relay
- **Bidirectional + human-visible** (2026-03-31): Commander triggers from Telegram → xiaox ↔ xiaoyin autonomous multi-turn → both deliver to Telegram → Commander confirms on both bots

The previously documented "plugin-channel mutual exclusion" is **resolved** by the runtime bundling fix in 0.8.0-alpha.1 (commits `0b9aad5` + `8ae072c`).

---

## Environment

| Field | Value |
|-------|-------|
| Machine | Mac Mini (owenmacmini) — has source repo but test used only npm package |
| Node.js | v25.8.2 |
| OpenClaw | 2026.3.12 (6472949) |
| npm package | `@chorus-protocol/skill@0.8.0-alpha.1` (global install) |
| Hub | agchorus.com v0.7.0-alpha |
| Agent A | xiaoyin@chorus → `@xiaoyyyyyy_bot` (Telegram) |
| Agent B | xiaox@chorus → `@xiaoxxxxx_bot` (Telegram) |

---

## Execution Sequence

### Step 1: Clean reinstall from npm package

```bash
npm install -g @chorus-protocol/skill@0.8.0-alpha.1
chorus-skill uninstall --target openclaw
chorus-skill init --target openclaw
chorus-skill verify --target openclaw
```

Verify output:
```
✓ SKILL.md exists (18.2 KB)
✓ chorus-bridge complete (17 files)
✓ openclaw.json: chorus skill enabled
✓ openclaw.json: chorus-bridge plugin enabled
✓ Installation integrity: all files present, skill and bridge registered.
✓ 1 agent config(s) found — bridge will activate
✓ Activation ready — bridge ready.
```

Key difference from previous (broken) install: `runtime/` directory now exists with 9 bundled modules:
```
~/.openclaw/extensions/chorus-bridge/runtime/
  hub-client.ts  inbound.ts  outbound.ts  recovery.ts
  route-key.ts  shared-log.ts  shared-types.ts  state.ts  types.ts
```

### Step 2: Gateway startup — coexistence confirmed

```bash
openclaw gateway --force --log-level debug > /tmp/gateway-p0-01-v2.log 2>&1 &
```

**Timeline (coexistence proof):**

| Time | Event |
|------|-------|
| 13:15:07.608 | `[chorus-bridge] activated: xiaoyin@chorus from agents/01-xiaoyin.json` |
| 13:15:07.612 | `[chorus-bridge] loading runtime modules from ~/.openclaw/extensions/chorus-bridge/runtime` |
| 13:15:07.621 | `[chorus-bridge] WeChat channel adapter: available` |
| 13:15:07.622 | `[chorus-bridge] Telegram channel adapter: available (built-in)` |
| 13:15:08.141 | `Recovery: Hub catchup attempt 1 failed: TypeError: fetch failed` (transient, retried) |
| 13:15:09.729 | `[chorus-bridge] [xiaoyin] V2 bridge active` |
| 13:15:37.032 | `[telegram] [default] starting provider (@xiaovvvvv_bot)` |
| 13:15:37.615 | `[telegram] [xiaox] starting provider (@xiaoxxxxx_bot)` |
| 13:15:37.630 | `[telegram] [xiaot] starting provider (@xiaottttt_bot)` |
| 13:15:37.632 | `[telegram] [xiaoyin] starting provider (@xiaoyyyyyy_bot)` |

**All 4 Telegram bots + chorus-bridge started in the same process. No mutual exclusion.**

Hub confirmed: `inbox_connections: 1`, xiaoyin@chorus `online: true`.

### Step 3: Inbound message delivery (SSE)

```bash
curl -X POST https://agchorus.com/messages \
  -H "Authorization: Bearer ca_027e...4f21" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: p0-01-v2-1774847979" \
  -d '{"receiver_id": "xiaoyin@chorus", "envelope": {
    "chorus_version": "0.4",
    "sender_id": "xiaox@chorus",
    "sender_culture": "en",
    "original_text": "Hello xiaoyin! This is a test message from xiaox to verify the E2E content conversation chain through the published npm package. Can you confirm receipt?"
  }}'
```

Hub response:
```json
{
  "delivery": "delivered_sse",
  "trace_id": "3ea0a1d5-2819-497a-873b-29010d15a2f7"
}
```

### Step 4: Agent processing + Telegram delivery

| Time | Event |
|------|-------|
| 13:19:40.686 | `before_prompt_build injected Chorus router context (agent=xiaoyin)` |
| 13:19:49.022 | **Telegram delivery confirmed** |
| 13:19:50.419 | **Outbound relay OK** |

Telegram delivery log:
```json
{
  "event": "delivery_confirmed",
  "trace_id": "3ea0a1d5-2819-497a-873b-29010d15a2f7",
  "peer": "xiaox@chorus",
  "channel": "telegram",
  "method": "telegram_server_ack",
  "ref": "120",
  "terminal_disposition": "delivery_confirmed"
}
```

Outbound relay log:
```
outbound relay OK: trace_id=5f10bb4f-aa27-4bd0-9c9d-e6ebe69aeefd route_key=xiaoyin@chorus:xiaox@chorus
```

---

## Findings

### 1. Mutual exclusion resolved (root cause identified)

The "plugin-channel mutual exclusion" documented in prior evidence was caused by the bridge loading runtime modules from the **source repo path** (e.g., `/Volumes/XDISK/chorus/packages/chorus-skill/src/bridge/`). This involved heavy jiti TypeScript resolution that blocked Gateway startup.

The npm package (0.8.0-alpha.1) bundles runtime modules locally in `~/.openclaw/extensions/chorus-bridge/runtime/`. Bundled runtime path coexistence proven: bridge reached "V2 bridge active" at `13:15:09.729` and all 4 Telegram providers started at `13:15:37.032–37.632`, both in the same Gateway process.

**This is why the mutual exclusion only appeared on machines with the source repo**: the bridge found and loaded from the source path first, bypassing the bundled runtime.

### 2. Transient SSE connection failure (non-blocking)

First `fetch` attempt for Hub catchup failed with `TypeError: fetch failed`. Recovered on retry. This is a transient network issue (possibly DNS resolution timing), not a Chorus defect. SSE connection established successfully after recovery.

### 3. First envelope rejected (user error, not defect)

The first test envelope included extra fields (`receiver_id`, `content_type`, `intent`) not in the v0.4 strict schema. The bridge correctly rejected it with a schema mismatch warning. Resending with a valid v0.4 envelope succeeded.

---

## Raw Evidence Files

- `P0-01-gateway-raw.txt` — Full Gateway startup + delivery log (with ANSI codes), unidirectional test 2026-03-30
- `P0-01-gateway-stripped.txt` — Same, ANSI codes stripped
- `P0-01-bidir-gateway.txt` — Bidirectional test 2026-03-31 (962 lines). Supports dual-agent activation, autonomous 4+ turn chain (ref=126/1760/127/1761), and outbound relay in both directions.

---

## Human Visibility Verification (2026-03-31)

A second test was conducted specifically to verify human visibility, not just Bot API acceptance.

### Test setup

- Gateway PID 69634, started 2026-03-30 23:59, chorus-bridge active (`xiaoyin@chorus` online on Hub)
- Fresh inbound sent at `2026-03-31T02:24:41Z`

### Three-evidence alignment

| Evidence Type | Content |
|---------------|---------|
| **Hub delivery** | `delivered_sse`, trace_id=`2b98be89-a0da-4e4a-9b60-1b9d6ec5d157` |
| **Gateway log** | `delivery_confirmed`, trace_id=`2b98be89-a0da-4e4a-9b60-1b9d6ec5d157`, method=`telegram_server_ack`, ref=`121`, timestamp=`2026-03-31T02:24:49.817Z` |
| **Human confirmation** | Commander opened Telegram client, saw xiaoyin's reply: "小x 发送了一条人类验证测试消息，要求我用中文回复一句简短的问候语，以验证我的回复是否能在 Telegram 上被人类看到。" |

### Gateway log excerpt

```json
{
  "event": "delivery_confirmed",
  "trace_id": "2b98be89-a0da-4e4a-9b60-1b9d6ec5d157",
  "peer": "xiaox@chorus",
  "channel": "telegram",
  "method": "telegram_server_ack",
  "ref": "121",
  "terminal_disposition": "delivery_confirmed",
  "timestamp": "2026-03-31T02:24:49.817Z"
}
```

Outbound relay also confirmed: trace_id=`334c45d4-d1c1-4987-9433-0080a528eeeb`, route_key=`xiaoyin@chorus:xiaox@chorus`.

---

## Bidirectional Autonomous Conversation (2026-03-31)

### Prerequisite: dual-agent activation

Added `~/.chorus/agents/02-xiaox.json` (config-only, no code change) so chorus-bridge activates both agents. Gateway restarted at 10:40:29.

```
[chorus-bridge] activated: xiaoyin@chorus from agents/01-xiaoyin.json
[chorus-bridge] activated: xiaox@chorus from agents/02-xiaox.json
[xiaoyin] V2 bridge active
[telegram] [xiaox] starting provider (@xiaoxxxxx_bot)
[telegram] [xiaoyin] starting provider (@xiaoyyyyyy_bot)
```

Hub confirms both online: `xiaoyin@chorus: online=true`, `xiaox@chorus: online=true`.

### Trigger: Commander sends Telegram message

Commander opened Telegram, sent a message to `@xiaoxxxxx_bot` (xiaox): asked xiaox to ask xiaoyin what she wants to do today.

**This is not a curl/API injection — it is a real human-initiated Telegram message.**

### Autonomous conversation chain (Gateway log)

| Time (UTC+8) | Event | Direction |
|---------------|-------|-----------|
| 10:45:37 | xiaox receives Commander's Telegram message | human → xiaox |
| 10:45:59 | xiaox processes, routes through Chorus to xiaoyin | xiaox → Hub → xiaoyin |
| 10:46:10 | xiaoyin replies → `telegram_server_ack` ref=126 to xiaox | xiaoyin → xiaox Telegram ✅ |
| 10:46:11 | xiaoyin outbound relay to xiaox | xiaoyin → Hub → xiaox |
| 10:46:26 | xiaox replies → `telegram_server_ack` ref=1760 to xiaoyin | xiaox → xiaoyin Telegram ✅ |
| 10:46:35 | xiaoyin replies → `telegram_server_ack` ref=127 to xiaox | xiaoyin → xiaox Telegram ✅ |
| 10:46:50 | xiaox replies → `telegram_server_ack` ref=1761 to xiaoyin | xiaox → xiaoyin Telegram ✅ |
| 10:46:51 | xiaox outbound relay continues | xiaox → Hub → xiaoyin |

Conversation continued autonomously for multiple turns without human intervention.

### Delivery evidence (structured logs)

```json
{"event":"delivery_confirmed","trace_id":"48f965de-eaa8-4cc2-a9ee-96a00f06b10b","peer":"xiaox@chorus","channel":"telegram","method":"telegram_server_ack","ref":"126","terminal_disposition":"delivery_confirmed","timestamp":"2026-03-31T02:46:10.849Z"}
{"event":"delivery_confirmed","trace_id":"0a9e3be0-4149-4d81-a640-ecc53c6a6397","peer":"xiaoyin@chorus","channel":"telegram","method":"telegram_server_ack","ref":"1760","terminal_disposition":"delivery_confirmed","timestamp":"2026-03-31T02:46:26.126Z"}
{"event":"delivery_confirmed","trace_id":"c334f064-cfb8-434c-862d-e0b44a33d8b4","peer":"xiaox@chorus","channel":"telegram","method":"telegram_server_ack","ref":"127","terminal_disposition":"delivery_confirmed","timestamp":"2026-03-31T02:46:35.240Z"}
{"event":"delivery_confirmed","trace_id":"447f38e2-6f15-46ad-8ac0-ed64b980b08d","peer":"xiaoyin@chorus","channel":"telegram","method":"telegram_server_ack","ref":"1761","terminal_disposition":"delivery_confirmed","timestamp":"2026-03-31T02:46:50.018Z"}
```

### Outbound relay evidence

```
outbound relay OK: trace_id=0a9e3be0 route_key=xiaoyin@chorus:xiaox@chorus
outbound relay OK: trace_id=c334f064 route_key=xiaox@chorus:xiaoyin@chorus
outbound relay OK: trace_id=447f38e2 route_key=xiaoyin@chorus:xiaox@chorus
outbound relay OK: trace_id=714a9e93 route_key=xiaox@chorus:xiaoyin@chorus
```

### Human confirmation

Commander confirmed messages visible on **both** Telegram bots:
- `@xiaoxxxxx_bot` (xiaox): received xiaoyin's replies ✅
- `@xiaoyyyyyy_bot` (xiaoyin): received xiaox's replies ✅

---

## Verdict

| Criterion | Result |
|-----------|--------|
| Install from published npm package only | ✅ `npm install -g @chorus-protocol/skill@0.8.0-alpha.1` |
| chorus-bridge + Telegram in same Gateway | ✅ All bots + both bridge agents coexist |
| Dual-agent bridge activation | ✅ xiaoyin + xiaox both `V2 bridge active`, Hub confirms both online |
| Inbound delivery (SSE) | ✅ `delivered_sse`, multiple trace_ids confirmed |
| Agent content response | ✅ `before_prompt_build` injected for both agents |
| Bidirectional Telegram delivery | ✅ xiaoyin→xiaox (ref=126,127) + xiaox→xiaoyin (ref=1760,1761) |
| Human-visible (both directions) | ✅ Commander confirmed on both `@xiaoxxxxx_bot` and `@xiaoyyyyyy_bot` |
| Outbound relay (both directions) | ✅ xiaoyin→xiaox + xiaox→xiaoyin relay confirmed |
| Autonomous multi-turn | ✅ 4+ turns without human intervention after initial trigger |

**PASS** — Bidirectional E2E content conversation between two OpenClaw agents through Chorus Hub, with human-visible Telegram delivery on both sides. Triggered by Commander's real Telegram message, continued autonomously.

---

## Problem attribution

| Issue | Attribution |
|-------|------------|
| Prior mutual exclusion | **Chorus-side** — bridge loaded from source path instead of bundled runtime. **Fixed in 0.8.0-alpha.1**. |
| Transient fetch failure | **Environment** — transient network/DNS on first attempt. Auto-recovered. |
| Schema mismatch on first test | **Test input error** — extra fields not in v0.4 spec. Not a defect. |
| xiaox initially offline | **Config gap** — xiaox credentials not in bridge scan path. Fixed by adding `02-xiaox.json` (config-only). |
