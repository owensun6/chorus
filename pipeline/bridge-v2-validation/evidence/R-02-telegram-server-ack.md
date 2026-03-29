<!-- Author: validation-worker -->
# R-02: Telegram Server ACK -- Implementation Evidence

## Change Summary

Modified `packages/chorus-skill/templates/bridge/runtime-v2.ts` to propagate the Telegram Bot API `message_id` from successful `sendMessage` responses. When a valid `message_id` is received, the delivery status is upgraded from `unverifiable` to `confirmed` with the message_id as the delivery `ref`.

Three production code changes:
1. **`parseTelegramMessageId(body)`** -- new pure function that safely extracts `message_id` from the Telegram Bot API response shape
2. **`sendTelegramMessage(...)` return type** -- changed from `Promise<void>` to `Promise<number | null>`, returns the parsed `message_id` on both the primary (200 OK) and 400-fallback paths
3. **`recordConfirmedDelivery(...)` function** -- new function (parallel to `recordUnverifiableDelivery`) that writes a `status: "confirmed"` delivery result record with `terminal_disposition: "delivery_confirmed"`

## Telegram Bot API Response Shape

On success, the Telegram Bot API `sendMessage` endpoint returns:

```json
{ "ok": true, "result": { "message_id": 12345, "chat": { ... }, "text": "..." } }
```

`parseTelegramMessageId` validates this shape defensively: checks `ok === true`, navigates to `result.message_id`, and returns `null` if any field is missing or malformed. No Zod schema was added because the parser is a single-purpose 8-line function with exhaustive null checks -- adding Zod would increase the dependency surface for negligible safety gain.

## Delivery Ref Propagation

In the Telegram branch of `OpenClawHostAdapter.deliverInbound`:

1. The inner async function now captures the return of `sendTelegramMessage` as `messageId`
2. On the success path (`sendOutcome.kind === "ok"`), `messageId` is converted to a string ref via `String(sendOutcome.messageId)`
3. If `tgRef !== null` (message_id was present), the delivery is recorded as `confirmed` with `method: "telegram_server_ack"` and `ref` set to the stringified message_id
4. If `tgRef === null` (API returned 200 but no parseable message_id), the delivery falls back to `unverifiable` with `method: "telegram_api_accepted"` -- preserving backward compatibility

## Receipt Level Upgrade

| Scenario | Before | After |
|----------|--------|-------|
| 200 OK + valid message_id | `unverifiable` / `telegram_api_accepted` / ref=null | `confirmed` / `telegram_server_ack` / ref="12345" |
| 200 OK + no message_id | `unverifiable` / `telegram_api_accepted` / ref=null | `unverifiable` / `telegram_api_accepted` / ref=null (unchanged) |
| 400 fallback + valid message_id | `unverifiable` / `telegram_api_accepted` / ref=null | `confirmed` / `telegram_server_ack` / ref="55555" |
| Timeout | `unverifiable` / `timeout` / ref=null | `unverifiable` / `timeout` / ref=null (unchanged) |
| Network error / throw | rethrown | rethrown (unchanged) |

## Failure Semantics Preserved

- **Timeout path**: unchanged -- `HOST_DELIVERY_TIMEOUT_SENTINEL` still produces `unverifiable` with `method: "timeout"`
- **Error/throw path**: unchanged -- `sendOutcome.kind === "error"` still rethrows, keeping inbound retryable
- **Injection paths** (`hang_before_send`, `throw_before_send`): unchanged, still exercised by existing test

No `confirmed` status is ever produced unless the Telegram API physically returned a parseable `message_id` in the response body.

## Test Coverage

Four new tests added to `tests/bridge/runtime-v2.test.ts`:

| Test | Verifies |
|------|----------|
| "Telegram delivery returns confirmed with message_id ref when API returns server ack" | 200 OK with `message_id: 98765` -> receipt `confirmed`, ref `"98765"`, delivery-results file written with `delivery_confirmed` |
| "Telegram 400 fallback resend returns confirmed with message_id ref" | First fetch 400, second fetch 200 with `message_id: 55555` -> receipt `confirmed`, ref `"55555"`, two fetch calls made |
| "Telegram delivery falls back to unverifiable when API response lacks message_id" | 200 OK with empty `result: {}` -> receipt `unverifiable`, ref null, delivery-results file written with `delivery_unverifiable` |
| "Telegram delivery timeout produces unverifiable receipt, not confirmed" | `hang_before_send` injection -> receipt `unverifiable`, method `timeout`, ref null |

All 16 tests pass (12 existing + 4 new). Zero regressions.

## Verdict

Telegram delivery upgraded from unverifiable to server-ack confirmed. The `message_id` from the Telegram Bot API response is now propagated as the delivery `ref`, and the receipt status is `confirmed` when a valid server acknowledgment is received.
