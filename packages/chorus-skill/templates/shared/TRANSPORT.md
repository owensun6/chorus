# Chorus Transport Profile

Version 0.4 | Default L3 binding for Chorus envelope delivery.

The key words "MUST", "MUST NOT", "SHOULD", and "MAY" in this document are to be interpreted as described in RFC 2119.

## 1. Scope

This document defines one way to deliver Chorus envelopes between agents. It is an optional L3 profile — not part of the core protocol.

Chorus Protocol (L1) defines the envelope format. Chorus Skill (L2) teaches agents how to use it. This transport profile provides a default HTTP binding so that agents can interoperate without building custom transport.

Agents MAY use any transport that delivers valid Chorus envelopes. Compliance with this profile is not required for Chorus compliance.

## Quick Start

A complete register → send → receive flow using the HTTP binding:

**Step 1 — Register your agent**

```
POST /agents

{
  "agent_id": "my-agent@chorus.example",
  "endpoint": "https://my-agent.example/receive",
  "agent_card": {
    "card_version": "0.3",
    "user_culture": "en",
    "supported_languages": ["en"]
  }
}
```

Response: `201` with `{ "success": true, "data": { "agent_id": "...", "registered_at": "..." } }`

**Step 2 — Send a message**

```
POST /messages

{
  "receiver_id": "other-agent@chorus.example",
  "envelope": {
    "chorus_version": "0.4",
    "sender_id": "my-agent@chorus.example",
    "original_text": "Hello, let's collaborate on this project.",
    "sender_culture": "en"
  }
}
```

Response: `200` with `{ "success": true, "data": { "delivery": "delivered", "receiver_response": { "status": "ok" } } }`

**Step 3 — Receive a message**

Your endpoint receives:

```
POST https://my-agent.example/receive

{
  "envelope": {
    "chorus_version": "0.4",
    "sender_id": "other-agent@chorus.example",
    "original_text": "こんにちは、プロジェクトについて相談しましょう。",
    "sender_culture": "ja"
  }
}
```

Your endpoint responds: `{"status": "ok"}`

That's it. You are now sending and receiving Chorus envelopes.

**Important: envelope nesting.** The Chorus envelope is always wrapped inside a JSON object — never sent as the top-level body. When sending: `{ "receiver_id": "...", "envelope": { ...chorus fields... } }`. When receiving: `{ "envelope": { ...chorus fields... } }`. The envelope fields (`chorus_version`, `sender_id`, `original_text`, `sender_culture`) go inside the `"envelope"` key, not at the root of the request body.

## 2. Addressing

An agent address follows the format `name@host`.

- `name`: identifier, unique within the host's namespace
- `host`: the Chorus server domain or peer address

The same format applies to both `sender_id` (defined in PROTOCOL.md) and `receiver_id` (used in transport requests).

Within a single server, implementations SHOULD accept the short form `name` as a local alias for `name@{server-host}`.

## 3. Connection Modes

### Server Relay

Agents register with a shared Chorus server. The server maintains a directory and relays envelopes between them.

```
Agent A ──envelope──▶ Chorus Server ──envelope──▶ Agent B
```

### P2P Direct

Two agents exchange envelopes directly when they know each other's endpoints.

```
Agent A ──envelope──▶ Agent B
```

No registration or server required. The agents' humans share addresses out of band.

## 4. Operations

Four abstract operations, independent of transport binding. Section 6 maps these to HTTP.

### 4.1 Register

An agent announces itself to a server.

Request:
- `agent_id` (string, MUST): the agent's `name@host` address
- `endpoint` (string, MUST): URL where the agent receives envelopes
- `agent_card` (object, SHOULD): agent capabilities — `card_version` (agent card schema version, currently `"0.3"`), `user_culture` (BCP 47), `supported_languages` (BCP 47 array)

Note: the agent card field is `card_version` (not `chorus_version`). The envelope has its own `chorus_version` field (`"0.4"`). They are different fields versioning different things.

**Migration from card v0.2**: In v0.2, the agent card field was named `chorus_version` (same name as the envelope field). This caused confusion, so v0.3 renames it to `card_version`. Agents using the old `chorus_version` field in their agent card MUST update to `card_version: "0.3"`. Servers MAY return a generic validation error if the old field name is used.

Result: registration record with `registered_at` timestamp.

Re-registering an existing `agent_id` updates the record.

### 4.2 Unregister

An agent removes itself from a server.

Request:
- `agent_id` (string, MUST)

Result: confirmation. No-op if already absent.

### 4.3 Discover

Query registered agents.

Request: none required. MAY support filters.

Result: list of registration records.

### 4.4 Send

Deliver a Chorus envelope to another agent.

Request:
- `receiver_id` (string, MUST): receiver's `name@host` address
- `envelope` (object, MUST): a valid Chorus envelope per PROTOCOL.md

The sender's identity is `envelope.sender_id`. There is no separate sender field — a single source of truth avoids mismatch.

Result: delivery outcome (see Section 5).

## 5. Delivery States

A Send request produces one of three outcomes:

| State | Meaning |
|-------|---------|
| `delivered` | Envelope reached the receiver. The response includes the receiver's protocol-level reply (per PROTOCOL.md Section 3) |
| `failed` | Delivery failed. The response includes an error code and detail |
| `rejected` | Sender validation failed (not registered, invalid envelope). No delivery attempted |

### Retry

- Senders MAY retry on transient failures (`ERR_AGENT_UNREACHABLE`, `ERR_TIMEOUT`)
- Senders MUST NOT retry on permanent failures (`ERR_AGENT_NOT_FOUND`, `ERR_VALIDATION`)
- Senders SHOULD use exponential backoff when retrying
- Receivers SHOULD treat duplicate envelopes with the same `conversation_id` + `turn_number` as idempotent

## 6. HTTP Binding

The default transport binding. A conforming server implements these endpoints.

### 6.1 Endpoints

| Operation | Method | Path | Success |
|-----------|--------|------|---------|
| Register | POST | `/agents` | 201 (new) / 200 (update) |
| Unregister | DELETE | `/agents/:id` | 200 |
| Discover (list) | GET | `/agents` | 200 |
| Discover (single) | GET | `/agents/:id` | 200 |
| Send | POST | `/messages` | 200 |
| Health | GET | `/health` | 200 |

### 6.2 Response Envelope

All HTTP responses use a common format:

```json
{
  "success": true,
  "data": { },
  "metadata": { "timestamp": "2026-03-20T10:00:00.000Z" }
}
```

```json
{
  "success": false,
  "error": { "code": "ERR_VALIDATION", "message": "sender_id is required" },
  "metadata": { "timestamp": "2026-03-20T10:00:00.000Z" }
}
```

### 6.3 Register

```
POST /agents

{
  "agent_id": "alice@chorus.example",
  "endpoint": "https://alice.example/receive",
  "agent_card": {
    "card_version": "0.3",
    "user_culture": "zh-CN",
    "supported_languages": ["zh-CN", "en"]
  }
}
```

### 6.4 Send

```
POST /messages

{
  "receiver_id": "bob@chorus.example",
  "envelope": {
    "chorus_version": "0.4",
    "sender_id": "alice@chorus.example",
    "original_text": "下午一起喝杯咖啡？",
    "sender_culture": "zh-CN",
    "cultural_context": "中国同事之间用「喝咖啡」作为非正式交流的邀请，表达善意和亲近，不一定真的要喝咖啡"
  }
}
```

Delivered:

```json
{
  "success": true,
  "data": {
    "delivery": "delivered",
    "receiver_response": { "status": "ok" }
  },
  "metadata": { "timestamp": "..." }
}
```

Failed:

```json
{
  "success": true,
  "data": {
    "delivery": "failed",
    "error_code": "ERR_AGENT_UNREACHABLE",
    "detail": "Receiver did not respond within timeout"
  },
  "metadata": { "timestamp": "..." }
}
```

Note: a delivery failure is not an HTTP error. The HTTP request succeeded; the delivery did not. Hence `"success": true` with `"delivery": "failed"`.

### 6.5 Agent Receive Endpoint

An agent that accepts envelopes MUST expose an HTTP endpoint. The URL is declared during Register.

Request (from server or direct peer):

```
POST {agent_endpoint}

{
  "envelope": {
    "chorus_version": "0.4",
    "sender_id": "alice@chorus.example",
    "original_text": "下午一起喝杯咖啡？",
    "sender_culture": "zh-CN"
  }
}
```

Response — per PROTOCOL.md Section 3:

```json
{ "status": "ok" }
```

```json
{ "status": "error", "error_code": "INVALID_ENVELOPE", "detail": "missing sender_culture" }
```

## 7. Transport Error Codes

These are distinct from protocol-level error codes in PROTOCOL.md.

| Code | HTTP Status | Meaning | Retryable |
|------|------------|---------|-----------|
| `ERR_VALIDATION` | 400 | Request body failed validation | No |
| `ERR_AGENT_NOT_FOUND` | 404 | Receiver not registered | No |
| `ERR_AGENT_UNREACHABLE` | 502 | Could not reach receiver endpoint | Yes |
| `ERR_TIMEOUT` | 504 | Receiver did not respond in time | Yes |
| `ERR_UNAUTHORIZED` | 401 | Authentication required or invalid | No |
| `ERR_SENDER_NOT_REGISTERED` | 400 | Sender not registered with this server | No |

## 8. Discovery

A Chorus server SHOULD serve a discovery document at:

```
GET /.well-known/chorus.json
```

```json
{
  "chorus_version": "0.4",
  "server_name": "Example Chorus Hub",
  "endpoints": {
    "register": "/agents",
    "discover": "/agents",
    "send": "/messages",
    "health": "/health"
  }
}
```

Clients that support discovery SHOULD fetch this document to resolve endpoint paths rather than hardcoding them.

## 9. Extensions

### A2A Message Wrapping (MAY)

Implementations MAY encode the Chorus envelope as a DataPart inside an A2A message, using mediaType `application/vnd.chorus.envelope+json`. This enables interoperability with A2A-compatible platforms.

A2A wrapping is an alternate encoding of the `envelope` field, not a change to the Send request structure. The request still contains `receiver_id` + `envelope`. The server or receiver detects the encoding and extracts the Chorus envelope for protocol processing.

### SSE Streaming (MAY)

Implementations MAY support Server-Sent Events to stream the receiver's processing output back to the sender. This is a content stream extension, not a streaming version of the delivery states in Section 5.

When supported:

- The Send request includes `"stream": true`
- The server relays the receiver's SSE stream to the sender
- Events: `chunk` (incremental content from receiver), `done` (processing complete, includes full result), `error` (receiver processing failed)

The delivery state for a streamed request is determined by the final event: `done` maps to `delivered`, `error` maps to `failed`.

## 10. Not In Scope

- Authentication schemes — use whatever your deployment requires
- Rate limiting — server-specific policy
- Federation between Chorus servers — future work
- Envelope encryption — future work
- Message persistence or history — implementation concern
