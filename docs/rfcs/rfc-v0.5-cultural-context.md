# RFC-001: Reclassify cultural_context from core field to optional hint

2026-03-20 | Status: DRAFT

---

## Problem

`cultural_context` is currently a conditional core field in the Chorus envelope (PROTOCOL.md Section 2). The protocol says senders SHOULD include it on the first turn when cultures differ.

This creates three problems:

1. **Incremental value is unproven and model-dependent.** A capable LLM can often infer cross-cultural nuances from `original_text` + `sender_culture` alone. A non-LLM agent may not be able to act on free-text explanation. The field may provide incremental benefit in some cases (e.g., EXP-01's clock-gift scenario where sender context helped the receiver identify a taboo), but this benefit has not been shown to be stable or necessary for protocol operation. The protocol should not treat an unproven incremental gain as a sender obligation.

2. **The protocol should not obligate senders to provide this hint.** The sender knows "why I said it this way" — that's genuine information. But the current SHOULD rule makes providing it an expected duty rather than an available option. The sender's role in the protocol is to provide the original message and its cultural origin; whether to add explanatory context should be the sender's choice, not the protocol's expectation.

3. **Creates documentation friction.** EXP-02 pilot found that "include on first turn when cultures differ" is ambiguous (F-2: what is "first"? per conversation_id? per sender_id?). The SHOULD keyword invites confusion about compliance.

The protocol itself already concedes the point: SKILL.md says "omit cultural_context — the receiving agent can still adapt without it." If the protocol works without it, it should not be presented as a core concern.

---

## Current State (v0.4)

| Layer | Treatment |
|-------|-----------|
| PROTOCOL.md Section 2 | `cultural_context (string 10-500, Conditional)` — listed in envelope definition |
| PROTOCOL.md Section 3 | `SHOULD include on first turn when cultures differ` |
| PROTOCOL.md Constraints | `cultural_context MUST be in sender's language` |
| envelope.schema.json | Optional field with minLength 10, maxLength 500 |
| SKILL.md Sending | Step 2: "Add cultural context if needed" — full paragraph of guidance |
| SKILL.md DO NOT | "Do not include cultural_context in every message. First turn only" |
| Implementation | Sender LLM generates it; receiver LLM uses it as adaptation context |

---

## Options

### Option A: Keep field, downgrade SHOULD → MAY

**Changes**:

| File | Before | After |
|------|--------|-------|
| PROTOCOL.md Section 2 | `Conditional` | `MAY` |
| PROTOCOL.md Section 3.1 | `SHOULD include cultural_context on the first turn when cultures differ` | `MAY include cultural_context as a hint to the receiver` |
| PROTOCOL.md Constraints | `cultural_context MUST be in sender's language` | Keep (applies when field is present) |
| SKILL.md Sending | Step 2: full paragraph of "Add cultural context if needed" | Collapse to one sentence: "You may optionally include `cultural_context` — a hint in your language about why the message is phrased this way. Most receivers can adapt without it." |
| SKILL.md DO NOT | "Do not include in every message. First turn only" | Remove (no longer prescriptive about timing) |
| Schema | No change | No change |
| Code | No change | No change |

**Pros**:
- Minimal diff — 4 files touched, no schema or code changes
- Backwards compatible — existing envelopes with cultural_context still valid
- Receivers that benefit from the hint can still use it
- Removes the prescriptive timing rule that caused EXP-02 F-2

**Cons**:
- Field remains in the core protocol definition, occupying space in every reader's mental model
- Documentation still needs to explain it (even as MAY)
- "Optional hint in core spec" is an odd category — either it matters or it doesn't

**Migration**: None. v0.4 envelopes remain valid. Senders stop feeling obligated to generate it.

---

### Option B: Move to extension profile

**Changes**:

| File | Before | After |
|------|--------|-------|
| PROTOCOL.md Section 2 | Listed in envelope fields | Remove. Add note: "Additional fields permitted (see extensions)" |
| PROTOCOL.md Section 3 | Two rules about cultural_context | Remove |
| PROTOCOL.md Constraints | MUST be in sender's language | Remove from core; move to extension doc |
| TRANSPORT.md Section 9 | Lists A2A wrapping and SSE streaming | Add: "Cultural Hints (MAY)" extension |
| SKILL.md Sending | Step 2: full paragraph | Remove step. Add brief mention in Reference: "Extension: cultural hints" |
| Schema | In core schema | Remove from core; create `cultural-hints.schema.json` or document inline in extension |
| Code | No change | No change (`additionalProperties: true` means the field still passes validation) |

New extension definition (in TRANSPORT.md Section 9 or standalone):

```
### Cultural Hints (MAY)

Senders MAY include `cultural_context` (string, 10-500 chars, in sender's language)
as a hint explaining why the message is phrased this way. Receivers MAY use it
to improve adaptation quality. Receivers MUST NOT require it.
```

**Pros**:
- Core protocol becomes 4 required fields, period — no conditional logic
- Extension mechanism already exists (TRANSPORT.md Section 9)
- Clean separation: core = message delivery, extension = adaptation quality hints
- Implementors who don't care about cultural hints never encounter the field

**Cons**:
- More files to maintain (extension doc + optional schema)
- Discovery: how does a new implementor learn the extension exists?
- Slight cognitive overhead: "is this core or extension?" question for implementors

**Migration**: None. The field was already optional in the schema. Moving its documentation doesn't change wire compatibility.

---

### Option C: Delete completely

**Changes**:

| File | Before | After |
|------|--------|-------|
| PROTOCOL.md | 3 references | Remove all |
| SKILL.md | Step 2 + DO NOT rule | Remove all |
| Schema | Field definition | Remove field |
| Code: llm.ts | Generates cultural_context | Remove generation logic |
| Code: envelope.ts | Conditionally includes field | Remove |
| Code: receiver | Uses cultural_context in adaptation prompt | Remove from prompt |
| Tests | Multiple tests reference cultural_context | Update |

**Pros**:
- Simplest possible protocol — 4 MUST fields, 2 MAY fields, done
- Zero documentation confusion
- Smaller envelope on the wire
- Forces receivers to be self-sufficient (which capable ones already are)

**Cons**:
- Irreversible — re-adding later means a version bump
- Loses the mechanism even for cases where sender context genuinely helps
- Breaks existing implementations that generate/consume the field (though EXP-01 is the only known external use)
- Larger code diff

**Migration**: v0.5 core semantics would ignore `cultural_context`. Legacy senders may still include it on the wire — the schema permits additional fields (`additionalProperties: true`), so existing envelopes remain wire-valid. However, compliant v0.5 receivers would treat the field as semantically irrelevant: no obligation to read, parse, or act on it.

---

## Comparison

| Dimension | A: MAY | B: Extension | C: Delete |
|-----------|--------|-------------|-----------|
| Core protocol complexity | Same | Reduced | Most reduced |
| Backwards compatible | Yes | Yes | Mostly (field ignored) |
| Code changes | None | None | ~6 files |
| Doc changes | 4 files, minor | 5+ files, moderate | All protocol docs |
| Recoverable | Yes | Yes | No (need version bump to re-add) |
| Sender burden | Removed (no SHOULD) | Removed | Removed |
| Receiver benefit preserved | Yes | Yes | No |
| EXP-02 F-2 resolved | Yes (no timing rule) | Yes | Yes |

---

## Recommendation

**Option A** for v0.5, with a path to B if the extension mechanism matures.

Rationale:
- The field isn't actively harmful — it's the SHOULD that's harmful. Downgrading to MAY removes the prescription without losing the mechanism.
- Option B is cleaner in principle but adds extension infrastructure that doesn't exist yet (only two other extensions are defined, both marked MAY, neither has a standalone schema).
- Option C is irreversible and the cost of keeping an optional field is near zero.

If a future version introduces a formal extension registry, cultural_context is a natural candidate to migrate from core MAY to registered extension (A → B path).

This RFC does not claim cultural_context has no value; it claims the protocol must stop treating it as an expected sender obligation.

---

## Decision

Pending Commander review.
