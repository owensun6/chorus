---
id: gene-20260328-codex-reads-arch-not-rules
trigger: 'when reviewing Codex output in a Fusion-Core project'
action: 'expect architecture compliance (System_Design.md) to be strong but coding style rules (.claude/rules/) to be ignored — budget time for let/Author/duplicate cleanup'
confidence: 0.6
topic: 'workflow'
universality: 'conditional'
project_types: ['multi-agent']
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-28'
updated: '2026-03-28'
evidence:
  - date: '2026-03-28'
    context: 'Codex Bridge v2 hardening: perfectly followed 9-step Recovery sequence from System_Design.md, but violated let ban (8 instances), used Author:codex instead of role names (13 files), duplicated compareCursorPosition, and used Function constructor in shell scripts'
---

# Codex Reads Architecture, Not Rules

## Action

When Codex delivers code in a project with both architecture docs and coding rules:
- Architecture compliance (data flows, state machine sequences, API contracts) will likely be correct
- Coding style rules (immutability, Author stamps, file size limits, security patterns) will likely be ignored
- Plan review time for style remediation proportional to number of new files

This is a single observation (n=1). May change as Codex evolves or with different instruction approaches.

## Evidence

- 2026-03-28: 5 Codex commits for Bridge v2 hardening. Recovery engine perfectly followed System_Design.md §5 nine-step sequence. But: 8 let violations, 13 Author stamp violations, 1 duplicate function, 2 shell injection patterns. All functional tests passed (429/429).
