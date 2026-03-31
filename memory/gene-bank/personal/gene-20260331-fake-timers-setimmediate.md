---
id: gene-20260331-fake-timers-setimmediate
trigger: 'when Jest tests use fake timers with ReadableStream or other Node internal async APIs'
action: 'do not use jest.useFakeTimers() in tests that consume ReadableStream. Node uses setImmediate internally for stream scheduling on Linux/Ubuntu. @sinonjs/fake-timers intercepts it, causing streams to stall. doNotFake options do NOT reliably fix this. Instead: save real setTimeout before tests, use real delays for async settling, only fake timers in tests that actually call advanceTimersByTime'
confidence: 0.9
topic: 'testing'
universality: 'global'
project_types: []
role_binding: 'qa-01'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-31'
updated: '2026-03-31'
graduated: true
graduated_date: '2026-03-31'
evidence:
  - date: '2026-03-31'
    context: '7 SSE tests passed on macOS but failed on Ubuntu CI. 4 iterations of doNotFake combinations all failed. Final fix: preserve real setTimeout, remove fake timers from 5 tests that dont need timer control, use 50ms real delay for async settling.'
---

# Fake Timers Break ReadableStream on Ubuntu

## Action

For tests involving ReadableStream consumption:
1. Save `globalThis.setTimeout` before any test setup
2. Do NOT call `jest.useFakeTimers()` unless the test actually needs `advanceTimersByTime`
3. Use `new Promise(r => realSetTimeout(r, 50))` for async settling instead of `flushMicrotasks`
4. `doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate']` does NOT work — the interception happens deeper

## Evidence

- 2026-03-31: 4 failed CI attempts with various doNotFake combos. Only removing fake timers entirely + real setTimeout delay fixed Ubuntu CI (commit dd169c2).
