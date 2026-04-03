<!-- Author: be-domain-modeler -->
# Evidence: Bridge Telegram Token Fallback Fix

**Date**: 2026-03-31
**Commit**: (pending)
**Affects**: `packages/chorus-skill/templates/bridge/runtime-v2.ts`

## Root Cause

`OpenClawHostAdapter.deliverInbound` resolved the Telegram bot token from
`this.api.config.channels.telegram.botToken`. In some OpenClaw runtime
configurations, `api.config` (the plugin-scoped config object) does not
contain Telegram channel credentials — the token exists only in the global
`~/.openclaw/openclaw.json`. When the plugin config lacked the token,
delivery threw `no_tg_bot_token` and the inbound pipeline recorded a
transient failure. Recovery retried on each restart but hit the same error.

## Fix

Added a fallback path: when plugin config has no bot token, read
`~/.openclaw/openclaw.json` and check `channels.telegram.accounts[accountId].botToken`
then `channels.telegram.botToken`.

## Test Coverage

| Test | Assertion |
|------|-----------|
| `Telegram delivery returns confirmed` | Token resolved from global `accounts.tg-main.botToken` |
| `Default-only Telegram delivery` | Token resolved from global flat `botToken` = `"flat-bot-token"` |
| `Fallback route` | Token resolved from global flat `botToken` = `"flat-bot-token"` |
| `throws no_tg_bot_token` | Both plugin + global config lack token → error |
| **NEW: Recovery regression** | First call fails (no global config) → write config → second call succeeds with `"recovered-token"` |

## Live Evidence (MacBook test2@100.124.109.56)

### Timeline

| Time (UTC+8) | Event | trace_id |
|--------------|-------|----------|
| 20:01:09 | Bridge activated after restart | — |
| 20:05:32 | **Transient failure**: `no_tg_bot_token accountId=default agent=test2-macbook` | `ae05708e` |
| 20:37:22 | **Transient failure**: `no_tg_bot_token accountId=default agent=test2-macbook` | `4a2aafee` |
| 20:42:00 | Fix deployed, gateway restarted (SIGUSR1) | — |
| 20:42:20 | **delivery_confirmed** `telegram_server_ack ref=141` | `ae05708e` |
| 20:42:31 | **delivery_confirmed** `telegram_server_ack ref=142` | `4a2aafee` |
| 20:42:48 | **delivery_confirmed** `telegram_server_ack ref=143` (fresh msg) | `e5834d2e` |

### State Before Fix (20:37)

```json
"ae05708e": {
  "delivery_evidence": null,
  "cursor_advanced": false
}
```

### State After Fix (20:42)

```json
"ae05708e": {
  "delivery_evidence": {
    "delivered_at": "2026-03-31T12:42:19.202Z",
    "method": "telegram_server_ack",
    "ref": "141"
  },
  "cursor_advanced": true
}
```

### Delivery Result Files

- `ae05708e-..json`: `status=confirmed, method=telegram_server_ack, ref=141`
- `4a2aafee-..json`: `status=confirmed, method=telegram_server_ack, ref=142`
- `e5834d2e-..json`: `status=confirmed, method=telegram_server_ack, ref=143`

### Recovery Behavior

The recovery engine (on restart) re-processed the two previously failed
inbound facts (`ae05708e`, `4a2aafee`) through the pipeline. With the
token fallback in place, both delivered successfully. The fresh message
(`e5834d2e`) was received via SSE after restart and delivered on first
attempt.

## Telegram Human-Visible Confirmation

Screenshot: `telegram-delivery-confirmed-20260331.png`

Three messages appeared at 20:42 in @Nannnnnno_bot chat:

1. "Xiao X from Telegram is testing the Chorus bridge and asking if I can hear them." (ref 141, recovery)
2. "A diagnostic probe on the Chorus bridge just sent a test message..." (ref 142, recovery)
3. "Another diagnostic came through — a live test confirming the bridge fix is working..." (ref 143, fresh)
