<!-- Author: Lead -->

# TASK_SPEC_T-02

**Task**: Hub Idempotency-Key support
**Assignee**: be-api-router
**Source**: INTERFACE.md §2.3; Freeze Gate #7 (outbound recovery depends on replay idempotency)
**Blocker**: None

## Input

- INTERFACE.md §2.3: POST /messages must honor `Idempotency-Key` header
- Current code: `src/server/db.ts` (schema v4), `src/server/routes.ts` lines 335-523 (POST /messages)

## Output

- `src/server/db.ts`: migration v5 adds `idempotency_keys` table (key TEXT PRIMARY KEY, payload_hash TEXT NOT NULL, trace_id TEXT, response TEXT, created_at TEXT)
- `src/server/routes.ts`: POST /messages checks `Idempotency-Key` header; if key exists, returns stored response without re-processing
- Updated tests

## Acceptance Criteria (BDD)

- Given: POST /messages with `Idempotency-Key: KEY-1` succeeds with trace_id=T1
  When: same POST is repeated with `Idempotency-Key: KEY-1`
  Then: response contains the original trace_id=T1; no duplicate message created

- Given: POST /messages without `Idempotency-Key` header
  When: request is processed
  Then: normal processing, no idempotency check (backward compatible)

- Given: POST /messages with `Idempotency-Key: KEY-2` and different payload than original KEY-2 request
  When: request is processed and stored `payload_hash` does not match the new request's hash
  Then: return 409 Conflict (same key, different payload)

## Test Specs

- Test file: `tests/server/idempotency.test.ts` (new)
- test_idempotent_replay: same key → same response, message count unchanged
- test_no_header: missing header → normal processing
- test_conflict: same key, different payload_hash → 409
- test_migration: db migration v5 creates idempotency_keys table with payload_hash column
- test_fail_closed: idempotency insert failure → 503 (not normal processing)

## Structural Constraints

- immutability: N/A (route handler)
- error_handling: idempotency table insert failure → return 503 (fail closed); do NOT fall through to normal processing — storing the key is a prerequisite for replay safety
- input_validation: `Idempotency-Key` header max length 256 chars; longer → 400
- auth_boundary: existing auth required before idempotency check

## Prohibitions

- Do not modify SSE delivery logic
- Do not change message-store query logic
- Do not modify Bridge code
