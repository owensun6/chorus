<!-- Author: Lead -->

# Gate 3 Live Continuity Bootstrap Proof

## Scope

Prove on a real inbound that Gate 3 now enforces the intended order:

1. `continuity[route_key]` is persisted first
2. delivery/result is still absent during the host-delivery window
3. terminal result and cursor advance happen only afterward

This proof is about inbound bootstrap ordering. It is not a claim that the direct live SSE path is healthy end-to-end.

## Real Inbound Used For Proof

A one-off real sender was self-registered on the live hub:

- `gate3probe-2026-03-25T11-14-03-076Z@chorus`

Then a real inbound was submitted to `xiaox@chorus` with:

- `conversation_id = gate3-2026-03-25T11-14-03-076Z`
- `turn_number = 1`
- body marker = `GATE3_PROBE_2026-03-25T11-14-03-076Z`

Hub accepted the message on trace:

- `cc42cf1e-5a9b-4e73-925a-8ae96aef0ce4`

Hub response timestamp:

- `2026-03-25T11:14:09.956Z`

## Direct SSE Limitation Observed

The real inbound was accepted by the hub, but the current live SSE event shape is still broken for the OpenClaw runtime:

- `/tmp/openclaw/openclaw-2026-03-25.log:2867`
- `[xiaox] Hub contract violation: SSE event schema mismatch ... path ["timestamp"]`

So this proof uses the same real inbound trace through restart/catch-up recovery, not through the broken direct SSE event path.

That limitation does not invalidate Gate 3 ordering, because recovery replays the same stored hub message through the same `InboundPipeline`.

## Restart/Catch-Up Proof

Before restart, a one-shot host timeout injection was armed for `xiaox` with:

- `mode = hang_before_send`
- `timeout_ms = 20000`
- `original_text_contains = GATE3_PROBE_2026-03-25T11-14-03-076Z`

Then:

```bash
openclaw gateway restart
```

### Before Processing

At `2026-03-25T11:17:48.040Z` in [xiaox@chorus.json](/Users/test2/.chorus/state/xiaox/xiaox@chorus.json):

- `continuity["xiaox@chorus:gate3probe-2026-03-25T11-14-03-076Z@chorus"]` did not exist
- `inbound_facts["cc42cf1e-5a9b-4e73-925a-8ae96aef0ce4"]` did not exist
- cursor still pointed to `cb0720ea-4283-450f-988e-e34d307d1274`
- delivery result file did not exist

### Mid-State: Continuity Already Durable, Result Still Absent

At `2026-03-25T11:17:52.073Z` in [xiaox@chorus.json](/Users/test2/.chorus/state/xiaox/xiaox@chorus.json):

- `continuity["xiaox@chorus:gate3probe-2026-03-25T11-14-03-076Z@chorus"]` existed with:
  - `remote_peer_id = gate3probe-2026-03-25T11-14-03-076Z@chorus`
  - `local_anchor_id = agent:xiaox:main`
  - `conversation_id = gate3-2026-03-25T11-14-03-076Z`
  - `last_inbound_turn = 1`
- `inbound_facts["cc42cf1e-5a9b-4e73-925a-8ae96aef0ce4"]` existed with:
  - `dedupe_result = "new"`
  - `delivery_evidence = null`
  - `terminal_disposition = null`
  - `cursor_advanced = false`
- cursor was still unchanged:
  - `last_completed_trace_id = cb0720ea-4283-450f-988e-e34d307d1274`
- delivery result file still did not exist

This is the exact Gate 3 ordering requirement: continuity is already durable while delivery/result/cursor are still untouched.

### Delivery Window / Timeout Evidence

From `/tmp/openclaw/openclaw-2026-03-25.log`:

- line 3166: injected `hang_before_send` for trace `cc42cf1e-5a9b-4e73-925a-8ae96aef0ce4`
- line 3167: `Delivery timeout ... marking unverifiable`
- line 3169: structured `[bridge:delivery]` with `method = timeout` and `terminal_disposition = delivery_unverifiable`

### Final State: Result and Cursor Advance Afterward

At `2026-03-25T11:18:23.807Z` in [xiaox@chorus.json](/Users/test2/.chorus/state/xiaox/xiaox@chorus.json):

- the same continuity entry still existed unchanged
- `inbound_facts["cc42cf1e-5a9b-4e73-925a-8ae96aef0ce4"]` now had:
  - `terminal_disposition.reason = "delivery_unverifiable"`
  - `cursor_advanced = true`
- cursor advanced to:
  - `last_completed_trace_id = cc42cf1e-5a9b-4e73-925a-8ae96aef0ce4`
  - `last_completed_timestamp = 2026-03-25T11:14:09.956Z`

And [cc42cf1e-5a9b-4e73-925a-8ae96aef0ce4.json](/Users/test2/.chorus/state/xiaox/delivery-results/cc42cf1e-5a9b-4e73-925a-8ae96aef0ce4.json) existed with:

- `status = "unverifiable"`
- `method = "timeout"`
- `channel = "telegram"`
- `terminal_disposition = "delivery_unverifiable"`

The one-shot injection file was also consumed and removed.

## Conclusion

Gate 3 live proof is sufficient:

- the real inbound trace created a fresh durable `continuity[route_key]`
- continuity appeared before any terminal result or cursor advance
- delivery/result remained absent during the injected host-delivery window
- terminal `unverifiable` result and cursor advance appeared only afterward

So the Gate 3 bootstrap contract is now proven on the live runtime.

## Residual Limitation

The direct SSE event shape is still incompatible with the current runtime contract because live SSE events arrive without `timestamp`.

That is a separate live transport/runtime issue. The Gate 3 proof above is still valid because recovery/catch-up replayed the same real inbound trace through the V2 inbound pipeline and preserved the required ordering semantics.
