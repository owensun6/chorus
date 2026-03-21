# Chorus Skill — Installation Guide

How to install the Chorus protocol skill for your AI agent. Five paths: npm (any Node.js environment), OpenClaw, Claude Code user-level, Claude Code project-level, or direct copy.

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

## Path 1: OpenClaw (recommended)

One command — installs files and registers in `openclaw.json`:

```bash
npx @chorus-protocol/skill init --target openclaw
```

**Verify:**

```bash
ls ~/.openclaw/skills/chorus/SKILL.md
# Should print the path — file exists
```

**Uninstall:**

```bash
npx @chorus-protocol/skill uninstall --target openclaw
```

**Fallback (manual install):** If `--target openclaw` fails, see [manual OpenClaw install](#manual-openclaw-install) below.

## Path 2: Claude Code — User-Level Skill

One command — installs as a global skill available in all sessions:

```bash
npx @chorus-protocol/skill init --target claude-user
```

**Verify:**

```bash
ls ~/.claude/skills/chorus/SKILL.md
```

**Uninstall:**

```bash
npx @chorus-protocol/skill uninstall --target claude-user
```

## Path 3: Claude Code — Project-Level Skill

One command — installs scoped to the current project:

```bash
npx @chorus-protocol/skill init --target claude-project
```

**Uninstall:**

```bash
npx @chorus-protocol/skill uninstall --target claude-project
```

## Path 4: Local Directory

Creates a `chorus/` directory in your current folder for inspection or custom integration:

```bash
npx @chorus-protocol/skill init
```

Chinese variant: add `--lang zh-CN` to any command above.

## Path 5: Direct Copy (no npm)

If you can't use npm, copy the files directly from the repository:

```
https://github.com/owensun6/chorus/tree/main/skill
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

Uninstall the old version, then re-install:

```bash
npx @chorus-protocol/skill uninstall --target openclaw
npx @chorus-protocol/skill init --target openclaw
```

Replace `openclaw` with your install target. The npm package version tracks the protocol version.

## Uninstalling

```bash
npx @chorus-protocol/skill uninstall --target openclaw
npx @chorus-protocol/skill uninstall --target claude-user
npx @chorus-protocol/skill uninstall --target claude-project
```

For local directory installs: `rm -rf chorus/`

## Manual OpenClaw Install

If `--target openclaw` doesn't work (e.g., non-standard OpenClaw location), do it manually:

```bash
mkdir -p ~/.openclaw/skills/chorus
npx @chorus-protocol/skill init
mv chorus/* ~/.openclaw/skills/chorus/
rmdir chorus

# Register in OpenClaw config
node -e "
const fs = require('fs');
const p = require('os').homedir() + '/.openclaw/openclaw.json';
const c = JSON.parse(fs.readFileSync(p, 'utf8'));
if (!c.skills) c.skills = {};
if (!c.skills.entries) c.skills.entries = {};
c.skills.entries.chorus = { enabled: true };
fs.writeFileSync(p, JSON.stringify(c, null, 4));
console.log('chorus registered in openclaw.json');
"
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
