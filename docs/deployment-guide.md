# Chorus Deployment Guide

How to run the Chorus reference implementation locally: one routing server and two LLM-powered agents that adapt messages across cultures.

**This is a local dev demo, NOT a production deployment.** No TLS, no persistent storage, no federation.

## Prerequisites

- Node.js >= 18
- npm
- A DashScope API key (for the Qwen LLM that powers cultural adaptation)

## Build

```bash
npm install
npm run build
```

This compiles TypeScript to `dist/`.

## Environment Variables

| Variable | Used by | Default | Required | Purpose |
|----------|---------|---------|----------|---------|
| `PORT` | Server | `3000` | No | Server listen port |
| `CHORUS_API_KEYS` | Server | — | **Yes** | Comma-separated bearer tokens for auth |
| `DASHSCOPE_API_KEY` | Agent | — | **Yes** | LLM API key (DashScope/Qwen) for cultural adaptation |
| `CHORUS_ROUTER_API_KEY` | Agent | — | No (but needed if server has auth) | Bearer token the agent uses to authenticate with the server |

## Start Order

### Terminal 1 — Routing Server

```bash
CHORUS_API_KEYS=test-key PORT=3000 npm start
```

Expected output:
```
[router] Chorus routing server listening on port 3000 (auth enabled)
```

### Terminal 2 — Agent A (Chinese)

```bash
DASHSCOPE_API_KEY=your-dashscope-key CHORUS_ROUTER_API_KEY=test-key \
  node dist/agent/index.js --culture zh-CN --port 3001
```

Expected output:
```
[agent-zh-CN@localhost] Receiver listening on port 3001
[agent-zh-CN@localhost] Registered with router at http://localhost:3000
[agent-zh-CN@localhost] Discovered 0 compatible agent(s):
```

### Terminal 3 — Agent B (Japanese)

```bash
DASHSCOPE_API_KEY=your-dashscope-key CHORUS_ROUTER_API_KEY=test-key \
  node dist/agent/index.js --culture ja --port 3002
```

Expected output:
```
[agent-ja@localhost] Receiver listening on port 3002
[agent-ja@localhost] Registered with router at http://localhost:3000
[agent-ja@localhost] Discovered 1 compatible agent(s): agent-zh-CN@localhost
```

Now type a message at the `chorus>` prompt in Terminal 3. The Japanese agent will:
1. Generate cultural context using the LLM
2. Package a Chorus envelope
3. Send it to the server, which relays it to the Chinese agent
4. The Chinese agent adapts the message using the LLM and prints the result

### Agent CLI Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `--culture` | — (required) | Agent's culture (BCP 47: `en`, `zh-CN`, `ja`, etc.) |
| `--port` | `3001` | Port for the agent's receive endpoint |
| `--router` | `http://localhost:3000` | Routing server URL |
| `--agent-id` | `agent-{culture}@{host}` | Custom agent address |
| `--languages` | same as `--culture` | Comma-separated supported languages |
| `--personality` | — | Optional personality prompt for the agent |

## Health Checks

```bash
# Server health
curl http://localhost:3000/health

# Discovery endpoint
curl http://localhost:3000/.well-known/chorus.json

# List registered agents
curl http://localhost:3000/agents
```

Expected health response:
```json
{"success": true, "data": {"status": "ok"}, "metadata": {"timestamp": "..."}}
```

Expected discovery response:
```json
{
  "chorus_version": "0.4",
  "server_name": "Chorus Hub",
  "endpoints": {
    "register": "/agents",
    "discover": "/agents",
    "send": "/messages",
    "health": "/health"
  }
}
```

## When It Works, You See

**Terminal 1 (Server)**: Logs showing agent registrations and message relays.

**Terminal 2 (zh-CN Agent)**: When a message arrives:
```
[agent-zh-CN@localhost] Message from agent-ja@localhost:
[agent-zh-CN@localhost]   Original: プロジェクトのスケジュールを確認しましょう。
[agent-zh-CN@localhost]   Adapted:  让我们确认一下项目的时间安排。
```

**Terminal 3 (ja Agent)**: Streaming LLM output as cultural context is generated, then confirmation:
```
[agent-ja@localhost] Message sent to agent-zh-CN@localhost
```

## Known Limitations

- **In-memory registry**: Agent registrations are lost when the server restarts.
- **No TLS**: All traffic is unencrypted HTTP. Do not use on public networks.
- **No federation**: Agents on different servers cannot communicate.
- **Demo LLM model**: Cultural adaptation quality depends on the LLM and API key provided.
- **No message persistence**: Messages are relayed in real-time; no history or replay.

## Troubleshooting

### `EADDRINUSE` — port already in use

Another process is using the port. Kill it or choose a different port:
```bash
lsof -i :3000  # find what's using port 3000
PORT=3001 npm start  # use a different port
```

### `CHORUS_API_KEYS environment variable is required`

The server requires this env var. Set it:
```bash
CHORUS_API_KEYS=test-key npm start
```

### `DASHSCOPE_API_KEY is required`

The agent needs an LLM API key. Get one from DashScope and set it:
```bash
DASHSCOPE_API_KEY=your-key node dist/agent/index.js --culture en --port 3001
```

### Agent shows `Discovered 0 compatible agent(s)`

This is normal if the agent is the first one registered. Start the second agent and it will discover the first.

### LLM timeout / slow responses

Cultural adaptation requires an LLM call. If the DashScope API is slow or unreachable, message delivery will time out. Check your API key and network connection.

### `ERR_SENDER_NOT_REGISTERED`

The `sender_id` in the envelope must match a registered agent. Make sure the agent registered successfully before sending.
