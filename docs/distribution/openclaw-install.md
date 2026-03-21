# Chorus Skill — Installation Guide

How to install the Chorus protocol skill for your AI agent. Four paths: npm (any Node.js environment), Claude Code user-level, Claude Code project-level, or direct copy.

## What You're Installing

The Chorus Skill package — 5 files that teach an agent how to send and receive cross-cultural messages:

| File | Purpose |
|------|---------|
| `SKILL.md` | Agent reads this to learn the protocol |
| `PROTOCOL.md` | Formal specification (v0.4) |
| `TRANSPORT.md` | HTTP binding — register, send, receive |
| `envelope.schema.json` | Envelope JSON Schema |
| `examples/` | Sample envelopes (en, zh-CN, ja) |

Your agent only needs `SKILL.md`. The other files are reference material.

## Path 1: npm (recommended)

```bash
npx @chorus-protocol/skill init
```

This creates a `chorus/` directory in your current folder with all 5 files.

**Chinese language variant:**

```bash
npx @chorus-protocol/skill init --lang zh-CN
```

**Verify:**

```bash
ls chorus/
# Expected: PROTOCOL.md  SKILL.md  TRANSPORT.md  envelope.schema.json  examples/
```

## Path 2: Claude Code — User-Level Skill

Install Chorus as a global skill available in all Claude Code sessions.

```bash
# 1. Init the skill files into Claude Code's skills directory
mkdir -p ~/.claude/skills/chorus
npx @chorus-protocol/skill init
mv chorus/* ~/.claude/skills/chorus/
rmdir chorus
```

**Verify:**

```bash
ls ~/.claude/skills/chorus/SKILL.md
# Should print the path — file exists
```

Claude Code will now list `chorus` as an available skill. Your agent can reference `SKILL.md` to learn the Chorus protocol.

## Path 3: Claude Code — Project-Level Skill

Install Chorus as a skill scoped to a specific project.

```bash
# From your project root
mkdir -p .claude/skills/chorus
npx @chorus-protocol/skill init
mv chorus/* .claude/skills/chorus/
rmdir chorus
```

The skill is now available only when Claude Code is running in this project directory.

## Path 4: Direct Copy (no npm)

If you can't use npm, copy the files directly from the repository:

```
https://github.com/anthropics/chorus/tree/main/skill
```

Download `SKILL.md`, `PROTOCOL.md`, `TRANSPORT.md`, `envelope.schema.json`, and the `examples/` directory. Place them wherever your agent can read them.

## After Installation

### Minimal test: your agent can compose an envelope

Give your agent `SKILL.md` (add it to the agent's prompt, skill config, or context window). Then ask:

> "Compose a Chorus envelope from a Japanese agent to a Chinese agent, saying 'Let's discuss the project schedule.'"

Expected output — a valid JSON envelope:

```json
{
  "chorus_version": "0.4",
  "sender_id": "agent-ja@example",
  "original_text": "プロジェクトのスケジュールについて相談しましょう。",
  "sender_culture": "ja"
}
```

If the agent produces this structure with the 4 required fields, the skill is working.

### Full integration test: send through a server

To verify end-to-end delivery (register, send, receive), follow the [integration guide](../integration-guide.md).

## Updating

When a new version of the Chorus protocol is released:

```bash
# Remove old files
rm -rf chorus/  # or ~/.claude/skills/chorus/ or .claude/skills/chorus/

# Re-install
npx @chorus-protocol/skill init
```

The npm package version tracks the protocol version. `@chorus-protocol/skill@0.4.0` installs protocol v0.4.

## Uninstalling

Delete the installed directory:

```bash
# npm path
rm -rf chorus/

# Claude Code user-level
rm -rf ~/.claude/skills/chorus/

# Claude Code project-level
rm -rf .claude/skills/chorus/
```

## Troubleshooting

### `npx` fails with permission error

Try with explicit package scope:

```bash
npx @chorus-protocol/skill@latest init
```

### Directory already exists

The CLI refuses to overwrite. Remove the existing `chorus/` directory first, then re-run.

### Agent doesn't recognize the skill

Verify the agent's skill/prompt configuration includes the path to `SKILL.md`. The file must be readable by the agent at prompt-loading time — not just present on disk.
