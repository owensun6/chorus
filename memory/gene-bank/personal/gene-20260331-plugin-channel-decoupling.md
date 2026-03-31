---
id: gene-20260331-plugin-channel-decoupling
trigger: 'when a Gateway plugin needs to deliver messages to a channel (Telegram, WeChat, etc.)'
action: 'delegate to the Gateway official channel helper, never implement private channel-specific send logic inside the plugin'
confidence: 0.7
topic: 'architecture'
universality: 'conditional'
project_types: ['openclaw-plugin']
role_binding: 'be-ai-integrator'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-31'
updated: '2026-03-31'
evidence:
  - date: '2026-03-31'
    context: 'chorus-bridge had private Telegram Bot API send logic (sendTelegramMessage + resolveTelegramBotToken). This created tight coupling to Telegram config schema (accounts.{id}.botToken vs flat botToken). On single-agent OpenClaw with flat config, bridge failed with no_tg_bot_token. Commander ruled: bridge should not know about Telegram at all — delegate to Gateway channel helper.'
---

# Plugin-Channel Decoupling

## Action

Gateway plugins must not implement private channel-specific send logic. When a plugin needs to deliver a message to a user-visible channel:
1. Use the Gateway's official channel helper API (e.g., `sendMessageTelegram(to, text, { cfg, accountId })`)
2. Never read channel config directly (botToken, accounts, etc.)
3. Never call external APIs (Telegram Bot API, WeChat API) directly from plugin code

## Evidence

- chorus-bridge runtime-v2.ts contained `sendTelegramMessage()` (direct Bot API call) and `resolveTelegramBotToken()` (reads `channels.telegram.accounts.{id}.botToken` from openclaw.json)
- Single-agent OpenClaw uses flat config: `channels.telegram.botToken` (no `accounts` sub-object)
- Bridge failed with `no_tg_bot_token accountId=default` because it expected the multi-agent `accounts` schema
- Root cause: bridge bypassed Gateway's channel layer, creating undocumented coupling to Telegram config internals
