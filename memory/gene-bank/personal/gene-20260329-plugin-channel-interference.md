---
id: gene-20260329-plugin-channel-interference
trigger: 'when an OpenClaw plugin loads TypeScript modules via jiti during gateway_start'
action: 'verify that plugin loading does not block channel initialization — test with plugin enabled AND disabled, comparing Telegram/WeChat startup logs'
confidence: 0.7
topic: 'architecture'
universality: 'conditional'
project_types: ['openclaw-plugin']
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-29'
updated: '2026-03-29'
evidence:
  - date: '2026-03-29'
    context: 'chorus-bridge plugin loading (successful, V2 bridge active) blocked Telegram channel startup on MacBook. Disabling plugin immediately restored Telegram. Multiple Gateway restarts confirmed pattern.'
---

# OpenClaw Plugin Loading Blocks Channel Initialization

## Action

When shipping an OpenClaw plugin that loads TypeScript modules via jiti during `gateway_start`, always verify that the plugin loading path — even when successful — does not interfere with other Gateway subsystems (especially channel initialization). Test by comparing Gateway startup logs with plugin enabled vs disabled.

## Evidence

- 2026-03-29: chorus-bridge loaded successfully (V2 bridge active), but Telegram `starting provider` never appeared in any subsequent Gateway restart. Disabling chorus-bridge in openclaw.json immediately restored Telegram channel startup. The plugin didn't crash — it just consumed enough startup time or resources to prevent channel initialization.
