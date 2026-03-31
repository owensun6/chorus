---
id: gene-20260331-cold-start-agent-name-mismatch
trigger: 'when a plugin uses an external agent identity (e.g., Chorus agent_id) to look up host-side resources (sessions, configs)'
action: 'never assume external identity name matches host agent name. Implement fallback: try exact match first, then scan for unambiguous single-agent environment, fail fast on ambiguous multi-agent'
confidence: 0.8
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
    context: 'Chorus agent "goooo@agchorus" tried to look up sessions at ~/.openclaw/agents/goooo/ but OpenClaw single-agent setup stores sessions at ~/.openclaw/agents/main/. Name mismatch caused no_delivery_target. Fixed by scanning all agent dirs and using unambiguous single fallback.'
  - date: '2026-03-31'
    context: 'Same pattern repeated with "test2@agchorus" vs "main" and "telegram-agent@agchorus" vs "main". Every cold-start hit this because users choose Chorus agent names freely.'
---

# Cold-Start Agent Name Mismatch

## Action

When a plugin's external identity (e.g., `goooo@agchorus`) differs from the host agent name (e.g., `main`):
1. Try exact match first (`~/.openclaw/agents/{externalName}/`)
2. If not found, scan all agent directories for the needed resource
3. If exactly one match → use it (single-agent environment, unambiguous)
4. If 0 or 2+ matches → fail fast with diagnostic error (no fuzzy resolution)

## Evidence

- Three consecutive EXP-03 attempts hit this: `goooo`, `test2`, `telegram-agent` — all differed from OpenClaw's `main`
- On Mac Mini multi-agent setup, names aligned by design (xiaoyin, xiaox) — so the bug was latent
- Cold-start is the default case for new users; multi-agent is the exception
