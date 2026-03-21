---
id: gene-20260320-timeout-finally
trigger: 'when writing setTimeout/AbortController timeout patterns in try-catch blocks'
action: 'do always clearTimeout in finally block, never only in try success path'
confidence: 0.9
topic: 'code-style'
universality: 'global'
project_types: []
role_binding: 'be-api-router'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-20'
updated: '2026-03-20'
evidence:
  - date: '2026-03-20'
    context: 'src/server/routes.ts had 120s AbortController timeouts with clearTimeout only in try success path. Error paths left timer active, causing jest workers to hang for 120s before force-exit. Fix: move clearTimeout to finally block.'
graduated: true
graduated_date: '2026-03-21'
---

# Timeout Cleanup in Finally Block

## Action

When using `setTimeout` with `AbortController` (or any timer-based cleanup pattern), always place `clearTimeout` in a `finally` block, not inside the `try` body. Error paths that skip cleanup create silent resource leaks — timers keep the event loop alive and prevent clean process exit.

```typescript
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
try {
  // ... fetch with signal ...
} catch {
  // ... error handling ...
} finally {
  clearTimeout(timer);  // ALWAYS here, never only in try
}
```

## Evidence

- 2026-03-20: Two instances in `src/server/routes.ts` (non-streaming line 105, streaming line 174). Both had clearTimeout only on success path. Jest test `messages.test.ts` triggered error paths (ECONNREFUSED mock), leaving 120s timers alive → "worker failed to exit gracefully" warning.
