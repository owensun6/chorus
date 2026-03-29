<!-- Author: be-ai-integrator -->

# S-03-08 Evidence — Host Delivery Timeout Degrades Correctly

## Runtime Change Applied

The OpenClaw bridge template now supports a bounded host-delivery timeout plus a one-shot debug injection file:

- [index.ts](/Volumes/XDISK/chorus/packages/chorus-skill/templates/bridge/index.ts)

The same runtime file was deployed to the live extension path:

- [index.ts](/Users/test2/.openclaw/extensions/chorus-bridge/index.ts)

For this validation run, a one-shot debug file was written at:

- `/Users/test2/.chorus/debug/host-timeout.json`

The debug file targeted:

- agent `xiaox`
- channel `telegram`
- messages whose `original_text` contains `HOST_TIMEOUT_S03_08`
- injected mode `hang_before_send`
- timeout `1000ms`
- `consume_once = true`

## Validation Trace

One real inbound was sent to trigger the timeout path:

- trace: `1a35ccf9-1bba-45c3-9d1d-53d12d16c891`
- receiver: `xiaox@chorus`
- marker: `HOST_TIMEOUT_S03_08`

Hub accepted it at `2026-03-25T09:29:29.417Z`.

## Timeout Proof

From `/tmp/openclaw/openclaw-2026-03-25.log`:

- line 950: `[chorus-bridge] [sse-recv] event received (xiaox) raw_trace_id=1a35ccf9-1bba-45c3-9d1d-53d12d16c891 raw_sender=xiaov@openclaw`
- line 952: `[chorus-bridge] [process] START trace_id=1a35ccf9-1bba-45c3-9d1d-53d12d16c891 sender=xiaov@openclaw agent=xiaox`
- line 973: `[chorus-bridge] [tg-deliver] sending (chatId=5465779468, len=95)`
- line 974: `[chorus-bridge] [deliver-timeout] injected hang_before_send trace_id=1a35ccf9-1bba-45c3-9d1d-53d12d16c891 channel=telegram agent=xiaox`
- line 975: `[chorus-bridge] [deliver-timeout] trace_id=1a35ccf9-1bba-45c3-9d1d-53d12d16c891 channel=telegram timeoutMs=1000 agent=xiaox`
- line 976: `[chorus-bridge] [bridge:delivery] {"event":"delivery_unverifiable","trace_id":"1a35ccf9-1bba-45c3-9d1d-53d12d16c891","peer":"xiaov@openclaw","channel":"telegram","method":"timeout","terminal_disposition":"delivery_unverifiable","timestamp":"2026-03-25T09:29:40.037Z"}`
- line 977: `[chorus-bridge] [process] removed from inbox trace_id=1a35ccf9-1bba-45c3-9d1d-53d12d16c891 (xiaox)`
- line 978: `[chorus-bridge] [process] SUCCESS trace_id=1a35ccf9-1bba-45c3-9d1d-53d12d16c891 sender=xiaov@openclaw agent=xiaox`

## Durable Result Proof

Observed file:

- [1a35ccf9-1bba-45c3-9d1d-53d12d16c891.json](/Users/test2/.chorus/state/xiaox/delivery-results/1a35ccf9-1bba-45c3-9d1d-53d12d16c891.json)

Observed content:

```json
{
  "trace_id": "1a35ccf9-1bba-45c3-9d1d-53d12d16c891",
  "peer": "xiaov@openclaw",
  "status": "unverifiable",
  "method": "timeout",
  "channel": "telegram",
  "terminal_disposition": "delivery_unverifiable",
  "recorded_at": "2026-03-25T09:29:40.037Z"
}
```

## Duplicate-Safety Proof

The timeout path did not fall into duplicate local delivery behavior:

- the injected debug file was consumed and removed after the match
- the same trace reached `[process] SUCCESS`
- the inbox entry was removed
- there is no second `START` line for trace `1a35ccf9-1bba-45c3-9d1d-53d12d16c891`
- there is no `[tg-deliver] OK` for this trace, because the injected send was intentionally hung before the host API call

This proves the timeout degrades to terminal `unverifiable` instead of hanging forever or retrying local delivery.

## Conclusion

Host timeout now matches the accepted contract on the live path:

- timeout result is recorded as `unverifiable`
- one structured observable signal is emitted
- processing completes and clears the inbox
- no duplicate local delivery path is entered

`S-03-08 = PASS`.
