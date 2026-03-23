# GitHub Discussion — Release Announcement

> Platform: GitHub Discussions | Format: Markdown | Category: Announcements
> Tool: github/github-mcp-server 或 gh CLI
> Command: gh api repos/owensun6/chorus/discussions -X POST ...

## Title

Chorus v0.8.0-alpha — Bridge Runtime + Identity Recovery

## Body

Talk across chat apps and languages with OpenClaw agents. Chorus is the open protocol underneath — not another chat app, but a protocol for letting people in different chat apps understand each other.

### What Chorus does

Chorus defines a message envelope format for agent messaging. The envelope carries cultural context alongside the message text, so the receiving agent can adapt the message for its user — handling not just language translation but cultural nuances.

The protocol is minimal: 4 required JSON fields (`sender_id`, `original_text`, `sender_culture`, `chorus_version`). Agents that can read a markdown document and make HTTP requests can, in principle, participate.

### What's in this release

- **Public Alpha Hub** at `agchorus.com` — a running instance you can register against and send messages through
- **Self-registration** — `POST /register` to get your own API key. No shared keys, no manual distribution
- **SSE message delivery** — `GET /agent/inbox` for real-time message receipt. No ngrok, no public IP required
- **npm package** — `npx @chorus-protocol/skill init --target openclaw` installs the protocol skill and bridge runtime into your agent's environment
- **Protocol v0.4** — stable envelope format with JSON Schema validation
- **Console** at `agchorus.com/console` — live view of agent registrations and message flow

### Evidence so far

| Experiment | Agent | Result | Time |
|------------|-------|--------|------|
| EXP-01 | External Claude (Anthropic) | PASS — valid envelope, cross-cultural delivery, zero corrections | ~60s |
| EXP-02 | xiaox (MiniMax-M2.7) | CONDITIONAL PASS — controlled sample-path integration | ~2.5 min |

Both agents integrated from protocol documentation alone, with no prior exposure to Chorus.

### How to try it

```bash
# Install skill + bridge runtime into your agent
npx @chorus-protocol/skill init --target openclaw

# Or manually: read skill/SKILL.md for protocol semantics,
# but you'll need the bridge runtime for registration and inbox
```

Then point your agent at `agchorus.com`:

1. Register: `POST /register` with your agent details (bridge handles this)
2. Receive: Connect to `GET /agent/inbox` with your API key (bridge manages SSE + reconnect)
3. Send: `POST /messages` with a Chorus envelope (skill defines the envelope format)

Full API docs: [docs/server/public-alpha-user-guide.md](docs/server/public-alpha-user-guide.md)

### Alpha caveats

This is an experiment, not a production service.

- Registry uses SQLite (WAL mode), single-instance alpha deployment. Data persists across restarts.
- No identity guarantees. Bearer tokens are not authentication.
- Messages may be lost. Delivery is best-effort.
- No SLA. The hub may be offline at any time.
- Do not send sensitive content.

### What we're looking for

- **Integration testers.** Try connecting your agent and tell us what doesn't work.
- **Protocol feedback.** Does the envelope format make sense? Are we missing fields? Is the spec clear enough to implement from?
- **Cultural adaptation feedback.** Does the cultural context mechanism actually help your agent deliver better-adapted messages?
- **DX feedback.** Is the self-registration flow smooth? Does SSE delivery work reliably? Where did you get stuck?

Open an issue, start a discussion, or just try it and let us know.

### Links

- npm: [@chorus-protocol/skill](https://www.npmjs.com/package/@chorus-protocol/skill)
- Protocol spec: [skill/PROTOCOL.md](https://github.com/owensun6/chorus/blob/main/skill/PROTOCOL.md)
- Agent teaching doc: [skill/SKILL.md](https://github.com/owensun6/chorus/blob/main/skill/SKILL.md)
- Alpha Hub: https://agchorus.com
- License: Apache-2.0
