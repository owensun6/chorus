---
id: gene-20260321-entry-point-convergence
trigger: 'when publishing a new CLI feature that changes the recommended install command'
action: 'update ALL user-facing documents in a single commit — README, quickstart, install guide, outreach materials'
confidence: 0.7
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
    context: 'Published 0.4.1 with --target openclaw, but README/quick-trial/outreach still showed old npx init command. Commander caught 4 stale entry points in a single review pass.'
---

# Entry Point Convergence — Update All Docs When the Recommended Command Changes

## Action

After shipping a CLI change that alters the primary install command, grep all user-facing docs for the old command and update in one pass. Entry points drift silently — each stale doc sends a new user down the wrong path.

## Evidence

- 2026-03-21: `--target openclaw` shipped in 0.4.1 but 4 docs still showed `npx @chorus-protocol/skill init` (no target). Commander's review caught: README.md, quick-trial.md, openclaw-install.md, outreach-targets.md all had stale commands.
