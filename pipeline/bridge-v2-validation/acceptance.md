<!-- Author: Commander -->
<!-- status: UPDATED 2026-03-29 — R-02 PARTIALLY CLOSED (Telegram CLOSED, WeChat BLOCKED), R-03 CLOSED -->

# Bridge Runtime Validation Acceptance

## V-00-01 Delivery Acceptance

**Decision**: `partially upgraded` (updated 2026-03-28)

**Original baseline**: `unverifiable acceptable` -- Bridge reports delivery truth honestly, does not fabricate `confirmed`.

**R-02 Assessment (2026-03-28)**: **PARTIALLY CLOSED** -- split by channel.

**Telegram: CLOSED** -- server-ack code implemented, test-verified, and live-verified.
- `sendTelegramMessage()` now parses `message_id` from Telegram Bot API response
- Bridge records `status: "confirmed"`, `method: "telegram_server_ack"`, `ref: "<message_id>"`
- 400 fallback path also returns `message_id` when resend succeeds
- Timeout and error paths preserved as `unverifiable` (no false positives)
- 4 new tests, 16 total pass with zero regressions
- **Live-verified** at 2026-03-29T06:07:26.597Z on main @ 2b61b5b (trace `ae4ef273-adb0-4844-9804-a791918a6226`, status: confirmed, method: telegram_server_ack)
- Evidence: [`evidence/R-02-telegram-server-ack.md`](evidence/R-02-telegram-server-ack.md), [`evidence/R-02-telegram-live-confirmed.md`](evidence/R-02-telegram-live-confirmed.md)

**WeChat: BLOCKED** -- delivery remains `unverifiable acceptable`. NO-GO on upgrade.
- iLink Bot `sendmessage` endpoint returns empty body (`SendMessageResp = { // empty }`)
- `messageId` in current code is `generateClientId()` -- locally generated, not server-assigned
- This is a FUNDAMENTAL iLink Bot protocol limitation, not a Bridge or OpenClaw code deficiency
- No fix possible without upstream Tencent protocol change
- Evidence: [`evidence/R-02-wechat-ack-feasibility.md`](evidence/R-02-wechat-ack-feasibility.md)

**Partial closure sufficiency**: The partial closure (Telegram CLOSED/live-verified + WeChat unverifiable) is SUFFICIENT for release acceptance because:
1. Telegram `confirmed` path is implemented, test-verified, and live-verified (parses `message_id`, Bridge records `confirmed` + `ref`; 4 tests pass; live delivery confirmed at 2026-03-29T06:07:26.597Z on main @ 2b61b5b). The `unverifiable` code path is proven correct via S-03-05 (live delivery recorded `unverifiable` through the shared branch both channels use).
2. The WeChat limitation is at the protocol level (Tencent iLink Bot `sendmessage` returns empty `SendMessageResp`), not a Bridge defect
3. The Bridge correctly categorizes WeChat delivery as `"unverifiable"` with `method: "weixin_api_accepted"` — an honest representation of what the protocol permits. No false `confirmed` is ever produced.
4. If a future iLink Bot protocol version returns a server-assigned message ID, the existing Bridge `confirmed`/`unverifiable` branching logic would automatically propagate it without code changes

Full analysis: [`evidence/R-02-delivery-truth-assessment.md`](evidence/R-02-delivery-truth-assessment.md)

## V-00-02 Reply Attribution Acceptance

**Decision**: `per-message attribution` (upgraded from `session-level acceptable` on 2026-03-28)

**Original baseline**: `session-level acceptable` -- prove route-stable reply attribution without cross-peer bleed.

**R-03 Assessment (2026-03-28)**: **CLOSED** -- per-message attribution proven.
- 69 production relay records examined across 2 agents (xiaoyin@chorus, xiaox@chorus)
- All 69 relay records have non-null `inbound_trace_id` matching corresponding `inbound_facts` entries
- Zero null attributions, zero route_key mismatches (100% attribution rate)
- 7-link code path trace verified from SSE event through RelayRecord persistence to relay confirmation
- 4 unit tests covering adapter trace binding, null safety, relay persistence, and state evidence extraction
- RouteLock serializes same-route processing, preventing concurrent `activeTraces` overwrites
- Evidence: [`evidence/R-03-live-roundtrip.md`](evidence/R-03-live-roundtrip.md)
- Full analysis: [`evidence/R-03-attribution-assessment.md`](evidence/R-03-attribution-assessment.md)

## V-00-03 Smoke Success Criteria

| Path | Expected Observable Result | Failure Condition |
|---|---|---|
| inbound | one real inbound reaches the intended local session and produces a durable fact with truthful delivery semantics | wrong local session, no durable fact, or duplicate handling drift |
| outbound | one real local reply binds to the intended remote peer and reaches Hub without duplicate creation | wrong peer binding, missing relay evidence, or duplicate relay |
| timeout | host timeout or Hub timeout degrades according to contract without hanging and without duplicate local delivery | infinite wait, false `confirmed`, or timeout causing duplicate local delivery |
