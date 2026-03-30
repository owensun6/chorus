---
id: gene-20260330-tag-then-publish
trigger: 'when publishing an npm package to a registry'
action: 'enforce strict tag-then-publish sequence: (1) bump version in package.json, (2) commit, (3) git tag, (4) run pre-publish validation (tag==HEAD + tarball content + registry clean), (5) npm publish, (6) push. Never publish without a tag pointing to HEAD.'
confidence: 0.9
topic: 'workflow'
universality: 'global'
project_types: ['npm-package']
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-30'
updated: '2026-03-30'
graduated: true
graduated_date: '2026-03-30'
evidence:
  - date: '2026-03-30'
    context: 'v0.8.0-alpha published from commit 6b0a2b2 which was missing 10 commits of critical onboarding fixes. No tag existed at publish time, so there was no traceability. Rectification required: retroactive tag on old baseline, version bump to 0.8.0-alpha.1, pre-publish-check.sh script (validates tag==HEAD, tarball content, registry collision), then republish.'
---

# Tag-Then-Publish Iron Rule

## Action

Never publish an npm package without:
1. A git tag on HEAD matching the package version
2. A pre-publish validation script that enforces: clean tree + tests green + tag==HEAD + tarball contains all required files + version not yet on registry

The `bin/pre-publish-check.sh` pattern (collect all failures before exiting, provide actionable fix commands) should be the standard for all publishable packages.

## Evidence

- 2026-03-30: `@chorus-protocol/skill@0.8.0-alpha` was published from the wrong baseline (missing 10 commits with 3 critical fixes). Required a full rectification: retroactive tag, version bump, script creation, republish. The `pre-publish-check.sh` now validates 17 bridge files + 4 skill templates + tag alignment + registry collision check.
