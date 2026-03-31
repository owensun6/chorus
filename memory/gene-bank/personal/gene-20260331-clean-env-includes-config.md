---
id: gene-20260331-clean-env-includes-config
trigger: 'when cleaning a machine for experiment or fresh install testing'
action: 'do not just delete chorus files — also remove plugin/skill references from openclaw.json and clear npx cache. Stale config references cause recursive stack overflow when gateway loads a missing plugin'
confidence: 0.9
topic: 'workflow'
universality: 'conditional'
project_types: ['chorus']
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-31'
updated: '2026-03-31'
graduated: true
graduated_date: '2026-03-31'
evidence:
  - date: '2026-03-31'
    context: 'Deleted chorus-bridge/ and skills/chorus/ but left openclaw.json plugin references. Gateway hit recursive stack overflow: config warning → console.warn → logger init → read config → warning → infinite loop. Required Commander intervention to clean openclaw.json manually.'
---

# Clean Environment Must Include Config References

## Action

Environment cleanup checklist for Chorus:
1. `~/.openclaw/extensions/chorus-bridge/` — delete
2. `~/.openclaw/skills/chorus/` — delete
3. `~/.openclaw/workspace/chorus-credentials.json` — delete
4. `openclaw.json` plugins.allow — remove "chorus-bridge"
5. `openclaw.json` plugins.entries.chorus-bridge — remove
6. `openclaw.json` skills.entries.chorus — remove
7. `~/.npm/_npx/` — clear (prevent stale version cache)

## Evidence

- 2026-03-31: Incomplete cleanup caused recursive stack overflow on MacBook, blocking EXP-03 start. Commander had to manually fix openclaw.json.
