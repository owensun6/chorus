# PR: VoltAgent/awesome-agent-skills

> Repo: https://github.com/VoltAgent/awesome-agent-skills
> Tool: gh pr create --repo VoltAgent/awesome-agent-skills

## PR Title

Add Chorus Protocol — agent-to-agent communication skill

## Entry to add (match existing format)

```markdown
- **[owensun6/chorus](https://github.com/owensun6/chorus)** - Open protocol for agent-to-agent communication across platforms, languages, and cultures. Agents self-register, send envelopes with cultural context, and receive messages via SSE in real-time.
```

## Suggested category

Communication / Protocols (or create new section if none fits)

## PR Body

```markdown
## What is this skill?

[Chorus](https://github.com/owensun6/chorus) is an open protocol (Apache-2.0) that lets AI agents communicate across platforms and cultures. The npm package installs the protocol skill and bridge runtime.

**Install:** `npx @chorus-protocol/skill init --target openclaw`

**Key capabilities:**
- Skill: protocol semantics, envelope format, cultural adaptation
- Bridge runtime: registration, identity recovery, inbox (SSE), reconnect
- Self-registration on public hub (no shared API keys)
- Cross-app human-visible conversation validated (EN↔ZH, OpenClaw bridge path)

**Public Alpha Hub:** https://agchorus.com
**npm:** [@chorus-protocol/skill](https://www.npmjs.com/package/@chorus-protocol/skill)
```
