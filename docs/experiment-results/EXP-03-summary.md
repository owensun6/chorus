# EXP-03: Human Developer Cold-Start — Results

2026-04-07

---

## Verdict: PASS

Run 2 (2026-04-03, `@chorus-protocol/skill@0.8.0-alpha.9`) achieved the formal target of EXP-03: a cold-start subject on MacBook, acting through their own OpenClaw agent, installed Chorus from scratch and received a Telegram-confirmed Chorus message from an agent running on a separate Mac mini in about 6 minutes.

The formal verdict is **PASS** because Run 2 was recorded as satisfying **C-1 through C-11**. The checked-in record anchors that verdict on the subject timeline (`18:40` cold-start request -> `18:41` install complete + restart request -> `18:42` explicit approval -> `18:46` Telegram visible), Hub trace `0c02a49a-4051-4391-8b22-ca27613f269d`, and `telegram_server_ack ref=147`.

Run 1 (2026-03-31, `0.8.0-alpha.7`) remains archived as **VOID** and is kept only as background context and friction history.

---

## Run Matrix

| Run | Date | Version | Subject / Setup | Verdict | Why |
|-----|------|---------|-----------------|---------|-----|
| Run 1 | 2026-03-31 | `0.8.0-alpha.7` | Commander's colleague on MacBook; same-org subject; incomplete audit capture | **VOID** | Missing contamination-audit artifacts (screen recording, shell history, browser history) and same-org screening violation; Telegram-visible Chorus delivery not reached |
| Run 2 | 2026-04-03 | `0.8.0-alpha.9` | Cold-start subject on MacBook (`openclaw-test@agchorus`) talking to agent on separate Mac mini (`xiaox@chorus`) | **PASS** | Cross-machine cold-start install -> consented restart -> Telegram-confirmed delivery in ~6 min; C-1 through C-11 satisfied |
| Run 3 | 2026-04-08 | `0.8.0-alpha.10` | Bidirectional A2A between Mac mini (`xiaox-test@agchorus`, per-agent workspace) and MacBook (`test2-air@agchorus`) | **PASS (addendum) / FAIL (product value)** | Plumbing contracts all satisfied (`delivery_confirmed`, SSE inbox, bidirectional trace), but both agents rendered Chinese user-facing text in English, violating the cross-cultural translation contract. See `EXP-03-run3-findings.md` for full diagnosis — Run 3 is recorded as an **addendum** and does not revise the Run 2 PASS verdict.|

---

## Metrics (Run 2 — Formal)

| Metric | Value | Basis |
|--------|-------|-------|
| Time to Install Complete (TTIC) | ~1 min | `18:40` opening request -> `18:41` install complete + restart request |
| Time to Telegram Visible (TTTV) | ~6 min | `18:40` opening request -> `18:46` Telegram-visible Chorus message |
| Question Count (QC) | Within PASS threshold | Run 2 recorded as satisfying C-8 (`QC <= 3`) |
| Human Intervention Required (HIR) | false | Run 2 recorded as satisfying C-9 |
| Restart Consent Gate (RCG) | PASS | Explicit approval recorded at `18:42` before recovery completion |
| Manual Takeover Required (MTR) | false | Run 2 recorded as satisfying C-6 without manual takeover |
| Delivery Proof | `delivery_confirmed`, `telegram_server_ack ref=147` | Hub trace `0c02a49a-4051-4391-8b22-ca27613f269d` |
| Topology | Cross-machine | Subject MacBook runtime <-> conductor Mac mini runtime |

Note: the checked-in Run 2 record preserves TTIC and TTTV directly. It implies bridge activation happened before the `18:46` confirmed delivery, but the exact TTBA timestamp is not restated in the checked-in summary artifacts.

---

## Run 2 Outcome

What Run 2 demonstrates:

- A human developer could delegate the install to their own OpenClaw agent from a true cold start.
- The published package path stayed pinned to `@chorus-protocol/skill@0.8.0-alpha.9`.
- Registration, credential save, restart-consent flow, bridge activation, Hub delivery, and Telegram-visible output closed end-to-end across two separate OpenClaw runtimes.
- The evidence story is stronger than the older `xiaov <-> xiaox` wording: this was a MacBook subject talking to a Mac mini agent, not a same-runtime self-test.

What Run 2 does not prove:

- Sustained Telegram usability after install. The first message delivery worked; post-delivery stability became a separate follow-up defect.
- Production readiness or SLA. This remains an alpha path with best-effort delivery semantics.

---

## Hard-Criteria Outcome (Run 2)

| Criteria Block | Result | Basis |
|----------------|--------|-------|
| C-1 through C-5 | PASS | Cold-start subject used their own agent, installed the published package, self-registered, followed explicit restart consent, and reached an active bridge path before first delivery |
| C-6 | PASS | Chorus message became visible on Telegram at `18:46` without manual takeover |
| C-7 | PASS | Run 2 verdict was not downgraded for false status reporting |
| C-8 through C-10 | PASS | Run 2 was recorded as a full PASS rather than CONDITIONAL PASS / VOID |
| C-11 | PASS | TTTV stayed within the 60-minute bound (`~6 min`) |

---

## Post-Verdict Friction: IMPL-EXP03-04

Run 2 still surfaced a real implementation defect after the PASS condition had already been met.

| Item | Detail |
|------|--------|
| Defect | `IMPL-EXP03-04` — Telegram polling disconnect after install / consent flow |
| When it appeared | After the Chorus message had already been delivered to Telegram |
| Why PASS still stands | EXP-03 judges the cold-start path through first Telegram-visible delivery; that condition was satisfied at `18:46` |
| Root cause | `restart-consent approve` mutated `openclaw.json`, which triggered an extra OpenClaw hot-reload / restart cycle and broke Telegram polling recovery |
| Tracking docs | `pipeline/tasks/TASK_SPEC_EXP03_TELEGRAM_POLLING_DISCONNECT.md`, `pipeline/handoffs/260403-exp03-run2-handoff.md` |

As of the 2026-04-07 remediation session, the fix direction is:

- `approve` records consent only and does not write `openclaw.json`
- `complete` performs the deferred cleanup write
- cleanup is resumable through a `completing` state instead of assuming a one-shot commit

This follow-up does not change the Run 2 verdict, but it does narrow the honest claim:

- **Proven**: cold-start install -> first Telegram-visible Chorus message
- **Not yet proven by Run 2 alone**: stable continued Telegram polling after install

---

## Conclusion

EXP-03 now has a formal **PASS** run.

The strongest current claim is:

> A cold-start developer on MacBook, using their own OpenClaw agent, installed Chorus from scratch and exchanged a Telegram-confirmed message with an agent on a separate Mac mini in about 6 minutes on `0.8.0-alpha.9`.

That is the canonical EXP-03 result. Run 1 remains useful only as archived failure context. Run 3 (2026-04-08, addendum) does not revise this verdict — it is a later bidirectional observation on `0.8.0-alpha.10` that passed the plumbing layer but failed the product-value layer (cross-cultural language contract). See `EXP-03-run3-findings.md` for the full post-mortem and the parse-layer-first remediation plan shipping in `0.8.0-alpha.11`.

---

## Evidence

Checked-in Run 2 record:

| File | Purpose |
|------|---------|
| `pipeline/handoffs/260403-exp03-run2-handoff.md` | Primary checked-in Run 2 PASS record: timeline, agent ID, trace ID, follow-up defect |
| `docs/distribution/launch-audit-2026-04-07.md` | Cross-machine interpretation, launch-facing wording, and IMPL-EXP03-04 analysis |
| `docs/experiments/EXP-03-human-developer-cold-start.md` | Formal experiment protocol and hard-criteria definitions |
| `pipeline/tasks/TASK_SPEC_EXP03_TELEGRAM_POLLING_DISCONNECT.md` | Formal task spec for the post-verdict polling disconnect defect |

Run 3 addendum (2026-04-08):

| File | Purpose |
|------|---------|
| `docs/experiment-results/EXP-03-run3-findings.md` | Bidirectional A2A observation on `0.8.0-alpha.10`; parse-layer vs execution-layer language failure analysis; IMPL-EXP03-05/06/07/08 backlog |

Archived Run 1 context:

| File | Purpose |
|------|---------|
| `docs/experiment-results/EXP-03-friction-log.md` | Run 1 friction chronology |
| `docs/experiment-results/EXP-03-question-log.md` | Run 1 QC / HIR notes |
| `docs/experiment-results/EXP-03-contamination-check.md` | Run 1 VOID rationale |
| `docs/experiment-results/EXP-03-screening.md` | Run 1 screening record |
| `docs/experiment-results/EXP-03-debrief.md` | Run 1 debrief notes |
| `docs/experiment-results/EXP-03-run1/` | Run 1 raw artifact folder |
