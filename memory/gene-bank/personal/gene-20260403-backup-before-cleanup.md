---
id: gene-20260403-backup-before-cleanup
trigger: 'when cleaning installation traces or resetting environment state that contains credentials or API keys'
action: 'export/backup credential files before deletion; at minimum record agent_id and key source so they can be re-obtained'
confidence: 0.7
topic: 'workflow'
universality: 'global'
project_types: []
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-04-03'
updated: '2026-04-03'
evidence:
  - date: '2026-04-03'
    context: 'Cleaned ~/.chorus/ on Mac mini to prepare for EXP-03 Run 2. This deleted agents/01-xiaoyin.json containing the xiaoyin@chorus API key. The production Hub has no admin delete API, so xiaoyin cannot be re-registered. Had to switch conductor identity to xiaox@chorus which still had its key in a different workspace path.'
---

# Backup Before Cleanup

## Action

Before deleting directories that may contain credentials (API keys, tokens, certificates), check for credential files and export them first. Even if you plan to re-create them, some systems (like Hub registration) don't allow re-registration without the original key.

## Evidence

- 2026-04-03: `rm -rf ~/.chorus/` deleted `agents/01-xiaoyin.json` which contained the only copy of xiaoyin@chorus Hub API key. Production Hub returns ERR_AGENT_ID_TAKEN on re-registration. Key is unrecoverable without DB admin access on Fly.io. Had to switch to xiaox@chorus as conductor for EXP-03 Run 2.
