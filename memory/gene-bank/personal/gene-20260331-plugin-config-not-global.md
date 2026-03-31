---
id: gene-20260331-plugin-config-not-global
trigger: 'when an OpenClaw plugin accesses channel credentials (bot tokens, API keys) via api.config'
action: 'do not assume api.config contains global channel credentials — fall back to reading ~/.openclaw/openclaw.json when the plugin config lacks the needed credential'
confidence: 0.9
topic: 'architecture'
universality: 'conditional'
project_types: ['openclaw-plugin']
role_binding: 'be-domain-modeler'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-31'
updated: '2026-03-31'
graduated: true
graduated_date: '2026-03-31'
evidence:
  - date: '2026-03-31'
    context: 'deliverInbound threw no_tg_bot_token because api.config (plugin-scoped) had no channels.telegram.botToken. Token existed only in global openclaw.json. All bridge deployments on test2-macbook failed silently for hours.'
---

# Plugin Config Is Not Global Config

## Action

When writing OpenClaw plugins that need channel credentials (Telegram bot tokens, WeChat API keys), never assume `api.config` carries them. The plugin API provides a plugin-scoped config object, not the global gateway config. Always implement a fallback to read `~/.openclaw/openclaw.json` directly.

## Evidence

- 2026-03-31: `runtime-v2.ts:deliverInbound` read `(cfg as any)?.channels?.telegram?.botToken` where `cfg = this.api.config`. Plugin config had `{channels: {telegram: {enabled: true}}}` but no `botToken`. Token was in `~/.openclaw/openclaw.json` under `channels.telegram.botToken`. All 3 Chorus messages to `test2-macbook@agchorus` failed with transient `no_tg_bot_token` errors. Fix: added fallback `readJSON(join(OPENCLAW_DIR, "openclaw.json"))`.
