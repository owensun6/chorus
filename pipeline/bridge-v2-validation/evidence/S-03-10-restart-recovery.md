<!-- Author: Lead -->

# S-03-10 Restart Recovery

## Goal

Prove restart recovery is lossless and non-duplicating on the live V2 runtime:

- a pre-send transient host failure leaves the inbound fact incomplete and retryable
- the next restart resumes the same fact exactly once
- completion advances the cursor once and does not duplicate local delivery

## Repo Fix

Two repo-side fixes were required before live proof:

1. `OpenClawHostAdapter.deliverInbound()` now rethrows pre-send dispatcher errors instead of collapsing them into `status: "failed"`.
   - [`runtime-v2.ts`](/Volumes/XDISK/chorus/packages/chorus-skill/templates/bridge/runtime-v2.ts)
   - [`runtime-v2.test.ts`](/Volumes/XDISK/chorus/tests/bridge/runtime-v2.test.ts)

2. `RecoveryEngine` now filters Hub history by `msg.receiver_id === this.config.agentId` before:
   - building the resume index
   - sending catch-up messages into `processMessage(...)`
   - [`recovery.ts`](/Volumes/XDISK/chorus/src/bridge/recovery.ts)
   - [`recovery.test.ts`](/Volumes/XDISK/chorus/tests/bridge/recovery.test.ts)

Targeted verification for this round:

```sh
./node_modules/.bin/jest --runInBand --coverage=false tests/bridge/recovery.test.ts tests/bridge/runtime-v2.test.ts tests/bridge/router-hook.test.ts
npx tsc --noEmit --skipLibCheck --module commonjs --moduleResolution node src/bridge/recovery.ts tests/bridge/recovery.test.ts packages/chorus-skill/templates/bridge/runtime-v2.ts tests/bridge/runtime-v2.test.ts tests/bridge/router-hook.test.ts packages/chorus-skill/templates/bridge/router-hook.ts
git diff --check -- src/bridge/recovery.ts tests/bridge/recovery.test.ts packages/chorus-skill/templates/bridge/runtime-v2.ts tests/bridge/runtime-v2.test.ts
```

Result:

- `41/41` targeted tests passed
- `tsc --noEmit` passed
- `git diff --check` passed

## Live Probe

One new live probe was sent after the receiver filter fix:

- trace: `5bbaca46-06c6-465d-bb6b-72284604bec8`
- sender: `xiaov@openclaw`
- receiver: `xiaox@chorus`
- marker: `S0310_RESTART_PROBE_E_2026-03-25T23:43:30+0800`
- Hub timestamp: `2026-03-25T15:45:11.130Z`

The one-shot injection file used for the first restart was:

- `/Users/test2/.chorus/debug/host-timeout.json`

Injected config:

```json
{
  "enabled": true,
  "agent": "xiaox",
  "channel": "telegram",
  "original_text_contains": "S0310_RESTART_PROBE_E_2026-03-25T23:43:30+0800",
  "mode": "throw_before_send",
  "consume_once": true
}
```

## First Restart Proof: Incomplete / Retryable

Before the first restart:

- the trace existed in Hub history for `xiaox`
- the trace was absent from both local state files
- the injection file was still present

After the first restart completed its pending relay retries and reached the probe:

- log line `9960`: injected `throw_before_send` on `trace_id=5bbaca46-06c6-465d-bb6b-72284604bec8`
- log line `9961`: `deliver error: Error: Injected transient delivery failure before send ...`
- log line `9962`: `[xiaox] Transient delivery failure for trace_id=5bbaca46-06c6-465d-bb6b-72284604bec8 ...`
- the injection file was consumed and removed

Observed fact in [`xiaox@chorus.json`](/Users/test2/.chorus/state/xiaox/xiaox@chorus.json):

```json
{
  "route_key": "xiaox@chorus:xiaov@openclaw",
  "observed_at": "2026-03-25T15:46:20.141Z",
  "hub_timestamp": "2026-03-25T15:45:11.130Z",
  "delivery_evidence": null,
  "terminal_disposition": null,
  "cursor_advanced": false
}
```

Observed cursor after the first restart:

```json
{
  "last_completed_trace_id": "d8e45a95-951b-4783-b066-288230fe7571",
  "last_completed_timestamp": "2026-03-25T15:21:32.645Z"
}
```

Observed property:

- `/Users/test2/.chorus/state/xiaox/delivery-results/5bbaca46-06c6-465d-bb6b-72284604bec8.json` did **not** exist

This is the required first-boot state: the fact survived as incomplete and retryable, with no terminal result and no cursor advance.

## Second Restart Proof: Single Completion

After a second restart with no injection file present:

- log line `10204`: `[bridge:delivery] {"event":"delivery_unverifiable","trace_id":"5bbaca46-06c6-465d-bb6b-72284604bec8","peer":"xiaov@openclaw","channel":"telegram","method":"telegram_api_accepted",...}`

Observed fact in [`xiaox@chorus.json`](/Users/test2/.chorus/state/xiaox/xiaox@chorus.json):

```json
{
  "route_key": "xiaox@chorus:xiaov@openclaw",
  "observed_at": "2026-03-25T15:46:20.141Z",
  "hub_timestamp": "2026-03-25T15:45:11.130Z",
  "delivery_evidence": null,
  "terminal_disposition": {
    "reason": "delivery_unverifiable",
    "decided_at": "2026-03-25T15:47:55.214Z"
  },
  "cursor_advanced": true
}
```

Observed cursor after the second restart:

```json
{
  "last_completed_trace_id": "5bbaca46-06c6-465d-bb6b-72284604bec8",
  "last_completed_timestamp": "2026-03-25T15:45:11.130Z"
}
```

Observed durable delivery result:

- [`5bbaca46-06c6-465d-bb6b-72284604bec8.json`](/Users/test2/.chorus/state/xiaox/delivery-results/5bbaca46-06c6-465d-bb6b-72284604bec8.json)

```json
{
  "trace_id": "5bbaca46-06c6-465d-bb6b-72284604bec8",
  "peer": "xiaov@openclaw",
  "status": "unverifiable",
  "method": "telegram_api_accepted",
  "channel": "telegram",
  "terminal_disposition": "delivery_unverifiable",
  "recorded_at": "2026-03-25T15:47:55.192Z"
}
```

## No-Duplicate Proof

The live log contains exactly one failure phase and one terminal completion phase for the probe trace:

- lines `9960`-`9962`: one injected pre-send transient failure
- line `10204`: one terminal `delivery_unverifiable`

There is:

- no second injected failure for the same trace
- no second terminal `bridge:delivery` record for the same trace
- no second cursor advance beyond `last_completed_trace_id = 5bbaca46-06c6-465d-bb6b-72284604bec8`

This proves the restart path did not duplicate local delivery or duplicate cursor advancement.

## Verdict

`S-03-10 = PASS`

Why:

- first restart left the fact incomplete and retryable
- second restart resumed the same fact exactly once
- completion produced one terminal result and one cursor advance
- the wrong-agent history replay bug is blocked by the new `receiver_id` recovery filter
