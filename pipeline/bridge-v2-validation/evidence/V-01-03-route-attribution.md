# V-01-03 Route Attribution Evidence

Host reply attribution is stable enough for the accepted session-level scope.

Evidence:
- `deriveChorusSessionKey(agentName, senderId, conversationId?)` is deterministic and names the session key from `agent + sender_id + optional conversation_id`, with sanitization but no transcript-based inference. See [~/.openclaw/extensions/chorus-bridge/resolve.ts:187-199](file:///Users/test2/.openclaw/extensions/chorus-bridge/resolve.ts#L187-L199).
- The runtime uses that session key as the isolated Chorus session, explicitly not the user main session, and records inbound session state with `sessionKey: chorusSessionKey` plus `updateLastRoute.sessionKey: chorusSessionKey`. See [~/.openclaw/extensions/chorus-bridge/index.ts:601-608](file:///Users/test2/.openclaw/extensions/chorus-bridge/index.ts#L601-L608) and [~/.openclaw/extensions/chorus-bridge/index.ts:699-716](file:///Users/test2/.openclaw/extensions/chorus-bridge/index.ts#L699-L716).
- The isolation tests prove determinism and separation: same `(agent, sender, conversation)` yields the same session key, different senders/conversations yield different keys, and the chorus session never equals the human main session pattern. See [~/.openclaw/extensions/chorus-bridge/session-isolation.test.ts:20-180](file:///Users/test2/.openclaw/extensions/chorus-bridge/session-isolation.test.ts#L20-L180).
- Outbound relay preserves `conversation_id` and increments `turn_number`, giving the reply a stable peer/conversation binding path rather than guessing from transcript text. See [~/.openclaw/extensions/chorus-bridge/resolve.ts:125-146](file:///Users/test2/.openclaw/extensions/chorus-bridge/resolve.ts#L125-L146) and [~/.openclaw/extensions/chorus-bridge/outbound-relay.test.ts:128-214](file:///Users/test2/.openclaw/extensions/chorus-bridge/outbound-relay.test.ts#L128-L214).

Conclusion:
`route_key` is stable at the accepted session-level scope because the host uses a deterministic chorus session key derived from peer identity and optional conversation identity, and it does not depend on transcript guessing.

YES
