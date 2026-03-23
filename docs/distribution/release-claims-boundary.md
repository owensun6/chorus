# Release Claims Boundary

> Status: active gate
> Purpose: define exactly what public launch copy may and may not claim.

Current blocker:
- no public copy may upgrade from "validated on one path" to a broader promise until reverse-path runtime evidence is closed with real logs

## Rule

Public copy may only claim capabilities supported by current evidence.

If a statement is not backed by:

- current tests
- current build
- current runtime verification

it must be downgraded or removed.

## Single Source of Truth

Use [github-release-package.md](/Volumes/XDISK/chorus/docs/distribution/github-release-package.md) as the canonical release-evidence summary.

All launch materials must be downstream of that file.

## Allowed Claims

### 1. Infrastructure / product framing

Allowed:

- Chorus is an open protocol.
- OpenClaw official path is `skill + bridge`.
- Chorus is not another chat app.
- Bridge handles connection infrastructure.
- Skill handles protocol semantics and behavior rules.

### 2. Runtime verification

Allowed:

- single-path delivery has been verified
- backlog drain has been verified
- auto-drain has been verified
- translation / adaptation path has been verified on the validated route

Allowed phrasing:

- “verified on one path”
- “single-path bridge delivery verified”
- “bridge runtime path verified”
- “alpha, controlled rollout”

### 3. Evidence

Allowed evidence types:

- `npm test -- --runInBand` current passing result
- `npm run build` passing result
- runtime proof limited to validated bridge path(s)

## Disallowed Claims

Remove or downgrade all of the following unless new evidence lands first:

- “bidirectional verified”
- “MiniMax bidirectional”
- “multi-turn final integration”
- “已验证双向互聊”
- “anyone, any language, any chat app” as a fully achieved present-tense promise
- “any OpenClaw agent can already auto-chat with any other agent”

## Required Caveats

Every launch packet must preserve these caveats somewhere visible:

1. Alpha, controlled rollout.
2. Multi-agent session surface and identity attribution are still converging.
3. Bridge does not mean arbitrary agents already chat stably out of the box.
4. Best-effort delivery; no SLA.

## Current Messaging Ceiling

Use wording at this strength or lower:

English:

- “Talk across chat apps and languages with OpenClaw agents.”
- “OpenClaw bridges the app, language, and cultural gap.”

Chinese:

- “通过 OpenClaw，在不同聊天软件和不同语言之间建立自然沟通。”
- “OpenClaw 负责跨平台传递、翻译和文化适配。”

Avoid stronger present-tense claims until runtime evidence catches up.

## P0 Blocking Fixes

### 1. Remove overclaimed bidirectional / multi-turn language

Files:

- [README.md](/Volumes/XDISK/chorus/README.md)
- [github-release-package.md](/Volumes/XDISK/chorus/docs/distribution/github-release-package.md)
- [v0.8.0-alpha-launch-kit.md](/Volumes/XDISK/chorus/docs/distribution/v0.8.0-alpha-launch-kit.md)

Completion standard:

- only single-path verified statements remain

### 2. Update stale test counts

Files:

- [github-release-package.md](/Volumes/XDISK/chorus/docs/distribution/github-release-package.md)
- [v0.8.0-alpha-launch-kit.md](/Volumes/XDISK/chorus/docs/distribution/v0.8.0-alpha-launch-kit.md)

Completion standard:

- current test/build numbers only

### 3. Add explicit alpha caveat for unfinished bridge/runtime work

Files:

- [README.md](/Volumes/XDISK/chorus/README.md)
- [v0.8.0-alpha-launch-kit.md](/Volumes/XDISK/chorus/docs/distribution/v0.8.0-alpha-launch-kit.md)

Completion standard:

- explicit statement that validated runtime scope is narrower than full product promise

## Review Order

1. Canonical evidence file
2. README
3. launch kit
4. release/discussion copy
5. social snippets

## Exit Criteria

This document is complete when:

- all public claims are evidence-backed
- no overclaim remains in launch materials
- all materials preserve the same alpha boundary
