<!-- Author: Lead -->
<!-- status: SUPERSEDED 2026-03-29 — this document is a frozen historical snapshot; authoritative verdict is now in final-verdict.md -->

# Chorus Release Gap Analysis — 2026-03-28 (HISTORICAL)

> **SUPERSEDED**: This document was written on 2026-03-28 when the verdict was FAIL with R-1/R-2/R-3 all open. As of 2026-03-29, the authoritative verdict is **CONDITIONAL PASS** (R-1 CLOSED, R-2 Telegram CLOSED, R-2 WeChat BLOCKED, R-3 CLOSED). See `pipeline/bridge-v2-validation/final-verdict.md` for current truth.
>
> This file is preserved as a historical record of the gap analysis process. Do not use it as current release status.

---

## Layer 1: Authoritative Release Blockers

These are inherited from the frozen technical verdict. All 3 must be resolved before the verdict can be reopened.

| # | Blocker | Authority | Current Status |
|---|---------|-----------|----------------|
| **R-1** | **Direct SSE timestamp contract** — `final-verdict.md` claims direct SSE path is contract-broken for new inbound events (no `timestamp`). This is a live boundary claim, not a repo-code claim. | `final-verdict.md:18-22` | Repo fixed (commit `90c59b4`). **Local verified PASS** (`evidence/R-01-sse-timestamp-local.md`). Live `agchorus.com` still on `0.7.0-alpha` — not yet revalidated on deployed version. |
| **R-2** | **Delivery acceptance at downgraded semantics** — frozen as `unverifiable acceptable`, needs upgrade to stronger delivery truth. Currently constrained by verified host reality (`V-01-01` WeChat = NO, `V-01-02` Telegram = NO); upgrade requires host adapter capability evolution or Commander redefining acceptable delivery truth | `final-verdict.md:11-12`, `manual-acceptance:65-66` | Not upgraded |
| **R-3** | **Reply attribution at downgraded semantics** — frozen as `session-level acceptable`, needs upgrade to stronger reply attribution truth. Upgrade path undefined; not pre-judged as host-only constraint | `final-verdict.md:13-14`, `manual-acceptance:66-67` | Not upgraded |

### Verdict Reopening Protocol

Per `manual-acceptance:63-68`:

1. Reopen from a clean, explicitly-scoped validation state (not the current mixed workspace)
2. Fix direct SSE timestamp contract (R-1)
3. Upgrade acceptance truth from downgraded semantics (R-2, R-3)
4. Rewrite `final-verdict.md` and `manual-acceptance-2026-03-28.md` together so both authoritative verdicts name the same blocker set

**Reopening the authoritative verdict is necessary but not sufficient for alpha launch.** Layer 2 gates must also pass.

---

## Layer 2: Additional Hardening / QA Gates

These do not change the authoritative release verdict, but define the security and quality baseline for any public-facing deployment.

### Security (from `security-audit-2026-03-28.md`)

| Priority | ID | Finding | Current Status |
|----------|----|---------|----------------|
| CRITICAL | C-01 | GET auth bypass — `/activity`, `/events`, `/console`, `/arena` unauthenticated | Closed in `46641e7` |
| CRITICAL | C-02 | API key exposed in SSE query parameter | Closed in `48e9041` + `809f2c3` |
| CRITICAL | C-03 | `.passthrough()` + no `original_text` max length | Closed in `1ff7398` + `3b8fea0` |
| CRITICAL | C-04 | SSRF — endpoint registration does not block private IPs | Closed in `58e64f6` + `87bf322` |
| CRITICAL | C-05 | Idempotency keys never cleaned up (unbounded disk growth) | Closed in `647d620` |
| HIGH | H-01 | Rate limit bypass via X-Forwarded-For spoofing | Closed in `7eeea85` |
| HIGH | H-02 | SSE buffer unbounded (OOM vector) | Closed in `59e7dd7` |
| HIGH | H-06 | Shell injection in `alpha-smoke.sh` | Closed in `de7d6af` |
| HIGH | H-08 | `agent_id` format not enforced at registration | Closed in `7a45f1a` |

### Test / CI

| Item | Source | Current |
|------|--------|---------|
| Branch coverage | Previously 74.8% (`security-audit-2026-03-28.md:256`); now 80.03% after test additions | PASS |
| Jest clean exit | Previously had `did-not-exit` warning; now exits cleanly | PASS |
| TypeScript | `npx tsc --noEmit` | PASS |
| Full test suite | `npx jest --runInBand --coverage=false` | PASS (`36 suites / 507 tests`) |

### Remaining from security audit

7 MEDIUM + 8 LOW findings — see `security-audit-2026-03-28.md` for full list.

---

## Shortest Path

There is no simple "do N things and ship" conclusion. The correct sequence:

1. **Close R-1** (SSE timestamp) — repo code already fixed (commit `90c59b4`); remaining action is deploy to a controlled environment and revalidate with `bin/probe-sse-timestamp.sh`. Production deploy is a separate risk decision gated by Layer 2 security hardening.
2. **R-2 is constrained by host reality** — upgrade requires host adapter capability evolution or Commander redefining acceptable delivery truth
3. **R-3 upgrade path is undefined** — not pre-judged as host-only constraint
4. After all 3 are resolved, reopen verdict from clean validation state per `manual-acceptance:63-68`, updating both authoritative documents in sync
5. Reopening the authoritative verdict is necessary but not sufficient; Layer 2 critical/high hardening is now closed and QA gates are green, but the authoritative verdict still cannot be reopened until `R-1`, `R-2`, and `R-3` are resolved from a clean validation state

---

## What Is Already Done

| Milestone | Status |
|-----------|--------|
| Protocol v0.4 (envelope + SKILL + TRANSPORT) | Phase 5 PASS, cross-platform 5/5 |
| Hub server (routing/registry/SSE/idempotency) | Phase 1+2 merged to main |
| Bridge v2 (state machine + recovery + relay) | Bridge v2 merged to main |
| Bridge runtime validation | CONDITIONAL |
| Release-truth corrections | Closed (gate truth + serialization + release-gate) |
| tsc | Zero errors |
| Tests | 35 suites / 475 pass |
| Security audit | 28 security + 1 correctness findings documented |
| Agent Team QA scheme | 4-gate scheme designed (A/B/C/D) |
