<!-- Author: PM Consultant -->

# PM Consultant Adversarial Audit — Phase 1 PRD

> Date: 2026-03-18
> Reviewer: PM Consultant (Critical Adversary)
> Scope: PRD.md, FEATURE_LIST.md, BDD_Scenarios.md
> Method: 4-attack adversarial review (Scenario Bombing, Number Interrogation, V2 Blocker Check, Assumption Risk Matrix)

---

## Overall Verdict: REVISE

Gate 0 cannot pass until the 2 CRITICAL issues are resolved. The PRD is structurally sound and the PM has done competent work translating Phase 0 findings into Phase 1 requirements. However, there are specification gaps that will cause ambiguity at implementation time, and one assumption (A-P1-04) has no fallback plan despite being rated H x H.

---

## CRITICAL Issues (Block Gate 0)

### C-01: `cultural_context` field has no validation constraints in the protocol spec

**Source**: Attack 1 (Scenario Bombing) + Attack 2 (Number Interrogation)

The BDD scenario (F3v2 happy path) states `cultural_context` length should be "20-200 characters". But this constraint appears NOWHERE in the PRD's F1v2 feature description, which only says `cultural_context` is a "string, strongly recommended" field. The INTERFACE.md schema revision suggestion also has no `minLength`/`maxLength`.

**Why this is critical**: Without validation bounds in the spec, the following will happen at implementation:
- An LLM could generate a 2000-character cultural essay, bloating every message
- An LLM could generate a 3-character string like "Chinese" that carries zero cultural insight
- There is no contractual agreement between the `be-domain-modeler` building the schema and the `be-ai-integrator` building the prompt — each will make their own assumptions

**Concrete edge cases the PM missed**:
1. LLM generates cultural_context in the wrong language (e.g., Japanese Agent generates context in Japanese instead of a language-neutral or sender-language description)
2. LLM generates cultural_context that is itself culturally offensive or contains stereotypes
3. LLM generates cultural_context that contradicts the `sender_culture` BCP47 tag (e.g., says "in Western culture..." when sender_culture is zh-CN)

**Required fix**: F1v2 must specify:
- `minLength` and `maxLength` for the field (justify the numbers — see C-02)
- Expected language of the `cultural_context` string (sender language? English? target language?)
- What constitutes a valid vs. degenerate cultural_context (even one sentence of guidance)

### C-02: The 20-200 character range for `cultural_context` has no empirical basis

**Source**: Attack 2 (Number Interrogation)

The BDD says "cultural_context content is natural language, 20-200 characters". Where does this range come from? It does not appear in:
- The Phase 0 experiment results (summary.md mentions cultural_context examples but never measures their length)
- The PRD (no mention of character limits)
- The INTERFACE.md (no length constraint)

**Why this is critical**: The range is either (a) an invention by the PM that needs justification, or (b) a reasonable guess that needs to be labeled as an assumption and added to Section 4.

Looking at the Phase 0 examples:
- "在阿拉伯文化中，用左手递东西被视为不尊重" = 18 characters (below the 20 minimum!)
- "日本文化中直接评论他人体重是社交禁忌" = 17 characters (also below!)
- "中国文化中，直接评论体重是亲近关系的日常关心表达，通常不带恶意" = 29 characters (barely above minimum)

The 20-char lower bound would reject the Phase 0 experiment's own examples. This is a specification that contradicts observed data.

**Required fix**: Either (a) derive the range from actual Phase 0 corpus analysis and cite it, or (b) remove the range from BDD and add an assumption "A-P1-05: cultural_context length of X-Y characters is sufficient for cross-cultural information" with a validation plan.

---

## HIGH Issues (Strongly Recommend Fix Before Gate 0)

### H-01: A-P1-04 (H x H) has no fallback plan

**Source**: Attack 4 (Assumption Risk Matrix)

A-P1-04 states: "A2A DataPart transmitting Chorus Envelope is viable in actual A2A SDK (Phase 0 only constructed JSON manually)". This is rated Impact=H, Risk=H — the highest risk quadrant. The validation plan is "D3 integration test, first use of real A2A transport."

**Problem**: What happens when the D3 integration test FAILS? The PRD says nothing. If A2A SDK's DataPart implementation differs from the hand-crafted JSON (e.g., SDK enforces additional constraints, serialization differs, mediaType handling is unexpected), the entire message transport layer is broken.

**Specific risks I can foresee**:
1. A2A SDK might not support custom `mediaType` values on DataPart (only standard MIME types)
2. A2A SDK might serialize `Part.data` differently than raw JSON (e.g., base64-encoded, or wrapped in an additional envelope)
3. The SDK's `SendMessage` implementation might strip unknown extensions or validate them against a registry

**Required fix**: Add a concrete fallback to A-P1-04:
- "If A2A SDK DataPart does not support custom mediaType → FALLBACK: embed Chorus envelope as a JSON string in a standard text DataPart, with a convention-based prefix identifier"
- Or: "FALLBACK: bypass A2A SDK for message construction, use raw HTTP with A2A-compliant JSON (as Phase 0 did)"
- Schedule a **Spike task in Stage 2** specifically to validate this assumption BEFORE committing to the full architecture

### H-02: Heartbeat mechanism is underspecified

**Source**: Attack 1 (Scenario Bombing) + Attack 2 (Number Interrogation)

F5 says "Agent disconnects auto-cleared (heartbeat timeout 30s)" and the BDD scenario says "Agent A has not sent a heartbeat for over 30 seconds". But nowhere is specified:
1. **What constitutes a heartbeat?** A dedicated `POST /heartbeat` endpoint? Or does any request to the server count?
2. **What is the heartbeat interval?** If timeout is 30s, the heartbeat should be sent at some interval < 30s (e.g., every 15s). This is never stated.
3. **Who initiates?** Does the Agent poll the server, or does the server ping the Agent?
4. **What happens mid-conversation?** If Agent A is composing a long message and hasn't interacted with the server for 35s, does it get evicted even though it's actively being used?

**Edge case**: User is typing a long, thoughtful message. Their Agent hasn't sent any HTTP requests to the server for 40 seconds. The server evicts the Agent. The other user sends a message. 404 Not Found. The conversation dies with no recovery path.

**Required fix**: F5 must specify the heartbeat protocol (endpoint, interval, what counts as keepalive). The BDD must add a scenario for "Agent is active but server-side heartbeat times out during long user input."

### H-03: No BDD scenario for simultaneous send (race condition)

**Source**: Attack 1 (Scenario Bombing)

PRD Section 5.5 acknowledges "simultaneous speaking behavior is undefined" and dismisses it as low risk. But the BDD has zero coverage for this case.

Consider: User A and User B both type and send at the exact same time. Both Agents POST to /messages simultaneously. Both routing server forwards hit the other Agent's /receive endpoint simultaneously. What happens?
- Does each Agent queue incoming messages while processing outbound?
- Does the CLI interleave display of received messages with the send confirmation?
- Could a message be lost if the Agent is busy sending when it receives?

Even if the behavior is "undefined," the BDD should contain an explicit scenario documenting this as an acknowledged limitation:

```
Scenario: [Known Limitation] Simultaneous send behavior
  Given Agent A and Agent B are both in active conversation
  When both users send messages at the same time
  Then behavior is best-effort; messages may arrive out of order
  And no messages are silently dropped
```

The "no messages are silently dropped" invariant is important even for a demo.

### H-04: Language matching semantics are ambiguous

**Source**: Attack 1 (Scenario Bombing)

F2v2 BDD says Agent A checks "that it can handle ja language." But the matching logic is nowhere defined for Phase 1. The Phase 0 INTERFACE.md says Agent A checks Agent B's `supported_languages` to see if A can "handle B's user_culture's primary language."

**Edge cases**:
1. Agent B declares `user_culture: "ja"` and `supported_languages: ["ja", "en"]`. Agent A supports `["zh-CN", "en"]`. Can they talk? They share English, but the conversation would be zh-CN to ja. Agent A doesn't list "ja" in supported_languages. Does "handle ja" mean "can produce output in ja" or "can send cultural metadata for a ja audience"?
2. What if Agent B's `user_culture` is `"ja"` but it can also speak `"zh-CN"`? Does Agent A need to match `user_culture` or just `supported_languages`?

**Required fix**: F2v2 or a supporting section must define the matching algorithm with pseudocode. One sentence is enough, e.g., "Match succeeds if Agent A's supported_languages INTERSECTS with [Agent B's user_culture primary language subtag]."

---

## MEDIUM Issues (Recommended but Optional)

### M-01: The 8-second latency target lacks decomposition

**Source**: Attack 2 (Number Interrogation)

PRD says "single message end-to-end < 8 seconds (including both sides' LLM inference + routing)." This is a reasonable-sounding number but where does it come from?

Let me decompose a message round-trip:
1. Agent A LLM call (semantic extraction + cultural_context generation): ~2-4s (Dashscope typical)
2. HTTP POST to routing server: ~10ms (localhost)
3. Routing server forward to Agent B: ~10ms (localhost)
4. Agent B LLM call (cultural adaptation + response generation): ~2-4s

Total: 4-8s, which means the 8s target gives almost zero margin. If Dashscope has a slow response (rate-limited or cold start), you blow past 8s easily.

**Questions**:
- Is this 8s for the FULL round trip (A sends, B receives adapted output)? Or just one hop (A sends, message arrives at B before LLM processing)?
- Does this include Agent A's LLM processing time for envelope creation, or just from "envelope ready" to "B displays output"?
- A-P1-01 says Dashscope rate limit is ~2 req/10s. That's 1 request per 5 seconds. Two sequential LLM calls in one message path would take ~10s minimum just from rate limiting.

**Recommendation**: Clarify what the 8s boundary includes. Add a timing breakdown to the PRD. If it's truly end-to-end including both LLM calls, the target may be unrealistic given A-P1-01's rate limit assessment.

### M-02: F4 (Phase 0 validation experiment) is missing from FEATURE_LIST

**Source**: Cross-referencing FEATURE_LIST with INTERFACE.md

FEATURE_LIST jumps from F3v2 to F5. The INTERFACE.md still lists F4 (chorus-validate CLI experiment runner). PRD doesn't mention F4 either.

If F4 is intentionally dropped for Phase 1 (reasonable — the experiment is done), the PM should explicitly state "F4 is retired; Phase 0 validation complete" in FEATURE_LIST to maintain traceability. Currently it's silently absent, which looks like an oversight.

### M-03: "Strongly recommended" (SHOULD) vs. required (MUST) for cultural_context needs protocol-level precision

**Source**: Attack 2 (Number Interrogation)

PRD F1v2 says cultural_context is "strongly recommended." INTERFACE.md revision says "SHOULD." BDD F3v2 error case says if LLM fails to generate it, the envelope "degrades to v0.1 level."

But the v0.2 schema must make a binary decision: is the field `required` in JSON Schema or not? If not required, receivers must handle its absence. If required, senders must always provide it. The PRD uses natural language ("strongly recommended") that doesn't map cleanly to JSON Schema semantics.

**Recommendation**: State explicitly: "cultural_context is NOT in the JSON Schema `required` array, but the prompt template SHOULD instruct the LLM to always generate it. Absence triggers degraded processing but is not a protocol error." This removes implementation ambiguity.

### M-04: No error recovery in the conversation flow

**Source**: Attack 1 (Scenario Bombing)

The BDD covers individual error cases (bad body, agent unreachable, missing fields) but never addresses error recovery within an ongoing conversation:
- After a 502 Bad Gateway, can Agent A retry? Is there a retry policy?
- After a malformed envelope is rejected, the BDD says "conversation continues, Agent A can resend." But how does Agent A know the send failed? Does the routing server return the error synchronously?
- What if the routing server itself crashes mid-conversation? Both agents lose their registration. There's no reconnection BDD scenario.

For a demo, manual restart is acceptable. But the BDD should at least have one scenario showing that a single failed message does not terminate the entire conversation session.

### M-05: V0.1 backward compatibility path has a logical inconsistency

**Source**: Attack 1 (Scenario Bombing)

The BDD says two different things about v0.1 envelopes:
1. F1v2 backward compat scenario: "Agent B notifies user 'the other party is using an old protocol, cultural adaptation may be incomplete'"
2. F8 v0.1 degradation scenario: "User is told 'the other party is using an old protocol'"

But in Phase 1, who would be sending v0.1 envelopes? All reference Agents being built are v0.2. The only way to encounter v0.1 is:
- A legacy agent from Phase 0 (but Phase 0 had no running agents, only experiments)
- A deliberately downgraded agent for testing

This is fine as defensive coding, but the BDD should acknowledge this is a robustness test, not a realistic user scenario in Phase 1.

---

## Attack Results Summary

### Attack 1: Scenario Bombing

| Feature | Edge Case Found | Severity |
|---------|----------------|----------|
| F1v2 | LLM generates cultural_context in wrong language / with stereotypes / contradicting sender_culture | CRITICAL (C-01) |
| F5 | Long user input causes heartbeat timeout, Agent evicted mid-conversation | HIGH (H-02) |
| F5 | Two agents register with same agent_id (BDD covers re-register but not ID collision from different hosts) | MEDIUM |
| F6 | Simultaneous bidirectional message send creates race condition | HIGH (H-03) |
| F6 | Agent B's /receive endpoint responds with 500 (partial failure — message received but processing failed) | MEDIUM |
| F7 | User sends empty string or whitespace-only input | MEDIUM |
| F7 | User sends extremely long input (10,000 chars) — no max input length specified | MEDIUM |
| F8 | All Phase 1 agents are v0.2, so v0.1 backward compat path has no natural trigger | MEDIUM (M-05) |

### Attack 2: Number Interrogation

| Number | Source | Justified? |
|--------|--------|-----------|
| 8s end-to-end latency | PRD NFR | **QUESTIONABLE** — no decomposition, may be unrealistic with Dashscope rate limits (M-01) |
| 30s heartbeat timeout | PRD F5 | **UNJUSTIFIED** — no rationale given. Why not 15s? Why not 60s? What's the tradeoff? (H-02) |
| 20-200 char cultural_context | BDD F3v2 | **CONTRADICTS DATA** — Phase 0's own examples fall below the 20-char minimum (C-02) |
| 2 req/10s Dashscope rate | PRD A-P1-01 | Reasonable but should be validated with actual Dashscope docs, not assumed |
| v0.2 version string | PRD F1v2 | Fine — incremental from v0.1 |
| 2 agents concurrent | PRD NFR | Appropriate for demo scope |

### Attack 3: V2 Blocker Check

| Phase 1 Decision | Blocks Phase 2? | Severity |
|-----------------|----------------|----------|
| In-memory-only routing server | **Partial blocker** — Phase 2 multi-user needs persistence. But since it's a clean rewrite anyway, the in-memory design doesn't create technical debt as long as the API contract (POST /agents, GET /agents, POST /messages) is stable. The API is the real contract, not the storage. | LOW |
| No auth | **Partial blocker** — Phase 2 auth needs to be added. But adding auth middleware to an existing HTTP server is well-understood. No architectural trap here as long as agent_id is not used as a trust boundary (and it isn't in Phase 1). | LOW |
| Routing server as transparent proxy (pure pass-through) | **Not a blocker** — This is actually a good decision. The routing server never inspects envelope content, so envelope schema changes don't require routing server changes. | NONE |
| `additionalProperties: false` in JSON Schema v0.1 | **Potential blocker** — The current v0.1 schema has `additionalProperties: false`, which means a v0.2 envelope with `cultural_context` would FAIL validation against the v0.1 schema. The v0.2 schema must set `additionalProperties: true` or use a different validation strategy. This isn't called out in the PRD. | HIGH (add to H issues) |

**Newly surfaced**: The existing `chorus-envelope.schema.json` has `"additionalProperties": false`. If v0.2 adds `cultural_context` and any component still validates against v0.1 schema, it will reject the new field. The PRD needs to explicitly address schema migration (change `additionalProperties` to `true` in v0.1, or ensure v0.2 replaces v0.1 entirely with no mixed validation).

### Attack 4: Assumption Risk Matrix

| Assumption | Impact | Risk | Validation Plan | Fallback Plan | Verdict |
|-----------|--------|------|----------------|---------------|---------|
| A-P1-01 (Dashscope rate limit) | H | M | D3 E2E test | Not specified | **ACCEPTABLE** — rate limits can be worked around with backoff/retry |
| A-P1-02 (Single LLM call for extraction + context) | M | L | Phase 0 agent.ts | N/A | **ACCEPTABLE** — low risk, already partially validated |
| A-P1-03 (HTTP latency < 8s) | H | M | D2 prototype | Not specified | **QUESTIONABLE** — see M-01, the 8s target may be unrealistic |
| A-P1-04 (A2A DataPart in real SDK) | H | H | D3 integration test | **NONE** | **UNACCEPTABLE** — H x H with no fallback is a project risk (H-01) |

---

## Consolidated Issue List

| ID | Severity | Issue | Section |
|----|----------|-------|---------|
| C-01 | CRITICAL | `cultural_context` has no validation constraints, no language specification, no quality guidance | F1v2, F3v2 |
| C-02 | CRITICAL | 20-200 char range in BDD contradicts Phase 0 data and has no empirical basis | F3v2 BDD |
| H-01 | HIGH | A-P1-04 (H x H) has no fallback plan; need spike + contingency | Section 4 |
| H-02 | HIGH | Heartbeat mechanism underspecified (endpoint, interval, mid-conversation eviction) | F5 |
| H-03 | HIGH | No BDD scenario for simultaneous bidirectional send | F6, Section 5.5 |
| H-04 | HIGH | Language matching algorithm undefined | F2v2 |
| H-05 | HIGH | `additionalProperties: false` in v0.1 schema will reject v0.2 envelopes | Schema migration |
| M-01 | MEDIUM | 8s latency target lacks decomposition, may be unrealistic | NFR |
| M-02 | MEDIUM | F4 silently absent from FEATURE_LIST (should be explicitly retired) | FEATURE_LIST |
| M-03 | MEDIUM | "Strongly recommended" doesn't map to JSON Schema required/optional | F1v2 |
| M-04 | MEDIUM | No error recovery scenarios in ongoing conversation | BDD |
| M-05 | MEDIUM | v0.1 backward compat has no natural trigger in Phase 1 | F8 BDD |

---

## Required Actions to Pass Gate 0

1. **Resolve C-01**: Add `cultural_context` field specification to F1v2 — minimum: expected language, validation constraints, one-sentence quality guidance
2. **Resolve C-02**: Either derive character range from Phase 0 corpus data or remove it from BDD and register as assumption
3. **Address H-01**: Add a fallback clause to A-P1-04 and recommend a Stage 2 spike
4. **Address H-02**: Specify heartbeat protocol (endpoint, interval, keepalive semantics)
5. **Address H-05**: Acknowledge v0.1 schema `additionalProperties: false` conflict and state migration strategy

Items H-03, H-04 and all M-* items are strongly recommended but do not block Gate 0.

---

*PM Consultant review complete. The PM has done solid foundational work. The issues above are about tightening specifications to prevent implementation-time ambiguity, not about fundamental design flaws.*
