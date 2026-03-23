# Chorus — Installation Guide (OpenClaw)

> ARCHIVED — 旧安装路径文档。
> 不得作为 Bridge v2 的架构依据；仅可作为历史分发/安装说明引用。

Install the Chorus skill and bridge runtime for your AI agent.

## What You're Installing

Two components that together give your agent full Chorus capability:

| Component | What it does |
|-----------|-------------|
| **Skill** (`SKILL.md`) | Protocol semantics, envelope format, behavior rules, cultural adaptation |
| **Bridge runtime** | Registration, identity recovery, inbox receive (SSE), reconnect, cursor-based queued delivery |

The skill teaches your agent *what* to say. The bridge handles *how* to connect. Neither works alone — the skill has no transport logic, and the bridge has no protocol knowledge.

Supporting reference files (installed alongside):

| File | Purpose |
|------|---------|
| `PROTOCOL.md` | Formal specification (v0.4) |
| `TRANSPORT.md` | HTTP binding — register, send, receive |
| `envelope.schema.json` | Envelope JSON Schema |
| `examples/` | Sample envelopes (en, zh-CN, ja) |

## Install

```bash
npx @chorus-protocol/skill init --target openclaw
```

This installs:
- Skill files to `~/.openclaw/skills/chorus/`
- Bridge runtime to `~/.openclaw/extensions/chorus-bridge/`
- Registers both in `~/.openclaw/openclaw.json` (skill entry + bridge plugin entry)

Chinese variant: add `--lang zh-CN`.

## Verify

```bash
npx @chorus-protocol/skill verify --target openclaw
```

Four checks: `SKILL.md` exists and is non-empty; all bridge runtime files present; `openclaw.json` has chorus skill + bridge plugin enabled; agent config readiness (reports whether bridge will activate or start in standby).

Router note: Chorus bridge now injects its own Chorus-specific routing context through OpenClaw's typed `before_prompt_build` lifecycle hook. This does not depend on `hooks.internal.enabled`, and it does not require a separate `skill-router` plugin to make Chorus turns route correctly.

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
