---
id: gene-20260323-session-isolation-prevents-format-leak
trigger: 'when a bridge injects custom reply format instructions into agent session context'
action: 'use a dedicated session key for bridge-injected messages, never share with human main session'
confidence: 0.7
topic: 'architecture'
universality: 'conditional'
project_types: ['agent-bridge', 'multi-channel']
role_binding: 'be-domain-modeler'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-23'
updated: '2026-03-23'
evidence:
  - date: '2026-03-23'
    context: 'chorus_inbound and human Telegram messages shared session b8d2b5b5. reply_format with [chorus_reply] marker injected in chorus turn persisted across session, causing Owen human message to trigger [chorus_reply] output through normal Telegram delivery (no splitReplyParts). Fix: chorus session key chorus:xiaox:xiaov@openclaw isolated from human agent:xiaox:main.'
---

# Session Isolation Prevents Format Leak

## Action

When a bridge or plugin injects custom output format instructions (like `[chorus_reply]` markers) into an agent's session, those instructions MUST go into a dedicated session key isolated from the human's main session. Otherwise the format instructions persist in session context and pollute all subsequent turns, including human-initiated messages that don't route through the bridge's custom delivery pipeline.

## Evidence

- 2026-03-23: chorus_inbound injected `reply_format` with `[chorus_reply]` marker into shared session. When Owen later sent "Reply to her anything you want" through normal Telegram, the agent used `[chorus_reply]` format, but normal Telegram delivery has no `splitReplyParts` — marker and Chinese relay content leaked to human.
