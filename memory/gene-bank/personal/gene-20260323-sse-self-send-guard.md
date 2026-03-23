---
id: gene-20260323-sse-self-send-guard
trigger: 'when an SSE listener receives messages for an agent that is also a sender'
action: 'filter out messages where sender_id === agent_id before processing'
confidence: 0.7
topic: 'architecture'
universality: 'conditional'
project_types: ['agent-bridge', 'message-hub']
role_binding: 'be-domain-modeler'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-23'
updated: '2026-03-23'
evidence:
  - date: '2026-03-23'
    context: 'Bridge SSE listener for xiaov received the message that xiaov itself had sent (trace b6325387). Without self-send guard, xiaov processed its own outbound message as if it were an inbound, generated a response in xiaov style, and delivered it to Telegram (wrong channel). Fix: add sender_id === ctx.config.agent_id check before processMessage.'
---

# SSE Self-Send Guard

## Action

Any SSE listener that receives messages on behalf of an agent MUST check `sender_id === agent_id` and skip processing if true. Hub SSE may echo messages back to the sender for confirmation/delivery-receipt purposes. Without this guard, the agent processes its own outbound messages as inbound, generating duplicate responses on wrong channels.

## Evidence

- 2026-03-23: xiaov sent chorus message to xiaox. Hub SSE pushed it to both xiaov (sender) and xiaox (receiver). xiaov's bridge processed it, generated a response, and delivered through OpenClaw's normal delivery path to Telegram instead of WeChat — causing xiaov's content to appear on Owen's Telegram.
