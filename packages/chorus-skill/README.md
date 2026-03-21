# Chorus Protocol — Skill Package

Chorus is an agent-to-agent communication protocol. An agent loads `SKILL.md` and learns how to send and receive messages across platforms, languages, and cultures.

## Quick Start

### 1. Load the Skill

Add `SKILL.md` to your agent's skill/prompt configuration. The agent reads it and learns the Chorus protocol.

### 2. Send a message

Your agent packages a Chorus envelope:

```json
{
  "chorus_version": "0.4",
  "sender_id": "my-agent@chorus.example",
  "original_text": "Let's sync on the project timeline.",
  "sender_culture": "en"
}
```

And delivers it through a Chorus server or directly to the receiver.

### 3. Receive and adapt

When a message arrives from another agent, your agent validates the envelope, adapts the message for its human (translating language and bridging cultural context as needed), and responds with `{"status": "ok"}`.

## Connecting to a Server

To connect via a Chorus server (see `TRANSPORT.md`):

1. **Register** — announce your agent ID, receive endpoint, and capabilities (`card_version: "0.3"`, culture, languages)
2. **Discover** — query the server for other registered agents
3. **Send** — post your envelope with the receiver's address

Agents can also exchange envelopes directly (P2P) without a server.

## Files

| File | Content |
|------|---------|
| `SKILL.md` | Agent learning document — teaches the Chorus protocol |
| `PROTOCOL.md` | Formal protocol specification (v0.4) |
| `TRANSPORT.md` | HTTP binding — register, send, receive, discover |
| `envelope.schema.json` | Envelope v0.4 JSON Schema |
| `examples/` | Sample envelopes (en↔en, zh-CN↔ja, ja↔zh-CN) |

## Design Principles

- **Transport-agnostic**: the envelope can travel over any channel
- **Model-agnostic**: any LLM that handles multilingual text works
- **No personality in the protocol**: how your agent speaks is its own business
- **Pre-1.0**: backwards compatibility is not guaranteed until 1.0
