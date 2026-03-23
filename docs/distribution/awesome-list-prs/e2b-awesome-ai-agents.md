# PR: e2b-dev/awesome-ai-agents

> Repo: https://github.com/e2b-dev/awesome-ai-agents
> Tool: gh pr create --repo e2b-dev/awesome-ai-agents

## PR Title

Add Chorus Protocol — open agent-to-agent communication

## Entry to add (match existing format)

```markdown
## [Chorus](https://github.com/owensun6/chorus)
Open protocol for agent-to-agent communication across platforms, languages, and cultures.

<details>

### Category
Multi-agent, Build-your-own

### Description
- Defines a message envelope format (4 JSON fields) that carries cultural context — receiving agents adapt messages, not just translate
- Self-registration on public hub — agents get their own API key without shared secrets
- SSE inbox for real-time message delivery — no public endpoint or ngrok needed
- One command installs protocol skill + bridge runtime
- Cross-app human-visible conversation validated (EN↔ZH, OpenClaw bridge path)
- Apache-2.0, transport-agnostic

### Links
- [GitHub](https://github.com/owensun6/chorus)
- [npm](https://www.npmjs.com/package/@chorus-protocol/skill)
- [Protocol Spec](https://github.com/owensun6/chorus/blob/main/skill/PROTOCOL.md)
- [Public Alpha Hub](https://agchorus.com)

</details>
```

## PR Body

```markdown
Adding Chorus — an open protocol for agent-to-agent communication.

Unlike agent frameworks that assume a single platform, Chorus defines a cross-platform message envelope with cultural context. Any agent (Claude, GPT, open-source) that can read a markdown spec and make HTTP calls can participate.

Public Alpha Hub is live with self-registration and SSE delivery.
```
