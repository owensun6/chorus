# Chorus — Agent-to-Agent Communication Standard

Chorus links AI agents across platforms, languages, and cultures.

## Why Chorus Exists

AI agents today can't talk to each other. An agent on one platform can't send a message to an agent on another — and even if it could, a Chinese cultural nuance would be lost on a Japanese recipient. Translation APIs handle words; Chorus carries meaning. A Chorus envelope wraps the original message with cultural context so the receiving agent can adapt it — not just translate it — for its human.

## What Chorus Is

**Protocol, not platform.** Chorus defines a message envelope format and behavioral rules. `skill/SKILL.md` is the teaching document — give it to your agent and it speaks Chorus. The `src/` directory contains one optional reference implementation (routing server + CLI agents). Using the protocol does not require this code or any specific transport.

| Layer | What | Where |
|-------|------|-------|
| **L1 Protocol** | Envelope format + behavioral rules | `skill/PROTOCOL.md` + `skill/envelope.schema.json` |
| **L2 Skill** | Teaching document — agent reads this to learn | `skill/SKILL.md` |
| **L3 Ecosystem** | Connection infrastructure (optional, many possible) | `skill/TRANSPORT.md` (default profile) + `src/` (reference impl) |

**You only need L1 + L2.** L3 provides a default HTTP binding and a reference server. You can use any transport that delivers valid envelopes.

## Quick Demo

Three terminals, five commands. See a cross-cultural message delivered in under 2 minutes.

**Prerequisites**: Node.js >= 18, npm, a DashScope API key (for the LLM that does cultural adaptation).

```bash
# Build
git clone <this-repo> && cd chorus
npm install && npm run build
```

```bash
# Terminal 1 — Start the routing server
CHORUS_API_KEYS=test-key PORT=3000 npm start
```

```bash
# Terminal 2 — Start a Chinese agent
DASHSCOPE_API_KEY=your-key CHORUS_ROUTER_API_KEY=test-key \
  node dist/agent/index.js --culture zh-CN --port 3001
```

```bash
# Terminal 3 — Start a Japanese agent, then type a message
DASHSCOPE_API_KEY=your-key CHORUS_ROUTER_API_KEY=test-key \
  node dist/agent/index.js --culture ja --port 3002
```

Type a message at the `chorus>` prompt in Terminal 3. The Japanese agent packages a Chorus envelope, sends it to the server, which relays it to the Chinese agent. The Chinese agent adapts the message for its human — not just translating, but bridging cultural context.

For step-by-step curl-based integration (no agents needed): [docs/integration-guide.md](docs/integration-guide.md)

## Core Docs

| Document | What it tells you |
|----------|-------------------|
| `skill/SKILL.md` | **Start here.** Teach your agent the Chorus protocol |
| `skill/PROTOCOL.md` | Formal spec — envelope fields, rules, error codes |
| `skill/TRANSPORT.md` | HTTP binding — register, send, receive, discover |
| `docs/integration-guide.md` | Human walkthrough — curl your way to a delivered message |
| `docs/deployment-guide.md` | Run the reference server + agents locally |
| `docs/verification-checklist.md` | Verify everything works end-to-end |

## Install the Skill

Give your agent the Chorus protocol in one command:

```bash
npx @chorus-protocol/skill init
```

This creates a `chorus/` directory with `SKILL.md` (the teaching document), `PROTOCOL.md` (formal spec), `TRANSPORT.md` (HTTP binding), `envelope.schema.json`, and examples. Give your agent `chorus/SKILL.md` and it speaks Chorus.

Chinese variant: `npx @chorus-protocol/skill init --lang zh-CN`

**Other install paths** (Claude Code skill, direct copy): [docs/distribution/openclaw-install.md](docs/distribution/openclaw-install.md)

**npm**: [@chorus-protocol/skill](https://www.npmjs.com/package/@chorus-protocol/skill)

## Skill Package

```
skill/
├── PROTOCOL.md           # Formal protocol specification (v0.4)
├── SKILL.md              # Agent reads this to learn Chorus
├── TRANSPORT.md          # Default L3 transport profile (HTTP binding)
├── envelope.schema.json  # Envelope v0.4 JSON Schema
└── examples/             # Send/receive examples (zh-CN <-> ja)
```

## Current Evidence

| Experiment | Result | What it proved |
|------------|--------|----------------|
| EXP-01 | PASS | External Claude read SKILL.md, composed a valid envelope, delivered to zh-CN agent in ~60s, zero human corrections |
| EXP-02 | CONDITIONAL PASS | xiaox (MiniMax-M2.7) completed bidirectional send+receive in ~2.5 min, zero quality corrections |
| Test suite | 13 suites, 142 tests, all green | Reference implementation is stable |

**Not yet verified**: No human developer has independently integrated using only the docs. EXP-03 (human cold-start) was designed but not executed.

## Current Limitations

- **No auth**: The reference server uses simple bearer tokens. No real authentication or authorization.
- **No persistence**: Agent registry is in-memory. Restart the server, lose all registrations.
- **Localhost only**: Reference implementation tested only on localhost. No public network, NAT, or federation testing.
- **No human dev cold-start verified**: All integration evidence comes from AI agents, not human developers.
- **Pre-1.0**: Backwards compatibility is not guaranteed until 1.0.

## Protocol Version

0.4

## License

Apache 2.0
