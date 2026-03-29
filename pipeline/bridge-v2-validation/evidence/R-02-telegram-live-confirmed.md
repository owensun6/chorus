<!-- Author: validation-worker -->
# R-02: Telegram Live Confirmed Delivery Evidence

## Observation

| Field | Value |
|-------|-------|
| Timestamp | 2026-03-29T06:07:26.597Z |
| Deployed version | main @ `2b61b5b` (`fix(bridge): fall back to bearer auth when session exchange returns 404`) |
| Parent commit | `2bde4b2` (`feat(bridge): propagate telegram server message id`) |
| Bridge runtime | `~/.openclaw/extensions/chorus-bridge/runtime-v2.ts` with `parseTelegramMessageId` + `recordConfirmedDelivery` |
| Hub relay trace_id | `ae4ef273-adb0-4844-9804-a791918a6226` |
| Sender | `tg-probe-1774763597@chorus` (registered at `2026-03-29T05:53:17.648Z`) |
| Receiver | `xiaoyin@chorus` |
| Hub delivery | `delivered_sse` at `2026-03-29T06:07:19.243Z` |

## Delivery Result (frozen from durable state)

```json
{
  "trace_id": "ae4ef273-adb0-4844-9804-a791918a6226",
  "peer": "tg-probe-1774763597@chorus",
  "status": "confirmed",
  "method": "telegram_server_ack",
  "channel": "telegram",
  "terminal_disposition": "delivery_confirmed",
  "recorded_at": "2026-03-29T06:07:26.597Z"
}
```

## What This Proves

1. `sendTelegramMessage()` successfully parsed `message_id` from the Telegram Bot API response
2. Bridge recorded `status: "confirmed"` (not `unverifiable`)
3. `method: "telegram_server_ack"` confirms the server-ack code path was exercised
4. The delivery was a real Hub→Bridge→Telegram chain (SSE delivery, not a direct bot reply)
5. The code deployed to the live Bridge is from main @ `2b61b5b` (includes both `2bde4b2` Telegram code + `2b61b5b` SSE fallback)

## Path Trace

1. Probe registered on Hub (`POST /register`)
2. Message sent via Hub relay (`POST /messages` with Idempotency-Key)
3. Hub delivered to xiaoyin via SSE (`delivered_sse`)
4. Bridge received via SSE inbox (fallback to Bearer auth — Hub does not yet support `/agent/session`)
5. Bridge routed to Telegram adapter
6. `sendTelegramMessage()` called Telegram Bot API `sendMessage`
7. Bot API returned `{ "ok": true, "result": { "message_id": <N> } }`
8. `parseTelegramMessageId()` extracted the message_id
9. `recordConfirmedDelivery()` wrote the durable delivery result
10. Delivery result persisted at `~/.chorus/state/xiaoyin/delivery-results/ae4ef273-adb0-4844-9804-a791918a6226.json`

## Verdict

**R-2 Telegram: CLOSED** — live confirmed delivery observed on production Bridge with real Telegram Bot API server ACK. Deployed version includes all committed code on main.
