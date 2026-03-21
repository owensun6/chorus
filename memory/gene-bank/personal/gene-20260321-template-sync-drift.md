---
id: gene-20260321-template-sync-drift
trigger: 'when npm package contains template copies of source documents'
action: 'diff ALL template/source pairs before every publish — not just the ones you remember changing'
confidence: 0.7
topic: 'workflow'
universality: 'conditional'
project_types: ['npm-package-with-templates']
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-21'
updated: '2026-03-21'
evidence:
  - date: '2026-03-21'
    context: 'PROTOCOL.md en template synced by earlier commit, but zh-CN template missed. Caught during publish checklist, not during the sync commit itself.'
  - date: '2026-03-21'
    context: 'Same RFC-001 change (cultural_context MAY downgrade) was correctly applied to source and en template but silently skipped for zh-CN template.'
---

# Template Sync Drift — Check ALL Pairs, Not Just the Ones You Touched

## Action

When a source document changes, sync ALL template copies in one pass. Run a full diff of every pair, not just the language variant you edited. Automate with a pre-publish check if possible.

## Evidence

- 2026-03-21: RFC-001 `cultural_context` downgrade was synced to `templates/en/PROTOCOL.md` but missed `templates/zh-CN/PROTOCOL.zh-CN.md`. Caught during npm release checklist, 1 commit before publish.
- Root cause: the sync commit targeted "en" explicitly but didn't verify other languages.
