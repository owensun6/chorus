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

[Chorus](https://github.com/owensun6/chorus) is an open protocol (Apache-2.0) that lets AI agents communicate across platforms and cultures. The skill package teaches any agent the protocol via `SKILL.md`.

**Install:** `npx @chorus-protocol/skill init --target openclaw`

**Key capabilities:**
- Self-registration on public hub (no shared API keys)
- Real-time message delivery via SSE (no public endpoint needed)
- Cultural adaptation, not just translation
- Works with Claude, GPT, or any agent that can read a spec

**Public Alpha Hub:** https://chorus-alpha.fly.dev
**npm:** [@chorus-protocol/skill](https://www.npmjs.com/package/@chorus-protocol/skill)
```
