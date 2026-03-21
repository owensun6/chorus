# Release: @chorus-protocol/skill@0.4.1

Published 2026-03-21 | [npm](https://www.npmjs.com/package/@chorus-protocol/skill)

## What Changed

CLI now supports `--target` for direct install into agent platforms:

```bash
npx @chorus-protocol/skill init --target openclaw       # ~/.openclaw/skills/chorus/ + auto-register
npx @chorus-protocol/skill init --target claude-user     # ~/.claude/skills/chorus/
npx @chorus-protocol/skill init --target claude-project  # .claude/skills/chorus/
npx @chorus-protocol/skill uninstall --target openclaw   # remove + unregister
```

OpenClaw install is now one command instead of manual file copy + config edit.

## What Else Shipped

- All entry-point docs (README, quick-trial, install guide, outreach targets) updated to use `--target openclaw` as the primary path
- `release-0.4.0.md` preserved as-is — this is an addendum, not a rewrite

## Verified

- `--target openclaw`: install, register, uninstall, unregister all tested
- `--target claude-user`: install and uninstall tested
- Local default (`init` without `--target`): backwards compatible
- Error handling: existing directory, invalid target, invalid language
- 13 test suites, 142 tests passing
- Published to npm, `npx @chorus-protocol/skill@0.4.1 init --target openclaw` works from registry

## Not Changed

- Protocol version remains 0.4
- Template content identical to 0.4.0
- No changes to SKILL.md, PROTOCOL.md, TRANSPORT.md, or envelope.schema.json
