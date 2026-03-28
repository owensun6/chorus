<!-- Author: be-ai-integrator -->

# R-01: SSE Timestamp Contract — Local Verification

> Date: 2026-03-28T13:01:00Z
> Environment: localhost:3000 (compiled from main @ `2e4d945`)
> Method: Manual probe equivalent to `bin/probe-sse-timestamp.sh`

## Result: PASS

## Evidence

### Delivery confirmation

Hub response to `POST /messages`:
```
delivery: delivered_sse
```

### SSE event payload (receiver inbox)

```json
{
  "trace_id": "217fb0c2-788d-48b9-b780-d4a580d69494",
  "sender_id": "sse-probe-sender-1774702859@chorus",
  "envelope": {
    "chorus_version": "0.4",
    "sender_id": "sse-probe-sender-1774702859@chorus",
    "original_text": "sse-timestamp-probe-1774702859",
    "sender_culture": "en"
  },
  "timestamp": "2026-03-28T13:01:00.748Z"
}
```

### Timestamp validation

- Field present: YES
- Value: `2026-03-28T13:01:00.748Z`
- ISO8601 round-trip check: `new Date(ts).toISOString() === ts` → PASS

## Code path verified

1. `src/server/routes.ts:424` — `const hubTimestamp = new Date().toISOString()`
2. `src/server/routes.ts:440` — `timestamp: hubTimestamp` included in `inbox.deliver()` payload
3. `src/shared/sse.ts:9` — `JSON.stringify(data)` serializes timestamp into SSE stream
4. Origin commit: `90c59b4` (2026-03-24)

## What this proves

- The `main` branch code correctly includes `timestamp` in direct SSE events
- The Bridge v2 consumer (`hub-client.ts:53` schema) will accept this event without contract violation

## What this does NOT prove

- Live `agchorus.com` deployment has this fix (still on `0.7.0-alpha`)
- The fix works under production load / network conditions
