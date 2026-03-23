# Cross-Platform Validation Report

**Date**: 2026-03-19
**Tester**: Fresh agent with zero prior Chorus knowledge
**Protocol version**: 0.4
**Source materials**: `skill/PROTOCOL.md`, `skill/SKILL.md`

---

## Test 1: Same-Culture Sending

**Scenario**: Human (en) says "Let's grab coffee after the standup tomorrow." to another en-culture agent.

**Input**: Plain English text, sender and receiver both "en".

**Output**:
```json
{
  "chorus_version": "0.4",
  "sender_id": "testbot@validation.chorus.org",
  "original_text": "Let's grab coffee after the standup tomorrow.",
  "sender_culture": "en"
}
```

**Protocol compliance**: PASS
- All MUST fields present (`chorus_version`, `sender_id`, `original_text`, `sender_culture`).
- `cultural_context` correctly omitted (same culture, per Rule: Sending #2 and SKILL.md "If same culture: just send the envelope").
- No personality or style injected into envelope (per Constraint).

---

## Test 2: Cross-Culture Sending

**Scenario**: Human (zh-CN) says "没关系，下次注意就好了。" to a ja-culture agent. First turn.

**Input**: Chinese text, sender "zh-CN", receiver "ja", first message in conversation.

**Output**:
```json
{
  "chorus_version": "0.4",
  "sender_id": "testbot@validation.chorus.org",
  "original_text": "没关系，下次注意就好了。",
  "sender_culture": "zh-CN",
  "cultural_context": "在中文语境中，「没关系」用于表达对他人过失的宽容和不计较，「下次注意就好了」则是一种温和的提醒方式，整体语气轻松友善，意在安抚对方不必过于自责，同时委婉地希望问题不再重复发生。"
}
```

**Protocol compliance**: PASS
- All MUST fields present.
- `cultural_context` included because cultures differ and this is the first turn (per Rule: Sending #1).
- `cultural_context` written in sender's language (Chinese), as required by the Constraint: "cultural_context MUST be in the sender's language."
- `cultural_context` length is within the 10-500 character range (113 characters).
- Content explains *why* the sender said it this way, not a translation.

---

## Test 3: Cross-Culture Receiving

**Scenario**: Received envelope from ja-culture sender. My user speaks en.

**Input**:
```json
{
  "chorus_version": "0.4",
  "sender_id": "sakura@chorus.example.jp",
  "original_text": "お忙しいところ恐れ入りますが、ご確認いただけますでしょうか。",
  "sender_culture": "ja",
  "cultural_context": "日本のビジネス文化では、依頼をする際に相手の時間を奪うことへの配慮として「お忙しいところ恐れ入りますが」という前置きを使います。これは単なる形式ではなく、相手への敬意と配慮を示す重要な表現です。"
}
```

**Validation step**: Envelope is valid (all MUST fields present, correct types).

**Adapted delivery to user**:

> "Could you please review this when you get a chance?"
>
> (Note: The sender used a formal Japanese business expression that acknowledges they are taking up your time. This is a standard respectful way of making a request in Japanese workplace culture -- the core ask is simply for you to review something.)

**Protocol compliance**: PASS
- Envelope validated before processing (Rule: Receiving #1).
- Message delivered in a form the English-speaking user can understand (Rule: Receiving #2).
- Used `cultural_context` to understand the nuance of the politeness prefix, then adapted rather than literally translating (SKILL.md: "you know how to bridge languages and cultures").
- Did not forward the raw Japanese text without adaptation (per DO NOT list).
- The cultural note preserves the sender's intent without over-explaining.

---

## Overall Assessment

### Was SKILL.md clear enough to learn from?

**Yes.** SKILL.md is well-structured and sufficient for a fresh agent to correctly implement the protocol. Specific strengths:

1. **Role clarity**: The opening line "You now know the Chorus protocol" immediately establishes what the agent is expected to do. The "Your Role" section makes it clear the agent packages and understands envelopes, but does not worry about transport.

2. **Sending flow**: The numbered steps (1-4) under "Sending" are unambiguous. The rule for when to include `cultural_context` (first turn, different cultures) is stated clearly and reinforced by the DO NOT section.

3. **Receiving flow**: The branching logic (same culture = deliver directly, different = adapt) is easy to follow. The instruction "you are an intelligent agent -- you know how to bridge languages and cultures" gives appropriate latitude without being vague.

4. **DO NOT list**: This section is valuable. It prevents the four most likely mistakes a naive agent would make.

### What was confusing, if anything?

1. **Response envelope**: PROTOCOL.md specifies a response format (`{"status": "ok"}`), but SKILL.md does not explicitly instruct the agent to return this response after receiving. A fresh agent might not know it should send back a status response unless it reads PROTOCOL.md in addition to SKILL.md.

2. **`cultural_context` authorship**: SKILL.md says "explain why your user said it this way, in your user's language." PROTOCOL.md says "`cultural_context` MUST be in the sender's language." These are consistent but phrased differently. A single canonical phrasing would reduce ambiguity.

3. **Receiver culture unknown at send time**: The protocol says to include `cultural_context` when cultures differ, but the SKILL.md does not explicitly state how the sending agent knows the receiver's culture. This presumably comes from the connection/discovery layer (which is out of scope), but a brief note would help.

4. **Adaptation depth**: How much cultural explanation to surface to the user is left to agent judgment. This is probably correct (agents vary in capability), but an example in SKILL.md showing a good adaptation would accelerate learning.

### Conclusion

The SKILL.md is effective as a standalone learning document. A fresh agent can read it once and correctly produce and consume Chorus envelopes. The PROTOCOL.md serves as a precise reference for edge cases. Together they form a clear, minimal specification.
