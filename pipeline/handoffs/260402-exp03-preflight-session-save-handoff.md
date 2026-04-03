# 260402 EXP-03 Preflight Session Save Handoff

## Durable Lessons

- Npm release readiness is not proven by `publish` alone; the audit trail must carry the exact version, dist-tag, shasum, integrity, and a live `npx @version --help` smoke test.
- Section closure and whole pre-flight closure are different verdicts; write them separately so `13.2 PASS` cannot be misread as `Run 2 cleared`.
- "Conductor offline" is too coarse to act on; reduce the blocker to concrete credential files, malformed local state, and live `discover` output before rerunning checks.
- Once a blocker is repaired, remediation must stay bounded to the explicitly allowed reruns; re-judge after that instead of expanding scope by momentum.
- Run 2 stays frozen until Section 13.4 names the subject, passes environment pre-check, and arms recording plus shell/browser history capture.

## Saved To Gene Bank

- `/Users/owenmacmini/.codex/gene-bank/2026-04-02/105235-session-save.md`
