<!-- Author: be-domain-modeler -->

# I-02-A-03 Evidence — Timeout Duplicate-Safety

## Claim

Bridge timeout is not allowed to fall back into retryable duplicate-local-delivery semantics.

## Evidence

- `src/bridge/inbound.ts` converts a delivery timeout into `DeliveryReceipt { status: 'unverifiable', method: 'timeout' }`.
- `src/bridge/types.ts` now states at the contract level that `unverifiable` is terminal for Bridge retry semantics and must not be re-delivered.
- `tests/bridge/inbound.test.ts:test_delivery_timeout` asserts timeout becomes `delivery_unverifiable`, advances the cursor, and does not record delivery evidence.
- `tests/bridge/inbound.test.ts:test_timeout_no_duplicate_delivery` asserts a second processing attempt with the same trace_id is deduped and `deliverInbound` is called exactly once.

## Conclusion

Timeout duplicate-safety is explicit in both contract and tests: the timeout path is terminal, cursor-advancing, and not retryable.
