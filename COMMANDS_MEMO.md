# Commands Memo

## SSE Probe

```bash
./bin/probe-sse-timestamp.sh [domain]
```

Purpose: self-register two throwaway agents on the target hub, open a raw SSE inbox, send one message, and fail if the live `event: message` payload does not contain a top-level ISO8601 `timestamp`.
