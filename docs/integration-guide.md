# Chorus Integration Guide

A step-by-step walkthrough: register an agent, send a message, receive a message — using only curl.

## Prerequisites

- Node.js >= 18, npm
- Project built: `npm install && npm run build`
- Server running (see Step 1)
- No LLM key needed for this walkthrough (we use curl to simulate agents)

## Mental Model

A Chorus server relays envelopes between agents. Agents register with the server (announcing their receive endpoint), then send envelopes addressed to other agents. The server looks up the receiver and POSTs the envelope to their endpoint. Envelopes carry the original message plus cultural context — the receiver adapts (not just translates) the message for its human.

## Step 1: Start the Server

```bash
CHORUS_API_KEYS=test-key PORT=3000 npm start
```

Expected output:
```
[router] Chorus routing server listening on port 3000 (auth enabled)
```

The server requires `CHORUS_API_KEYS` (comma-separated bearer tokens). All POST/DELETE requests must include `Authorization: Bearer <key>`. GET requests don't require auth.

## Step 2: Register Your Agent

```bash
curl -s http://localhost:3000/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key" \
  -d '{
    "agent_id": "alice@localhost",
    "endpoint": "http://localhost:4001/receive",
    "agent_card": {
      "card_version": "0.3",
      "user_culture": "en",
      "supported_languages": ["en"]
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "agent_id": "alice@localhost",
    "registered_at": "2026-03-21T..."
  },
  "metadata": { "timestamp": "..." }
}
```

Key fields:
- `agent_id`: your agent's address (`name@host`)
- `endpoint`: URL where you'll receive envelopes (you need to run an HTTP server here — see Step 5)
- `agent_card.card_version`: `"0.3"` (not `chorus_version` — that's an envelope field)

## Step 3: Register a Second Agent

```bash
curl -s http://localhost:3000/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key" \
  -d '{
    "agent_id": "bob@localhost",
    "endpoint": "http://localhost:4002/receive",
    "agent_card": {
      "card_version": "0.3",
      "user_culture": "ja",
      "supported_languages": ["ja"]
    }
  }'
```

## Step 4: Discover Agents

```bash
curl -s http://localhost:3000/agents
```

No auth required (GET request). Expected response:
```json
{
  "success": true,
  "data": [
    {
      "agent_id": "alice@localhost",
      "endpoint": "http://localhost:4001/receive",
      "agent_card": { "card_version": "0.3", "user_culture": "en", "supported_languages": ["en"] },
      "registered_at": "..."
    },
    {
      "agent_id": "bob@localhost",
      "endpoint": "http://localhost:4002/receive",
      "agent_card": { "card_version": "0.3", "user_culture": "ja", "supported_languages": ["ja"] },
      "registered_at": "..."
    }
  ],
  "metadata": { "timestamp": "..." }
}
```

## Step 5: Send a Message

To send a message from alice to bob:

```bash
curl -s http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key" \
  -d '{
    "receiver_id": "bob@localhost",
    "envelope": {
      "chorus_version": "0.4",
      "sender_id": "alice@localhost",
      "original_text": "Hey Bob, want to grab coffee and discuss the project?",
      "sender_culture": "en",
      "cultural_context": "Casual invitation to an informal meeting — coffee is a social ritual, not a formal appointment"
    }
  }'
```

**If bob's endpoint is not actually running**, you'll get a 502 error:
```json
{
  "success": false,
  "error": {
    "code": "ERR_AGENT_UNREACHABLE",
    "message": "Failed to reach receiver agent"
  },
  "metadata": { "timestamp": "..." }
}
```

**If bob's endpoint is running and responds**, you'll get a 200:
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

## Step 6: Receive a Message

When the server relays a message to your agent, it POSTs to your registered endpoint:

```
POST http://localhost:4001/receive

{
  "envelope": {
    "chorus_version": "0.4",
    "sender_id": "bob@localhost",
    "original_text": "プロジェクトのスケジュールについて相談しましょう。",
    "sender_culture": "ja"
  }
}
```

Your endpoint must respond with:
```json
{"status": "ok"}
```

Or on error:
```json
{"status": "error", "error_code": "INVALID_ENVELOPE", "detail": "missing sender_culture"}
```

To test receiving without building a real agent, you can use a simple HTTP listener (e.g., `nc -l 4001` or a one-line Node server) that prints the incoming body and responds with `{"status": "ok"}`.

## Common Mistakes

### 1. `card_version` vs `chorus_version`

The agent card uses `card_version: "0.3"`. The envelope uses `chorus_version: "0.4"`. They are different fields versioning different things. If you put `chorus_version` in the agent card, registration will fail with a validation error.

### 2. Envelope not nested inside `"envelope"` key

When sending:
```json
// WRONG — envelope fields at root
{ "receiver_id": "bob@localhost", "chorus_version": "0.4", "sender_id": "alice@localhost", ... }

// CORRECT — envelope nested inside "envelope" key
{ "receiver_id": "bob@localhost", "envelope": { "chorus_version": "0.4", "sender_id": "alice@localhost", ... } }
```

### 3. `receiver_id` placement

`receiver_id` goes at the body root, NOT inside the envelope. The envelope only carries who sent it (`sender_id`), not who it's for.

### 4. Sender not registered

The server checks that the `sender_id` in the envelope matches a registered agent. If alice sends a message but hasn't registered, the server returns `ERR_SENDER_NOT_REGISTERED`.

### 5. Port conflicts

The server, each agent's receive endpoint, and each CLI agent all need different ports. A typical setup:
- Server: port 3000
- Agent A receive endpoint: port 3001 (or 4001)
- Agent B receive endpoint: port 3002 (or 4002)

## Minimal Success Checklist

- [ ] Server running on port 3000
- [ ] Agent registered (201 response with `agent_id`)
- [ ] `GET /agents` shows your agent in the list
- [ ] `POST /messages` returns `"delivery": "delivered"` (requires receiver endpoint running)
- [ ] Receiver endpoint received the envelope with all fields intact

## Next Steps

- Full deployment with LLM-powered agents: [deployment-guide.md](deployment-guide.md)
- Verification checklist: [verification-checklist.md](verification-checklist.md)
- Protocol spec: `../skill/PROTOCOL.md`
- Transport spec: `../skill/TRANSPORT.md`
