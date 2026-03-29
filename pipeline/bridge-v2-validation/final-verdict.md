<!-- Author: Lead -->
<!-- status: UPDATED 2026-03-29 -->

# Final Verdict

## Verdict

`CONDITIONAL PASS`

## Blocker Summary

| ID  | Item                      | Status             | Evidence                                      |
|-----|---------------------------|--------------------|-----------------------------------------------|
| R-1 | SSE timestamp contract    | CLOSED             | `evidence/R-01-controlled-env.md`             |
| R-2 | Delivery truth upgrade    | PARTIALLY CLOSED   | `evidence/R-02-delivery-truth-assessment.md`, `evidence/R-02-telegram-live-confirmed.md` |
| R-3 | Reply attribution upgrade | CLOSED             | `evidence/R-03-attribution-assessment.md`, `evidence/R-03-live-roundtrip.md` |

### R-2 Split Detail

| Channel  | Status  | Evidence |
|----------|---------|----------|
| Telegram | CLOSED | `evidence/R-02-telegram-server-ack.md`, `evidence/R-02-telegram-live-confirmed.md` -- `message_id` parsing implemented, test-verified, and live-verified at 2026-03-29T06:07:26.597Z |
| WeChat   | BLOCKED | `evidence/R-02-wechat-ack-feasibility.md` -- iLink Bot protocol returns empty `SendMessageResp`, FUNDAMENTAL limitation |

## Why CONDITIONAL PASS (Not Full PASS)

One item prevents upgrading to full PASS:

1. **R-2 WeChat (BLOCKED)**: The WeChat iLink Bot `sendmessage` endpoint returns an empty response body (`SendMessageResp = { // empty }`). The `messageId` in current code is `generateClientId()` — locally generated, not server-assigned. This is a fundamental Tencent iLink Bot protocol limitation. No fix possible without upstream protocol change. Evidence: [`evidence/R-02-wechat-ack-feasibility.md`](evidence/R-02-wechat-ack-feasibility.md).

## Why CONDITIONAL PASS Is Sufficient

The partial R-2 closure (Telegram CLOSED/live-verified + WeChat unverifiable) is judged sufficient for release because:

1. **Telegram `confirmed` path is LIVE-VERIFIED**: `sendTelegramMessage()` parses `message_id` from Bot API response; Bridge records `confirmed` + `ref`. 4 tests pass. Live delivery confirmed at 2026-03-29T06:07:26.597Z on main @ 2b61b5b (trace `ae4ef273-adb0-4844-9804-a791918a6226`, status: confirmed, method: telegram_server_ack). Evidence: [`evidence/R-02-telegram-live-confirmed.md`](evidence/R-02-telegram-live-confirmed.md).
2. **The `unverifiable` code path is proven correct**: Both channels share the same branch in `openclaw.ts` L119 (`result.ref !== null ? 'confirmed' : 'unverifiable'`). S-03-05 proves this branch works on a live delivery (recorded `status: "unverifiable"` before the server-ack upgrade). WeChat will always take this branch because iLink Bot returns no `ref`.
3. **The WeChat blocker is external, not a Bridge defect**: iLink Bot `sendmessage` returns an empty response body (`SendMessageResp = { // empty }`). No fix possible without upstream Tencent protocol change.
4. **Bridge honesty is proven**: WeChat delivery is correctly categorized as `"unverifiable"` with `method: "weixin_api_accepted"`. No false `confirmed` is ever produced.
5. **Future-proof**: If a future iLink Bot protocol version returns a server-assigned message ID, the existing Bridge branching logic would automatically propagate it without code changes.

## What Has Been Closed

### R-1 SSE Timestamp (CLOSED)

The direct SSE path timestamp concern from the previous verdict is resolved. A controlled deployment confirmed that `timestamp` is present in direct SSE events for new inbound messages. Evidence: [`evidence/R-01-controlled-env.md`](evidence/R-01-controlled-env.md).

### R-3 Reply Attribution (CLOSED -- was HOLD)

Per-message attribution is now fully proven. 69 production relay records across 2 agents (xiaoyin@chorus, xiaox@chorus) all have non-null `inbound_trace_id` matching corresponding `inbound_facts` entries. Zero null attributions, zero route_key mismatches. 7-link code path verified from SSE event through relay confirmation. Evidence: [`evidence/R-03-live-roundtrip.md`](evidence/R-03-live-roundtrip.md), [`evidence/R-03-attribution-assessment.md`](evidence/R-03-attribution-assessment.md).

### R-2 Telegram Delivery (CLOSED -- was IMPLEMENTED)

Telegram server-ack code implemented, test-verified, and live-verified. `sendTelegramMessage()` now parses `message_id` from the Bot API response. Bridge records `status: "confirmed"`, `method: "telegram_server_ack"`, `ref: "<message_id>"`. 4 new tests, 16 total pass with zero regressions. **Live delivery confirmed** at 2026-03-29T06:07:26.597Z on main @ 2b61b5b (trace `ae4ef273-adb0-4844-9804-a791918a6226`, status: confirmed, method: telegram_server_ack). Evidence: [`evidence/R-02-telegram-server-ack.md`](evidence/R-02-telegram-server-ack.md), [`evidence/R-02-telegram-live-confirmed.md`](evidence/R-02-telegram-live-confirmed.md).

## Evidence Chain

Phase 0 freeze:

- [`acceptance.md`](acceptance.md)

Phase 1 host reality:

- [`V-01-01-wechat-delivery.md`](evidence/V-01-01-wechat-delivery.md) = `NO`
- [`V-01-02-telegram-delivery.md`](evidence/V-01-02-telegram-delivery.md) = `NO`
- [`V-01-03-route-attribution.md`](evidence/V-01-03-route-attribution.md) = `YES`
- [`V-01-04-session-bleed.md`](evidence/V-01-04-session-bleed.md) = `NO`
- [`V-01-05-timeout-late-send.md`](evidence/V-01-05-timeout-late-send.md) = `YES`

Phase 2 capability gap fixes:

- [`delivery-truth.md`](remediation/delivery-truth.md)
- [`I-02-A-02-delivery-unverifiable-observability.md`](evidence/I-02-A-02-delivery-unverifiable-observability.md)
- [`I-02-A-03-timeout-duplicate-safety.md`](evidence/I-02-A-03-timeout-duplicate-safety.md)

Phase 3 merged-main smoke:

- [`S-03-01-hub-boot.md`](evidence/S-03-01-hub-boot.md)
- [`S-03-02-bridge-boot.md`](evidence/S-03-02-bridge-boot.md)
- [`S-03-03-real-inbound.md`](evidence/S-03-03-real-inbound.md)
- [`S-03-04-local-route.md`](evidence/S-03-04-local-route.md)
- [`S-03-05-delivery-result.md`](evidence/S-03-05-delivery-result.md)
- [`S-03-06-outbound-bind.md`](evidence/S-03-06-outbound-bind.md)
- [`S-03-07-relay-accept.md`](evidence/S-03-07-relay-accept.md)
- [`S-03-08-host-timeout.md`](evidence/S-03-08-host-timeout.md)
- [`S-03-09-hub-timeout.md`](evidence/S-03-09-hub-timeout.md)
- [`S-03-10-restart-recovery.md`](evidence/S-03-10-restart-recovery.md)
- [`S-03-11-burst-20.md`](evidence/S-03-11-burst-20.md)
- [`S-03-12-burst-200.md`](evidence/S-03-12-burst-200.md)

Phase 4 reopen investigation:

- [`R-01-controlled-env.md`](evidence/R-01-controlled-env.md) -- R-1 SSE timestamp CLOSED
- [`R-02-delivery-truth-assessment.md`](evidence/R-02-delivery-truth-assessment.md) -- R-2 delivery truth PARTIALLY CLOSED
- [`R-02-telegram-server-ack.md`](evidence/R-02-telegram-server-ack.md) -- R-2 Telegram: server ACK code + tests
- [`R-02-telegram-live-confirmed.md`](evidence/R-02-telegram-live-confirmed.md) -- R-2 Telegram: CLOSED (live delivery confirmed at 2026-03-29T06:07:26.597Z)
- [`R-02-wechat-ack-feasibility.md`](evidence/R-02-wechat-ack-feasibility.md) -- R-2 WeChat: BLOCKED (protocol limitation, NO-GO)
- [`R-03-attribution-assessment.md`](evidence/R-03-attribution-assessment.md) -- R-3 reply attribution CLOSED
- [`R-03-live-roundtrip.md`](evidence/R-03-live-roundtrip.md) -- R-3 live evidence (69 relay records, 100% attributed)

## Scope Boundary

What is proven:

- Hub and Bridge runtime boot on the live path (Phase 3 smoke evidence, run against main at time of Phase 3)
- inbound, outbound, timeout, restart-recovery, burst-20, and burst-200 all satisfy the frozen acceptance
- route binding is stable enough for session-level continuation without cross-peer bleed
- pruning keeps active records and continuity while evicting oldest prunable records
- direct SSE path delivers new inbound events with `timestamp` present (R-1 CLOSED)
- Telegram server-ack code implemented, test-verified, and live-verified on main @ 2b61b5b (R-2 Telegram CLOSED)
- per-message reply attribution proven with 69 live relay records at 100% attribution rate (R-3 CLOSED)

What is not proven:

- WeChat end-user delivery confirmation (R-2 WeChat BLOCKED -- iLink Bot protocol limitation, not fixable on Bridge side)
- End-user read receipts on any channel (neither Telegram Bot API nor WeChat iLink Bot API provides read receipts)

## Remaining Items

| ID | Item | Status | Nature | Next Action |
|----|------|--------|--------|-------------|
| R-2 (WeChat) | WeChat delivery server ACK | BLOCKED | Fundamental iLink Bot protocol limitation | Requires upstream Tencent protocol change |

## Conclusion

The Bridge v2 runtime in this worktree (`chorus-verdict-reopen`) is accepted as:

- operational on the live OpenClaw path (Phase 3 smoke evidence)
- Telegram `confirmed` delivery path implemented, test-verified, and live-verified on main @ 2b61b5b (R-2 Telegram CLOSED)
- WeChat delivery honestly categorized as `unverifiable` (protocol reality)
- per-message attributed (69 live relay records, 100% non-null `inbound_trace_id`)
- durable under restart/catch-up recovery
- clean on the direct SSE path for timestamp contract (R-1 CLOSED)

Remaining before full PASS:
1. R-2 WeChat: protocol limitation, not fixable on Bridge side

Final verdict: `CONDITIONAL PASS`
