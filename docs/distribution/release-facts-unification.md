# Release Facts Unification

> Status: active gate
> Purpose: unify the factual layer before any public launch copy is finalized.

Current blocker:
- do not publish while runtime evidence still has unexplained reverse-path gaps (`delivered_sse` is not yet equivalent to bridge-consumed on every validated lane)

## Scope

This document covers only hard facts:

- version numbers
- install paths
- storage model
- license metadata
- public domain / example IDs
- public API surface described in trials

It does not define marketing claims. Those belong in `release-claims-boundary.md`.

## P0 Blocking Fixes

### 1. Unify the release version baseline

Keep exactly one release baseline across:

- Git tag
- GitHub release
- launch kit
- npm package version

Files:

- [packages/chorus-skill/package.json](/Volumes/XDISK/chorus/packages/chorus-skill/package.json)
- [package.json](/Volumes/XDISK/chorus/package.json)
- [github-release-package.md](/Volumes/XDISK/chorus/docs/distribution/github-release-package.md)
- [v0.8.0-alpha-launch-kit.md](/Volumes/XDISK/chorus/docs/distribution/v0.8.0-alpha-launch-kit.md)

Completion standard:

- one version string per release surface
- no mixed `v0.7.0-alpha` vs `0.7.1` ambiguity in public copy without explicit explanation

### 2. Unify OpenClaw install path and install behavior

All public docs must say the same thing:

- one command installs skill to `~/.openclaw/skills/chorus`
- one command installs bridge to `~/.openclaw/extensions/chorus-bridge`
- one command updates `~/.openclaw/openclaw.json`

Files:

- [openclaw-install.md](/Volumes/XDISK/chorus/docs/distribution/openclaw-install.md)
- [README.md](/Volumes/XDISK/chorus/README.md)
- [cli.mjs](/Volumes/XDISK/chorus/packages/chorus-skill/cli.mjs)

Completion standard:

- all docs match actual installer behavior
- no lingering “install only SKILL.md” story

### 3. Unify Hub storage model wording

Public wording must match code:

- SQLite
- WAL mode
- single-instance alpha deployment

Remove legacy wording such as “registry is in-memory”.

Files:

- [github-release-package.md](/Volumes/XDISK/chorus/docs/distribution/github-release-package.md)
- [v0.8.0-alpha-launch-kit.md](/Volumes/XDISK/chorus/docs/distribution/v0.8.0-alpha-launch-kit.md)
- [db.ts](/Volumes/XDISK/chorus/src/server/db.ts)

Completion standard:

- one storage story across release materials

### 4. Unify license metadata

Keep root metadata consistent across:

- LICENSE file
- root package.json
- README
- release copy

Files:

- [LICENSE](/Volumes/XDISK/chorus/LICENSE)
- [package.json](/Volumes/XDISK/chorus/package.json)
- [README.md](/Volumes/XDISK/chorus/README.md)

Completion standard:

- same license string everywhere

## P1 Pre-Launch Fixes

### 5. Remove legacy public domain references

Public entry points must use only:

- `agchorus.com`

Files:

- [quick-trial.md](/Volumes/XDISK/chorus/docs/distribution/quick-trial.md)
- [github-release-package.md](/Volumes/XDISK/chorus/docs/distribution/github-release-package.md)

Completion standard:

- no `chorus-alpha.fly.dev` in external-facing docs

### 6. Fix public `agent_id` examples

Public hub examples should use:

- `@agchorus`

Generic / local examples may still use:

- `@chorus.example`

Files:

- [quick-trial.md](/Volumes/XDISK/chorus/docs/distribution/quick-trial.md)
- [packages/chorus-skill/README.md](/Volumes/XDISK/chorus/packages/chorus-skill/README.md)

Completion standard:

- public examples no longer mix generic and production hosts

### 7. Fix Quick Trial API surface

Public quick trial must distinguish:

- `GET /discover` = public directory
- `GET /agents` = internal/operator path

Files:

- [quick-trial.md](/Volumes/XDISK/chorus/docs/distribution/quick-trial.md)
- [routes.ts](/Volumes/XDISK/chorus/src/server/routes.ts)

Completion standard:

- public docs teach only `GET /discover`

### 8. Update npm README links

Files:

- [packages/chorus-skill/README.md](/Volumes/XDISK/chorus/packages/chorus-skill/README.md)

Completion standard:

- quick trial link points at corrected doc
- hub examples match main README

## Execution Order

1. Version
2. Install path
3. Storage model
4. License
5. Domain and IDs
6. Public API docs
7. npm README

## Exit Criteria

This document is complete when:

- all factual launch surfaces tell the same story
- every public fact is backed by current code
- no stale domain, version, or install-path wording remains
