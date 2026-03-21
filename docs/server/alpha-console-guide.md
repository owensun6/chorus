<!-- Author: Lead -->

# Alpha Console Guide

The Alpha Console is a built-in observation and testing tool for the Chorus Hub server. It is **not** a product UI — it exists to help operators, testers, and developers see what agents are doing in real time.

## Quick Start

```bash
CHORUS_API_KEYS=test-key npm start
# Open http://localhost:3000/console
```

Enter `test-key` in the API Key field (top-right) to enable POST operations.

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ Chorus Alpha Console   │ SSE ● │ API Key: [____] │ Hub ● │
├──────────────┬───────────────────┬───────────────────────┤
│ Agents       │ Timeline          │ Detail / Test Actions │
└──────────────┴───────────────────┴───────────────────────┘
│ uptime │ agents │ delivered │ failed                      │
└──────────────────────────────────────────────────────────┘
```

## Three User Perspectives

### Operator

Watch agent registration and message throughput. The footer shows live stats from `/health`. SSE dot (green = connected, red = disconnected) and Hub dot (green = healthy) give instant status.

### Tester

Use the **Test Actions** panel:

| Button | What It Does | Expected Result |
|--------|-------------|-----------------|
| Register Agent | `POST /agents` with random ID | 201 + agent appears in list |
| Send Message | `POST /messages` between first two agents | Timeline shows submitted → forward → delivered |
| No Auth POST | `POST /messages` without Bearer token | 401 in detail panel |
| Unknown Receiver | `POST /messages` to nonexistent agent | 404 in detail panel |
| Bad Envelope | `POST /messages` with missing fields | 400 validation error |

### Developer

Click any timeline event to see full JSON in the Detail panel. Use `trace_id` to follow a message through submitted → forward_started → delivered/failed.

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/activity` | GET | No | JSON array of recent events. `?since=N` for polling |
| `/events` | GET | No | SSE stream of real-time events |
| `/console` | GET | No | This HTML console |

## Limitations

- **In-memory only** — all events are lost on server restart (ring buffer, 500 events max)
- **No authentication** on GET endpoints — suitable for alpha/development only
- **Single instance** — no cross-node event sharing
- **Alpha quality** — UI may change without notice
