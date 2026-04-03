# EXP-03 Run 2 Subject Pre-Check Packet

> Date: 2026-04-01
> Status: READY TO FILL
> Scope: Section 13.4 + Section 13.5 only
> Current state: no subject assigned yet; this packet is prepared so the remaining pre-flight work can be executed without changing protocol

---

## 1. Subject Selection

| Field | Value |
|-------|-------|
| Subject code | `TBD` |
| Recruitment source | `TBD` |
| Compensation | `TBD / none` |
| Same organization as Commander? | `TBD` |
| Same reporting chain as Commander? | `TBD` |
| Prior Chorus exposure? | `TBD` |
| Eligible for Run 2? | `TBD` |

Hard gate:

- If the subject is in the same organization or reporting chain as the Commander, stop. Run 2 cannot use that subject.
- If the subject has prior Chorus exposure, stop. Run 2 cannot use that subject.

---

## 2. Screening Record

### Inclusion criteria

| # | Criterion | Method | Result |
|---|-----------|--------|--------|
| I-1 | Never seen, read, or heard about Chorus | Screening conversation | `TBD` |
| I-2 | Can use their own OpenClaw agent and read replies | Live check | `TBD` |
| I-3 | OpenClaw installed and at least one Telegram bot configured | Live check | `TBD` |
| I-4 | Can understand and answer a restart approval question about their own Gateway | Neutral screening question | `TBD` |
| I-5 | Has authority to approve or deny changes to their OpenClaw setup on this machine | Consent confirmation | `TBD` |

### Exclusion criteria

| # | Criterion | Method | Result |
|---|-----------|--------|--------|
| E-1 | Current or past contributor to this project | Screening conversation | `TBD` |
| E-2 | Has read any file from the Chorus repository | Screening conversation | `TBD` |
| E-3 | Has been briefed about Chorus by anyone who knows the project | Screening conversation | `TBD` |
| E-4 | Same organization or reporting chain as Commander | Screening conversation | `TBD` |
| E-5 | Cannot dedicate 60 uninterrupted minutes | Scheduling confirmation | `TBD` |

### Subject profile

| Field | Value |
|-------|-------|
| Experience level | `TBD` |
| Primary language(s) | `TBD` |
| Years of professional development | `TBD` |
| Familiarity with agent-to-agent protocols | `TBD` |
| Familiarity with OpenClaw | `TBD` |
| OpenClaw version | `TBD` |
| Telegram bot(s) configured | `TBD` |

---

## 3. Consent Record

Written consent is mandatory. Verbal consent alone is insufficient.

| Item | Record |
|------|--------|
| Purpose explained | `TBD` |
| Data collected explained | `TBD` |
| Data usage explained | `TBD` |
| Right to withdraw explained | `TBD` |
| No deception explained | `TBD` |
| Compensation explained | `TBD` |
| Written acknowledgment captured | `TBD` |
| Consent artifact location | `TBD` |

Required wording coverage:

- "We're testing whether a developer can delegate setup to their own agent without help."
- Data collected: screen recording, terminal history, chat log, think-aloud audio if consented, debrief notes
- Results may be documented in anonymized form
- The subject can stop at any time and request deletion
- There are no hidden tasks or trick questions

---

## 4. Section 13.4 Subject Environment Pre-Check

| Check | Method | Result |
|------|--------|--------|
| Subject's OpenClaw is working and Telegram bot responds | Subject sends a normal message to their own agent and reads the reply | `TBD` |
| Subject can send a message to their own OpenClaw agent and read the reply | Same live check as above; timestamp the reply | `TBD` |
| Subject's machine can reach `agchorus.com` | Run the health check command below or load the hub in a browser | `TBD` |
| Subject and Commander are not in the same organization / reporting chain | Screening record above | `TBD` |
| No prior Chorus files exist on subject's machine | Run the command below on the subject machine before the opening instruction | `TBD` |

Health check command:

```bash
curl -s https://agchorus.com/health | jq .status
```

Command for the last row:

```bash
ls ~/.chorus/ ~/.openclaw/skills/chorus/ ~/.openclaw/extensions/chorus-bridge/ 2>/dev/null
```

Pass condition for the last row:

- all three paths are absent before the run

Record the actual observed output verbatim:

```text
TBD
```

---

## 5. Section 13.5 Session Logistics

| Check | Method | Result |
|------|--------|--------|
| Screen recording software is ready | Subject demonstrates QuickTime / OBS / equivalent before T0 | `TBD` |
| Subject has been screened and consent is recorded | Link to Sections 2 and 3 above | `TBD` |
| Timer is ready (60 min countdown) | Conductor arms timer before T0 | `TBD` |
| Conductor has `https://agchorus.com/console` open in separate tab | Conductor verifies before T0 | `TBD` |
| Conductor has Step 4 curl command prepared with their API key | Prepared locally; API key itself is not written to repo | `TBD` |
| Opening instruction prepared with `0.8.0-alpha.8` filled in | Already true per main pre-flight record | `PASS` |
| Subject will send the opening instruction directly to their own agent | Confirmed verbally before T0 | `TBD` |
| If restart is requested, Conductor is ready to capture checkpoint evidence before approval | Conductor confirms before T0 | `TBD` |

Artifact capture plan:

| Artifact | Method | Ready? |
|----------|--------|--------|
| Full-session screen recording | Subject starts recording before T0 | `TBD` |
| Shell history export | Subject runs `history > ~/exp03-history.txt` after the run | `TBD` |
| Browser history export | Subject exports browser history after the run or makes it visible in the recording | `TBD` |

---

## 6. Pre-Flight Consequence

Run 2 pre-flight can be re-judged as cleared only if:

1. A real subject is selected and passes screening.
2. Written consent is captured.
3. All Section 13.4 rows are completed with live evidence.
4. All Section 13.5 rows are completed before T0.

Until then:

- do not modify the experiment spec
- do not switch conductor identity
- do not start Run 2
