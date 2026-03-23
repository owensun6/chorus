<!-- Author: Lead -->

# TASK_SPEC_T-09

**Task**: OpenClaw Host Adapter implementation
**Assignee**: be-ai-integrator
**Source**: INTERFACE.md §3 (Host Adapter contract); T-08 verification report
**Blocker**: T-04, T-05, T-08

## Input

- T-08 output: A-B2 verification report (determines confirmed vs unverifiable path, per-message vs session-scoped attribution)
- INTERFACE.md §3: HostAdapter interface contract
- T-03: HostAdapter interface types
- T-04: InboundPipeline (adapter is called by it)
- T-05: OutboundPipeline (adapter feeds replies to it)

## Output

- `src/bridge/adapters/openclaw.ts`: OpenClawAdapter implementing HostAdapter
  - `adaptContent()`: cultural adaptation via host LLM + Skill prompt
  - `deliverInbound()`: delivers to agent's active channel; returns DeliveryReceipt with status="confirmed"|"unverifiable"|"failed" per T-08 findings
  - `onReplyDetected()`: hooks into reply pipeline; provides inbound_trace_id if per-message attribution available (T-08), null if session-scoped
  - `resolveLocalAnchor()`: returns OpenClaw session key for the route
  - `acquireHandles()` / `releaseHandles()`: lifecycle management
- Tests

## Acceptance Criteria (BDD)

- Given: an inbound Chorus message in Chinese from a peer with culture=zh-CN
  When: adaptContent() is called with receiver_culture=en
  Then: returns English-adapted text (non-empty, different from original)

- Given: adaptContent() returns adapted text and host channel supports confirmation (per T-08)
  When: deliverInbound() is called
  Then: DeliveryReceipt.status="confirmed", method contains channel name, ref contains channel API reference

- Given: host channel is fire-and-forget (per T-08)
  When: deliverInbound() is called
  Then: DeliveryReceipt.status="unverifiable"

- Given: a chorus-facing reply is produced by the host
  When: onReplyDetected callback fires
  Then: callback receives route_key matching the inbound delivery's route_key

## Test Specs

- Test file: `tests/bridge/adapters/openclaw.test.ts` (new)
- test_adapt_content: cultural adaptation produces non-empty adapted text
- test_delivery_confirmed: confirmed channel → status="confirmed" with method + ref
- test_delivery_unverifiable: fire-and-forget channel → status="unverifiable"
- test_reply_attribution: onReplyDetected provides correct route_key (+ inbound_trace_id if available per T-08)

## Structural Constraints

- immutability: adapter does not store mutable state beyond acquired handles
- error_handling: transient channel failure (timeout, network) → throw (pipeline catches, fact stays retryable); permanent channel failure (invalid target, channel removed) → return DeliveryReceipt with status="failed"
- input_validation: validate route_key format before resolving anchor
- auth_boundary: adapter uses host-provided credentials, never stores Hub API keys

## Prohibitions

- Do not implement Bridge pipeline logic (adapter is called BY the pipeline)
- Do not hardcode agent names or channel types
- Do not modify OpenClaw core runtime code (adapter is a plugin)
- Do not parse reply text to determine relay target
