---
id: gene-20260403-config-write-cascade
trigger: 'when writing to a shared config file (e.g. openclaw.json) that has a file-watcher/hot-reload mechanism'
action: 'batch all writes into the minimum number of atomic operations, separated by long intervals; never write the same config file from multiple steps in a single workflow'
confidence: 0.7
topic: 'architecture'
universality: 'global'
project_types: []
role_binding: 'be-domain-modeler'
source: 'session'
campaign_id: 'chorus'
created: '2026-04-03'
updated: '2026-04-03'
evidence:
  - date: '2026-04-03'
    context: 'Chorus init writes openclaw.json (skill+plugin+deny), then approve writes it again (remove deny). Each write triggers OpenClaw hybrid reload watcher (1s debounce), causing cascading gateway restarts. Telegram polling failed to recover after second restart. Fix: defer deny removal from approve to complete step.'
---

# Config Write Cascade

## Action

When a workflow modifies a shared config file that has a file-watcher/hot-reload mechanism, batch all writes into minimum operations. Never write the same config from multiple sequential steps — each write triggers a reload cycle that compounds. Defer non-critical writes to the latest possible step.

## Evidence

- 2026-04-03: EXP-03 Run 2. Chorus `init` writes openclaw.json once (OK). Then `restart-consent approve` writes it again to remove deny, triggering a second automatic gateway restart. Telegram polling lost after the cascade. The deny removal was non-critical at approve time — deferring to `complete` step eliminates the second write entirely.
