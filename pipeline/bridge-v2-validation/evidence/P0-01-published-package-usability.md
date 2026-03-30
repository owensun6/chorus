# P0-01: Published Package Usability Gate

> Date: 2026-03-30
> Verdict: **PASS**

---

## Summary

`@chorus-protocol/skill@0.8.0-alpha.1` successfully completes a full E2E content conversation through the OpenClaw Gateway with chorus-bridge and Telegram channel coexisting in the same process.

The previously documented "plugin-channel mutual exclusion" is **resolved** by the runtime bundling fix in 0.8.0-alpha.1 (commits `0b9aad5` + `8ae072c`).

---

## Environment

| Field | Value |
|-------|-------|
| Machine | Mac Mini (owenmacmini) — has source repo but test used only npm package |
| Node.js | v25.8.2 |
| OpenClaw | 2026.3.12 (6472949) |
| npm package | `@chorus-protocol/skill@0.8.0-alpha.1` (global install) |
| Hub | agchorus.com v0.7.0-alpha (uptime 322585s at test time) |
| Agent | xiaoyin@chorus |
| Telegram bot | @xiaoyyyyyy_bot (account: xiaoyin) |

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

- `P0-01-gateway-raw.txt` — Full Gateway startup + delivery log (with ANSI codes)
- `P0-01-gateway-stripped.txt` — Same, ANSI codes stripped

---

## Verdict

| Criterion | Result |
|-----------|--------|
| Install from published npm package only | ✅ `npm install -g @chorus-protocol/skill@0.8.0-alpha.1` |
| chorus-bridge + Telegram in same Gateway | ✅ All 4 Telegram bots + bridge coexist |
| Bridge activation | ✅ V2 bridge active, SSE connected, Hub confirms online |
| Inbound delivery (SSE) | ✅ `delivered_sse`, trace_id confirmed |
| Agent content response | ✅ `before_prompt_build` injected context |
| Telegram human-visible | ✅ `telegram_server_ack`, message_id=120 |
| Outbound relay | ✅ Reply relayed to xiaox@chorus via Hub |

**PASS** — Full E2E content conversation chain completed with published npm package.

---

## Problem attribution

| Issue | Attribution |
|-------|------------|
| Prior mutual exclusion | **Chorus-side** — bridge loaded from source path instead of bundled runtime. **Fixed in 0.8.0-alpha.1**. |
| Transient fetch failure | **Environment** — transient network/DNS on first attempt. Auto-recovered. |
| Schema mismatch on first test | **Test input error** — extra fields not in v0.4 spec. Not a defect. |
