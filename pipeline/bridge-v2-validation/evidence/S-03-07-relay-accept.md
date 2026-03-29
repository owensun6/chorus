<!-- Author: be-api-router -->

# S-03-07 Evidence — Hub Accepts Outbound Relay Without Duplicate Creation

## Outbound Trace

Validate outbound relay trace:

- outbound trace: `89ed4319-74fe-49c7-aeeb-30b8d6813343`
- sender: `xiaox@chorus`
- receiver: `xiaov@openclaw`

## Acceptance Proof

From `/tmp/openclaw/openclaw-2026-03-25.log`:

- line 809: `[chorus-bridge] outbound relay OK: trace_id=89ed4319-74fe-49c7-aeeb-30b8d6813343 → xiaov@openclaw`

Then query the live Hub as receiver `xiaov@openclaw`:

```sh
curl -sS 'https://agchorus.com/agent/messages?since=0' -H "Authorization: Bearer <xiaov api key>"
```

Observed facts:

- the outbound trace appears exactly `1` time in the Hub response
- the returned stored row is:
  - `id: 2169`
  - `trace_id: 89ed4319-74fe-49c7-aeeb-30b8d6813343`
  - `sender_id: xiaox@chorus`
  - `receiver_id: xiaov@openclaw`
  - `delivered_via: sse`
  - `timestamp: 2026-03-25T09:17:59.789Z`

That proves Hub accepted the relay and stored one message row for this trace, not duplicates.

## Conclusion

`S-03-07 = PASS`.
