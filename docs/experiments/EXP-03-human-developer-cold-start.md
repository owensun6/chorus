# EXP-03: Human Developer Cold-Start Integration

2026-03-21 (original) | 2026-03-31 (updated for current architecture) | Status: READY TO EXECUTE

---

## 1. Objective

Validate whether a human developer with no prior Chorus exposure can go from `npx @chorus-protocol/skill init` to a **human-visible Telegram message** using only the published npm package, public documentation, and the public alpha hub.

EXP-02 proved a non-Claude AI could do cold-start from raw docs. E-03-01 proved the infrastructure path (install → credentials → bridge activation) works on a clean machine. EXP-03 asks: can a human, starting from nothing, reach a Telegram-visible message by following the installed docs?

This is a documentation and install path usability test. It is not a market validation, product-market fit study, or user experience research.

### Architecture context (v0.8.0-alpha.1)

The current Chorus architecture uses **SSE-based inbox delivery** through OpenClaw Gateway:

```
npx init → bridge installed → register on Hub → save credentials
→ Gateway restart → bridge activates (SSE) → Hub delivers message
→ bridge routes to agent → agent replies → Telegram delivery
```

The subject does NOT need to:
- Write an HTTP server
- Use ngrok or expose any endpoint
- Write any code at all

The test measures whether the **configuration sequence** is discoverable from the installed docs.

---

## 2. Subject Definition

### Inclusion criteria

All of the following MUST be true:

| # | Criterion | Verification |
|---|-----------|-------------|
| I-1 | Has never seen, read, or heard about Chorus protocol or this project | Pre-experiment interview (see Section 10.1) |
| I-2 | Can use a command-line terminal (cd, curl, npm/npx) | Self-reported + verified during screening |
| I-3 | Has OpenClaw installed and working with at least one Telegram bot configured | Verified by Conductor before experiment |
| I-4 | Understands HTTP basics (request/response, status codes, JSON bodies) | Screening question: "What does a 201 status code mean?" |
| I-5 | Can read and edit JSON files | Self-reported |

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
| Familiarity with OpenClaw | Daily / Weekly / Occasional |
| OpenClaw version | 2026.3.xx |
| Telegram bot(s) configured | @bot_name |
| Recruited via | Personal network / Online posting / etc. |

---

## 3. Materials

The subject receives exactly these materials and nothing else:

| # | Material | Delivery | Content |
|---|----------|----------|---------|
| M-1 | Task prompt | Text message (email, chat, or in-person) | See Section 5 |
| M-2 | Hub URL | In task prompt | `https://agchorus.com` |

**Note**: No API key is pre-provided. The subject must discover the self-registration flow from the installed docs and obtain their own `api_key` via `POST /register`.

### What the subject discovers themselves

- SKILL.md, PROTOCOL.md, TRANSPORT.md, examples/ — installed by `npx @chorus-protocol/skill init --target openclaw`
- envelope.schema.json — installed alongside SKILL.md
- Bridge runtime files at `~/.openclaw/extensions/chorus-bridge/`
- The project name "Chorus" — visible in the installed docs
- Self-registration endpoint and credential format — documented in SKILL.md
- Credential file path — documented in SKILL.md

### Explicitly NOT provided

- Source code, repository URL, or any implementation files
- Direct links to documentation beyond the npm package
- API key (subject must self-register)
- Hints about credential file format, path, or Gateway restart
- Any AI assistance (ChatGPT, Claude, Copilot) — see Section 3.1

### 3.1 External resource policy

| Resource | Allowed | Reason |
|----------|---------|--------|
| OpenClaw documentation | Yes | General tooling reference, not Chorus-specific |
| Language documentation (Python docs, MDN, Go docs) | Yes | General programming reference |
| Stack Overflow for general syntax | Yes | Not a Chorus question |
| AI assistants (ChatGPT, Claude, Copilot, etc.) | No | An AI interpreting Chorus docs is a confound — it would replay EXP-02, not test human comprehension |
| Google/search for "Chorus protocol" | No | Would surface this project if public; banned to maintain isolation |
| Asking other people for help | No | Third-party knowledge transfer = contamination |

The subject is informed of this policy before the experiment begins (Section 5, task prompt). Violations are detected via the mandatory audit trail (Section 3.3).

### 3.2 Hub provisioning

The public alpha hub is running at `https://agchorus.com`.

**Before the experiment, the Conductor must:**

1. Verify the hub is healthy: `curl -s https://agchorus.com/health | jq .`
2. Ensure at least one Conductor agent is registered and online (e.g., `xiaoyin@chorus`) with an active SSE inbox
3. Verify the Conductor agent can receive and respond to messages (test with a self-send)
4. Confirm the Console is accessible at `https://agchorus.com/console`

**No endpoint reachability check needed**: The subject's bridge uses SSE to pull messages from the Hub. The subject does not need to expose any port.

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
- When the subject switches between docs and terminal
- Visible confusion, backtracking, or re-reading
- Moments of apparent misunderstanding
- Points where the subject considers giving up
- Time spent on: npm install vs. reading docs vs. Hub registration vs. credential config vs. Gateway restart

---

## 5. Task

The task prompt sent to the subject:

> **Goal**: Add cross-agent messaging to your OpenClaw setup. A protocol called Chorus lets agents talk to each other across language and chat-app boundaries.
>
> **Setup (do this first):**
>
> ```bash
> npx @chorus-protocol/skill@0.8.0-alpha.1 init --target openclaw
> ```
>
> This installs documentation and a bridge runtime into your OpenClaw. Read the installed files (especially SKILL.md) — they describe how to connect your agent to a messaging network.
>
> **Hub URL**: `https://agchorus.com`
>
> **Complete these steps:**
>
> 1. **Install and verify** — run the init command above, then verify the installation is complete.
>
> 2. **Register your agent** on the hub and save your credentials so the bridge can activate. The installed docs tell you how.
>
> 3. **Activate the bridge** — get the bridge to connect to the hub. You'll know it's working when your agent appears as "online" on the hub.
>
> 4. **Receive a message** — once your bridge is active, a message will be sent to your agent through the hub. Confirm you can see the response on Telegram.
>
> 5. **Report** what was confusing and what the docs got wrong or left out.
>
> **Rules:**
> - Work only from the installed documents. Do not search online for information about this specific protocol.
> - Do not use AI assistants (ChatGPT, Claude, Copilot, etc.) to interpret the documents.
> - You may use OpenClaw documentation and standard programming references.
> - There is no pass/fail for you — this is testing the documentation, not your ability. If you get stuck, say what's blocking you.
> - Time limit: 60 minutes. If you haven't finished, that's a valid and useful result.
>
> If you have questions about the protocol, ask me — but I can only say "That information is in the docs" or log your question as a gap in the documentation.

### Step 4 mechanics

After the subject's bridge shows "online" on the Hub (Conductor monitors via `/discover` or Console), the Conductor sends a test message:

```bash
curl -s -X POST https://agchorus.com/messages \
  -H "Authorization: Bearer {CONDUCTOR_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: exp03-$(date +%s)" \
  -d '{
    "receiver_id": "{SUBJECT_AGENT_ID}",
    "envelope": {
      "chorus_version": "0.4",
      "sender_id": "xiaoyin@chorus",
      "original_text": "周末我们组织了一次团建，去了郊外烧烤，大家玩得很开心。",
      "sender_culture": "zh-CN",
      "cultural_context": "团建是中国企业文化中常见的团队活动，通常由公司组织，目的是增进同事间的关系。烧烤是一种轻松的户外社交方式。"
    }
  }'
```

The Conductor copies `{SUBJECT_AGENT_ID}` from the subject's registration step (visible on Console or `/discover`). The envelope content above is fixed for all runs — do not improvise.

**Human visibility verification**: After the Hub delivers the message and the subject's agent processes it, the Conductor asks: "Can you check your Telegram bot? Do you see a new message?" The subject confirms verbally and shows their Telegram screen. The Conductor timestamps the confirmation.

### Console observation (Conductor only)

During the experiment, the Conductor can monitor the subject's activity in real time at:

```
https://agchorus.com/console
```

This shows agent registrations, online status, message delivery, and trace IDs. The Conductor does NOT share this URL with the subject.

---

## 6. Success Metrics

| Metric | ID | Definition | Measurement |
|--------|----|-----------|-------------|
| Time to Install Complete | TTIC | T₀ → `npx verify` passes (installation integrity, not activation) | Conductor timestamps |
| Time to Bridge Active | TTBA | T₀ → agent appears online on Hub | Console observation |
| Time to Telegram Visible | TTTV | T₀ → subject confirms message visible on Telegram | Conductor timestamps + subject screen |
| Question Count | QC | Times subject asked for clarification | Chat log count |
| Documentation Defect Count | DDC | Issues where docs were missing, ambiguous, or wrong | Friction log categorization |
| Human Intervention Required | HIR | Did Conductor provide info beyond defined materials | Chat log analysis |
| Install One-Shot | IOS | Did `npx init + verify` pass on first attempt? | Screen recording |
| Registration One-Shot | ROS | Did Hub registration succeed on first attempt? | Hub logs |
| Credential Config One-Shot | COS | Did subject save credentials correctly on first attempt? | Gateway log (bridge activation vs. errors) |
| Gateway Restart Method | GRM | How did subject restart Gateway? (launchctl / kill+restart / app restart / other) | Screen recording |
| Give-Up Point | GUP | If subject did not finish: which step and what blocker | Screen recording + debrief |

### Hard success criteria

| # | Criterion | Required for |
|---|-----------|-------------|
| C-1 | Subject runs `npx init` and verify reports installation integrity PASS | PASS |
| C-2 | Subject registers an agent on the Hub (self-registration, no pre-provided key) | PASS |
| C-3 | Subject saves credentials to the correct path so bridge can find them | PASS |
| C-4 | Bridge activates: subject's agent appears online on Hub | PASS |
| C-5 | Message delivered through Hub → bridge → agent → **visible on Telegram** (subject confirms) | PASS |
| C-6 | QC ≤ 3 | PASS |
| C-7 | HIR = false | PASS |
| C-8 | No prior Chorus exposure verified (pre-experiment screening passed) | PASS (violation → VOID) |
| C-9 | TTTV ≤ 60 min | PASS |

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

### Expected friction points (hypotheses to validate)

These are predicted stumbling blocks based on E-03-01. Record whether each actually occurs:

| # | Predicted friction | Category if confirmed |
|---|-------------------|----------------------|
| F-1 | Subject doesn't know where to save credentials (path not obvious in SKILL.md) | DOC |
| F-2 | Subject doesn't know how to restart Gateway after saving credentials | DOC |
| F-3 | Subject tries to use the Hub API key format but gets the credential JSON wrong | DOC |
| F-4 | Subject doesn't realize `verify` will fail until credentials are saved (standby ≠ broken) | DOC |
| F-5 | Subject registers with wrong `agent_id` format (not `name@host`) | DOC |
| F-6 | Subject saves credentials but bridge doesn't activate (Gateway needs restart) | DOC / IMPL |

---

## 7. Failure Taxonomy

Every friction event gets one **primary** tag and an optional **secondary** tag:

| Category | Code | Definition | Implies |
|----------|------|-----------|---------|
| Documentation Defect | DOC | Installed docs are missing, ambiguous, incorrect, or contradictory | Fix the docs |
| Implementation Defect | IMPL | Hub, CLI, or bridge behaves differently from docs | Fix the code |
| Install Defect | INST | npm install, verify, or file placement fails | Fix the CLI |
| Environment Issue | ENV | Network, OpenClaw version, Telegram config, unrelated to Chorus | Discard from analysis |
| Subject Capability | SUBJ | Subject misread clear documentation or lacked prerequisite skill | Log for context; does not reflect on protocol |

### Classification guidance

- Subject skims SKILL.md and misses credential path → `SUBJ` (but if multiple humans miss it → reconsider as `DOC`)
- Subject doesn't know how to restart OpenClaw Gateway → `ENV` (OpenClaw knowledge, not Chorus) unless SKILL.md should mention it → `DOC`
- Subject brings preconception from another protocol (e.g., assumes OAuth is needed) → `SUBJ / DOC` if the docs could have preempted the assumption
- Subject registers but uses wrong `agent_id` format → `DOC` if format rules are unclear in SKILL.md
- npm install fails due to network or permission → `ENV`
- npm install succeeds but verify fails due to our bug → `INST`
- Bridge activates but message doesn't appear on Telegram → `IMPL` if bridge or delivery is broken; `ENV` if Telegram bot is misconfigured

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
- Debug the subject's configuration, even if asked directly
- Show or mention the console URL
- Mention the credential file path, Gateway restart method, or any configuration detail
- Confirm whether `verify` reporting "standby" means success or failure

### 8.3 Conductor MAY

- Confirm hub is running: "yes, the hub is up"
- Trigger Step 4 inbound message (per Section 5 mechanics)
- Confirm experiment completion: "message visible on Telegram, confirmed"
- Answer meta-questions: "how much time is left?", "can I use Python?"
- Remind of rules if subject starts using AI assistant: "per the rules, please don't use AI tools"
- Acknowledge frustration neutrally: "I understand, take your time"

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
- "Was it clear how to go from 'installed' to 'working'?"
- "Did you understand the difference between the skill (docs) and the bridge (runtime)?"

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
| "A human developer completed cold-start to Telegram-visible message in X min with Y questions" | PASS or CONDITIONAL PASS |
| "npm install + bridge activation path works end-to-end for a cold-start human developer" | C-1 through C-5 met |
| "Documentation has N defects that blocked a human developer" | DDC > 0 |
| "Published Chorus docs are sufficient for unassisted human cold start to Telegram delivery" | PASS with HIR=false |
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
| Hub Activity Log | `EXP-03-hub-activity.json` | Activity events from hub during experiment window |
| Gateway Log | `EXP-03-gateway-log.txt` | Subject's Gateway log during experiment (bridge activation, delivery events) |
| Debrief Notes | `EXP-03-debrief.md` | Post-experiment interview notes |
| Contamination Check | `EXP-03-contamination-check.md` | Screen/shell/browser audit results, violations found (if any), VOID/CLEAN verdict |
| Screening Record | `EXP-03-screening.md` | Eligibility verification (anonymized) |
| Consent Record | (not published) | Stored securely, not in repository |

---

## 12. Comparison with Prior Experiments

| Dimension | EXP-01 | EXP-02 | E-03-01 | EXP-03 |
|-----------|--------|--------|---------|--------|
| Subject | Claude (same model) | MiniMax-M2.7 (different AI) | Infrastructure (no human) | Human developer |
| Direction | Send only | Bidirectional | N/A (activation only) | Inbound → Telegram visible |
| Materials | SKILL.md + prompt | SKILL.md + TRANSPORT.md + prompt | npm package + manual SSH | npm package + Hub URL only |
| Source code access | Implicit | None | None (XDISK disconnected) | None |
| AI assistance allowed | N/A | N/A | N/A | No |
| Hub | Local | Local | agchorus.com | agchorus.com |
| Install method | Manual file | Manual file | `npx init` (local pack) | `npx init` (published npm) |
| Subject endpoint needed | N/A | Yes (HTTP server) | No (SSE) | No (SSE) |
| OpenClaw prerequisite | N/A | N/A | Yes | Yes (+ Telegram bot) |
| Time limit | None | None | None | 60 minutes |
| Bias controls | None | Formal | None | Formal (screening, consent, no-hint) |
| Observation | Server logs only | Transcript + tool call log | Gateway log | Screen recording + think-aloud + Hub console + Gateway log + debrief |
| Ethics | N/A (AI) | N/A (AI) | N/A (infra test) | Informed consent required |
| Conclusion scope | Technical reachability | AI cold start feasibility | Infrastructure path works | Human developer cold-start to Telegram-visible message |

---

## 13. Conductor Pre-Flight Checklist

Execute before each experiment run. All items must pass.

### 13.1 Version gate (BLOCKING)

```
[ ] npm version check: npm view @chorus-protocol/skill version shows 0.8.0-alpha.1
[ ] Install test: npx @chorus-protocol/skill@0.8.0-alpha.1 --help runs without error
```

### 13.2 Hub and infrastructure

```
[ ] Hub health: curl -s https://agchorus.com/health | jq .status shows "ok"
[ ] Conductor agent online: curl -s https://agchorus.com/discover | jq shows xiaoyin@chorus online
[ ] Conductor agent can receive: send self-test message, verify delivered_sse
[ ] Console accessible: https://agchorus.com/console loads in browser
```

### 13.3 Install path smoke test

```
[ ] From a clean OpenClaw environment (no prior Chorus state):
    npx @chorus-protocol/skill@0.8.0-alpha.1 init --target openclaw
    npx @chorus-protocol/skill verify --target openclaw
    Init exits 0, verify reports installation integrity PASS (activation may be standby — that's expected)
[ ] Verify installed SKILL.md contains registration instructions and credential path
[ ] Verify ~/.openclaw/extensions/chorus-bridge/runtime/ has 9 modules
```

### 13.4 Subject environment pre-check

```
[ ] Subject's OpenClaw is working (can start Gateway, Telegram bot responds)
[ ] Subject has Node.js and npm/npx available
[ ] Subject's machine can reach agchorus.com (curl health check from their machine)
[ ] No prior Chorus files exist on subject's machine:
    ls ~/.chorus/ ~/.openclaw/skills/chorus/ ~/.openclaw/extensions/chorus-bridge/ 2>/dev/null
    (all should be "No such file or directory")
```

### 13.5 Session logistics

```
[ ] Screen recording software is ready
[ ] Subject has been screened (Section 10.1) and consent is recorded
[ ] Timer is ready (60 min countdown)
[ ] Conductor has https://agchorus.com/console open in a separate browser tab
[ ] Conductor has the curl command from Section 5 "Step 4 mechanics" prepared with their API key
```

---

## 14. Result-Driven Action Protocol

### If PASS

- Record as evidence: `pipeline/bridge-v2-validation/evidence/EXP-03-{run-id}.md`
- Update monitor: EXP-03 = PASS
- Chorus enters "externally accessible, human-verified" status
- Documentation is sufficient for the tested subject profile

### If CONDITIONAL PASS

- Same as PASS, but note QC/HIR exceedances
- Document which questions were asked → prioritize DOC fixes
- Retest after doc fixes (new subject, same protocol)

### If INCOMPLETE or FAIL

- Record GUP (give-up point) with maximum detail
- Categorize every friction event by taxonomy (Section 7)
- Fix docs/install at each failure point:
  - DOC → update SKILL.md, TRANSPORT.md, or installed docs
  - INST → fix CLI (new npm publish required)
  - IMPL → fix bridge or Hub (code change)
- Retest with a new subject after fixes
- Do NOT retest the same subject (contaminated by first attempt)

### Iteration cap

Maximum 3 subjects. If EXP-03 cannot PASS after 3 runs with fixes between each:
- Escalate to Commander: fundamental usability problem, not a doc fix
- Consider whether the configuration sequence itself is too complex
