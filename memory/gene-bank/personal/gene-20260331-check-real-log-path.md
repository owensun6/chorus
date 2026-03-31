---
id: gene-20260331-check-real-log-path
trigger: 'when debugging a process and log file shows no relevant entries'
action: 'verify you are reading the correct log file — check startup output for the actual log path (e.g. /tmp/ vs ~/.openclaw/logs/)'
confidence: 0.8
topic: 'workflow'
universality: 'global'
project_types: []
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-31'
updated: '2026-03-31'
graduated: true
graduated_date: '2026-03-31'
evidence:
  - date: '2026-03-31'
    context: 'Previous session read ~/.openclaw/logs/gateway.log and found zero delivery-related entries. The actual runtime log was at /tmp/openclaw/openclaw-YYYY-MM-DD.log (JSON format). The correct file immediately showed no_tg_bot_token errors. Gateway startup banner prints the real log path.'
---

# Check Real Log Path Before Debugging

## Action

When a log file shows no entries for an event you know occurred, do not assume the event is silent. Check the process startup output for the actual log file path. Many runtimes log to a different path than the "obvious" one (e.g., `/tmp/` vs config dir). The gateway startup line `[gateway] log file: ...` is the authoritative source.

## Evidence

- 2026-03-31: Spent time reading `~/.openclaw/logs/gateway.log` (human-readable format) which showed only startup messages. The real runtime log at `/tmp/openclaw/openclaw-2026-03-31.log` (JSON format) immediately revealed `Transient delivery failure ... no_tg_bot_token`. The previous session's handoff had directed to the wrong log path.
