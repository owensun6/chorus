# EXP-02: Third-Party Cold-Start Integration — Results

2026-03-20

---

## Status: PILOT RUN (procedurally disqualified)

This run is **not** a formal EXP-02 PASS. It is a pilot/dry run that produced useful technical signal but failed to follow the approved experiment protocol.

### Procedural violations

1. **Materials not delivered from approved path**: Approved protocol specifies `/tmp/chorus-exp02/` as the neutral delivery directory (Section 4). Actual delivery used `~/.openclaw/workspace/chorus-docs/` — OpenClaw's native workspace, which is not isolated from the agent's broader filesystem context.
2. **Incomplete transcript**: Approved protocol requires full Commander↔Subject communication record (Section 10). Only partial transcript was captured — Commander relayed 小v's output rather than exporting the full Telegram chat.
3. **Contamination check incomplete**: C-7 check was performed on gateway logs only. Without the full transcript and command history, we cannot confirm OpenClaw did not access Chorus-related files via paths not logged by the gateway.

### What this run IS

- A **technical dry run** confirming the protocol works end-to-end with a non-Claude AI
- A source of **3 actionable documentation defects** (F-1, F-2, F-3)
- Evidence that **the experiment design is executable** and the checklist/metrics/taxonomy framework functions

### What this run is NOT

- Formal cold-start evidence
- A basis for claiming "third-party adoption feasibility verified"
- Eligible for archival as EXP-02 PASS

---

## Technical Outcome (pilot data — not formal verdict)

---

## Metrics

| Metric | ID | Value |
|--------|----|-------|
| Time to First Message | TTFM | ~5 min (T₀ to registration ~5 min; first outbound send shortly after) |
| Total Completion Time | TCT | ~9 min (T₀ to bidirectional round-trip server-confirmed) |
| Question Count | QC | 0 |
| Documentation Defect Count | DDC | 3 |
| Human Intervention Required | HIR | false |
| Bidirectional Complete | BDC | true |
| Envelope Validity Rate | EVR | 100% (all sends returned `delivery: "delivered"`) |
| Retry Count | RC | 0 (no failed attempts observed in server logs) |

## Criteria

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| C-1 | Registration | PASS | `xiaov@localhost` registered at 06:44:49 UTC, HTTP 201 |
| C-2 | Outbound send delivered | PASS | Two messages delivered — agent-zh-cn adapted to Chinese, agent-ja adapted to Japanese. See `EXP-02-server-log.txt` |
| C-3 | Inbound envelope parsed + evidence | PASS | 小v reported full envelope fields (`sender_id`, `original_text`, `sender_culture`, `cultural_context`), correctly applied same-culture direct delivery rule. See transcript |
| C-4 | BDC = true | PASS | Send (xiaov → agent-zh-cn) + Receive (agent-zh-cn → xiaov) both confirmed |
| C-5 | QC ≤ 3 | PASS | QC = 0 |
| C-6 | HIR = false | PASS | Commander provided no information beyond task prompt |
| C-7 | No contamination | PASS | OpenClaw logs contain no references to Chorus repo paths, PROTOCOL.md, or envelope.schema.json |

## Subject Profile

| Property | Value |
|----------|-------|
| Subject | OpenClaw (小v) |
| Model | 豆包 seed-2.0-code (Doubao) |
| Platform | OpenClaw framework via Telegram |
| Chorus exposure | Zero prior |
| Materials | SKILL.md (97 lines) + TRANSPORT.md (298 lines) + task prompt |

## What the Subject Built

- `chorus-receive.py`: 39-line Python HTTP server using stdlib `http.server`
- Parses incoming JSON, logs full envelope to stdout, stores in memory, returns `{"status": "ok"}`
- Registered as `xiaov@localhost` on port 3005
- Sent 2 outbound messages (one to zh-CN agent, one to ja agent)
- Correctly included `cultural_context` for cross-culture sends

## Documentation Defects Found (DDC = 3)

| # | Defect | Severity |
|---|--------|----------|
| F-1 | `agent_card.chorus_version` vs envelope `chorus_version` — two different version fields, undocumented relationship | MEDIUM |
| F-2 | "First message" criterion for `cultural_context` — ambiguous whether first is per `conversation_id` or per `sender_id` | LOW |
| F-3 | No end-to-end example flow (register → send → receive sequence) | LOW |

Details in `EXP-02-friction-log.md`.

## Observations

1. **Zero questions, zero retries**: 小v completed the entire integration without asking for help or hitting server errors. The docs were sufficient for a non-Claude AI to integrate on first attempt.

2. **Proactive notification gap**: 小v's endpoint logged the inbound envelope but did not push a notification to Telegram. She only reported the received message when asked. This is protocol-correct (the protocol only requires `{"status": "ok"}`), but a production integration would push to the user.

3. **Cross-culture behavior correct**: 小v included `cultural_context` when sending to `agent-ja@localhost` (different culture) and correctly identified that same-culture messages (zh-CN → zh-CN) don't need adaptation.

4. **Version field confusion**: The most substantive doc defect. Two fields named similarly (`chorus_version` in envelope = "0.4", `chorus_version` in agent_card = "0.2") with no explanation of the difference. 小v worked around it by copying the example, but this would trip up a stricter implementation.

## Contamination Check

**Result: CLEAN**

Checked: OpenClaw gateway.log, gateway.err.log — no references to `/Volumes/XDISK/chorus`, `~/.claude/`, `PROTOCOL.md`, or `envelope.schema.json`.

OpenClaw's code (`chorus-receive.py`) uses only Python stdlib, no Chorus-specific imports.

## Conclusion (pilot-grade — not formal)

**Technical signal**: A non-Claude AI (豆包 seed-2.0-code) completed bidirectional Chorus integration in ~9 minutes with zero questions. Three documentation defects were found.

**Procedural status**: This run deviated from the approved experiment protocol on material delivery path, transcript completeness, and contamination check depth. Results are informative but not citable as formal cold-start evidence.

### Usable outputs

- 3 documentation defects (F-1, F-2, F-3) — these are real regardless of procedural status
- Confirmation that the experiment design is executable
- Baseline timing data for a formal rerun

### Not usable

- Any claim about "third-party cold-start feasibility"
- Any claim about documentation sufficiency
- Comparison with EXP-01 as a progression

### Path to formal EXP-02

Rerun with strict protocol adherence:
1. Deliver materials from `/tmp/chorus-exp02/` only
2. Export complete Telegram transcript before compilation
3. Run full C-7 contamination check against transcript + command history

---

## Artifacts Index

| File | Content |
|------|---------|
| `EXP-02-summary.md` | This file |
| `EXP-02-friction-log.md` | Timestamped friction events with taxonomy classification |
| `EXP-02-question-log.md` | Question log (empty — QC = 0) |
| `EXP-02-transcript.md` | Commander↔小v Telegram conversation (partial) |
| `EXP-02-server-log.txt` | Demo server output during experiment |
| `EXP-02-subject-code/chorus-receive.py` | 小v's receive endpoint implementation |
