---
id: gene-20260321-dont-guess-metadata
trigger: 'when writing repository/homepage/bugs URLs in package.json'
action: 'verify with git remote -v first; if no remote exists, omit the fields rather than guess'
confidence: 0.9
topic: 'workflow'
universality: 'global'
project_types: []
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-21'
updated: '2026-03-21'
evidence:
  - date: '2026-03-21'
    context: 'Wrote repository URL as github.com/anthropics/chorus (guessed). Commander caught it: no git remote existed to prove this was the actual repo. Had to delete and re-add after creating the real repo.'
graduated: true
graduated_date: '2026-03-21'
---

# Don't Guess Package Metadata — Verify or Omit

## Action

Never fill `repository`, `homepage`, or `bugs` fields with assumed URLs. Run `git remote -v` first. If empty, leave the fields out. Add them when the real URL is known.

## Evidence

- 2026-03-21: package.json shipped with `github.com/anthropics/chorus` — a plausible but unverified URL. Commander flagged: "一旦发到 npm，用户会被导向可能错误的主页". Fields removed, re-added only after `owensun6/chorus` was actually created.
