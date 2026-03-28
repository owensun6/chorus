<!-- Author: Lead -->

# S-03-09 Hub Timeout During Catchup

## Goal

Inject a Hub timeout on the recovery catch-up path and verify fail-closed behavior:

- catch-up timeout is surfaced as an error
- the target Bridge runtime does not proceed to SSE / active state
- the process does not hang forever
- after removing the one-shot injection and restarting, the runtime recovers normally

## Core Contract Evidence

Recovery already encodes the required fail-closed rule in core code and tests:

- [`src/bridge/recovery.ts`](/Volumes/XDISK/chorus/src/bridge/recovery.ts) step 3 states Hub catch-up `MUST succeed before SSE can connect — fail-closed if all retries exhausted`
- [`tests/bridge/recovery.test.ts`](/Volumes/XDISK/chorus/tests/bridge/recovery.test.ts) `test_catchup_exhausted_throws` asserts:
  - recovery throws after retries are exhausted
  - `connectSSE` is **not** called
  - `acquireHandles` is **not** called

Repo verification for this round:

```sh
./node_modules/.bin/jest --runInBand --coverage=false tests/bridge/recovery.test.ts tests/bridge/runtime-v2.test.ts tests/bridge/router-hook.test.ts
npx tsc --noEmit --skipLibCheck --module commonjs --moduleResolution node packages/chorus-skill/templates/bridge/runtime-v2.ts tests/bridge/runtime-v2.test.ts tests/bridge/recovery.test.ts tests/bridge/router-hook.test.ts packages/chorus-skill/templates/bridge/router-hook.ts
```

Result:

- `3/3` suites passed
- `38/38` tests passed

## Installable Runtime Injection

The installable OpenClaw bridge now supports a one-shot debug injection file at:

- `/Users/test2/.chorus/debug/hub-catchup-timeout.json`

Injected file for this proof:

```json
{
  "enabled": true,
  "agent": "xiaox",
  "timeout_ms": 100,
  "max_retries": 0,
  "consume_once": true
}
```

This targets only `xiaox`, forces the catch-up timeout at `fetchHistory`, and reduces recovery retries to `0` so the proof is bounded to a single failed attempt.

## Live Fail-Closed Proof

After writing the injection file, the gateway was restarted.

Relevant live log lines from `/tmp/openclaw/openclaw-2026-03-25.log`:

- line `6915`: `[chorus-bridge] [xiaov] V2 bridge active (state: /Users/test2/.chorus/state/xiaov)`
- line `6916`: `[chorus-bridge] [xiaox] [catchup-timeout] injecting fetchHistory timeout timeoutMs=100`
- line `6923`: `[chorus-bridge] [xiaox] Recovery: Hub catchup attempt 1 failed: Error: Injected Hub catchup timeout after 100ms`
- line `6924`: `[chorus-bridge] [xiaox] V2 startup FAILED: Error: Recovery: Hub catchup failed after 1 attempts — cannot proceed to SSE`

Observed properties:

- the timeout happened specifically on the catch-up boundary
- `xiaox` did **not** reach `V2 bridge active` during the injected startup
- `xiaov` still reached `V2 bridge active`, so this was not a whole-gateway crash
- the injection file was consumed (`/Users/test2/.chorus/debug/hub-catchup-timeout.json` no longer existed after startup)

This is the live fail-closed signal: catch-up timeout prevented the target Bridge runtime from moving into the active/SSE phase.

## Live Recovery Proof

After the fail-closed proof was captured, the gateway was restarted again with no injection file present.

Relevant recovery window:

- line `7144`: `[chorus-bridge] [xiaov] V2 bridge active (state: /Users/test2/.chorus/state/xiaov)`
- lines `7196`-`7214`: `xiaox` retried incomplete relays; failures were logged but recovery continued
- line `7231`: `[chorus-bridge] [xiaox] V2 bridge active (state: /Users/test2/.chorus/state/xiaox)`

This proves the injected catch-up timeout was fail-closed, not destructive:

- the target runtime did not partially enter active state during the timeout proof
- removing the one-shot injection and restarting restored normal startup

## Verdict

`S-03-09 = PASS`

Why:

- catch-up timeout is explicit and observable
- the target runtime fails closed before active/SSE state
- no hang was observed
- normal startup resumes once the injected timeout is removed
