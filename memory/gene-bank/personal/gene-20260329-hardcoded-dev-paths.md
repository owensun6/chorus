---
id: gene-20260329-hardcoded-dev-paths
trigger: 'when a distributable template/plugin imports modules from absolute filesystem paths'
action: 'bundle all runtime dependencies inside the distributable package and use __dirname-relative paths as primary; dev-repo paths are detection-based fallback only, never hardcoded default'
confidence: 0.9
topic: 'architecture'
universality: 'global'
project_types: []
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-29'
updated: '2026-03-29'
graduated: true
graduated_date: '2026-03-30'
evidence:
  - date: '2026-03-29'
    context: 'runtime-v2.ts hardcoded /Volumes/XDISK/chorus as CHORUS_PROJECT. On MacBook without XDISK, loadRuntimeModules() failed with Cannot find module. Fix: bundle 9 runtime modules in extension/runtime/, resolve from __dirname first.'
  - date: '2026-03-29'
    context: 'Even after bundling, hub-client.ts imported zod which was unavailable in extension node_modules. Fix: add zod to jiti alias pointing to OpenClaw node_modules. Third-party deps in bundled modules need explicit resolution mapping.'
---

# Never Hardcode Dev Machine Paths in Distributable Code

## Action

When a distributable template or plugin needs to import runtime modules:
1. Bundle all required modules inside the package (not as external imports from a dev repo)
2. Use the package's own directory as the primary module resolution path
3. Map third-party dependencies (zod, etc.) via alias to the host platform's node_modules
4. Dev-repo paths should be detection-based fallbacks, clearly marked as dev-only

## Evidence

- 2026-03-29: `const CHORUS_PROJECT = "/Volumes/XDISK/chorus"` in runtime-v2.ts caused `Cannot find module` on any machine without that exact path. Required bundling 9 files + zod alias to fix.
- 2026-03-29: Tests had mocked away the module loading, hiding the problem. Real deployment exposed it instantly.
