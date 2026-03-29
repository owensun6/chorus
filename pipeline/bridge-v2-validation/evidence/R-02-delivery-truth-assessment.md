<!-- Author: Lead -->
<!-- status: PARTIALLY CLOSED 2026-03-29 -->

# R-02 Delivery Truth Assessment

## Current Level

`partially upgraded` -- split by channel (updated 2026-03-28)

- **Telegram**: `confirmed` via server ACK (`message_id` from Telegram Bot API)
- **WeChat**: `unverifiable acceptable` (unchanged -- iLink Bot protocol limitation)

## Question

Can delivery truth be upgraded beyond `unverifiable acceptable` given current evidence?

## Conclusion

**PARTIALLY CLOSED** -- Telegram delivery is now upgraded to server-ack confirmed. WeChat delivery remains unverifiable due to a fundamental iLink Bot protocol limitation (not fixable on Bridge side).

- **Telegram half: CLOSED** -- `sendTelegramMessage()` parses `message_id` from the Telegram Bot API response. Bridge records `status: "confirmed"`, `method: "telegram_server_ack"`, `ref: "<message_id>"`. 4 tests pass. Live delivery confirmed at 2026-03-29T06:07:26.597Z on main @ 2b61b5b (trace `ae4ef273-07a9-450e-967b-e2d6c51621db`, status: confirmed, method: telegram_server_ack). Evidence: [`R-02-telegram-server-ack.md`](R-02-telegram-server-ack.md), [`R-02-telegram-live-confirmed.md`](R-02-telegram-live-confirmed.md).
- **WeChat half: BLOCKED** -- iLink Bot `sendmessage` returns empty body (`SendMessageResp = { // empty }`). `messageId` in current code is `generateClientId()`, a locally generated string, not server-assigned. This is a FUNDAMENTAL protocol limitation. Evidence: [`R-02-wechat-ack-feasibility.md`](R-02-wechat-ack-feasibility.md).

## Analysis

### What "stronger delivery truth" would require

A delivery truth upgrade from `unverifiable acceptable` to `confirmed acceptable` requires at least one of the following to be proven:

1. **Host channel returns a server-acknowledged receipt** -- the `ChannelResult.ref` field in `openclaw.ts` L119 must be non-null, meaning the channel provided a server-side delivery identifier (not a locally generated one).
2. **End-user visibility confirmation** -- a read receipt or delivery receipt from the messaging platform confirming the human saw or received the message.

### What the evidence proves

**WeChat path** (`V-01-01-wechat-delivery.md`):
- `sendMessageApi(...)` returns `Promise<void>` (V-01-01, bullet 2).
- The `messageId` returned by the send wrapper is `generateClientId()` -- locally generated, not server-acknowledged (V-01-01, bullet 1).
- The path is explicitly fire-and-forget with no throw on failure (V-01-01, bullet 4).
- Verdict: **NO** server-side receipt exists. `ChannelResult.ref` would be `null`.

**Telegram path** (updated 2026-03-28 -- `R-02-telegram-server-ack.md`):
- `sendTelegramMessage(...)` now returns `Promise<number | null>` instead of `Promise<void>`.
- New `parseTelegramMessageId(body)` extracts `message_id` from the Telegram Bot API response `{ "ok": true, "result": { "message_id": 12345 } }`.
- On 200 OK with valid `message_id`: delivery recorded as `confirmed`, `method: "telegram_server_ack"`, `ref: "<message_id>"`.
- On 400 fallback resend with valid `message_id`: same `confirmed` + `telegram_server_ack` outcome.
- On 200 OK without parseable `message_id`: falls back to `unverifiable` + `telegram_api_accepted` (backward-compatible).
- Timeout and error paths: unchanged (`unverifiable` / rethrow).
- 4 new tests added, 16 total tests pass with zero regressions.
- Verdict: **YES** -- server-side receipt now exists for Telegram, and is live-verified on main @ 2b61b5b.
- Previous assessment (V-01-02): Telegram returned void. That code-level gap has been fixed and deployed.

**Bridge code path** (`openclaw.ts` L112-119):
- The adapter correctly checks `result.ref !== null` to distinguish `confirmed` vs `unverifiable`.
- Telegram now returns `ref: "<message_id>"` on successful sends, causing the adapter to correctly return `status: 'confirmed'`.
- WeChat still returns `ref: null` (locally generated client ID is not a server ACK), causing the adapter to correctly return `status: 'unverifiable'`.
- The Bridge logic is correct for both channels -- it honestly reports what each host channel provides.

**Live runtime proof** (`S-03-05-delivery-result.md`):
- Real inbound trace `e4f62036-...` was delivered to live Telegram path.
- Durable result recorded: `status: "unverifiable"`, `method: "telegram_api_accepted"`.
- This confirms the runtime is already correctly reporting `unverifiable` on live paths.

**Observability proof** (`I-02-A-02-delivery-unverifiable-observability.md`):
- Every `delivery_unverifiable` terminal path emits a structured observable signal.
- Tests prove both direct-unverifiable and timeout-unverifiable emit the signal.
- This means the `unverifiable` status is not silent -- it is observable and auditable.

**Timeout safety proof** (`I-02-A-03-timeout-duplicate-safety.md`):
- Bridge timeout is terminal -- it does not retry, preventing duplicate delivery.
- The `unverifiable` from timeout is also correctly handled.

### Why the Bridge itself cannot provide stronger guarantees

The Bridge is a pipe. Its delivery truth is strictly bounded by what the host adapter reports:

1. `openclaw.ts` L119: `const status = result.ref !== null ? 'confirmed' : 'unverifiable'`
2. `inbound.ts` L321-361: The pipeline applies the receipt status as-is -- it does not fabricate `confirmed`.
3. `types.ts` L109-115: The contract explicitly states `unverifiable` is terminal for retry semantics.

The Bridge cannot independently verify that a message reached the end user. It depends entirely on `ChannelResult.ref` from the host channel implementation. Telegram now returns `ref: "<message_id>"` (server-assigned); WeChat still returns `ref: null` (locally generated client ID).

### What would unblock the WeChat upgrade

Telegram is now resolved and live-verified (see above). For WeChat, the following would be needed:

1. **WeChat iLink Bot protocol change**: The `sendmessage` endpoint would need to return a server-assigned message ID in `SendMessageResp`. Currently `SendMessageResp = { // empty }` (types.ts:193-195). This is a Tencent iLink Bot protocol limitation -- not addressable by Chorus or OpenClaw code changes.
2. **Read receipts**: Neither Telegram Bot API nor WeChat iLink Bot API provides read receipts. The Telegram upgrade is at the "server accepted with server ID" level, not end-user read receipt.

The WeChat upgrade is blocked at the protocol level. If a future iLink Bot API version returns a message ID, the existing Bridge `confirmed`/`unverifiable` branching logic would automatically benefit -- no Bridge code change would be needed.

## Verdict

**PARTIALLY CLOSED**

| Dimension | Status | Detail |
|-----------|--------|--------|
| Bridge honesty | PASS | Bridge correctly reports `confirmed` when `ref` is non-null, `unverifiable` when `ref` is null |
| Observable signal | PASS | Both `delivery_confirmed` and `delivery_unverifiable` emit structured observable signals |
| Timeout safety | PASS | Timeout is terminal, no duplicate delivery risk |
| Telegram server ACK | CLOSED | `sendTelegramMessage()` parses `message_id`; 4 tests pass. Live-verified at 2026-03-29T06:07:26.597Z (trace `ae4ef273`, status: confirmed, method: telegram_server_ack). Evidence: [`R-02-telegram-server-ack.md`](R-02-telegram-server-ack.md), [`R-02-telegram-live-confirmed.md`](R-02-telegram-live-confirmed.md) |
| WeChat server ACK | BLOCKED | iLink Bot `sendmessage` returns empty body (`SendMessageResp = { // empty }`). FUNDAMENTAL protocol limitation. Evidence: [`R-02-wechat-ack-feasibility.md`](R-02-wechat-ack-feasibility.md) |
| End-user read receipt | NOT AVAILABLE | Neither platform API provides read receipts in current integration model |

**Delivery truth is now split by channel:**
- **Telegram**: CLOSED. Server-ack code implemented, test-verified, and live-verified. `message_id` from the Telegram Bot API response is propagated as `ChannelResult.ref` on the deployed main branch. Live delivery confirmed at 2026-03-29T06:07:26.597Z (trace `ae4ef273-07a9-450e-967b-e2d6c51621db`).
- **WeChat**: remains `unverifiable acceptable`. The iLink Bot protocol does not provide a server-assigned message ID. This is not a Bridge deficiency — it is a fundamental upstream protocol limitation.
