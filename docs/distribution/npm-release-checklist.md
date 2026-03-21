# Chorus Skill — npm Release Checklist

Use this checklist before publishing `@chorus-protocol/skill` to npm.

## Release Decision

- [ ] This release has a clear purpose (`first publish`, `bugfix`, `doc sync`, `version bump`)
- [ ] Package version in [`packages/chorus-skill/package.json`](/Volumes/XDISK/chorus/packages/chorus-skill/package.json) is correct
- [ ] The package version matches the intended protocol/doc baseline
- [ ] If this is the first public release, decide whether to publish under `latest` or a prerelease tag

## Metadata

- [ ] [`packages/chorus-skill/package.json`](/Volumes/XDISK/chorus/packages/chorus-skill/package.json) contains the real `repository` URL
- [ ] [`packages/chorus-skill/package.json`](/Volumes/XDISK/chorus/packages/chorus-skill/package.json) contains the real `homepage` URL
- [ ] [`packages/chorus-skill/package.json`](/Volumes/XDISK/chorus/packages/chorus-skill/package.json) contains the real `bugs` URL
- [ ] Package name, description, and keywords reflect the current positioning
- [ ] LICENSE is present in both repo root and package directory

## Content Boundary

- [ ] `npm pack --dry-run` shows only distributable files
- [ ] Tarball does not include runtime files, logs, experiment outputs, or local config
- [ ] Tarball includes:
  - [ ] `cli.mjs`
  - [ ] `README.md`
  - [ ] `LICENSE`
  - [ ] `templates/en/*`
  - [ ] `templates/zh-CN/*`
  - [ ] `templates/shared/*`

## Document Sync

- [ ] [`skill/PROTOCOL.md`](/Volumes/XDISK/chorus/skill/PROTOCOL.md) matches [`packages/chorus-skill/templates/en/PROTOCOL.md`](/Volumes/XDISK/chorus/packages/chorus-skill/templates/en/PROTOCOL.md)
- [ ] [`skill/SKILL.md`](/Volumes/XDISK/chorus/skill/SKILL.md) matches [`packages/chorus-skill/templates/en/SKILL.md`](/Volumes/XDISK/chorus/packages/chorus-skill/templates/en/SKILL.md)
- [ ] [`skill/PROTOCOL.zh-CN.md`](/Volumes/XDISK/chorus/skill/PROTOCOL.zh-CN.md) matches [`packages/chorus-skill/templates/zh-CN/PROTOCOL.zh-CN.md`](/Volumes/XDISK/chorus/packages/chorus-skill/templates/zh-CN/PROTOCOL.zh-CN.md)
- [ ] [`skill/SKILL.zh-CN.md`](/Volumes/XDISK/chorus/skill/SKILL.zh-CN.md) matches [`packages/chorus-skill/templates/zh-CN/SKILL.zh-CN.md`](/Volumes/XDISK/chorus/packages/chorus-skill/templates/zh-CN/SKILL.zh-CN.md)
- [ ] [`skill/TRANSPORT.md`](/Volumes/XDISK/chorus/skill/TRANSPORT.md) matches [`packages/chorus-skill/templates/shared/TRANSPORT.md`](/Volumes/XDISK/chorus/packages/chorus-skill/templates/shared/TRANSPORT.md)
- [ ] [`skill/envelope.schema.json`](/Volumes/XDISK/chorus/skill/envelope.schema.json) matches [`packages/chorus-skill/templates/shared/envelope.schema.json`](/Volumes/XDISK/chorus/packages/chorus-skill/templates/shared/envelope.schema.json)

## CLI Verification

- [ ] `node packages/chorus-skill/cli.mjs` prints the expected version and usage
- [ ] `node packages/chorus-skill/cli.mjs init` creates the expected `chorus/` directory
- [ ] `node packages/chorus-skill/cli.mjs init --lang zh-CN` creates the Chinese variant
- [ ] Re-running `init` into an existing `chorus/` directory fails with a clear error
- [ ] Invalid `--lang` fails with a clear error

## Install Rehearsal

- [ ] `npm pack`
- [ ] Install from the local `.tgz`
- [ ] Run `npx chorus-skill init`
- [ ] Confirm created files match source documents
- [ ] Verify schema JSON parses cleanly
- [ ] Verify Claude Code user-level install path works
- [ ] Verify Claude Code project-level install path works
- [ ] Remove temporary rehearsal files after validation

## Implementation Health

- [ ] `npm test` passes
- [ ] No known packaging-related regressions remain open
- [ ] Current release notes do not claim unverified capabilities

## Publish Readiness

- [ ] npm owner/account is confirmed
- [ ] `npm whoami` returns the intended publishing account
- [ ] Two-factor / token setup is ready
- [ ] Target dist-tag is decided
- [ ] Rollback plan is understood (`deprecate`, patch release, or follow-up fix)

## Post-Publish

- [ ] `npm view @chorus-protocol/skill version` shows the expected version
- [ ] `npx @chorus-protocol/skill init` works against the published package
- [ ] README on npm renders correctly
- [ ] Install docs stay consistent with the published package behavior
