<!-- Author: be-ai-integrator -->

# A-B2 Verification Report — OpenClaw Host Adapter Capability Assessment

> Source: TASK_SPEC_T-08 / INTERFACE.md §5
> Date: 2026-03-24

---

## A-B2-01: Delivery Confirmation

**Assessment: Fire-and-forget only (no delivery receipt from any channel)**

### Evidence

| Channel | Code Location | Return Type | Delivery Confirmation? |
|---------|--------------|-------------|----------------------|
| WeChat | `~/.openclaw/extensions/openclaw-weixin/src/messaging/send.ts:82-111` | `{ messageId: string }` | No — `messageId` is locally-generated via `generateClientId()`, not a server ACK |
| Telegram | `~/.openclaw/extensions/chorus-bridge/index.ts:150-171` | `void` | No — fire-and-forget, no return value |
| Hub relay | `~/.openclaw/extensions/chorus-bridge/relay.ts:59-76` | `{ ok, trace_id }` | No — HTTP 2xx confirms Hub accepted the message, not that the end user saw it |

### Relay Error Handling

Location: `~/.openclaw/extensions/chorus-bridge/index.ts:784-811`

Relay errors are caught and logged but **do not propagate** to the caller. The user's local delivery succeeds even if the remote relay fails. This means the Bridge cannot currently distinguish "delivered to user" from "sent to channel".

### Implementation Path for T-09

The HostAdapter `deliverInbound` method must return a `DeliveryReceipt`. Given fire-and-forget channels:

- **Option A (recommended)**: Return `status: "unverifiable"` for WeChat and Telegram channels. The Bridge pipeline handles this via `terminal_disposition = "delivery_unverifiable"`, advancing the cursor without claiming confirmed delivery. This is honest and safe.
- **Option B**: Return `status: "confirmed"` when the send API does not throw, treating "sent without error" as proxy for "delivered". Weaker guarantee but simpler.

---

## A-B2-02: Reply Attribution

**Assessment: Confirmed — per-peer session isolation + turn number tracking available**

### Evidence

| Mechanism | Code Location | Description |
|-----------|--------------|-------------|
| Session isolation | `~/.openclaw/extensions/chorus-bridge/resolve.ts:187-199` | `deriveChorusSessionKey(agentName, senderId, conversationId?)` isolates context per peer + optional conversation thread |
| Turn tracking | `~/.openclaw/extensions/chorus-bridge/resolve.ts:129-149` | `buildOutboundEnvelope()` increments `turn_number` from inbound envelope |
| Turn limit | `~/.openclaw/extensions/chorus-bridge/resolve.ts:165-171` | `shouldRelay(inboundTurnNumber, maxTurns)` enforces relay depth |
| Conversation history | `src/agent/history.ts` | `ConversationHistory` class tracks per-peerId turns |
| Test evidence | `~/.openclaw/extensions/chorus-bridge/outbound-relay.test.ts:174-214` | Confirms `conversation_id` preserved and `turn_number` incremented |

### Reply Attribution Flow

1. Inbound message arrives with `envelope: { sender_id, conversation_id?, turn_number? }`
2. `deriveChorusSessionKey()` creates isolated session key from `agentName + senderId + conversationId`
3. Agent generates reply within the isolated session
4. `buildOutboundEnvelope()` constructs outbound with `turn_number = inbound_turn + 1`, same `conversation_id`
5. Remote agent receives reply with full attribution chain

### Implementation Path for T-09

The HostAdapter `onReplyDetected` callback can be wired to the existing chorus-bridge reply pipeline:

1. Hook into the session's reply event (after LLM generates response)
2. Extract `route_key` from the session key (maps to `agentName:senderId`)
3. Extract `reply_text` from the generated response
4. Extract `inbound_trace_id` from the session context (the trace_id that triggered this session)
5. Invoke the callback: `onReplyDetected({ route_key, reply_text, inbound_trace_id })`

The session isolation mechanism already exists and does not need modification.

---

## Summary

| Capability | Status | Implication for T-09 |
|-----------|--------|---------------------|
| A-B2-01: Delivery confirmation | Fire-and-forget | Return `status: "unverifiable"` — Bridge handles this correctly |
| A-B2-02: Reply attribution | Confirmed | Wire `onReplyDetected` to existing session reply pipeline |
