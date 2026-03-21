# EXP-03: Human Developer Cold-Start Integration

2026-03-20 | Status: DRAFT — pending Commander review

---

## 1. Objective

Validate whether a human developer with no prior Chorus exposure can complete a full bidirectional integration using only the published documentation (SKILL.md + TRANSPORT.md).

EXP-02 proved a non-Claude AI could do this. EXP-03 asks: can a human? The friction profile is fundamentally different — humans scan rather than parse, bring preconceptions from other protocols, get frustrated, and may give up.

This is a documentation usability test. It is not a market validation, product-market fit study, or user experience research.

---

## 2. Subject Definition

### Inclusion criteria

All of the following MUST be true:

| # | Criterion | Verification |
|---|-----------|-------------|
| I-1 | Has never seen, read, or heard about Chorus protocol or this project | Pre-experiment interview (see Section 10.1) |
| I-2 | Can use a command-line terminal (cd, curl, running scripts) | Self-reported + verified during screening |
| I-3 | Can write working code in at least one language (any language) | Self-reported; backed by GitHub profile, portfolio, or live demonstration |
| I-4 | Understands HTTP basics (request/response, status codes, JSON bodies) | Screening question: "What does a 201 status code mean?" |
| I-5 | Can start a local HTTP server in their language of choice | Screening question: "How would you start a server that listens on port 3006?" |

### Exclusion criteria

Any of the following disqualifies:

| # | Criterion | Reason |
|---|-----------|--------|
| E-1 | Current or past contributor to this project | Cannot simulate cold start |
| E-2 | Has read any file from the Chorus repository (code, docs, CLAUDE.md, issues) | Prior exposure invalidates cold start |
| E-3 | Has been briefed about Chorus by anyone who knows the project | Oral knowledge transfer = contamination |
| E-4 | Is employed by or contracted to the same organization as the Commander | Social pressure and implicit context sharing |
| E-5 | Cannot dedicate 60 uninterrupted minutes | Partial sessions cannot be compared |

### Subject profile documentation

Before the experiment, record:

| Field | Example |
|-------|---------|
| Experience level | Junior / Mid / Senior / Staff |
| Primary language(s) | Python, TypeScript, Go, etc. |
| Years of professional development | 3 |
| Familiarity with agent-to-agent protocols | None / Heard of A2A / Built with A2A / etc. |
| Familiarity with REST APIs | Daily / Occasional / Rare |
| Recruited via | Personal network / Online posting / etc. |

---

## 3. Materials

The subject receives exactly these materials and nothing else:

| # | Material | Delivery | Content |
|---|----------|----------|---------|
| M-1 | SKILL.md | File (email, chat, or shared drive) | Protocol skill document |
| M-2 | TRANSPORT.md | File (same channel as M-1) | HTTP binding document |
| M-3 | Task prompt | Text message (same channel) | See Section 5 |
| M-4 | Server URL | In task prompt | `http://{server_address}:3000` |

### Explicitly NOT provided

- Source code, repository URL, or any implementation files
- PROTOCOL.md or envelope.schema.json
- The project name "Chorus" beyond what appears in the docs themselves
- Hints about language choice, architecture, or implementation approach
- Any AI assistance (ChatGPT, Claude, Copilot) — see Section 3.1

### 3.1 External resource policy

| Resource | Allowed | Reason |
|----------|---------|--------|
| Language documentation (Python docs, MDN, Go docs) | Yes | General programming reference, not Chorus-specific |
| Stack Overflow for language-specific syntax | Yes | "How to start HTTP server in Python" is not a Chorus question |
| AI assistants (ChatGPT, Claude, Copilot, etc.) | No | An AI interpreting Chorus docs is a confound — it would replay EXP-02, not test human comprehension |
| Google/search for "Chorus protocol" | No | Would surface this project if it were public; banned to maintain isolation |
| Asking other people for help | No | Third-party knowledge transfer = contamination |

The subject is informed of this policy before the experiment begins (Section 5, task prompt). Violations are detected via the mandatory audit trail (Section 3.3).

### 3.2 Server provisioning

The Conductor starts the Chorus server before the experiment. The subject connects to it over the network.

**Default: Remote mode.** The server runs on a separate machine (VPS, Conductor's machine, or a different host on the same network). The subject receives an IP or hostname. This eliminates filesystem-level contamination risk entirely.

**Fallback: Local mode.** Only if remote is logistically impossible. Requires additional controls:
- The project directory MUST be moved or renamed before the experiment so that the subject cannot `find` or `ls` their way to source code
- Conductor verifies no source code paths are discoverable from `localhost:3000` responses
- Terminal history export is REQUIRED (not recommended) in local mode

In either mode, the server runs from committed code (`npm run build && node dist/demo/index.js`) with at least one demo agent registered (e.g., `agent-zh-cn@localhost`).

### 3.3 Contamination audit trail (REQUIRED)

All of the following are REQUIRED for every experiment run. A run missing any of these cannot produce a verdict other than VOID.

| Evidence | Method | Audits for |
|----------|--------|-----------|
| Full-session screen recording | Subject shares screen or uses recording software (OBS, QuickTime, etc.) | AI assistant usage, Google searches, local filesystem browsing, accessing project repo |
| Shell history export | `history > ~/exp03-history.txt` after experiment | Commands that accessed project paths, `curl` to external APIs, `git clone`, etc. |
| Browser history export | Export from browser after experiment (or record browser tab in screen recording) | Searches for "Chorus protocol", visits to ChatGPT/Claude, Stack Overflow queries beyond language syntax |

The Conductor reviews all three artifacts after the experiment:
- Policy violation found in any artifact → **VOID**
- Any artifact missing (e.g., subject forgot to export history, recording failed) → **VOID**

There is no partial audit. A run without a complete audit trail cannot produce any verdict other than VOID. The Conductor MUST verify all three artifacts are captured before ending the session.

---

## 4. Observation Method

### Think-aloud protocol (RECOMMENDED, not REQUIRED)

If the subject consents, ask them to narrate their thinking as they work: "Please talk through what you're doing and why." This provides richer data on where confusion occurs.

If the subject declines or finds it disruptive, fall back to silent observation with a post-experiment debrief interview.

### Session recording

| Artifact | Method | Required |
|----------|--------|----------|
| Screen recording | Subject shares screen or uses recording software | REQUIRED (see also Section 3.3) |
| Shell history export | `history > ~/exp03-history.txt` after experiment | REQUIRED (see also Section 3.3) |
| Browser history export | Export or visible in screen recording | REQUIRED (see also Section 3.3) |
| Chat/question log | Conductor timestamps all communications | REQUIRED |
| Think-aloud audio | Voice recording during session | RECOMMENDED if consented |

### Conductor observation notes

The Conductor takes timestamped notes during the session on:
- When the subject switches between docs and code
- Visible confusion, backtracking, or re-reading
- Moments of apparent misunderstanding
- Points where the subject considers giving up

These notes are subjective and labeled as such in the results.

---

## 5. Task

The task prompt sent to the subject:

> You have two documents: SKILL.md and TRANSPORT.md. They describe a protocol for agent-to-agent communication.
>
> A server implementing this protocol is running at `{SERVER_URL}`. There is a registered agent called `agent-zh-cn@localhost` that speaks Chinese.
>
> Complete these steps using any programming language you prefer:
>
> 1. **Register** your agent with the server. Choose your own agent ID (must be `name@host` format), declare your culture and languages, and provide a real HTTP endpoint where you can receive messages. You must actually start a server on that endpoint.
>
> 2. **Send a message** to `agent-zh-cn@localhost`. The message should be in English.
>
> 3. **Receive a message** at your registered endpoint. After you confirm your endpoint is running, a message will be sent to your agent. Your endpoint must accept the incoming message format and return the correct response per the protocol.
>
> 4. **Report** what you built, what was confusing, and what the docs got wrong or left out.
>
> Rules:
> - Work only from the two attached documents and the running server. Do not search online for information about this specific protocol.
> - Do not use AI assistants (ChatGPT, Claude, Copilot, etc.) to interpret the documents or write your code.
> - You may use standard programming references (language docs, Stack Overflow for general syntax questions).
> - There is no pass/fail for you — this is testing the documentation, not your ability. If you get stuck, say what's blocking you.
> - Time limit: 60 minutes. If you haven't finished, that's a valid and useful result.
>
> If you have questions about the protocol, ask me — but I can only say "That information is in the docs" or log your question as a gap in the documentation.

### Step 3 mechanics

After the subject confirms their receive endpoint is running, the Conductor triggers the inbound message:

```bash
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{
    "receiver_id": "{SUBJECT_AGENT_ID}",
    "envelope": {
      "chorus_version": "0.4",
      "sender_id": "agent-zh-cn@localhost",
      "original_text": "周末我们组织了一次团建，去了郊外烧烤，大家玩得很开心。",
      "sender_culture": "zh-CN",
      "cultural_context": "团建是中国企业文化中常见的团队活动，通常由公司组织，目的是增进同事间的关系。烧烤是一种轻松的户外社交方式。"
    }
  }'
```

The Conductor copies `{SUBJECT_AGENT_ID}` from the subject's registration step. The envelope content above is fixed for all runs — do not improvise. If the server is remote, replace `localhost:3000` with the actual server address.

---

## 6. Success Metrics

| Metric | ID | Definition | Measurement |
|--------|----|-----------|-------------|
| Time to First Message | TTFM | T₀ → first `delivery: "delivered"` | Conductor timestamps |
| Total Completion Time | TCT | T₀ → bidirectional round-trip confirmed | Conductor timestamps |
| Question Count | QC | Times subject asked for clarification | Chat log count |
| Documentation Defect Count | DDC | Issues where docs were missing, ambiguous, or wrong | Friction log categorization |
| Human Intervention Required | HIR | Did Conductor provide info beyond defined materials | Chat log analysis |
| Bidirectional Complete | BDC | Both send AND receive succeeded | Server logs |
| Envelope Validity Rate | EVR | Valid attempts / total attempts on POST /messages | Server logs |
| Retry Count | RC | Total attempts before first success (register + send + receive) | Server logs + screen recording |
| Give-Up Point | GUP | If subject did not finish: which step and what blocker | Screen recording + debrief |

### Hard success criteria

| # | Criterion | Required for |
|---|-----------|-------------|
| C-1 | Subject registers successfully (HTTP 201) | PASS |
| C-2 | Subject sends a message delivered to demo agent | PASS |
| C-3 | Subject's endpoint accepts inbound envelope AND produces evidence of envelope parsing (same standard as EXP-02 C-3: log output, structured report, or adapted rendering) | PASS |
| C-4 | BDC = true | PASS |
| C-5 | QC ≤ 3 | PASS |
| C-6 | HIR = false | PASS |
| C-7 | No prior Chorus exposure verified (pre-experiment screening passed) | PASS (violation → VOID) |
| C-8 | TCT ≤ 60 min | PASS |

| Outcome | Condition |
|---------|-----------|
| PASS | C-1 through C-8 all met |
| CONDITIONAL PASS | C-1 through C-4, C-7, C-8 met; C-5 or C-6 exceeded |
| INCOMPLETE | 60 minutes elapsed and C-1 through C-4 are not all met. Records GUP (give-up point) for analysis |
| FAIL | Subject explicitly gives up before 60 minutes, stating they cannot proceed. At least one of C-1 through C-4 not met |
| VOID | C-7 violated (prior exposure discovered) or external resource policy violated (see Section 3.1) |

### Verdict decision tree

```
Time runs out (60 min)?
  ├── Yes → Are C-1 through C-4 all met?
  │     ├── Yes → Check C-5, C-6 → PASS or CONDITIONAL PASS
  │     └── No  → INCOMPLETE (record GUP)
  └── No  → Subject gives up?
        ├── Yes → FAIL (record blocker)
        └── No  → Are C-1 through C-4 all met?
              ├── Yes → Check C-5, C-6 → PASS or CONDITIONAL PASS
              └── No  → (continue, not yet decided)
```

INCOMPLETE is not a judgment on the subject — it means the docs require more than 60 minutes for this subject's profile. FAIL means the subject concluded the task was impossible, which is a stronger signal about doc quality.

---

## 7. Failure Taxonomy

Same as EXP-02. Every friction event gets one **primary** tag and an optional **secondary** tag:

| Category | Code | Definition | Implies |
|----------|------|-----------|---------|
| Documentation Defect | DOC | SKILL.md or TRANSPORT.md is missing, ambiguous, incorrect, or contradictory | Fix the docs |
| Implementation Defect | IMPL | Server or demo agent behaves differently from docs | Fix the code |
| Environment Issue | ENV | Network, tooling, port conflicts, unrelated to protocol | Discard from analysis |
| Subject Capability | SUBJ | Subject misread clear documentation or lacked prerequisite skill | Log for context; does not reflect on protocol |

### Human-specific classification guidance

- Subject skims a section and misses a detail that is clearly stated → `SUBJ` (but note: if multiple humans miss it, reconsider as `DOC`)
- Subject brings preconception from another protocol (e.g., assumes OAuth is needed) → `SUBJ / DOC` if the docs could have preempted the assumption
- Subject cannot write an HTTP server in their chosen language → `SUBJ` (prerequisite gap, not doc gap)
- Subject finds the doc structure confusing (e.g., reads Section 6 before Section 4) → `DOC` if the doc structure actively misleads

---

## 8. Bias Controls

### 8.1 The core risk

Same as EXP-02, amplified: the Commander has social rapport with a human subject. Humans respond to social cues — a raised eyebrow, a pause, a "hmm" can all serve as inadvertent hints.

### 8.2 Conductor MUST NOT

Everything from EXP-02 Section 8.2, plus:

- React visibly (facial expression, tone) to the subject's progress or mistakes
- Say "you're on the right track" or "that's not quite right"
- Look at the subject's screen and then look away pointedly
- Offer encouragement like "you're almost there" (this reveals progress information)
- Adjust the task mid-experiment ("actually, skip step 3")
- Debug the subject's code, even if asked directly

### 8.3 Conductor MAY

- Confirm server is running: "yes, the server is up"
- Trigger Step 3 inbound message (per Section 5 mechanics)
- Confirm experiment completion: "bidirectional round-trip verified"
- Answer meta-questions: "how much time is left?", "can I use Python?"
- Remind of rules if subject starts using AI assistant: "per the rules, please don't use AI tools"
- Acknowledge frustration neutrally: "I understand, take your time"

### 8.4 Question handling

When the subject asks for help:

1. Log the question verbatim with timestamp
2. Is the answer in SKILL.md or TRANSPORT.md?
   - **Yes** → "That information is in the docs you received."
   - **No** → Log as DOC defect. Provide minimal factual answer. Mark HIR=true.
3. Increment QC

### 8.5 Post-experiment debrief

After the experiment (regardless of outcome), conduct a brief unstructured debrief:

- "What was the hardest part?"
- "Was there a point where you almost gave up? What was blocking you?"
- "If you could change one thing about the docs, what would it be?"
- "Did anything in the docs actively mislead you?"

Record answers verbatim. These are subjective but valuable for prioritizing doc improvements.

---

## 9. Conclusion Boundaries

### MUST NOT claim

| Prohibited claim | Why |
|-----------------|-----|
| "Developers will adopt Chorus" | One developer completing a task ≠ adoption intent |
| "Protocol is production-ready" | N=1 cold start on localhost ≠ production |
| "Documentation is complete" | One developer finding it sufficient ≠ universally sufficient |
| "Result generalizes to all developer levels" | One subject at one experience level ≠ population |
| "Market demand exists" | Feasibility ≠ demand |
| "Non-technical users can adopt" | Developer test ≠ non-technical user test |

### MAY claim

| Permitted claim | Condition |
|----------------|-----------|
| "A human developer completed cold-start integration in X min with Y questions" | PASS or CONDITIONAL PASS |
| "Documentation has N defects that blocked a human developer" | DDC > 0 |
| "Bidirectional integration is achievable by a human developer with only published Chorus docs plus standard programming references" | PASS with HIR=false |
| "Published Chorus docs are insufficient for unassisted human cold start (standard programming references allowed)" | FAIL or INCOMPLETE |
| "The documentation friction profile for humans differs from AI in these ways: ..." | Comparison with EXP-02 data |

---

## 10. Ethics and Consent

### 10.1 Pre-experiment screening and consent

Before any experiment activity, the Conductor MUST:

1. **Screen for eligibility**: Verify I-1 through I-5 and E-1 through E-5 via conversation. Do not reveal protocol details during screening — use generic framing: "Have you worked with any agent-to-agent communication protocols recently?"

2. **Obtain informed consent** covering:
   - Purpose: "We're testing whether our documentation is clear enough for a developer to use without help."
   - Data collected: screen recording, terminal history, chat log, think-aloud audio (if consented), debrief notes
   - Data usage: results may be included in project documentation (anonymized — no name, employer, or identifying details)
   - Right to withdraw: "You can stop at any time, for any reason. Your data will be deleted if you withdraw."
   - No deception: "There are no hidden tasks or trick questions. The docs may have real gaps — that's what we're trying to find."
   - Compensation: state clearly whether the subject is compensated and how (if applicable)

3. **Record consent**: Written acknowledgment (email, chat message, or signed form). Verbal consent alone is insufficient.

### 10.2 During the experiment

- The subject is never penalized for asking questions, getting stuck, or not finishing
- The Conductor does not express disappointment, frustration, or judgment about the subject's performance
- If the subject becomes visibly frustrated or distressed, the Conductor offers a break or reminds them they can stop

### 10.3 After the experiment

- Results are anonymized: subject is referred to by a code (e.g., "Subject H-1"), not by name
- Raw screen recordings and audio are stored securely and not published
- The subject may request their data be deleted after the experiment
- If results are shared publicly (e.g., in a blog post or README), the subject is offered a preview before publication

---

## 11. Artifacts

All under `docs/experiment-results/EXP-03-*`.

| Artifact | File | Content |
|----------|------|---------|
| Summary | `EXP-03-summary.md` | Verdict + metrics + conclusion |
| Friction Log | `EXP-03-friction-log.md` | Timestamped events, each classified by taxonomy |
| Question Log | `EXP-03-question-log.md` | Every question, answer, HIR flag |
| Transcript | `EXP-03-transcript.md` | Conductor↔Subject chat log |
| Server Log | `EXP-03-server-log.txt` | Raw HTTP request/response during experiment |
| Subject's Code | `EXP-03-subject-code/` | Code the subject wrote (with consent) |
| Debrief Notes | `EXP-03-debrief.md` | Post-experiment interview notes |
| Contamination Check | `EXP-03-contamination-check.md` | Screen/shell/browser audit results, violations found (if any), VOID/CLEAN verdict |
| Screening Record | `EXP-03-screening.md` | Eligibility verification (anonymized) |
| Consent Record | (not published) | Stored securely, not in repository |

---

## 12. Comparison with Prior Experiments

| Dimension | EXP-01 | EXP-02 | EXP-03 |
|-----------|--------|--------|--------|
| Subject | Claude (same model) | MiniMax-M2.7 (different AI) | Human developer |
| Direction | Send only | Bidirectional | Bidirectional |
| Materials | SKILL.md + prompt | SKILL.md + TRANSPORT.md + prompt | SKILL.md + TRANSPORT.md + prompt |
| Source code access | Implicit | None | None |
| AI assistance allowed | N/A | N/A | No |
| Time limit | None | None | 60 minutes |
| Bias controls | None | Formal (isolation, contamination check) | Formal (screening, consent, no-hint protocol) |
| Observation | Server logs only | Transcript + server logs + tool call log | Screen recording + think-aloud + server logs + debrief |
| Ethics | N/A (AI subject) | N/A (AI subject) | Informed consent required |
| Conclusion scope | Technical reachability | Conditional evidence for AI cold start | Human developer cold-start feasibility |

---

## 13. Install Path Verification Protocol

As of 2026-03-21, the install path has been converged to a single official route. EXP-03 subjects should follow `docs/distribution/quick-trial.md` from zero. The install steps are now:

1. `npx @chorus-protocol/skill init --target openclaw`
2. `npx @chorus-protocol/skill verify --target openclaw`
3. Envelope test (prompt agent + `verify --envelope`)

**What to record during install steps:**

| Observation | Record |
|-------------|--------|
| One-shot success? | Did install + verify pass on first attempt without errors? |
| Where stuck? | Which step produced confusion or error? |
| Needed human explanation? | Did the subject need clarification beyond the docs? |
| Error message actionable? | If CLI errored, did the subject know what to do next? |

**Gate condition**: Do not declare "install path fixed" until at least 2 subjects complete steps 1-3 without Conductor intervention on the install portion. The envelope test (step 3) may still require iteration — that tests the protocol, not the install path.
