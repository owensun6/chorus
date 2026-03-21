# EXP-03: Human Developer Cold-Start Integration

2026-03-21 | Status: READY TO EXECUTE

---

## 1. Objective

Validate whether a human developer with no prior Chorus exposure can complete a full bidirectional integration using the published npm package and the public alpha hub.

EXP-02 proved a non-Claude AI could do this from raw docs. EXP-03 asks: can a human, starting from `npx @chorus-protocol/skill init`, reach bidirectional message delivery through `https://chorus-alpha.fly.dev`?

This is a documentation and install path usability test. It is not a market validation, product-market fit study, or user experience research.

---

## 2. Subject Definition

### Inclusion criteria

All of the following MUST be true:

| # | Criterion | Verification |
|---|-----------|-------------|
| I-1 | Has never seen, read, or heard about Chorus protocol or this project | Pre-experiment interview (see Section 10.1) |
| I-2 | Can use a command-line terminal (cd, curl, npm/npx) | Self-reported + verified during screening |
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
| M-1 | Task prompt | Text message (email, chat, or in-person) | See Section 5 |
| M-2 | API key | In task prompt | A valid Bearer token for the public hub |
| M-3 | Hub URL | In task prompt | `https://chorus-alpha.fly.dev` |

### What the subject discovers themselves

- SKILL.md, PROTOCOL.md, TRANSPORT.md, examples/ — installed by `npx @chorus-protocol/skill init`
- envelope.schema.json — installed alongside SKILL.md
- The project name "Chorus" — visible in the installed docs

### Explicitly NOT provided

- Source code, repository URL, or any implementation files
- Direct links to documentation beyond the npm package
- Hints about language choice, architecture, or implementation approach
- Any AI assistance (ChatGPT, Claude, Copilot) — see Section 3.1

### 3.1 External resource policy

| Resource | Allowed | Reason |
|----------|---------|--------|
| Language documentation (Python docs, MDN, Go docs) | Yes | General programming reference, not Chorus-specific |
| Stack Overflow for language-specific syntax | Yes | "How to start HTTP server in Python" is not a Chorus question |
| ngrok / tunneling tool documentation | Yes | Tooling for exposing local ports is general knowledge |
| AI assistants (ChatGPT, Claude, Copilot, etc.) | No | An AI interpreting Chorus docs is a confound — it would replay EXP-02, not test human comprehension |
| Google/search for "Chorus protocol" | No | Would surface this project if it were public; banned to maintain isolation |
| Asking other people for help | No | Third-party knowledge transfer = contamination |

The subject is informed of this policy before the experiment begins (Section 5, task prompt). Violations are detected via the mandatory audit trail (Section 3.3).

### 3.2 Hub provisioning

The public alpha hub is already running at `https://chorus-alpha.fly.dev`. No server setup is needed by the Conductor.

**Before the experiment, the Conductor must:**

1. Verify the hub is healthy: `curl -s https://chorus-alpha.fly.dev/health | jq .`
2. Ensure at least one demo agent is registered (e.g., `agent-zh@conductor`) that has a live receive endpoint
3. Prepare a valid API key for the subject
4. Verify the Conductor's own agent endpoint is reachable from the hub (test with a self-send)

**Subject endpoint reachability:**

The subject's receive endpoint must be reachable from `chorus-alpha.fly.dev` (Fly.io, sjc region). Options:

| Method | Difficulty | Notes |
|--------|-----------|-------|
| ngrok / Cloudflare Tunnel | Low | Subject runs `ngrok http 3006`, gives the URL as endpoint |
| Cloud VM / VPS | Medium | Subject deploys to a server with a public IP |
| Cloud function (Lambda, Cloud Run) | Medium | Serverless endpoint |

The task prompt mentions ngrok as a hint. If the subject asks "how do I make my local server reachable?", the Conductor MAY say "You'll need a tunneling tool like ngrok" — this is general networking, not Chorus-specific.

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
- Time spent on npm install vs. reading docs vs. writing code

---

## 5. Task

The task prompt sent to the subject:

> **Setup (do this first):**
>
> ```bash
> npx @chorus-protocol/skill init --target openclaw
> ```
>
> This installs documentation files for a protocol called Chorus. Read the installed files (especially SKILL.md and TRANSPORT.md) — they describe how agents communicate with each other.
>
> **Your hub and API key:**
>
> - Hub URL: `https://chorus-alpha.fly.dev`
> - API key: `{API_KEY}`
> - There is already a registered agent called `agent-zh@conductor` that speaks Chinese.
>
> **Complete these steps using any programming language you prefer:**
>
> 1. **Register** your agent with the hub. Choose your own agent ID (must be `name@host` format), declare your culture and languages, and provide a publicly reachable HTTP endpoint where you can receive messages. You must actually start a server on that endpoint. (Hint: if you're developing locally, you'll need a tool like ngrok to make your local server reachable from the internet.)
>
> 2. **Send a message** to `agent-zh@conductor`. The message should be in your preferred language.
>
> 3. **Receive a message** at your registered endpoint. After you confirm your endpoint is running and registered, a message will be sent to your agent. Your endpoint must accept the incoming message format and return the correct response per the protocol.
>
> 4. **Report** what you built, what was confusing, and what the docs got wrong or left out.
>
> **Rules:**
> - Work only from the installed documents and the running hub. Do not search online for information about this specific protocol.
> - Do not use AI assistants (ChatGPT, Claude, Copilot, etc.) to interpret the documents or write your code.
> - You may use standard programming references (language docs, Stack Overflow for general syntax questions, ngrok docs).
> - There is no pass/fail for you — this is testing the documentation, not your ability. If you get stuck, say what's blocking you.
> - Time limit: 60 minutes. If you haven't finished, that's a valid and useful result.
>
> If you have questions about the protocol, ask me — but I can only say "That information is in the docs" or log your question as a gap in the documentation.

### Step 3 mechanics

After the subject confirms their receive endpoint is running and registered, the Conductor triggers the inbound message:

```bash
curl -s -X POST https://chorus-alpha.fly.dev/messages \
  -H "Authorization: Bearer {CONDUCTOR_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "receiver_id": "{SUBJECT_AGENT_ID}",
    "envelope": {
      "chorus_version": "0.4",
      "sender_id": "agent-zh@conductor",
      "original_text": "周末我们组织了一次团建，去了郊外烧烤，大家玩得很开心。",
      "sender_culture": "zh-CN",
      "cultural_context": "团建是中国企业文化中常见的团队活动，通常由公司组织，目的是增进同事间的关系。烧烤是一种轻松的户外社交方式。"
    }
  }'
```

The Conductor copies `{SUBJECT_AGENT_ID}` from the subject's registration step. The envelope content above is fixed for all runs — do not improvise.

### Console observation (Conductor only)

During the experiment, the Conductor can monitor the subject's activity in real time at:

```
https://chorus-alpha.fly.dev/console
```

This shows agent registrations, message chains (submitted → forwarded → delivered/failed), and trace IDs. The Conductor does NOT share this URL with the subject.

---

## 6. Success Metrics

| Metric | ID | Definition | Measurement |
|--------|----|-----------|-------------|
| Time to Install Complete | TTIC | T₀ → `npx verify` passes | Conductor timestamps |
| Time to First Message | TTFM | T₀ → first `delivery: "delivered"` | Hub console / activity log |
| Total Completion Time | TCT | T₀ → bidirectional round-trip confirmed | Conductor timestamps |
| Question Count | QC | Times subject asked for clarification | Chat log count |
| Documentation Defect Count | DDC | Issues where docs were missing, ambiguous, or wrong | Friction log categorization |
| Human Intervention Required | HIR | Did Conductor provide info beyond defined materials | Chat log analysis |
| Bidirectional Complete | BDC | Both send AND receive succeeded | Hub activity log |
| Envelope Validity Rate | EVR | Valid attempts / total attempts on POST /messages | Hub activity log |
| Retry Count | RC | Total attempts before first success (install + register + send + receive) | Hub logs + screen recording |
| Give-Up Point | GUP | If subject did not finish: which step and what blocker | Screen recording + debrief |
| Install One-Shot | IOS | Did `npx init + verify` pass on first attempt? | Screen recording |

### Hard success criteria

| # | Criterion | Required for |
|---|-----------|-------------|
| C-1 | Subject installs via npm and verify passes | PASS |
| C-2 | Subject registers successfully with the public hub | PASS |
| C-3 | Subject sends a message delivered to demo agent | PASS |
| C-4 | Subject's endpoint accepts inbound envelope AND produces evidence of envelope parsing (log output, structured response, or adapted rendering) | PASS |
| C-5 | BDC = true | PASS |
| C-6 | QC ≤ 3 | PASS |
| C-7 | HIR = false | PASS |
| C-8 | No prior Chorus exposure verified (pre-experiment screening passed) | PASS (violation → VOID) |
| C-9 | TCT ≤ 60 min | PASS |

| Outcome | Condition |
|---------|-----------|
| PASS | C-1 through C-9 all met |
| CONDITIONAL PASS | C-1 through C-5, C-8, C-9 met; C-6 or C-7 exceeded |
| INCOMPLETE | 60 minutes elapsed and C-1 through C-5 are not all met. Records GUP (give-up point) for analysis |
| FAIL | Subject explicitly gives up before 60 minutes, stating they cannot proceed. At least one of C-1 through C-5 not met |
| VOID | C-8 violated (prior exposure discovered) or external resource policy violated (see Section 3.1) |

### Verdict decision tree

```
Time runs out (60 min)?
  ├── Yes → Are C-1 through C-5 all met?
  │     ├── Yes → Check C-6, C-7 → PASS or CONDITIONAL PASS
  │     └── No  → INCOMPLETE (record GUP)
  └── No  → Subject gives up?
        ├── Yes → FAIL (record blocker)
        └── No  → Are C-1 through C-5 all met?
              ├── Yes → Check C-6, C-7 → PASS or CONDITIONAL PASS
              └── No  → (continue, not yet decided)
```

INCOMPLETE is not a judgment on the subject — it means the docs require more than 60 minutes for this subject's profile. FAIL means the subject concluded the task was impossible, which is a stronger signal about doc quality.

---

## 7. Failure Taxonomy

Same as EXP-02. Every friction event gets one **primary** tag and an optional **secondary** tag:

| Category | Code | Definition | Implies |
|----------|------|-----------|---------|
| Documentation Defect | DOC | Installed docs are missing, ambiguous, incorrect, or contradictory | Fix the docs |
| Implementation Defect | IMPL | Hub or CLI behaves differently from docs | Fix the code |
| Install Defect | INST | npm install, verify, or file placement fails | Fix the CLI |
| Environment Issue | ENV | Network, tooling, ngrok, port conflicts, unrelated to protocol | Discard from analysis |
| Subject Capability | SUBJ | Subject misread clear documentation or lacked prerequisite skill | Log for context; does not reflect on protocol |

### Human-specific classification guidance

- Subject skims a section and misses a detail that is clearly stated → `SUBJ` (but note: if multiple humans miss it, reconsider as `DOC`)
- Subject brings preconception from another protocol (e.g., assumes OAuth is needed) → `SUBJ / DOC` if the docs could have preempted the assumption
- Subject cannot write an HTTP server in their chosen language → `SUBJ` (prerequisite gap, not doc gap)
- Subject finds the doc structure confusing (e.g., reads Section 6 before Section 4) → `DOC` if the doc structure actively misleads
- npm install fails due to network or permission → `ENV`
- npm install succeeds but verify fails due to our bug → `INST`
- Subject struggles to make local endpoint reachable from internet → `ENV` (but if docs don't mention this need, also `DOC`)

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
- Show or mention the console URL

### 8.3 Conductor MAY

- Confirm hub is running: "yes, the hub is up"
- Trigger Step 3 inbound message (per Section 5 mechanics)
- Confirm experiment completion: "bidirectional round-trip verified"
- Answer meta-questions: "how much time is left?", "can I use Python?"
- Remind of rules if subject starts using AI assistant: "per the rules, please don't use AI tools"
- Acknowledge frustration neutrally: "I understand, take your time"
- Confirm ngrok is an acceptable tool if asked: "yes, ngrok is fine to use"

### 8.4 Question handling

When the subject asks for help:

1. Log the question verbatim with timestamp
2. Is the answer in the installed docs (SKILL.md, TRANSPORT.md, PROTOCOL.md)?
   - **Yes** → "That information is in the docs that were installed."
   - **No** → Log as DOC defect. Provide minimal factual answer. Mark HIR=true.
3. Increment QC

### 8.5 Post-experiment debrief

After the experiment (regardless of outcome), conduct a brief unstructured debrief:

- "What was the hardest part?"
- "Was there a point where you almost gave up? What was blocking you?"
- "How was the npm install experience?"
- "Were the installed docs sufficient, or did you wish you had more?"
- "If you could change one thing about the docs, what would it be?"
- "Did anything in the docs actively mislead you?"

Record answers verbatim. These are subjective but valuable for prioritizing doc improvements.

---

## 9. Conclusion Boundaries

### MUST NOT claim

| Prohibited claim | Why |
|-----------------|-----|
| "Developers will adopt Chorus" | One developer completing a task ≠ adoption intent |
| "Protocol is production-ready" | N=1 cold start ≠ production |
| "Documentation is complete" | One developer finding it sufficient ≠ universally sufficient |
| "Result generalizes to all developer levels" | One subject at one experience level ≠ population |
| "Market demand exists" | Feasibility ≠ demand |
| "Non-technical users can adopt" | Developer test ≠ non-technical user test |

### MAY claim

| Permitted claim | Condition |
|----------------|-----------|
| "A human developer completed cold-start integration in X min with Y questions" | PASS or CONDITIONAL PASS |
| "npm install path works end-to-end for a cold-start human developer" | C-1 met (install + verify on first or second attempt) |
| "Documentation has N defects that blocked a human developer" | DDC > 0 |
| "Bidirectional integration via public hub is achievable by a human developer using only the npm package and standard programming references" | PASS with HIR=false |
| "Published Chorus docs are insufficient for unassisted human cold start" | FAIL or INCOMPLETE |
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
| Hub Activity Log | `EXP-03-hub-activity.json` | Activity events from hub `/activity` during experiment window |
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
| Materials | SKILL.md + prompt | SKILL.md + TRANSPORT.md + prompt | npm install + hub URL + API key |
| Source code access | Implicit | None | None |
| AI assistance allowed | N/A | N/A | No |
| Server | Local (same machine) | Local (same machine) | Public hub (chorus-alpha.fly.dev) |
| Install method | Manual file | Manual file | `npx @chorus-protocol/skill init` |
| Time limit | None | None | 60 minutes |
| Bias controls | None | Formal (isolation, contamination check) | Formal (screening, consent, no-hint protocol) |
| Observation | Server logs only | Transcript + server logs + tool call log | Screen recording + think-aloud + hub activity + console + debrief |
| Ethics | N/A (AI subject) | N/A (AI subject) | Informed consent required |
| Conclusion scope | Technical reachability | Conditional evidence for AI cold start | Human developer cold-start feasibility via npm + public hub |

---

## 13. Conductor Pre-Flight Checklist

Execute before each experiment run. All items must pass.

### 13.1 Version gate (BLOCKING)

```
[ ] npm version check: npx @chorus-protocol/skill --help shows version ≥ 0.5.0
    (version 0.5.0 contains CLI hardening: register-before-write rollback,
     target validation in verify, help path convergence)
[ ] If version is stale: npm cache clean --force, then re-check
```

**EXP-03 MUST NOT execute until the CLI fix (commit df2d69d) is published to npm.** Running the experiment on the old CLI risks a subject hitting the orphan-file bug (init writes files then fails registration, blocking retry).

### 13.2 Hub and infrastructure

```
[ ] Hub health check passes: curl https://chorus-alpha.fly.dev/health
[ ] Demo agent (agent-zh@conductor) is registered and its endpoint is reachable
[ ] Subject's API key is valid (test with a POST /agents, then DELETE cleanup)
[ ] Console is accessible at /console (Conductor-side monitoring)
[ ] Activity stream is working at /activity (verify events appear after test POST)
```

### 13.3 Install path smoke test

```
[ ] From a clean temp directory (no prior state):
    npx @chorus-protocol/skill init --target openclaw
    npx @chorus-protocol/skill verify --target openclaw
    Both exit 0 on first attempt
[ ] Verify installed SKILL.md references TRANSPORT.md and both are readable
```

### 13.4 Subject endpoint reachability

```
[ ] If subject will use ngrok/Cloudflare Tunnel:
    Conductor confirms tunnel tool works from subject's network to fly.dev
    (test: start tunnel, register test agent with tunnel URL, send message,
     verify hub delivers to tunnel endpoint)
[ ] If subject has a public server: verify hub can reach it (POST test)
```

This check prevents ENV failures from consuming experiment time. The Conductor MAY do this as a 5-minute pre-check with the subject before the 60-minute timer starts, framed as "let's verify your network setup works."

### 13.5 Session logistics

```
[ ] Screen recording software is ready
[ ] Subject has been screened (Section 10.1) and consent is recorded
[ ] Timer is ready (60 min countdown)
[ ] Conductor has /console open in a separate browser tab
```

### Demo agent setup

The Conductor must have a live agent registered with the hub that can receive and log incoming envelopes. Minimal setup:

```bash
# Terminal — simple echo receiver on a public endpoint
# Option A: Use the reference agent
CHORUS_ROUTER_URL=https://chorus-alpha.fly.dev \
  CHORUS_ROUTER_API_KEY={CONDUCTOR_KEY} \
  node dist/agent/index.js --culture zh-CN --port 3001

# Option B: Minimal receiver (any language)
# Just accept POST, log the envelope, return {"status":"ok"}
```

The agent must be registered as `agent-zh@conductor` so it matches the task prompt.

### CORS note

The Console (`/console`) is served from the same origin as the API (`chorus-alpha.fly.dev`), so all browser requests (EventSource to `/events`, fetch to `/activity`, `/agents`, `/health`) are same-origin. No CORS configuration is needed.
