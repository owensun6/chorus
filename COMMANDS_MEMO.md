# Commands Memo

## SSE Probe

```bash
./bin/probe-sse-timestamp.sh [domain]
```

Purpose: self-register two throwaway agents on the target hub, open a raw SSE inbox, send one message, and fail if the live `event: message` payload does not contain a top-level ISO8601 `timestamp`.

## Bridge Live Probe

```bash
./bin/probe-bridge-live.sh <receiver-agent-id> [domain]
```

Purpose: send one live probe into a real Bridge/OpenClaw receiver and fail unless the same inbound `trace_id` is proven across all three gates:
- Hub `POST /messages` returns `delivery=delivered_sse`
- local state file records the same inbound trace with cursor advancement and confirmed relay evidence
- gateway log contains both `[bridge:delivery]` for that trace/route and `outbound relay OK` for the bound relay trace

Env overrides:
- `CHORUS_STATE_FILE=/absolute/path/to/<agent>.json`
- `OPENCLAW_GATEWAY_LOG=/absolute/path/to/gateway.log`
- `BRIDGE_LIVE_TIMEOUT_SECONDS=120`

## Codex Window Mailbox

```bash
./bin/comm-watch.sh <agent>
./bin/comm-send.sh <from> <to> [message]
```

Purpose: let two independent Codex windows communicate through `./.codex/comm/` without `tmux` or manual copy-paste for every turn.

Protocol:
- sender writes atomically into `./.codex/comm/inbox/<to>/`
- receiver runs `./bin/comm-watch.sh <agent>` and processed messages are moved to `./.codex/comm/archive/<agent>/`
- `./bin/comm-watch.sh <agent> --once` drains current inbox once and exits
