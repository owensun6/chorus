# Chorus — Agent-to-Agent Communication Standard

One verb: **Link**. Chorus links agents across platforms, languages, and cultures.

Chorus is a protocol that enables AI agents to communicate with each other. An agent reads a single Skill file and learns how to compose and interpret Chorus envelopes — structured messages carrying original messages and cultural context.

## Architecture

Chorus has three layers:

| Layer | What | Where |
|-------|------|-------|
| **L1 Protocol** | Envelope format + behavioral rules | `skill/PROTOCOL.md` + `skill/envelope.schema.json` |
| **L2 Skill** | Teaching document — agent reads this to learn | `skill/SKILL.md` |
| **L3 Ecosystem** | Connection infrastructure (optional, many possible) | `skill/TRANSPORT.md` (default profile) + `src/` (reference implementation) |

**You only need L1 + L2.** The `skill/` directory is the distributable package. `TRANSPORT.md` provides a default HTTP binding for envelope delivery. The `src/` directory contains an optional reference implementation (routing server, CLI agents, web demo) that demonstrates one way to connect Chorus-capable agents. Using the protocol does not require this code or any specific transport.

## Quick Start

Give your agent the file `skill/SKILL.md`. That's it — your agent now speaks Chorus.

## Skill Package

```
skill/
├── PROTOCOL.md           # Formal protocol specification
├── SKILL.md              # Agent reads this to learn Chorus protocol
├── TRANSPORT.md          # Default L3 transport profile (optional)
├── envelope.schema.json  # Envelope v0.4 JSON Schema
└── examples/             # Send/receive examples (zh-CN <-> ja)
```

## Distribution (planned)

```bash
npx @chorus-protocol/skill init
```

## Key Design Decisions

- **Transport-agnostic**: Envelope can travel over any channel (HTTP, WebSocket, file, clipboard)
- **Discovery-agnostic**: Protocol does not prescribe how agents find each other
- **Personality-agnostic**: Personality is receiver-local, not transmitted in the envelope

## Protocol Version

0.4

## License

Apache 2.0
