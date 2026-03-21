---
id: gene-20260320-evidence-before-claims
trigger: 'when writing status reports, experiment summaries, or any document that contains numerical claims'
action: 'do attach artifact index table mapping every claim to a verifiable file path or command; mark claims with weak evidence explicitly'
confidence: 0.9
topic: 'workflow'
universality: 'global'
project_types: []
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-20'
updated: '2026-03-20'
evidence:
  - date: '2026-03-20'
    context: 'Status report v1 claimed 82.82% coverage (actual: 82.56%), cited non-existent file src/agent/chorus-agent.ts, and used self-reported scores with no baseline. Commander rejected as "self-report audit, not evidence". v2 added artifact index table with every path verified.'
  - date: '2026-03-20'
    context: 'EXP-01 summary initially wrote "仅凭 SKILL.md" when the agent actually received SKILL.md + task prompt. Commander caught the overreach and required correction.'
graduated: true
graduated_date: '2026-03-21'
---

# Evidence Before Claims

## Action

Every numerical claim or verification statement in a deliverable must have a corresponding entry in an artifact index table. Each entry maps to: exact file path, exact command to reproduce, or exact commit hash. If evidence is weak (e.g., self-reported, no independent test file), mark it explicitly as "evidence strength insufficient". Never write "verified" or "confirmed" without pointing to the artifact.

## Evidence

- 2026-03-20: Coverage number 82.82% was approximate (actual 82.56% from `coverage/lcov-report/index.html`). CI pipeline didn't exist but wasn't mentioned. Cross-platform 5/5 had no independent test file.
- 2026-03-20: EXP-01 conclusion scope expanded beyond evidence — "仅凭 SKILL.md" vs actual "SKILL.md + minimal task prompt". Commander required precision.
