# EXP-02: Third-Party Cold-Start Integration

2026-03-20 | Status: APPROVED — Commander authorized execution

---

## 1. Objective

Validate whether an agent with no repository context, no oral explanation, and no implicit knowledge can complete a full bidirectional Chorus integration using only the published documentation.

This is an adoption friction test. It does not validate market demand, protocol longevity, or cultural adaptation quality.

---

## 2. Scope

**In scope**:
- First-contact adoption friction: how hard is it to go from zero to working integration
- Documentation sufficiency: do SKILL.md and TRANSPORT.md contain everything needed
- Cross-LLM generality: can a non-Claude model understand the docs
- Bidirectional completeness: can the subject both send and receive

**Out of scope**:
- Market demand or willingness to adopt
- Long-term retention or continued usage
- Cultural adaptation quality (tested in EXP-01)
- Performance benchmarks
- P2P mode (server relay only)
- Multi-turn conversation
- Human developer experience (see Section 3 validity)

---

## 3. Test Subject

### Selected: OpenClaw (xiaox) — revised from original design

Original design specified xiaov (豆包 seed-2.0-code) via Feishu. Revised during execution: switched to xiaox (MiniMax-M2.7) via Telegram after xiaov was disqualified (warm start from pilot context). See Appendix in results.

| Property | Value |
|----------|-------|
| Model | MiniMax-M2.7 |
| Platform | OpenClaw framework, Telegram integration |
| Location | Local machine (`~/.openclaw/agents/xiaox/`) |
| Chorus protocol exposure | Zero — has never seen SKILL.md, TRANSPORT.md, PROTOCOL.md, or any protocol spec before this experiment |
| Chorus project exposure | Non-zero caveat: xiaox read project CLAUDE.md (Fusion-Core workflow doc, no protocol content) on 2026-03-13. See Section 3.1 |
| Execution capability | Shell command execution, file creation, HTTP requests |
| Interaction model | Commander → Telegram chat → OpenClaw (xiaox) |

### 3.1 Historical Exposure Assessment

xiaox's session history from 2026-03-13 contains a read of the Chorus project's `CLAUDE.md`. This file is a Fusion-Core project management workflow document. It contains:
- Stage routing tables referencing file paths (e.g., `.claude/skills/pm/SKILL.md`)
- Workflow instructions for project management roles
- No protocol specifications, envelope formats, HTTP bindings, or API contracts

It does NOT contain the content of SKILL.md, TRANSPORT.md, PROTOCOL.md, or any source code.

**Ruling**: This exposure means xiaox does not satisfy the original "zero Chorus artifact" criterion strictly. However, CLAUDE.md contains no information that would help construct Chorus envelopes, register with a server, or implement a receive endpoint. The subject's behavior during the experiment (struggling with version fields, trying both flat and nested envelope formats, discovering the 404 on /.well-known/chorus.json) is consistent with genuine first contact with the protocol documentation.

This experiment therefore provides conditional evidence for "cold start from protocol documentation" but not "zero exposure to any project artifact." The distinction is documented here for audit transparency.

### Why OpenClaw

1. **Different LLM family**: MiniMax-M2.7 is not Claude/GPT — tests whether docs are clear enough for a different non-Claude model family
2. **Zero protocol exposure**: OpenClaw has never seen SKILL.md, TRANSPORT.md, or any protocol spec (non-protocol artifact caveat in Section 3.1)
3. **Autonomous execution**: Can write and run code without human intermediary editing
4. **Available now**: No recruitment delay

### Validity Assessment

| Strength | Limitation |
|----------|-----------|
| Different LLM → tests doc generality | AI subject → cannot extrapolate to human developer experience |
| Zero protocol exposure (non-protocol artifact caveat, see 3.1) → conditional cold start evidence | Same machine → eliminates network/ENV friction a real third party would face |
| Autonomous code execution → realistic integration test | Commander as conductor → bias risk (mitigated by Section 8) |
| MiniMax-M2.7 is a different non-Claude model → if it passes, docs are reasonably clear | N=1, single model family → cannot claim generality |

**Validity level**: This experiment provides conditional evidence for "non-Claude AI protocol-doc cold start." It is strictly stronger than EXP-01 (different LLM, bidirectional, no source code access) but strictly weaker than a human developer test. The "conditional" qualifier reflects the non-protocol artifact exposure caveat documented in Section 3.1.

If EXP-02 FAILS, it reveals real documentation deficiencies. If EXP-02 PASSES, it justifies investing in a human developer test (EXP-03).

---

## 4. Provided Materials

OpenClaw receives exactly these materials via Telegram chat and nothing else:

| # | Material | Delivery | Content |
|---|----------|----------|---------|
| M-1 | SKILL.md | File path in Telegram message | Protocol skill document (97 lines) |
| M-2 | TRANSPORT.md | File path in Telegram message | HTTP binding (298 lines) |
| M-3 | Task prompt | Telegram message | See Section 5 |
| M-4 | Server URL | In task prompt | `http://localhost:3000` |

### Explicitly NOT provided

- Source code, repository path, or any implementation files
- `PROTOCOL.md` or `envelope.schema.json`
- The Chorus project directory path (`/Volumes/XDISK/chorus`)
- Any prior conversation context about Chorus
- OpenClaw memory entries about Chorus (verify none exist before experiment)
- Hints like "use Hono" or "check the demo code"

### Information isolation (CRITICAL)

OpenClaw runs on the same machine as the Chorus repository. Without active containment, it can `find`, `grep`, or `ls` its way to source code, test files, experiment logs, and this design document itself. "Not provided" is not "not accessible."

**Containment measures**:

1. Copy SKILL.md and TRANSPORT.md to `/tmp/chorus-exp02/` before the experiment. Deliver only these copies.
2. The task prompt (Section 5) includes an explicit no-search constraint: the subject is told it may only use the two attached documents and the running server.
3. If OpenClaw's chat log reveals it accessed any path under `/Volumes/XDISK/chorus`, `~/.claude/`, or any file containing "chorus" outside `/tmp/chorus-exp02/`, the experiment is **VOID** — not FAIL, VOID. The result cannot be used because the independent variable (docs-only access) was violated.

**Detection**: After the experiment, grep OpenClaw's transcript and executed commands for any Chorus repo paths. If found → VOID.

### Delivery protocol

1. Start a **fresh** OpenClaw conversation (no carryover context)
2. Verify OpenClaw has no Chorus-related memories: check `~/.openclaw/memory/` for any Chorus references
3. Copy docs to neutral location: `cp skill/SKILL.md skill/TRANSPORT.md /tmp/chorus-exp02/`
4. Reference `/tmp/chorus-exp02/SKILL.md` and `/tmp/chorus-exp02/TRANSPORT.md` as file paths in the task prompt (OpenClaw reads them via tool calls)
5. Send M-3 as a chat message
6. Timestamp the moment M-3 is sent → this is T₀ for all time metrics

---

## 5. Task

The task prompt sent to OpenClaw:

> You have two documents attached: SKILL.md and TRANSPORT.md. They describe a protocol called Chorus for agent-to-agent communication.
>
> A Chorus server is running at `http://localhost:3000`. There is a registered agent called `agent-zh-cn@localhost` that speaks Chinese.
>
> Complete these steps:
>
> 1. **Register** your agent with the server. Choose your own agent ID (must be `name@host` format), declare your culture and languages, and provide a real HTTP endpoint where you can receive messages. You must actually start a server on that endpoint.
>
> 2. **Send a message** to `agent-zh-cn@localhost`. The message should be in English. If the receiver's culture differs from yours, follow the protocol's guidance on cultural context.
>
> 3. **Receive a message** at your registered endpoint. After you confirm your endpoint is running, a message will be sent to your agent. Your endpoint must accept the Chorus envelope and return the correct response per the protocol.
>
> 4. **Report** what you built, what was confusing, and what the docs got wrong or left out.
>
> You may use any programming language or tools to write your own code. However, you must work **only** from the two attached documents and the running server at `http://localhost:3000`. Do not search the local filesystem for Chorus-related files, source code, repositories, or documentation beyond what is attached. If you get stuck, say what's blocking you — but try to solve it from the docs first.

### Step 3 mechanics

After OpenClaw confirms its receive endpoint is running, the Commander triggers the inbound message:

```bash
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{
    "receiver_id": "{OPENCLAW_AGENT_ID}",
    "envelope": {
      "chorus_version": "0.4",
      "sender_id": "agent-zh-cn@localhost",
      "original_text": "周末我们组织了一次团建，去了郊外烧烤，大家玩得很开心。",
      "sender_culture": "zh-CN",
      "cultural_context": "团建是中国企业文化中常见的团队活动，通常由公司组织，目的是增进同事间的关系。烧烤是一种轻松的户外社交方式。"
    }
  }'
```

The Commander copies `{OPENCLAW_AGENT_ID}` from OpenClaw's registration step. The envelope content is pre-written (above) to eliminate improvisation bias.

---

## 6. Success Metrics

| Metric | ID | Definition | Measurement |
|--------|----|-----------|-------------|
| Time to First Message | TTFM | T₀ → first `delivery: "delivered"` | Conductor timestamps |
| Total Completion Time | TCT | T₀ → bidirectional round-trip confirmed | Conductor timestamps |
| Question Count | QC | Times OpenClaw said "I'm stuck" or asked for clarification | Chat log count |
| Documentation Defect Count | DDC | Issues where docs were missing, ambiguous, or wrong | Friction log categorization |
| Human Intervention Required | HIR | Did Commander provide info beyond defined materials | Chat log analysis |
| Bidirectional Complete | BDC | Both send AND receive succeeded | Server logs |
| Envelope Validity Rate | EVR | Valid attempts / total attempts on POST /messages | Server logs |
| Retry Count | RC | Total attempts before first success (register + send + receive) | Server logs + chat log |

### Hard success criteria

| # | Criterion | Required for |
|---|-----------|-------------|
| C-1 | OpenClaw registers successfully (HTTP 201) | PASS |
| C-2 | OpenClaw sends a message delivered to demo agent | PASS |
| C-3 | OpenClaw's endpoint accepts inbound envelope, returns `{ "status": "ok" }`, AND produces evidence of envelope parsing (see below) | PASS |
| C-4 | BDC = true | PASS |
| C-5 | QC ≤ 3 | PASS (graduated) |
| C-6 | HIR = false | PASS (graduated) |
| C-7 | No contamination detected (Section 8.6 check passes) | PASS (violation → VOID) |

#### C-3 evidence requirement

Returning `{ "status": "ok" }` alone is insufficient — a stub server with a hardcoded response would pass that bar. The subject must demonstrate it actually parsed the inbound Chorus envelope. At least ONE of the following must be present:

1. **Receive-side log output**: The endpoint logs the parsed `sender_id`, `original_text`, and `sender_culture` from the incoming envelope to stdout or a file
2. **Structured processing report**: OpenClaw reports back (in chat) the content of the received message, referencing specific envelope fields
3. **Adapted or translated output**: The endpoint or OpenClaw produces a human-readable rendering of the received message (translation, summary, or acknowledgment that references the original content)

The conductor verifies C-3 by cross-referencing the subject's output against the known inbound envelope (Section 5, Step 3 curl). The `original_text` sent is "周末我们组织了一次团建，去了郊外烧烤，大家玩得很开心。" — the subject's evidence must contain or reference this content.

| Outcome | Condition |
|---------|-----------|
| PASS | C-1 through C-7 all met |
| CONDITIONAL PASS | C-1 through C-4 and C-7 met; C-5 or C-6 exceeded |
| FAIL | Any of C-1 through C-4 not met after reasonable effort (≥30 min or ≥5 retries) |
| VOID | C-7 violated (contamination detected) — result cannot be used |

---

## 7. Failure Taxonomy

Every friction event MUST be classified with one **primary** tag and an optional **secondary** tag:

`PRIMARY [/ SECONDARY]` — e.g., `DOC`, `SUBJ / DOC`, `ENV`

| Category | Code | Definition | Implies |
|----------|------|-----------|---------|
| Documentation Defect | DOC | SKILL.md or TRANSPORT.md is missing, ambiguous, incorrect, or contradictory | Fix the docs |
| Implementation Defect | IMPL | Server or demo agent behaves differently from docs | Fix the code |
| Environment Issue | ENV | Network, tooling, port conflicts, unrelated to Chorus | Discard from analysis |
| Subject Capability | SUBJ | OpenClaw misread clear documentation or model limitation | Log for context; does not reflect on protocol |

### Classification rules

- The **primary** tag determines the action item. The secondary tag adds context but does not change the action.
- OpenClaw misunderstands clear docs → `SUBJ`
- OpenClaw misunderstands ambiguous docs → `DOC`
- When in doubt between DOC and SUBJ → primary `DOC` (err toward fixing docs)
- Model-dependent clarity issue (subject model fails where Claude would not, but the doc could be clearer) → `SUBJ / DOC` — primary cause is model capability, secondary action is to improve doc clarity for weaker models

---

## 8. Bias Controls

### 8.1 The core risk

The Commander is both the project creator AND the experiment conductor. This creates two bias vectors:

1. **Prompt leakage**: unconsciously including Chorus knowledge in the task prompt beyond Section 5
2. **Rescue instinct**: when OpenClaw struggles, providing hints instead of letting it fail

### 8.2 Conductor MUST NOT

- Modify the task prompt from Section 5 (copy-paste exactly)
- Add context like "this is similar to email" or "think of it like REST APIs"
- Share server logs, error messages, or debug output with OpenClaw
- Edit OpenClaw's code or curl commands before execution
- Say "check Section 6.4" or "look at the register endpoint" — only "check the docs"
- Run OpenClaw's commands for it (OpenClaw must execute its own code)

### 8.3 Conductor MAY

- Confirm server is running: "yes, localhost:3000 is up"
- Trigger Step 3 inbound message (per Section 5 mechanics)
- Ask OpenClaw to narrate its reasoning (for transcript capture)
- Confirm experiment completion: "bidirectional round-trip verified"

### 8.4 Question handling

When OpenClaw asks for help:

1. Log the question verbatim with timestamp
2. Is the answer in SKILL.md or TRANSPORT.md?
   - **Yes** → "That information is in the docs you received."
   - **No** → Log as DOC defect. Provide minimal factual answer. Mark HIR=true.
3. Increment QC

### 8.5 Pre-experiment isolation

Before starting:

- [ ] Verify no Chorus-related files in `~/.openclaw/memory/`
- [ ] Start a fresh OpenClaw conversation (no prior context)
- [ ] Copy docs to `/tmp/chorus-exp02/` (no other files in that directory)
- [ ] Verify the task prompt matches Section 5 exactly
- [ ] Start server from committed code: `npm run build && node dist/demo/index.js`

### 8.6 Post-experiment contamination check

After experiment completes (regardless of outcome):

1. Extract all commands OpenClaw executed from the Telegram transcript (or OpenClaw session JSONL)
2. Grep for: `/Volumes/XDISK/chorus`, `~/.claude/`, `chorus/src`, `chorus/skill`, `chorus/tests`, `PROTOCOL.md`, `envelope.schema.json`
3. If any match → experiment verdict is **VOID** (see Section 4, Information isolation)
4. Record the contamination check result in `EXP-02-summary.md`

---

## 9. Conclusion Boundaries

### MUST NOT claim

| Prohibited claim | Why |
|-----------------|-----|
| "Third-party developers will adopt Chorus" | AI ≠ human developer; friction ≠ motivation |
| "Protocol is production-ready" | N=1 cold start with an AI on localhost ≠ production |
| "Documentation is complete" | One AI finding it sufficient ≠ universally sufficient |
| "Cultural adaptation works for non-Claude models" | OpenClaw doesn't do adaptation — the demo agent does |
| "Result generalizes to other models" | MiniMax-M2.7 has specific capabilities; other models may differ |

### MAY claim

| Permitted claim | Condition |
|----------------|-----------|
| "A non-Claude AI completed cold-start integration in X min with Y questions" | PASS or CONDITIONAL PASS |
| "Documentation has N defects that blocked a non-Claude AI" | DDC > 0 |
| "Bidirectional integration is achievable from SKILL.md + TRANSPORT.md alone by a non-Claude AI (conditional on Section 3.1 caveat)" | PASS or CONDITIONAL PASS with HIR=false |
| "SKILL.md/TRANSPORT.md are insufficient for non-Claude cold start" | FAIL |
| "Results justify a human developer test (EXP-03)" | PASS |

---

## 10. Artifacts

All under `docs/experiment-results/EXP-02-*`.

| Artifact | File | Content |
|----------|------|---------|
| Summary | `EXP-02-summary.md` | Verdict + metrics + conclusion |
| Friction Log | `EXP-02-friction-log.md` | Timestamped events, each classified by taxonomy |
| Question Log | `EXP-02-question-log.md` | Every question, answer, HIR flag |
| Transcript | `EXP-02-transcript.md` | Full Commander↔OpenClaw chat (copy-paste from Telegram) |
| Server Log | `EXP-02-server-log.txt` | Raw HTTP request/response during experiment |
| OpenClaw's Code | `EXP-02-subject-code/` | Code OpenClaw wrote (extracted from chat or filesystem) |
| Final Verdict | In `EXP-02-summary.md` | PASS / CONDITIONAL PASS / FAIL |

---

## 11. Pre-Experiment Checklist

- [ ] `npm run build` succeeds (tsc zero errors)
- [ ] `npm test` passes (141 tests)
- [ ] `node dist/demo/index.js` starts router + demo agents on :3000/:3001/:3002
- [ ] `curl http://localhost:3000/agents` returns agent list with `agent-zh-cn@localhost`
- [ ] `DASHSCOPE_API_KEY` configured for demo agent LLM calls
- [ ] No Chorus-related content in `~/.openclaw/memory/`
- [ ] Fresh OpenClaw conversation started
- [ ] SKILL.md and TRANSPORT.md copied to a neutral location (e.g., `/tmp/chorus-docs/`)
- [ ] Task prompt copied verbatim from Section 5
- [ ] Step 3 curl command prepared with placeholder for OpenClaw's agent ID
- [ ] Terminal recording or Telegram chat export ready

---

## 12. Differences from EXP-01

| Dimension | EXP-01 | EXP-02 |
|-----------|--------|--------|
| Subject | Claude (same model family as project) | MiniMax-M2.7 via OpenClaw (different model family) |
| Subject control | Conductor ran both sides | Commander conducts, OpenClaw executes independently |
| Direction | Send only | Bidirectional (send + receive) |
| Materials | SKILL.md + task prompt | SKILL.md + TRANSPORT.md + task prompt |
| Source code access | Implicit (same repo session) | None |
| Receive endpoint | Not required | Subject must implement |
| Success bar | Message delivered | Bidirectional round-trip + question limit |
| Bias control | None (same person, same session) | Formal protocol with isolation checks |
| Network | localhost, trivial | localhost, trivial (same limitation) |
| Conclusion scope | "Controlled-environment technical reachability" | "Conditional evidence for non-Claude AI protocol-doc cold start" |
