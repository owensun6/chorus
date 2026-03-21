# Chorus Skill — Installation Guide

Install the Chorus protocol skill for your AI agent.

## What You're Installing

Five files that teach an agent how to send and receive cross-cultural messages:

| File | Purpose |
|------|---------|
| `SKILL.md` | Agent reads this to learn the protocol |
| `PROTOCOL.md` | Formal specification (v0.4) |
| `TRANSPORT.md` | HTTP binding — register, send, receive |
| `envelope.schema.json` | Envelope JSON Schema |
| `examples/` | Sample envelopes (en, zh-CN, ja) |

Your agent only needs `SKILL.md`. The other files are reference material.

## Install

```bash
npx @chorus-protocol/skill init --target openclaw
```

This installs files to `~/.openclaw/skills/chorus/` and registers the skill in `~/.openclaw/openclaw.json`.

Chinese variant: add `--lang zh-CN`.

## Verify

```bash
npx @chorus-protocol/skill verify --target openclaw
```

Two checks: `SKILL.md` exists and is non-empty; `openclaw.json` has chorus registered and enabled.

## Envelope Test

Ask your agent:

> "Compose a Chorus envelope from a Japanese agent to a Chinese agent, saying 'Let's discuss the project schedule.'"

Then validate the output:

```bash
npx @chorus-protocol/skill verify --envelope '{"chorus_version":"0.4","sender_id":"agent-ja@example","original_text":"プロジェクトのスケジュールについて相談しましょう。","sender_culture":"ja"}'
```

If it prints `✓ Valid Chorus envelope`, the skill is working.

## Update

```bash
npx @chorus-protocol/skill uninstall --target openclaw
npx @chorus-protocol/skill init --target openclaw
```

## Uninstall

```bash
npx @chorus-protocol/skill uninstall --target openclaw
```

## Troubleshooting

### `npx` fails with permission error

Try with explicit version:

```bash
npx @chorus-protocol/skill@latest init --target openclaw
```

### Directory already exists

The CLI refuses to overwrite. Remove the existing directory first:

```bash
npx @chorus-protocol/skill uninstall --target openclaw
npx @chorus-protocol/skill init --target openclaw
```

### openclaw.json not found

OpenClaw must be installed first. The CLI needs `~/.openclaw/openclaw.json` to exist. Install OpenClaw, then re-run.

### Agent doesn't recognize the skill

Verify the agent's skill/prompt configuration includes the path to `SKILL.md`. The file must be readable by the agent at prompt-loading time — not just present on disk.

---

## Appendix: Alternative Install Paths

These paths are compatible but not the primary route. Use them only if OpenClaw is not available.

**Claude Code — user-level skill:**

```bash
npx @chorus-protocol/skill init --target claude-user
# Installs to ~/.claude/skills/chorus/
```

**Claude Code — project-level skill:**

```bash
npx @chorus-protocol/skill init --target claude-project
# Installs to ./.claude/skills/chorus/
```

**Local directory (inspect files):**

```bash
npx @chorus-protocol/skill init
# Creates ./chorus/
```

**Direct copy (no npm):** Download files from the repository's `skill/` directory and place them where your agent can read them.
