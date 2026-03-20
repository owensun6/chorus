# EXP-02: Third-Party Cold-Start Integration — Results

2026-03-20

---

## Verdict: CONDITIONAL PASS

Run 3 (subject: xiaox, MiniMax-M2.7) achieved bidirectional integration from protocol documentation alone. All criteria C-1 through C-7 met on in-experiment evidence.

**Condition**: Subject does not satisfy the original "zero Chorus artifact exposure" criterion strictly — xiaox read the project's CLAUDE.md (a workflow management document, not protocol specs) on 2026-03-13. This is assessed as non-protocol exposure that did not aid integration, but it prevents claiming strict "zero artifact" cold start. See Historical Exposure Assessment in the experiment design document.

Runs 1-2 (subject: xiaov) are archived as pilot/void — see Appendix.

---

## Metrics (Run 3 — formal)

| Metric | ID | Value |
|--------|----|-------|
| Time to First Message | TTFM | ~1.5 min |
| Total Completion Time | TCT | ~2.5 min |
| Question Count | QC | 0 |
| Documentation Defect Count | DDC | 5 |
| Human Intervention Required | HIR | false |
| Bidirectional Complete | BDC | true |
| Envelope Validity Rate | EVR | 100% |
| Retry Count | RC | 0 |

## Criteria (Run 3)

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| C-1 | Registration | PASS | `xiaox@localhost` registered at 08:10:33 UTC, HTTP 201 |
| C-2 | Outbound send delivered | PASS | Message to agent-zh-cn delivered, adapted to Chinese. Server log confirms |
| C-3 | Inbound envelope parsed + evidence | PASS | Subject proactively reported `sender_id`, `original_text`, `cultural_context` without prompting. Code validates all 4 required fields |
| C-4 | BDC = true | PASS | Send (xiaox → agent-zh-cn) + Receive (agent-zh-cn → xiaox) both confirmed |
| C-5 | QC ≤ 3 | PASS | QC = 0 |
| C-6 | HIR = false | PASS | Commander provided no information beyond task prompt |
| C-7 | No contamination | PASS | Current session only accessed `/tmp/chorus-exp02/SKILL.md` and `/tmp/chorus-exp02/TRANSPORT.md`. No repo path references. See Contamination Check section |

---

## Subject Profile (Run 3)

| Property | Value |
|----------|-------|
| Subject | xiaox (OpenClaw agent, separate profile from xiaov) |
| Model | MiniMax-M2.7 |
| Platform | OpenClaw via Telegram (independent chat thread from xiaov) |
| Chorus exposure | Zero in current session. Historical caveat: see Contamination Check |
| Materials | `/tmp/chorus-exp02/SKILL.md` + `/tmp/chorus-exp02/TRANSPORT.md` + task prompt |

## What the Subject Built

`xiaox-agent.js`: 200-line Node.js agent using stdlib `http` module. Includes:
- HTTP server on port 3006, routing `/receive` endpoint
- Envelope validation (checks `chorus_version`, `sender_id`, `original_text`, `sender_culture`)
- Error responses with proper error codes per protocol
- Register function
- Send function with optional `cultural_context`
- Main orchestrator: start server → register → send → wait for receive

This is a complete implementation, not a stub. Subject chose a different language (Node.js) than the pilot subject (Python), demonstrating the docs are language-agnostic.

## Documentation Defects Found (DDC = 5)

| # | Defect | Classification | Severity |
|---|--------|---------------|----------|
| F-1r | Version field confusion persists despite v0.5 fix — "文档中有注释解释，但非常容易忽略" | DOC | MEDIUM |
| F-4 | Quick Start shows request/response but not runnable code — subject wanted executable examples | DOC | LOW |
| F-5 | `/.well-known/chorus.json` returns 404 — spec says SHOULD, server doesn't implement | IMPL | LOW |
| F-6 | Envelope nesting unclear — "envelope 嵌套在哪一层？" Subject tried both flat and nested before finding correct format | DOC | MEDIUM |
| F-7 | Version compatibility unexplained — what happens when sender uses 0.4 and receiver uses 0.2? | DOC | LOW |

Additional observations (not defects):
- `receiver_id` not in envelope (asymmetry with `sender_id`) — subject found this confusing initially but understood the design rationale after reading
- `delivery: "failed"` with `success: true` — counterintuitive but documented in TRANSPORT.md 6.4

## Contamination Check

### In-experiment (C-7): CLEAN — auditable

Full execution log: `EXP-02-execution-log.txt` (extracted from OpenClaw session JSONL).

13 tool calls during experiment window (08:09:21Z to 08:12:40Z):

| Time (UTC) | Action | Target |
|------------|--------|--------|
| 08:09:21 | READ | `/tmp/chorus-exp02/SKILL.md` |
| 08:09:21 | READ | `/tmp/chorus-exp02/TRANSPORT.md` |
| 08:09:38 | EXEC | `curl GET localhost:3000/agents` |
| 08:09:38 | EXEC | `curl GET localhost:3000/.well-known/chorus.json` (404) |
| 08:10:24 | WRITE | `/tmp/chorus-exp02/xiaox-agent.js` |
| 08:10:40 | EXEC | `node xiaox-agent.js` (start server) |
| 08:10:44 | POLL | check server started |
| 08:10:58 | EXEC | `curl POST localhost:3000/agents` (register) |
| 08:11:03 | POLL | check logs |
| 08:11:29 | EXEC | `curl POST localhost:3000/messages` (send) |
| 08:11:44 | POLL | check inbound |
| 08:11:53 | PROC | kill server |
| 08:12:40 | WRITE | `/tmp/chorus-exp02/REPORT.md` |

Scanned all 13 inputs/outputs for: `/Volumes/XDISK/chorus`, `PROTOCOL.md`, `envelope.schema.json`, `.claude/skills`, `chorus/src`, `chorus/tests`. **Zero matches.** All file access within `/tmp/chorus-exp02/`. All HTTP within `localhost:3000`.

### Historical exposure (pre-experiment): NON-PROTOCOL

xiaox's session from 2026-03-13 contains a read of the Chorus project's `CLAUDE.md` — a Fusion-Core project management workflow document containing stage routing tables and role definitions. It does NOT contain protocol specifications, envelope formats, HTTP bindings, or source code.

**Ruling**: This means xiaox does not satisfy the original "zero Chorus artifact" criterion strictly. However, CLAUDE.md contains no information usable for protocol integration. The subject's in-experiment behavior (version field confusion, envelope nesting trial-and-error, discovery 404) is consistent with genuine first contact with the protocol docs.

**Classification**: Non-protocol project exposure. Does not invalidate in-experiment C-7, but prevents claiming strict "zero artifact" cold start. This distinction is the reason for CONDITIONAL (not full) PASS.

---

## Conclusion

A non-Claude AI (MiniMax-M2.7 via OpenClaw) with zero prior Chorus protocol exposure completed bidirectional integration in ~2.5 minutes from cold start, using only SKILL.md + TRANSPORT.md, with zero questions and zero human intervention.

Five documentation friction points were identified, including one (F-1r) that persists from the pilot despite a prior fix attempt.

### What this proves

- A non-Claude AI integrated with a Chorus server from SKILL.md + TRANSPORT.md alone, with no protocol-relevant prior exposure
- The protocol's technical chain (register → send → receive → validate) works end-to-end
- The HTTP binding documentation is sufficient for an AI to write a working implementation without source code access
- In-experiment contamination check is clean and independently auditable (see `EXP-02-execution-log.txt`)

### What this does NOT prove

- Human developer adoption friction (AI ≠ human developer)
- Market demand or willingness to adopt
- Documentation completeness for all capability levels (N=1, one model)
- Cultural adaptation quality (not tested — subject declared en-US, receiver was zh-CN, but adaptation was done by demo agent, not subject)
- Generalizability across model families (tested MiniMax only)

### Recommended next steps

1. Fix F-1r (version field confusion still insufficient), F-6 (envelope nesting clarity)
2. Implement `/.well-known/chorus.json` (F-5)
3. Consider EXP-03 with a human developer subject

---

## Appendix: Prior Runs (not formal evidence)

| Run | Subject | Verdict | Reason |
|-----|---------|---------|--------|
| Run 1 (pilot) | xiaov (豆包 seed-2.0-code) | PILOT | Materials from workspace, partial transcript, incomplete contamination check |
| Run 2 | xiaov (豆包 seed-2.0-code) | VOID | Subject had full pilot context ("第四次了"), warm start |

Pilot outputs (3 doc defects found, all fixed) are preserved in the friction log for reference.

---

## Artifacts

| File | Content |
|------|---------|
| `EXP-02-summary.md` | This file |
| `EXP-02-execution-log.txt` | Auditable tool call log extracted from OpenClaw session JSONL (C-7 evidence) |
| `EXP-02-friction-log.md` | All friction events across all runs |
| `EXP-02-question-log.md` | QC = 0 across all runs |
| `EXP-02-transcript.md` | Complete transcripts (Run 2 + Run 3) |
| `EXP-02-server-log.txt` | Server logs for Run 3 |
| `EXP-02-subject-code/xiaox-agent.js` | Run 3 subject's Node.js implementation |
| `EXP-02-subject-code/xiaox-report.md` | Run 3 subject's self-generated report |
| `EXP-02-subject-code/chorus-receive.py` | Run 1/2 subject's Python implementation (pilot) |
