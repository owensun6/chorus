# V-01-02 Telegram Delivery Truth

## Evidence

- Telegram delivery path in [~/.openclaw/extensions/chorus-bridge/index.ts](~/.openclaw/extensions/chorus-bridge/index.ts) defines `sendTelegramMessage(...): Promise<void>` and only checks the HTTP response from `api.telegram.org/bot.../sendMessage`.
- On non-400 failures it throws; on 400 it retries without `parse_mode`; on success it returns `void`. There is no server ACK, no user-visible receipt, and no delivery confirmation callback.
- The caller only logs `"[tg-deliver] OK"` after `await sendTelegramMessage(...)` in [~/.openclaw/extensions/chorus-bridge/index.ts](~/.openclaw/extensions/chorus-bridge/index.ts), which proves only that the HTTP request path completed without throwing.
- The nearby relay path in [~/.openclaw/extensions/chorus-bridge/relay.ts](~/.openclaw/extensions/chorus-bridge/relay.ts) posts the chorus reply back to Hub and returns a `RelayResult`; this is Hub relay bookkeeping, not Telegram end-user delivery proof.

## Conclusion

The real OpenClaw Telegram path is fire-and-forget. It does not provide actual end-user delivery confirmation.

NO
