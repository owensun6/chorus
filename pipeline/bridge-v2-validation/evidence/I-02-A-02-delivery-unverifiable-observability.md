<!-- Author: be-domain-modeler -->

# I-02-A-02 Evidence — delivery_unverifiable Observability

## Claim

Every `delivery_unverifiable` terminal path now emits one structured observable signal without leaking message content.

## Code Evidence

- `src/bridge/inbound.ts` emits `log('bridge:delivery', JSON.stringify(...))` on the shared `receipt.status === 'unverifiable'` path, so fire-and-forget and timeout dispositions both pass through the same observable branch.
- The emitted payload includes:
  - `event: "delivery_unverifiable"`
  - `trace_id`
  - `route_key`
  - `method`
  - `terminal_disposition`
  - `timestamp`
- The payload does not include `original_text`.
- `src/shared/log.ts` provides one tagged logger entrypoint, so the signal is machine-readable and grepable instead of ad hoc inline `console.log`.

## Test Proof

Command used:

```sh
npx jest --runInBand --coverage=false --testPathPatterns=tests/bridge/inbound.test.ts --testNamePattern='test_delivery_unverifiable_emits_observable_signal|test_delivery_timeout|test_timeout_no_duplicate_delivery'
```

Observed result:

- Exit code `0`
- `test_delivery_unverifiable_emits_observable_signal`
- `test_delivery_timeout`
- `test_timeout_no_duplicate_delivery`

These tests prove:

- direct `status="unverifiable"` emits the structured signal
- timeout-driven `status="unverifiable"` emits the same structured signal
- timeout does not re-enter retryable duplicate-local-delivery semantics

## Conclusion

`delivery_unverifiable` is now observable on every terminal runtime path covered by current Bridge semantics, and the signal is structured, grepable, and content-safe.
