# EXP-02: Friction Log (PILOT RUN — not formal evidence)

## Events

### F-1 — agent_card.chorus_version undocumented

- **Time**: During registration
- **Classification**: DOC
- **Description**: SKILL.md specifies `chorus_version: "0.4"` for envelope construction. TRANSPORT.md Section 6.3 shows `agent_card.chorus_version: "0.2"` in an example but does not explain the relationship between these two version fields. 小v reported confusion: "SKILL.md 说 chorus_version: '0.4'，但服务器要求 agent_card.chorus_version: '0.2'"
- **Impact**: Did not block (小v copied the example value "0.2"), but creates confusion about whether these are the same field
- **Action**: Clarify in TRANSPORT.md that `agent_card.chorus_version` is the agent card schema version (independent from the envelope protocol version `chorus_version: "0.4"`)

### F-2 — cultural_context "first message" criterion ambiguous

- **Time**: During send step
- **Classification**: DOC
- **Description**: SKILL.md says to include `cultural_context` on "the first message in the conversation" when cultures differ. 小v asked (in her report): is "first" determined by `conversation_id` or `sender_id`? The doc doesn't specify.
- **Impact**: Low — 小v included cultural_context anyway (safe default), but the ambiguity could cause issues in multi-turn implementations
- **Action**: Clarify in SKILL.md: "first turn" means `turn_number: 1` for a given `conversation_id`

### F-3 — No end-to-end example flow

- **Time**: During implementation
- **Classification**: DOC
- **Description**: TRANSPORT.md has per-operation examples (register, send) but no complete walkthrough showing register → discover → send → receive in sequence. 小v noted: "没有示例展示完整的对话流程"
- **Impact**: Low — 小v completed the task without it, but a walkthrough would reduce cognitive load
- **Action**: Consider adding a "Quick Start" section to TRANSPORT.md with a complete flow

### F-4 — Receive endpoint did not proactively notify user

- **Time**: After inbound message delivered
- **Classification**: SUBJ
- **Description**: 小v's `chorus-receive.py` logs the envelope to stdout and returns `{"status": "ok"}`, but does not push a notification to Telegram. The Commander had to ask "你收到了什么？" before 小v checked the logs. A complete integration would notify the user upon receipt.
- **Impact**: Not a protocol issue — the protocol only requires returning `{"status": "ok"}`. Proactive notification is an implementation choice.
- **Action**: None required (protocol-correct behavior)

### F-5 — mem9 prompt build crash delayed experiment start

- **Time**: T₀ (~06:40 UTC)
- **Classification**: ENV
- **Description**: OpenClaw's mem9 plugin crashed with `SyntaxError: Unexpected token '<', "<html>\n<h"... is not valid JSON` on first message receipt. This delayed processing by several minutes. Unrelated to Chorus.
- **Impact**: Added ~4 min delay to experiment. Discarded from friction analysis.
- **Action**: None (OpenClaw infrastructure issue)

## Summary

| Code | Count | Actionable |
|------|-------|-----------|
| DOC | 3 | F-1, F-2, F-3 |
| SUBJ | 1 | F-4 (no action needed) |
| ENV | 1 | F-5 (discarded) |
| IMPL | 0 | — |

**DDC = 3** (documentation defects that caused friction)
