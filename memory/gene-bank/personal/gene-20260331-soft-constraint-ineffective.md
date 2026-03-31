---
id: gene-20260331-soft-constraint-ineffective
trigger: 'when adding behavior rules to SKILL.md that agents must follow during activation'
action: 'do not rely on SKILL.md text alone to enforce critical behavior (like restart consent). Agent LLMs skip soft constraints. Enforce via code gates (CLI exit codes, pre-flight checks) or hard-coded prompts injected at the exact decision point'
confidence: 0.7
topic: 'architecture'
universality: 'global'
project_types: []
role_binding: 'be-domain-modeler'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-31'
updated: '2026-03-31'
evidence:
  - date: '2026-03-31'
    context: 'Alpha.7 SKILL.md added restart consent checkpoint rules. Both MacBook and Mac mini agents ignored the rules and self-restarted gateway without asking user permission or writing checkpoint file.'
---

# SKILL.md Soft Constraints Ineffective for Critical Actions

## Action

Critical activation behaviors (restart consent, checkpoint persistence) must be enforced in code, not in SKILL.md prose. Agent LLMs treat SKILL.md as advisory — they read it but skip steps that feel non-essential to the immediate goal.

## Evidence

- 2026-03-31: Added restart consent + checkpoint rules to alpha.7 SKILL.md. Both agents in EXP-03 retest ignored the rules entirely and called gateway.restart without consent or checkpoint.
