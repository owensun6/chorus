<!-- Author: Lead -->

# Agent Team QA Scheme — Multi-Agent Code Contribution Quality Assurance

> Purpose: Systematic quality gate for code produced by any AI agent (Claude, Codex, Gemini, future agents) contributing to the Chorus codebase.
> Lesson source: Codex Bridge v2 review (功能 A / 规范 C+), 3 rounds of Commander correction, security audit 28 security + 1 correctness findings.

---

## 1. Problem Statement

Multi-agent codebases face unique quality risks that single-developer workflows don't:

| Risk | Evidence from Chorus |
|------|---------------------|
| **Agents don't read project rules** | Codex delivered 8 `let` violations, 13 wrong Author stamps — never loaded `.claude/rules/` |
| **Agents introduce subtle security holes** | Dynamic code execution in shell scripts, `.passthrough()` in schemas |
| **Agents produce "correct but non-compliant" code** | RouteLock logic was flawless, but duplicated a helper already exported from `state.ts` |
| **Cross-agent consistency gaps** | Different agents use different naming conventions, error patterns, import styles |
| **Coverage regression** | Branch coverage dropped to 74.8% after Codex commits — no agent checked threshold |

---

## 2. QA Gate Architecture

```
Agent produces code
        │
        ▼
┌─────────────────┐
│  Gate A: Static  │  Automated, <30s, blocks merge
│  Compliance Scan │
└────────┬────────┘
         │ PASS
         ▼
┌─────────────────┐
│  Gate B: Test    │  Automated, <5min, blocks merge
│  Integrity Check │
└────────┬────────┘
         │ PASS
         ▼
┌─────────────────┐
│  Gate C: Cross-  │  Agent-driven, <10min, blocks merge
│  Agent Review    │
└────────┬────────┘
         │ PASS
         ▼
┌─────────────────┐
│  Gate D: Security│  Agent-driven, triggered by file-path patterns
│  Spot Check      │
└────────┬────────┘
         │ PASS
         ▼
   Commander signs
```

---

## 3. Gate A: Static Compliance Scan (Automated)

**Trigger**: Every commit by any agent, before `git commit` completes (pre-commit hook or CI step).

**Checks**:

| # | Check | Tool | Block Level |
|---|-------|------|-------------|
| A1 | `let` usage (except `for` loops) | `grep -rn 'let ' src/ --include='*.ts' \| grep -v 'for (let'` | ERROR |
| A2 | Author stamp present on new/modified files | `bin/fusion-lint.sh` L2 | ERROR |
| A3 | Author stamp is a valid role name | Validate against `.claude/rules/01-fusion-roles.md` role list | ERROR |
| A4 | No `console.log` / `TODO` / `FIXME` in production code | `bin/fusion-lint.sh` L3 | WARNING→ERROR |
| A5 | File ≤ 300 lines | `bin/fusion-lint.sh` L4 | WARNING |
| A6 | No hardcoded secrets (API_KEY, PASSWORD, TOKEN patterns) | `bin/fusion-lint.sh` L1 | CRITICAL |
| A7 | `tsc --noEmit` passes (zero type errors) | TypeScript compiler | ERROR |
| A8 | `.passthrough()` not used in Zod schemas | grep pattern | ERROR |
| A9 | No dynamic code execution constructs | grep for dangerous patterns | CRITICAL |
| A10 | No unquoted shell variables in `bin/*.sh` | shellcheck | WARNING |

**Implementation**: `bin/agent-qa-gate-a.sh` — single script, exit 0 = pass, exit 1 = block with report.

**Key design decision**: Gate A is mechanical. No judgment calls. If it can be checked by grep/tsc, it belongs here.

---

## 4. Gate B: Test Integrity Check (Automated)

**Trigger**: After Gate A passes. Runs full test suite.

**Checks**:

| # | Check | Threshold | Block Level |
|---|-------|-----------|-------------|
| B1 | All tests pass | 0 failures | ERROR |
| B2 | Statement coverage | ≥ 80% | ERROR |
| B3 | Branch coverage | ≥ 80% | ERROR |
| B4 | Function coverage | ≥ 80% | ERROR |
| B5 | No new test files with 0 assertions | grep for `expect`/`assert` | WARNING |
| B6 | No skipped tests (`.skip`, `xit`, `xdescribe`) | grep pattern | WARNING |
| B7 | No open handle leaks | `--detectOpenHandles` (see below) | WARNING |

**Implementation**: `npx jest --runInBand --coverage --detectOpenHandles 2>&1 | tee jest.log` + threshold check script. B7 is WARNING (non-blocking): `grep -q 'worker.*has not exited\|open handle' jest.log && echo "WARN: open handles detected"`. This uses the same `--detectOpenHandles` flag as `bin/release-gate.sh:76` (though that script runs a subset of tests, not the full suite). B7 does NOT exit 1 — it reports but does not block merge.

**Incremental check**: For PRs, also run `jest --changedSince=main` to identify which new code lacks tests.

---

## 5. Gate C: Cross-Agent Review (Agent-Driven)

**Trigger**: After Gate B passes. A different agent instance reviews the code.

**Principle**: The reviewing agent MUST NOT be the same agent that wrote the code. This prevents confirmation bias.

### Review Checklist (reviewer fills out):

```markdown
## Cross-Agent Review — [PR/commit ref]

Reviewer: [agent name + model]
Producer: [agent name + model]

### Compliance
- [ ] All modified files have correct Author stamp for the producing agent's role
- [ ] No role boundary violations (UI agent touching DB, domain agent touching routes)
- [ ] Naming conventions match existing codebase patterns

### Duplication
- [ ] No functions duplicated from existing exports (check with grep)
- [ ] No re-implementation of utilities already in src/shared/

### Architecture
- [ ] Changes align with the active phase's architecture docs (e.g., `pipeline/bridge-v2-validation/` for Bridge v2, `pipeline/1_architecture/` for Phase 1). Reviewer must identify which phase is active from `pipeline/monitor.md` before checking.
- [ ] New interfaces follow existing patterns (Repository, Response envelope)
- [ ] Error handling follows fault containment rules (try-catch on I/O)

### Immutability
- [ ] No object mutation (spread operator for updates, no in-place modification)
- [ ] State transitions return new objects

### Verdict
- [ ] PASS — merge-ready
- [ ] CONDITIONAL — merge after listed fixes
- [ ] REJECT — requires rework
```

**Output**: Review document saved to `pipeline/reviews/YYYY-MM-DD-[agent]-review.md`.

---

## 6. Gate D: Security Spot Check (Triggered by File Path)

**Trigger**: When modified files match security-sensitive patterns.

| File Pattern | Security Check Required |
|-------------|----------------------|
| `src/server/auth.ts` | Auth bypass regression test |
| `src/server/routes.ts` | New endpoints must have auth + rate limiting |
| `src/server/validation.ts`, `src/shared/types.ts` | Schema strictness (no `.passthrough()`) |
| `src/server/registry.ts` | Invite code race condition test |
| `src/bridge/hub-client.ts` | No credential in URL, buffer size limits |
| `bin/*.sh` | No unquoted variables, no dynamic code execution |
| `*.sql`, `db.ts` | Parameterized queries only |
| `Dockerfile`, `docker-compose.yml` | Base image pinned, no secrets in build args |

**Implementation**: CI job that reads changed-file list and triggers targeted security review agent.

---

## 7. Agent Onboarding Protocol

When a new agent type (e.g., Gemini, Codex, DeepSeek) contributes code for the first time:

### Step 1: Capability Assessment (one-time)

Run a small calibration task and evaluate:

| Dimension | Test | Pass Criteria |
|-----------|------|---------------|
| Rule compliance | Give agent a task + point to `.claude/rules/` | Zero `let`, correct Author stamp |
| Code style | Review output for immutability, naming | Matches existing patterns |
| Test writing | Ask for tests first (TDD) | RED commit before GREEN commit |
| Security awareness | Task involving user input | Input validation present |
| Documentation | Check Author stamps, comments | Present and accurate |

### Step 2: Supervision Level Assignment

Based on calibration:

| Score | Level | Gate Requirements |
|-------|-------|-------------------|
| 5/5 | Trusted | Gate A + B (automated only) |
| 3-4/5 | Supervised | Gate A + B + C (cross-agent review) |
| 1-2/5 | Restricted | Gate A + B + C + D (full review + security) |

### Step 3: Progressive Trust

After 5 successful contributions at current level, eligible for promotion to next level. Any REJECT resets counter.

---

## 8. Monitoring & Metrics

Track per-agent quality over time:

```
Agent Quality Dashboard
─────────────────────────
Agent        │ Contributions │ Gate A Pass % │ Gate B Pass % │ Rejects │ Trust Level
─────────────┼───────────────┼───────────────┼───────────────┼─────────┼────────────
claude-opus  │ 47            │ 98%           │ 95%           │ 1       │ Trusted
codex        │ 5             │ 40%           │ 100%          │ 0       │ Restricted
gemini       │ 0             │ -             │ -             │ -       │ New
```

**Key metric**: Gate A first-pass rate. This directly measures whether an agent reads and follows project rules. Codex scored ~40% (8 `let` + 13 Author stamp violations in 5 commits).

---

## 9. Integration with Fusion-Core Pipeline

This QA scheme integrates into the existing Fusion-Core workflow:

**所有 4 个 Gate 均在 Stage 5 → Stage 6 交接前完成**，作为 Stage 6 funnels 的前置过滤器：

| 时机 | QA Gate | Who |
|------|---------|-----|
| Stage 5: 每个 T-ID GREEN 后 | Gate A (static) + Gate B (test) | Dev agent 自检 |
| Stage 5 全部完成后、Stage 6 启动前 | Gate C (cross-agent review) | 不同 agent 实例 |
| Gate C 同期，仅当改动匹配安全敏感路径时 | Gate D (security spot check) | 安全审查 agent |
| Stage 7 (merge) | 验证所有 Gate 记录 | Lead |

### Stage 6 funnels 不变（Gate A-D PASS 后才进入）:

```
qa-01 (functional) → qa-02 (perf/UX) → qa-03 (security) → qa-04 (domain) →
iv-01 (E2E) → iv-02 (ACID) → iv-03 (chaos)
```

Gate D 与 Stage 6 的 qa-03 的区别：Gate D 是文件路径触发的快速扫描（<2min），qa-03 是 OWASP Top 10 全覆盖审计。两者不重叠——Gate D 抓机械模式（无 auth、schema 松散），qa-03 做深度逻辑审计（IDOR、CSRF、权限绕过）。

---

## 10. Implementation Checklist

- [ ] Create `bin/agent-qa-gate-a.sh` with checks A1-A10
- [ ] Add coverage threshold enforcement to CI (currently configured but branch coverage fails)
- [ ] Create cross-agent review template at `pipeline/reviews/TEMPLATE.md`
- [ ] Define security-sensitive file patterns in `.github/security-paths.yml`
- [ ] Create agent quality tracking table in `pipeline/agent-quality-log.md`
- [ ] Add Gate A as pre-commit hook (`.claude/hooks/` or git pre-commit)
- [ ] Document agent onboarding protocol in `docs/agent-onboarding.md`

---

## 11. Anti-Patterns to Avoid

| Anti-Pattern | Why It Fails | What To Do Instead |
|-------------|-------------|-------------------|
| "Trust all agents equally" | Codex proved agents have different compliance levels | Progressive trust based on evidence |
| "Review everything manually" | Commander reviewed 3 rounds — expensive | Automate mechanical checks (Gate A) |
| "Skip review for small changes" | Small changes can introduce `.passthrough()` or unsafe patterns | Gate A runs on ALL commits |
| "Let the producing agent self-review" | Confirmation bias — agent won't catch its own patterns | Cross-agent review (Gate C) |
| "Only check tests pass" | Tests passed but branch coverage dropped 5.2% | Check coverage thresholds (Gate B) |
| "Security review at the end" | By then the architecture is set, fixes are expensive | Gate D triggers early on sensitive files |

---

## 12. Cost-Benefit Analysis

| Without QA Scheme | With QA Scheme |
|-------------------|----------------|
| Codex 5 commits → 4 remediation items → 3 Commander review rounds | Gate A catches let/Author/passthrough before commit |
| Security audit finds 30 issues post-merge | Gate D catches auth/validation issues at PR time |
| Branch coverage silently drops below threshold | Gate B blocks merge until 80% restored |
| ~3 hours Commander time per Codex batch | ~5 minutes automated gates + 10 min cross-review |
