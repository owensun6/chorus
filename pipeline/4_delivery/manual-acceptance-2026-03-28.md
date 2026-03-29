<!-- Author: Lead -->
<!-- status: UPDATED 2026-03-29 -->

# Release-Now Verdict -- 2026-03-28

## Scope

Decide whether Chorus can be released **now**, and whether the current live internet surface matches the release claim.

## Authoritative Evidence

- [`pipeline/bridge-v2-validation/final-verdict.md`](../bridge-v2-validation/final-verdict.md)
- [`pipeline/bridge-v2-validation/evidence/R-01-controlled-env.md`](../bridge-v2-validation/evidence/R-01-controlled-env.md)
- [`pipeline/bridge-v2-validation/evidence/R-02-delivery-truth-assessment.md`](../bridge-v2-validation/evidence/R-02-delivery-truth-assessment.md)
- [`pipeline/bridge-v2-validation/evidence/R-02-telegram-server-ack.md`](../bridge-v2-validation/evidence/R-02-telegram-server-ack.md)
- [`pipeline/bridge-v2-validation/evidence/R-02-wechat-ack-feasibility.md`](../bridge-v2-validation/evidence/R-02-wechat-ack-feasibility.md)
- [`pipeline/bridge-v2-validation/evidence/R-03-attribution-assessment.md`](../bridge-v2-validation/evidence/R-03-attribution-assessment.md)
- [`pipeline/bridge-v2-validation/evidence/R-03-live-roundtrip.md`](../bridge-v2-validation/evidence/R-03-live-roundtrip.md)
- [`pipeline/bridge-v2-validation/evidence/S-03-13-same-route-strict-order.md`](../bridge-v2-validation/evidence/S-03-13-same-route-strict-order.md)
- live `GET https://agchorus.com/health` on `2026-03-27T17:18:28.820Z` returned `"invite_gating": false`
- live anonymous `POST https://agchorus.com/register` on `2026-03-27T17:19:56.150Z` returned `201`
- [`README.md`](../../README.md)
- frozen supporting commits: `1a6423d`, `35b16d3`

## Verdict

`CONDITIONAL PASS`

Why: R-1 is CLOSED, R-3 is CLOSED, R-2 is PARTIALLY CLOSED (Telegram CLOSED, WeChat BLOCKED). One remaining item: WeChat iLink Bot protocol limitation.

| ID  | Item                      | Status             | Evidence                                                         |
|-----|---------------------------|--------------------|------------------------------------------------------------------|
| R-1 | SSE timestamp contract    | CLOSED             | `evidence/R-01-controlled-env.md`                                |
| R-2 | Delivery truth upgrade    | PARTIALLY CLOSED   | `evidence/R-02-delivery-truth-assessment.md`, `evidence/R-02-telegram-live-confirmed.md` |
| R-3 | Reply attribution upgrade | CLOSED             | `evidence/R-03-attribution-assessment.md`, `evidence/R-03-live-roundtrip.md` |

### R-2 Split Detail

| Channel  | Status  | Evidence |
|----------|---------|----------|
| Telegram | CLOSED | `evidence/R-02-telegram-server-ack.md`, `evidence/R-02-telegram-live-confirmed.md` -- `message_id` parsing implemented, test-verified, and live-verified at 2026-03-29T06:07:26.597Z |
| WeChat   | BLOCKED | `evidence/R-02-wechat-ack-feasibility.md` -- iLink Bot protocol returns empty `SendMessageResp`, FUNDAMENTAL limitation |

## Resolution Summary

| #   | Item                                  | Status           | Detail                                                                                                  |
|-----|---------------------------------------|------------------|---------------------------------------------------------------------------------------------------------|
| 1   | Clean validation state                | DONE             | This worktree (`chorus-verdict-reopen` at HEAD; see `git log --oneline -1` for current commit)         |
| 2   | SSE timestamp contract (R-1)          | CLOSED           | Controlled deploy confirmed timestamp present in direct SSE events (`evidence/R-01-controlled-env.md`)  |
| 3a  | Telegram delivery truth (R-2)         | CLOSED           | `sendTelegramMessage()` parses `message_id`; 4 tests pass. Live-verified at 2026-03-29T06:07:26.597Z on main @ 2b61b5b. (`evidence/R-02-telegram-server-ack.md`, `evidence/R-02-telegram-live-confirmed.md`) |
| 3b  | WeChat delivery truth (R-2)           | BLOCKED          | iLink Bot `sendmessage` returns empty body (`SendMessageResp = { // empty }`). FUNDAMENTAL protocol limitation. NO-GO. (`evidence/R-02-wechat-ack-feasibility.md`) |
| 4   | Reply attribution upgrade (R-3)       | CLOSED           | 69 production relay records, all with non-null `inbound_trace_id` matching `inbound_facts`. 7-link code path verified. (`evidence/R-03-live-roundtrip.md`) |
| 5   | Both verdicts agree                   | DONE             | This document and `final-verdict.md` name the same blocker set                                          |

## Why CONDITIONAL PASS Is Sufficient

The partial R-2 closure (Telegram CLOSED/live-verified + WeChat unverifiable) is judged sufficient for release because:

1. **Telegram `confirmed` path is LIVE-VERIFIED**: `sendTelegramMessage()` parses `message_id` from Bot API response; Bridge records `confirmed` + `ref`. 4 tests pass. Live delivery confirmed at 2026-03-29T06:07:26.597Z on main @ 2b61b5b (trace `ae4ef273-adb0-4844-9804-a791918a6226`, status: confirmed, method: telegram_server_ack). Evidence: [`evidence/R-02-telegram-live-confirmed.md`](../bridge-v2-validation/evidence/R-02-telegram-live-confirmed.md).
2. **The `unverifiable` code path is proven correct**: Both channels share the same branch in `openclaw.ts` L119 (`result.ref !== null ? 'confirmed' : 'unverifiable'`). S-03-05 proves this branch works on a live delivery (recorded `status: "unverifiable"` before the server-ack upgrade). WeChat will always take this branch because iLink Bot returns no `ref`.
3. **The WeChat blocker is external, not a Bridge defect**: iLink Bot `sendmessage` returns an empty response body (`SendMessageResp = { // empty }`). No fix possible without upstream Tencent protocol change.
4. **Bridge honesty is proven**: WeChat delivery is correctly categorized as `"unverifiable"` with `method: "weixin_api_accepted"`. No false `confirmed` is ever produced.
5. **Future-proof**: If a future iLink Bot protocol version returns a server-assigned message ID, the existing Bridge branching logic would automatically propagate it without code changes.

## Decision

Approved now:

- public-alpha release with truth-aligned documentation
- release-gate enforcement via explicit `--detectOpenHandles`
- committed same-route serialization proof
- SSE timestamp contract closure (R-1 CLOSED)
- Telegram server-ack code implemented, test-verified, and live-verified (R-2 Telegram CLOSED)
- Per-message reply attribution (R-3 CLOSED)

Caveat (must be documented in release notes):

- WeChat delivery status is `unverifiable` -- the Bridge honestly reports that the iLink Bot protocol does not confirm end-user delivery. This is a platform limitation, not a quality defect.

Not approved:

- claiming WeChat delivery is `confirmed` (it is not)
- upgrading `final-verdict.md` to full PASS while WeChat remains unverifiable
- marketing language implying delivery confirmation on all channels

## Live Gate Truth

What is true on the internet-facing surface right now:

- Hub status is public alpha
- self-registration is live
- invite gating is currently off
- Telegram delivery is `confirmed` via server-ack (live-verified at 2026-03-29T06:07:26.597Z on main @ 2b61b5b)
- WeChat delivery is correctly reported as unverifiable

What is not true right now:

- "invite-only alpha"
- "controlled access" as a live gate property
- "confirmed delivery on all channels" (WeChat remains unverifiable)

## Blocker Alignment

This document and [`final-verdict.md`](../bridge-v2-validation/final-verdict.md) agree on one remaining item:

1. **R-2 WeChat (BLOCKED)**: iLink Bot `sendmessage` returns empty body. FUNDAMENTAL protocol limitation. Not fixable on Bridge side.

Closed items: R-1 (SSE timestamp), R-2 Telegram (live-verified), R-3 (per-message attribution).

Overall verdict: `CONDITIONAL PASS` — one remaining item (WeChat BLOCKED) before full PASS.
