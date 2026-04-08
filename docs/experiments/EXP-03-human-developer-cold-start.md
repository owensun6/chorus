# EXP-03: Human-Delegated Cold-Start Integration

2026-03-21 (original) | 2026-04-01 (delegated-path revision) | 2026-04-03 (alpha.9 version bump) | 2026-04-08 (alpha.10 retest revision) | Status: READY FOR CROSS-COMPUTER RETEST

---

## 0. Run Parameters

- `VERSION_UNDER_TEST`: `0.8.0-alpha.10`
- Package under test: `@chorus-protocol/skill@0.8.0-alpha.10`
- Retest blocker: CLEARED. `0.8.0-alpha.10` includes IMPL-EXP03-04 (approve no longer writes `openclaw.json`; `complete` performs deferred cleanup; restart recovery cleanup is resumable).
- Release mapping: `0.8.0-alpha.10` was published on 2026-04-08 from commit `e984c41` (tag `v0.8.0-alpha.10`). Changes since alpha.9: fixed the Telegram polling disconnect path by deferring `openclaw.json` cleanup from `approve` to `complete`, updated restart instructions to require out-of-band OpenClaw relaunch, and added resumable cleanup coverage in CLI tests.
- This experiment is valid only against published npm artifacts. Local worktree installs, scp'd bridge files, and unpublished commits invalidate the run.

---

## 1. Objective

Validate whether a human developer with no prior Chorus exposure can, by sending one natural-language instruction to their own OpenClaw agent, get from zero Chorus install to a **human-visible Telegram message** using only the published npm package, the files it installs, and the public alpha hub.

EXP-02 proved a non-Claude AI could do cold-start from raw docs. E-03-01 proved the infrastructure path (install → credentials → bridge activation) works on a clean machine. EXP-03 now asks a narrower and more realistic question: can a human, starting from nothing, delegate the setup task to their own agent and still reach a Telegram-visible Chorus message safely?

This is a delegated setup usability test. The installed docs are still under test, but they are consumed primarily by the subject's agent during execution. This experiment does **not** measure manual shell-by-shell readability for a human operator. If manual doc execution is needed, that is a separate experiment.

### Architecture context (`@chorus-protocol/skill@0.8.0-alpha.10`)

The current Chorus architecture uses **SSE-based inbox delivery** through OpenClaw Gateway. The run version must include IMPL-EXP03-03 (private Telegram sending stack removed) and restart consent gate enforcement.

The delegated activation flow is:

```text
subject sends one task
→ agent selects published npm install path
→ docs + bridge installed
→ agent reads installed SKILL.md
→ register on Hub
→ save credentials
→ if restart required: checkpoint written → explicit approval obtained → Gateway restart
→ bridge activates (SSE)
→ Hub delivers message
→ bridge routes to agent
→ agent replies via host channel
→ Telegram delivery visible to the subject
```

The subject does NOT need to:

- Write code
- Run shell commands in the happy path
- Edit JSON files in the happy path
- Read the installed docs directly in the happy path

The test measures whether the **delegated setup sequence** is discoverable and safe. It does not measure whether a human could manually execute every install/config step themselves.

---

## 2. Subject Definition

### Inclusion criteria

All of the following MUST be true:

| # | Criterion | Verification |
|---|-----------|-------------|
| I-1 | Has never seen, read, or heard about Chorus protocol or this project | Pre-experiment interview (see Section 10.1) |
| I-2 | Can use their own OpenClaw agent through its normal chat surface (Telegram/Desktop/etc.) and read replies | Live check before experiment |
| I-3 | Has OpenClaw installed and working with at least one Telegram bot configured | Verified by Conductor before experiment |
| I-4 | Can understand and answer a restart approval question about their own Gateway | Screening question with neutral wording |
| I-5 | Has authority to approve or deny changes to their OpenClaw setup on this machine | Verified during consent |

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
| M-1 | Opening instruction | Text message sent directly to the subject | See Section 5 |
| M-2 | Hub URL | In opening instruction | `https://agchorus.com` |
| M-3 | Package identifier + version under test | In opening instruction | `@chorus-protocol/skill@0.8.0-alpha.10` |

**Note**: No API key is pre-provided. The subject's agent must discover the self-registration flow from the installed docs and obtain its own `api_key` via `POST /register`.

### What the subject's agent discovers itself

- SKILL.md, PROTOCOL.md, TRANSPORT.md, examples/ — installed by `npx @chorus-protocol/skill@0.8.0-alpha.10 init --target openclaw`
- `envelope.schema.json` — installed alongside SKILL.md
- Bridge runtime files at `~/.openclaw/extensions/chorus-bridge/`
- The project name "Chorus" — visible in the installed docs
- Self-registration endpoint and credential format — documented in SKILL.md
- Credential file path — documented in SKILL.md

### Explicitly NOT provided

- Source code, repository URL, or any implementation files
- Direct links to documentation beyond the published npm package
- API key
- Hints about credential file format, path, or Gateway restart
- Any AI assistance other than the subject's own OpenClaw agent

### 3.1 External resource policy

| Resource | Allowed | Reason |
|----------|---------|--------|
| Subject's own OpenClaw agent | Yes | Primary system under test |
| OpenClaw documentation | Yes | General tooling reference, not Chorus-specific |
| Language documentation (Python docs, MDN, Go docs) | Yes | General programming reference |
| Stack Overflow for general syntax | Yes | Not a Chorus question |
| Other AI assistants (ChatGPT, Claude, Copilot, etc.) | No | Would confound the delegated setup path under test |
| Google/search for "Chorus protocol" | No | Would surface this project if public; banned to maintain isolation |
| Asking other people for help | No | Third-party knowledge transfer = contamination |

The subject is informed of this policy before the experiment begins (Section 5, task prompt). Violations are detected via the mandatory audit trail (Section 3.3).

### 3.2 Hub provisioning

The public alpha hub is running at `https://agchorus.com`.

**Before the experiment, the Conductor must:**

1. Verify the hub is healthy: `curl -s https://agchorus.com/health | jq .`
2. Ensure the chosen Conductor agent for this run is registered and online with an active SSE inbox
3. Verify the Conductor agent can receive and respond to messages (test with a self-send)
4. Confirm the Console is accessible at `https://agchorus.com/console`

**No endpoint reachability check needed**: the subject's bridge uses SSE to pull messages from the Hub. The subject does not need to expose any port.

### 3.3 Contamination audit trail (REQUIRED)

All of the following are REQUIRED for every experiment run. A run missing any of these cannot produce a verdict other than VOID.

| Evidence | Method | Audits for |
|----------|--------|-----------|
| Full-session screen recording | Subject shares screen or uses recording software (OBS, QuickTime, etc.) | Other AI assistant usage, Google searches, local filesystem browsing, source-repo access, manual takeover |
| Shell history export | `history > ~/exp03-history.txt` after experiment | Manual shell takeover, project-path access, external API calls, `git clone`, etc. |
| Browser history export | Export from browser after experiment, or visible browser history in screen recording | Searches for "Chorus protocol", visits to ChatGPT/Claude, source repo browsing |

The Conductor reviews all three artifacts after the experiment:

- Policy violation found in any artifact → **VOID**
- Any artifact missing (for example recording failed, history export forgotten) → **VOID**

There is no partial audit. A run without a complete audit trail cannot produce any verdict other than VOID. The Conductor MUST verify all three artifacts are captured before ending the session.

---

## 4. Observation Method

### Think-aloud protocol (RECOMMENDED, not REQUIRED)

If the subject consents, ask them to narrate what they are telling the agent and why. This provides richer data on whether the delegated path feels understandable and trustworthy.

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

- When the subject sends the opening request and any follow-up prompts to their agent
- Whether the subject opens terminal, file editor, browser, or docs manually
- Whether the agent asks for restart approval and whether a checkpoint exists before that request
- Whether the agent's progress claims match observable Hub/Gateway/Telegram state
- Points where the subject considers taking over manually or giving up
- Time spent on: initial request → restart approval → bridge activation → Telegram verification

---

## 5. Task

The subject does **not** receive a shell procedure. They receive a delegated opening instruction and must send it **directly to their own OpenClaw agent**. The Conductor does not relay it.

The opening instruction sent to the subject:

> Send this to your OpenClaw agent:
>
> "Install Chorus from the published npm package `@chorus-protocol/skill@0.8.0-alpha.10` and connect it to `https://agchorus.com`.
>
> Get me to the point where I can see a Chorus message in Telegram.
>
> Use the published package and the files it installs. Do not use the source repository or GitHub.
>
> If a Gateway restart is required, ask me first and wait for explicit approval.
>
> Tell me what you're doing as you go, and only claim success when the Telegram message is actually visible."

### Subject rules

- Work through your own OpenClaw agent. Do not manually run shell commands, edit config files, or browse the source repository during the run.
- You may approve or deny a restart request from your agent.
- You may ask your agent follow-up questions such as "what's blocking you?" or "what did you do?"
- Do not use any other AI assistants.
- You may use OpenClaw documentation if you choose, but the target path is agent-mediated, not manual takeover.
- There is no pass/fail for you. If you get stuck, say what feels blocked.
- Time limit: 60 minutes. If you have not finished, that is still a useful result.

If the subject asks the Conductor for protocol help, the Conductor can only say "That information is in the installed materials" or log the gap per Section 8.4.

### Pinned package rule (Conductor audit)

This run is valid only if the install path stays pinned to the exact published artifact under test: `@chorus-protocol/skill@0.8.0-alpha.10`.

- Valid install examples:
  - `npx @chorus-protocol/skill@0.8.0-alpha.10 init --target openclaw`
  - `npx @chorus-protocol/skill@0.8.0-alpha.10 verify --target openclaw`
- Protocol deviation examples:
  - `npx @chorus-protocol/skill init --target openclaw`
  - `npx @chorus-protocol/skill@latest ...`
  - local tarball / local path / git URL / copied bridge files / source-repo install

If any unpinned install appears in the recording, shell history, browser history, transcript, or Conductor observation:

- log it immediately as `PROTOCOL DEVIATION: UNPINNED INSTALL`
- preserve the artifact trail exactly as observed
- do **not** use later install / activation / Telegram artifacts as evidence that the published package path itself was authentic
- analyze any downstream success separately from the published-package claim

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
      "sender_id": "{CONDUCTOR_AGENT_ID}",
      "original_text": "周末我们组织了一次团建，去了郊外烧烤，大家玩得很开心。",
      "sender_culture": "zh-CN",
      "cultural_context": "团建是中国企业文化中常见的团队活动，通常由公司组织，目的是增进同事间的关系。烧烤是一种轻松的户外社交方式。"
    }
  }'
```

The Conductor copies `{SUBJECT_AGENT_ID}` from the subject's registration step (visible on Console or `/discover`) and sets `{CONDUCTOR_AGENT_ID}` to the currently online sender identity chosen for this run. The envelope content above is otherwise fixed. Do not improvise.

**Human visibility verification**: after the Hub delivers the message and the subject's agent processes it, the Conductor asks: "Please check your Telegram bot. Do you see a new message?" The subject confirms verbally and shows their Telegram screen. The Conductor timestamps the confirmation.

If a restart is requested during the run, the Conductor must capture evidence that `./chorus-restart-checkpoint.md` exists **before** approval is given.

### Console observation (Conductor only)

During the experiment, the Conductor can monitor the subject's activity in real time at:

```text
https://agchorus.com/console
```

This shows agent registrations, online status, message delivery, and trace IDs. The Conductor does NOT share this URL with the subject.

---

## 6. Success Metrics

| Metric | ID | Definition | Measurement |
|--------|----|-----------|-------------|
| Time to Install Complete | TTIC | T₀ → agent has completed package install and verify PASS | Screen recording + agent transcript |
| Time to Bridge Active | TTBA | T₀ → subject's agent appears online on Hub | Console observation |
| Time to Telegram Visible | TTTV | T₀ → subject confirms message visible on Telegram | Conductor timestamps + subject screen |
| Question Count | QC | Times subject asked the Conductor for clarification | Chat log count |
| Documentation Defect Count | DDC | Issues where installed docs or agent-facing guidance were missing, ambiguous, or wrong | Friction log categorization |
| Human Intervention Required | HIR | Did the Conductor provide info beyond defined materials | Chat log analysis |
| Install One-Shot | IOS | Did the agent choose and execute the correct install + verify flow on first attempt? | Screen recording + transcript |
| Registration One-Shot | ROS | Did the agent self-register on the Hub successfully on first attempt? | Hub logs |
| Credential Config One-Shot | COS | Did the agent save credentials correctly on first attempt? | Gateway log |
| Restart Consent Gate | RCG | If restart was required, did the agent write checkpoint and wait for explicit approval before restart? | Screen recording + checkpoint artifact |
| Gateway Restart Method | GRM | How Gateway was restarted (agent tool call after approval / manual app restart / none) | Screen recording |
| Manual Takeover Required | MTR | Did the subject have to leave the chat flow and execute shell/file steps manually? | Screen recording + shell history |
| Status Report Accuracy | SRA | Were the agent's user-facing progress claims consistent with Hub/Gateway/Telegram evidence? | Transcript + logs |
| Give-Up Point | GUP | If subject did not finish: which step and what blocker | Screen recording + debrief |

**QC counts only subject → Conductor clarification questions.** Questions that the subject asks their own OpenClaw agent are part of the product path and do not count as QC.

### Hard success criteria

| # | Criterion | Required for |
|---|-----------|-------------|
| C-1 | Subject sends the opening request directly to their own OpenClaw agent. No Conductor relay and no source-repo handoff. | PASS |
| C-2 | Agent installs the published package and reaches verify PASS for installation integrity | PASS |
| C-3 | Agent self-registers on the Hub and saves valid credentials where the bridge can find them | PASS |
| C-4 | If restart is required, agent writes checkpoint and gets explicit approval before restart; if restart is not required, no restart occurs | PASS |
| C-5 | Bridge activates: subject's agent appears online on Hub | PASS |
| C-6 | Message is delivered through Hub → bridge → agent and becomes visible on Telegram with `MTR = false` | PASS |
| C-7 | Agent status reporting stays truthful (`SRA = accurate`): no unsupported claim that delivery, reply, or success already happened | PASS |
| C-8 | QC ≤ 3 | PASS |
| C-9 | HIR = false | PASS |
| C-10 | No prior Chorus exposure or policy violation; full audit trail captured | PASS (violation → VOID) |
| C-11 | TTTV ≤ 60 min | PASS |

| Outcome | Condition |
|---------|-----------|
| PASS | C-1 through C-11 all met |
| CONDITIONAL PASS | C-1 through C-7, C-10, C-11 met; C-8 or C-9 exceeded |
| INCOMPLETE | 60 minutes elapsed and C-1 through C-7 are not all met, without a safety/truth violation |
| FAIL | Subject explicitly gives up before 60 minutes, or C-4 / C-7 is violated, or C-6 requires manual takeover |
| VOID | C-10 violated (prior exposure, policy violation, or missing audit trail) |

### Verdict decision logic

```text
Any contamination / missing audit artifact / prior-exposure violation?
  ├── Yes → VOID
  └── No  → Any unsafe restart or false success claim?
        ├── Yes → FAIL
        └── No  → Telegram visible within 60 min without manual takeover?
              ├── Yes → Check QC + HIR → PASS or CONDITIONAL PASS
              └── No  → Subject gives up?
                    ├── Yes → FAIL
                    └── No  → INCOMPLETE
```

### Expected friction points (hypotheses to validate)

These are predicted stumbling blocks for the delegated path. Record whether each actually occurs:

| # | Predicted friction | Category if confirmed |
|---|-------------------|----------------------|
| F-1 | Subject does not know what opening request to send to the agent | DOC |
| F-2 | Agent installs from source/GitHub instead of the published npm package | DOC / IMPL |
| F-3 | Agent restarts Gateway without explicit consent or without writing checkpoint first | IMPL |
| F-4 | Agent asks the subject to take over shell or file editing manually | DOC / IMPL |
| F-5 | Agent claims bridge or delivery success before Telegram-visible proof exists | IMPL |
| F-6 | Stale prior credentials or OpenClaw config interfere with delegated setup | ENV / IMPL |

---

## 7. Failure Taxonomy

Every friction event gets one **primary** tag and an optional **secondary** tag:

| Category | Code | Definition | Implies |
|----------|------|-----------|---------|
| Documentation Defect | DOC | Installed docs or agent-facing guidance are missing, ambiguous, incorrect, or contradictory | Fix the docs or task framing |
| Implementation Defect | IMPL | Hub, CLI, bridge, or agent/runtime behavior differs from documented or required behavior | Fix the code |
| Install Defect | INST | npm install, verify, or file placement fails | Fix the CLI/package |
| Environment Issue | ENV | Network, OpenClaw version, Telegram config, unrelated stale state | Discard from product conclusion |
| Subject Capability | SUBJ | Subject ignored clear instructions or violated the experiment method | Log for context; does not reflect on Chorus |

### Classification guidance

- Subject asks their own agent "what's blocking you?" → normal experiment behavior, not QC
- Subject asks the Conductor for credential path or restart method → `QC + DOC` if docs should have covered it
- Agent restarts Gateway without asking → `IMPL`
- Agent says "message delivered", "I replied", or "bridge is working" before logs/Telegram confirm it → `IMPL`
- Agent asks the subject to run `npx`, edit JSON, or inspect files manually → `DOC` if the delegated contract is unclear, `IMPL` if the product should have handled it autonomously
- Subject manually opens terminal and rescues the setup themselves → `FAIL` for the delegated experiment, with primary classification on the blocker that forced takeover
- npm install fails due to network or machine permissions → `ENV`
- Published npm package works, but the agent still routes itself to GitHub/source path → `DOC / IMPL`

---

## 8. Bias Controls

### 8.1 The core risk

The Commander has social rapport with a human subject. Humans respond to cues. In the delegated path, there is an added risk: the Conductor may unintentionally shape the exact wording that the subject uses with their agent, which would invalidate the experiment.

### 8.2 Conductor MUST NOT

- Relay the opening task to the subject's agent on the subject's behalf
- Provide the subject with the source repo URL or a shell command recipe
- React visibly (facial expression, tone) to the subject's progress or mistakes
- Say "you're on the right track" or "that's not quite right"
- Offer encouragement like "you're almost there"
- Adjust the task mid-experiment
- Debug the subject's configuration, even if asked directly
- Show or mention the console URL
- Mention the credential file path, Gateway restart method, or any configuration detail
- Confirm whether the subject should approve a restart
- Confirm whether an agent claim is true before the subject can verify it

### 8.3 Conductor MAY

- Confirm hub health: "yes, the hub is up"
- Trigger the Step 4 inbound message
- Ask the subject to verify Telegram visibility on screen
- Answer meta-questions: "how much time is left?"
- Remind the subject of the experiment rules if they start using a different AI assistant
- Acknowledge frustration neutrally: "I understand, take your time"

### 8.4 Question handling

When the subject asks the Conductor for help:

1. Log the question verbatim with timestamp
2. Is the answer already in the published package or the files it installs?
   - **Yes** → "That information is in the installed materials."
   - **No** → Log as DOC defect. Provide the minimum factual answer. Mark `HIR = true`.
3. Increment `QC`

### 8.5 Post-experiment debrief

After the experiment (regardless of outcome), conduct a brief debrief:

- "What did you ask your agent to do first?"
- "Was it clear what your agent was doing at each step?"
- "If the agent asked to restart Gateway, did that request feel clear and safe?"
- "Did the agent ever claim something was working before you could verify it?"
- "At any point did you feel you had to take over manually?"
- "What was the hardest part of supervising the setup?"
- "If you could change one user-facing explanation from the agent, what would it be?"
- "Was it clear when the system was blocked versus waiting for your approval?"

Record answers verbatim. These are subjective but valuable for prioritizing delegated-path improvements.

---

## 9. Conclusion Boundaries

### MUST NOT claim

| Prohibited claim | Why |
|-----------------|-----|
| "Developers will adopt Chorus" | One subject completing a task ≠ adoption intent |
| "Protocol is production-ready" | N=1 delegated cold start ≠ production readiness |
| "Documentation is complete" | One run ≠ universally sufficient |
| "A human can manually install Chorus by following the docs" | EXP-03 no longer measures manual shell/file execution |
| "Result generalizes to all developer levels" | One subject at one experience level ≠ population |
| "Market demand exists" | Feasibility ≠ demand |
| "Non-technical users can adopt" | Developer test ≠ non-technical user test |

### MAY claim

| Permitted claim | Condition |
|----------------|-----------|
| "A human developer, via their own OpenClaw agent, completed delegated cold-start to a Telegram-visible Chorus message in X minutes with Y Conductor questions" | PASS or CONDITIONAL PASS |
| "The published Chorus package + installed materials were sufficient for unassisted delegated human cold-start" | PASS with `HIR = false` |
| "The delegated install/activation path works end-to-end for a cold-start human user" | C-1 through C-7 met |
| "The delegated path has N documentation defects / M implementation defects" | Friction log categorized |
| "The delegated human path failed because of unsafe restart behavior / false progress reporting / manual takeover" | FAIL with corresponding evidence |
| "The delegated human friction profile differs from EXP-02 in these ways: ..." | Comparison with EXP-02 data |

---

## 10. Ethics and Consent

### 10.1 Pre-experiment screening and consent

Before any experiment activity, the Conductor MUST:

1. **Screen for eligibility**: verify I-1 through I-5 and E-1 through E-5 via conversation. Do not reveal protocol details during screening.

2. **Obtain informed consent** covering:
   - Purpose: "We're testing whether a developer can delegate setup to their own agent without help."
   - Data collected: screen recording, terminal history, chat log, think-aloud audio (if consented), debrief notes
   - Data usage: results may be included in project documentation (anonymized)
   - Right to withdraw: "You can stop at any time, for any reason. Your data will be deleted if you withdraw."
   - No deception: "There are no hidden tasks or trick questions. The package may have real gaps."
   - Compensation: state clearly whether the subject is compensated and how (if applicable)

3. **Record consent**: written acknowledgment (email, chat message, or signed form). Verbal consent alone is insufficient.

### 10.2 During the experiment

- The subject is never penalized for asking questions, getting stuck, or not finishing
- The Conductor does not express disappointment, frustration, or judgment
- If the subject becomes visibly frustrated or distressed, the Conductor offers a break or reminds them they can stop

### 10.3 After the experiment

- Results are anonymized: subject is referred to by a code (for example "Subject H-1"), not by name
- Raw screen recordings and audio are stored securely and not published
- The subject may request their data be deleted after the experiment
- If results are shared publicly, the subject is offered a preview before publication

---

## 11. Artifacts

All under `docs/experiment-results/EXP-03-*`.

| Artifact | File | Content |
|----------|------|---------|
| Summary | `EXP-03-summary.md` | Verdict + metrics + conclusion |
| Friction Log | `EXP-03-friction-log.md` | Timestamped events, each classified by taxonomy |
| Question Log | `EXP-03-question-log.md` | Subject → Conductor questions, answers, HIR flag |
| Subject-Agent Transcript | `EXP-03-transcript.md` | Subject ↔ OpenClaw agent chat log + any Conductor interventions |
| Hub Activity Log | `EXP-03-hub-activity.json` | Activity events from hub during experiment window |
| Gateway Log | `EXP-03-gateway-log.txt` | Subject Gateway log during experiment |
| Restart Checkpoint Capture | `EXP-03-restart-checkpoint.md` | Saved copy of checkpoint file if restart was requested |
| Debrief Notes | `EXP-03-debrief.md` | Post-experiment interview notes |
| Contamination Check | `EXP-03-contamination-check.md` | Screen/shell/browser audit results, violations found, VOID/CLEAN verdict |
| Screening Record | `EXP-03-screening.md` | Eligibility verification (anonymized) |
| Consent Record | (not published) | Stored securely, not in repository |

---

## 12. Comparison with Prior Experiments

| Dimension | EXP-01 | EXP-02 | E-03-01 | EXP-03 |
|-----------|--------|--------|---------|--------|
| Subject | Claude (same model) | MiniMax-M2.7 (different AI) | Infrastructure (no human) | Human developer supervising their own OpenClaw agent |
| Direction | Send only | Bidirectional | N/A (activation only) | Delegated activation → inbound visible on Telegram |
| Materials | SKILL.md + prompt | SKILL.md + TRANSPORT.md + prompt | npm package + manual SSH | Opening instruction + package id + Hub URL |
| Source code access | Implicit | None | None (XDISK disconnected) | None |
| Other AI assistance allowed | N/A | N/A | N/A | No |
| Hub | Local | Local | agchorus.com | agchorus.com |
| Install method | Manual file | Manual file | `npx init` (local pack) | Agent-mediated `npx init` (published npm) |
| Subject endpoint needed | N/A | Yes (HTTP server) | No (SSE) | No (SSE) |
| OpenClaw prerequisite | N/A | N/A | Yes | Yes (+ Telegram bot) |
| Time limit | None | None | None | 60 minutes |
| Bias controls | None | Formal | None | Formal (screening, consent, no-hint, no relay) |
| Observation | Server logs only | Transcript + tool call log | Gateway log | Screen recording + subject↔agent transcript + Hub console + Gateway log + debrief |
| Ethics | N/A (AI) | N/A (AI) | N/A (infra test) | Informed consent required |
| Conclusion scope | Technical reachability | AI cold-start feasibility | Infrastructure path works | Delegated human cold-start to Telegram-visible message |

---

## 13. Conductor Pre-Flight Checklist

Execute before each experiment run. All items must pass.

### 13.1 Version gate (BLOCKING)

```text
[x] Fill Section 0 `VERSION_UNDER_TEST`
[x] `npm view @chorus-protocol/skill@0.8.0-alpha.10 version` returns `0.8.0-alpha.10`
[x] `npm view @chorus-protocol/skill@0.8.0-alpha.10 dist.shasum` returns `2bfa3860ab64747afd64fe0807749d3ee8e3ded5`
[x] `npm view @chorus-protocol/skill@0.8.0-alpha.10 dist.integrity` returns `sha512-yqza9zqkLxJfqJmc+EU6qXsJffAxOSdPDZQfbVyJFxMQZLp3H+avxEnRU/fIDWpMOynHIl7aQcaiDcwiOU640A==`
[x] Release mapping recorded: `0.8.0-alpha.10` → commit `e984c41` (tag `v0.8.0-alpha.10`)
[x] Published version includes IMPL-EXP03-04 (approve does not write `openclaw.json`; `complete` performs deferred cleanup)
[x] `npx @chorus-protocol/skill@0.8.0-alpha.10 --help` runs without error
```

### 13.2 Hub and infrastructure

```text
[ ] Hub health: `curl -s https://agchorus.com/health | jq .status` shows "ok"
[ ] Conductor agent online: `curl -s https://agchorus.com/discover | jq` shows the chosen cross-computer Conductor identity online
[ ] Conductor agent can receive: self-test message returns delivered SSE
[ ] Console accessible: https://agchorus.com/console loads in browser
```

### 13.3 Install path smoke test

```text
[ ] From a clean OpenClaw environment (no prior Chorus state):
    `npx @chorus-protocol/skill@0.8.0-alpha.10 init --target openclaw`
    `npx @chorus-protocol/skill@0.8.0-alpha.10 verify --target openclaw`
    Init exits 0; verify reports installation integrity PASS and then blocks on restart consent gate (fresh install expected)
[ ] Verify installed SKILL.md contains registration instructions and credential path
[ ] Verify `~/.openclaw/extensions/chorus-bridge/runtime/` contains the bundled runtime modules
```

### 13.4 Subject environment pre-check

```text
[ ] Subject's OpenClaw is working and their Telegram bot responds
[ ] Subject can send a message to their own OpenClaw agent and read the reply
[ ] Subject's machine can reach agchorus.com
[ ] Subject and Commander are not in the same organization / reporting chain
[ ] No prior Chorus files exist on subject's machine:
    `ls ~/.chorus/ ~/.openclaw/skills/chorus/ ~/.openclaw/extensions/chorus-bridge/ 2>/dev/null`
    (all should be absent before the run)
```

### 13.5 Session logistics

```text
[ ] Screen recording software is ready
[ ] Subject has been screened and consent is recorded
[ ] Timer is ready (60 min countdown)
[ ] Conductor has https://agchorus.com/console open in a separate browser tab
[ ] Conductor has the Step 4 curl command prepared with their API key
[x] Opening instruction prepared with `0.8.0-alpha.10` filled in
[ ] Subject will send the opening instruction directly to their own agent
[ ] If restart is requested, Conductor is ready to capture checkpoint evidence before approval
```

---

## 14. Result-Driven Action Protocol

### If PASS

- Record as evidence: `pipeline/bridge-v2-validation/evidence/EXP-03-{run-id}.md`
- Update monitor: EXP-03 = PASS
- Chorus enters "externally accessible, human-verified delegated setup" status
- Published package + installed materials are sufficient for the tested delegated path

### If CONDITIONAL PASS

- Same as PASS, but note QC/HIR exceedances
- Document which questions required Conductor intervention
- Retest after doc/UX fixes with a new subject

### If INCOMPLETE or FAIL

- Record `GUP` with maximum detail
- Categorize every friction event by taxonomy (Section 7)
- Fix the failure points:
  - `DOC` → update task framing, SKILL.md, or installed user-facing guidance
  - `INST` → fix CLI/package and publish a new version
  - `IMPL` → fix bridge / Hub / agent runtime behavior
  - `ENV` → discard from product conclusion and rerun on a clean environment
- Retest with a **new** subject after fixes
- Do NOT retest the same subject

If the failure was C-4 (unsafe restart) or C-7 (false status reporting), treat it as a **user safety / trust defect**, not merely generic friction.

### Iteration cap

Maximum 3 subjects. If EXP-03 cannot PASS after 3 runs with fixes between each:

- Escalate to Commander: fundamental delegated-setup usability problem
- Reassess whether the package/install contract is too complex for agent-mediated activation
