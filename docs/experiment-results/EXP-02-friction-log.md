# EXP-02: Friction Log

---

## Run 3 — Formal (subject: xiaox, MiniMax-M2.7)

### F-1r — Version field confusion persists

- **Classification**: DOC
- **Description**: Despite v0.5 fix adding a note in TRANSPORT.md 4.1 and an inline comment in the Register example, subject still reported confusion: "两个不同的 chorus_version，容易混淆" and "我第一次尝试时用了 0.4 作为 agent_card 的版本" and "文档中有注释解释，但非常容易忽略"
- **Impact**: Subject used wrong version on first attempt, then self-corrected from docs
- **Action**: Consider renaming `agent_card.chorus_version` to `agent_card.card_version` or `agent_card.schema_version` to eliminate name collision entirely

### F-4 — Quick Start lacks runnable code

- **Classification**: DOC
- **Description**: Quick Start in TRANSPORT.md shows HTTP request/response format but not executable code. Subject noted "只有伪代码" and wanted "完整可运行的示例"
- **Impact**: Low — subject wrote own implementation successfully
- **Action**: Consider adding a minimal runnable example (curl or code snippet)

### F-5 — Discovery endpoint not implemented

- **Classification**: IMPL
- **Description**: TRANSPORT.md Section 8 says servers SHOULD serve `/.well-known/chorus.json`. Demo server returns 404.
- **Impact**: Low — subject noted it but was not blocked
- **Action**: Implement the discovery endpoint in the reference server

### F-6 — Envelope nesting unclear

- **Classification**: DOC
- **Description**: Subject reported "接收端点的请求格式...没有明确说明 envelope 是嵌套在 envelope 字段里". Subject "尝试了两种方式才找到正确的格式"
- **Impact**: MEDIUM — caused a failed attempt before success
- **Action**: Make TRANSPORT.md 6.5 more explicit: the receive endpoint body is `{ "envelope": { ... } }`, not the envelope directly

### F-7 — Version compatibility unexplained

- **Classification**: DOC
- **Description**: "如果发送方用 chorus_version: 0.4，接收方用 0.2，会发生什么？服务器如何处理版本不匹配？"
- **Impact**: Low — theoretical concern, did not block integration
- **Action**: Add a note to PROTOCOL.md Section 5 about version negotiation behavior

### Additional observations (not classified as defects)

- `receiver_id` asymmetry with `sender_id` — subject initially confused but understood the protocol/transport layer separation after reading
- `delivery: "failed"` with `success: true` — counterintuitive but documented; subject noted TRANSPORT.md 6.4 explains it
- Subject suggested `cultural_context` is "很好的想法" (good idea) — consistent with RFC-001 position: value exists, but shouldn't be obligatory

---

## Runs 1-2 — Pilot / Void (subject: xiaov, preserved for reference)

### F-1 — agent_card.chorus_version undocumented (FIXED in v0.5)

- **Classification**: DOC
- **Status**: Fixed in commit `5f5a1c8`. Partially effective — see F-1r above.

### F-2 — cultural_context "first turn" timing ambiguous (RESOLVED by RFC-001)

- **Classification**: DOC
- **Status**: Resolved. RFC-001 downgraded cultural_context to MAY, removing timing prescription.

### F-3 — No end-to-end quickstart example (FIXED in v0.5)

- **Classification**: DOC
- **Status**: Fixed in commit `5f5a1c8`. Quick Start added to TRANSPORT.md.

---

## Summary

| Run | Code | Count | Actionable |
|-----|------|-------|-----------|
| Run 3 | DOC | 4 | F-1r, F-4, F-6, F-7 |
| Run 3 | IMPL | 1 | F-5 |
| Pilot | DOC | 3 | All fixed |

**Total active DDC = 5** (Run 3 defects, unfixed)
