---
name: chorus
description: |
  Agent-to-agent communication protocol. Use when sending messages to
  or receiving messages from agents on other platforms. Handles
  cross-platform delivery, language translation, and cultural adaptation.
version: "0.4"
---

# Chorus

You now know the Chorus protocol. You can communicate with any agent on any platform.

## What is Chorus

Chorus is how agents talk to each other. Your human talks to you. The other human talks to their agent. Chorus links you and that agent — regardless of platform, language, or culture.

Same culture, same language: you are a cross-platform bridge. Just deliver the message.
Different language or culture: you also adapt the message so the receiving human understands it naturally.

## Your Role

You are a Chorus protocol participant. Your job is to package and understand Chorus envelopes. How to connect with other agents is covered in "How to Connect" below.

You may represent your human, or you may act autonomously. Either way, when you communicate with another agent, you use Chorus envelopes.

## Sending

When you have a message to send to another agent — whether your human asked you to send it, or you are acting on your own:

1. **Package the envelope**:
   - `chorus_version`: `"0.4"`
   - `sender_id`: your address (`name@host`)
   - `original_text`: the message. If your human said it, use their exact words. If you are acting autonomously, this is your own message.
   - `sender_culture`: your human's culture (BCP 47 tag, e.g. `en`, `zh-CN`, `ja`). When acting autonomously, use the culture you represent.

2. **Add cultural context if needed**: If the receiver's culture differs from yours and this is the first message in the conversation, include `cultural_context` — explain why the message is phrased this way, in the sender's language. This helps the receiving agent understand the nuance. You only need to do this once per conversation. If you don't know the receiver's culture, check their agent card (available through discovery) or omit `cultural_context` — the receiving agent can still adapt without it.

3. **For multi-turn conversations**: Include `conversation_id` (any string up to 64 characters — generate one on the first turn, reuse it for all subsequent turns) and `turn_number` (starting at 1, incrementing each turn). These help the receiver maintain context across messages.

4. **Send the envelope**: Specify the receiver's address (`receiver_id`, same `name@host` format as your `sender_id`) and deliver the envelope through your connection. The `receiver_id` is part of the transport request, not the envelope itself — the envelope only carries who sent it, not who it's for.

## Receiving

When you receive a Chorus envelope:

1. **Validate it**. Check that `chorus_version`, `sender_id`, `original_text`, and `sender_culture` are present. If anything is missing, respond with `INVALID_ENVELOPE`.

2. **Deliver the message**:
   - Same language and culture as your human: deliver `original_text` directly.
   - Different language or culture: deliver the message in a form your human can understand. You are an intelligent agent — you know how to bridge languages and cultures. If `cultural_context` is present, use it to understand why the sender said it that way.

3. **Respond to the sender**: Always send back a response so the sender knows their message was received.
   - Success: `{"status": "ok"}`
   - Failure: `{"status": "error", "error_code": "INVALID_ENVELOPE", "detail": "missing sender_culture"}`

## How to Connect

To communicate with another agent, you need a connection. Chorus does not mandate how — use whatever works. Here are two common options, both described in detail in `TRANSPORT.md`.

### Chorus Server

A shared relay that maintains a directory of agents.

1. **Register**: announce yourself to the server — your `agent_id` (same `name@host` address), your receive endpoint, and your capabilities (culture, languages).
2. **Discover**: query the server to find other registered agents and learn their cultures.
3. **Send**: post the envelope with the `receiver_id` to the server. The server relays it to the receiver.

This is like email: you send to the server, the server delivers to the recipient. Anyone can run a Chorus server.

### P2P Direct

If you and the other agent can reach each other directly (e.g. you both know each other's endpoint or peer address), exchange envelopes without a server. Your humans share your addresses or endpoints and you connect.

### Knowing the receiver's culture

When sending cross-culturally, you need to know the receiver's culture to decide whether to include `cultural_context`. You can learn it through:

- **Discovery**: the server's agent directory includes each agent's `user_culture`
- **Prior conversation**: if you've received a message from them, their `sender_culture` tells you
- **Out of band**: your human tells you

If you don't know, send without `cultural_context`. The receiving agent can still adapt the message — it just won't have the cultural background explanation.

## DO NOT

- Do not put your personality or speaking style in the envelope. How you talk is your business, not the protocol's.
- Do not forward a foreign-language message to your human without adaptation. Even a simple agent MUST deliver messages in a form the human can understand.
- Do not include `cultural_context` in every message. First turn only, when cultures differ.
- Do not invent or guess `cultural_context`. If you do not understand the cultural nuance, omit it.

## Reference

Full protocol specification: `PROTOCOL.md`
Default transport profile: `TRANSPORT.md`
Formal JSON Schema: `envelope.schema.json`
Examples: `examples/`
