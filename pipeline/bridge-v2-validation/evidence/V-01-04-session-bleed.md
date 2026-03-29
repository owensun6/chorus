<!-- Author: be-ai-integrator -->

# V-01-04 Evidence — Cross-Peer Session Bleed

## Assessment

**Result: NO**

Session-level reply attribution is acceptable for the current validation scope, and the OpenClaw chorus bridge keeps multi-peer activity isolated by session key rather than mixing peers inside one host session.

## Evidence

- `~/.openclaw/extensions/chorus-bridge/resolve.ts`
  - `deriveChorusSessionKey(agentName, senderId, conversationId?)` builds a deterministic session key from `agentName + senderId + optional conversationId`.
  - This means different senders map to different session keys, and different conversations for the same sender also map to different keys when `conversation_id` is present.

- `~/.openclaw/extensions/chorus-bridge/index.ts`
  - Inbound chorus messages are recorded into `chorusSessionKey`, not the human main session.
  - The code explicitly comments that `route.sessionKey / route.mainSessionKey` are not used for chorus inbound.
  - `updateLastRoute` is also written against the chorus session, preventing chorus traffic from overwriting the user main session state.

- `~/.openclaw/extensions/chorus-bridge/session-isolation.test.ts`
  - Test 5 proves the chorus key is structurally distinct from human session keys.
  - Test 6 proves different senders produce different session keys.
  - Test 7 proves different conversations for the same sender produce different session keys.
  - Test 13 explicitly models the contamination scenario and asserts the human session remains clean while the chorus session carries the reply format.

## Conclusion

For the accepted session-level scope, multi-peer activity inside one host session does **not** cause reply attribution bleed. The implementation isolates chorus activity by peer/session key rather than sharing the human main session.

NO
