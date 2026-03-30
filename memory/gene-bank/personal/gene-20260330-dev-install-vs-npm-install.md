---
id: gene-20260330-dev-install-vs-npm-install
trigger: 'when testing a published npm package that includes runtime modules loaded via jiti/TypeScript transpilation'
action: 'always test from a clean npm install, not from dev-installed files that may load from source repo paths; the two installations can exhibit different runtime behavior (module resolution paths, load time, side effects)'
confidence: 0.7
topic: 'testing'
universality: 'conditional'
project_types: ['npm-package', 'plugin-system']
role_binding: 'be-ai-integrator'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-30'
updated: '2026-03-30'
evidence:
  - date: '2026-03-30'
    context: 'chorus-bridge loaded from dev-installed files used source repo runtime path via jiti, blocking Telegram channel startup (mutual exclusion). Same bridge installed from npm package used bundled runtime/, loaded fast, no blocking. The "mutual exclusion" was an artifact of dev installation, not a real product defect.'
---

# Dev Install vs npm Install Behavioral Divergence

## Action

When validating a published npm package that loads TypeScript modules at runtime (via jiti or similar), always test from a clean `npm install` / `npx` install — never from files manually copied from a dev environment. Dev-installed files may resolve modules from the source repo path (heavy, slow), while npm-installed files use bundled paths (lightweight, fast). This difference can cause bugs that only appear in one installation mode.

## Evidence

- 2026-03-30: chorus-bridge installed from local dev had no `runtime/` directory and loaded modules from `/Volumes/XDISK/chorus/packages/chorus-skill/src/bridge/` via jiti, which blocked Gateway startup and prevented Telegram channel initialization ("mutual exclusion"). The same bridge installed from npm `0.8.0-alpha.1` used `~/.openclaw/extensions/chorus-bridge/runtime/` (bundled), loaded without blocking, and coexisted with all 4 Telegram bots. The "mutual exclusion" bug was entirely an artifact of dev installation path resolution.
