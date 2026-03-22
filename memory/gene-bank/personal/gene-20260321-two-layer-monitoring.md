---
id: gene-20260321-two-layer-monitoring
trigger: 'when setting up monitoring for a public-facing service'
action: 'use external uptime service as primary (independent evidence) plus local deep probe as supplement (transaction chain verification) — never rely on only one'
confidence: 0.7
topic: 'architecture'
universality: 'global'
project_types: ['web-service']
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-21'
updated: '2026-03-21'
evidence:
  - date: '2026-03-21'
    context: 'Commander FP review identified that local cron alone lacks independent evidence (self-reporting audit), and external uptime alone only proves GET /health is alive, not that register/discover/send transaction chain works. Correct architecture: external UptimeRobot (5min, independent reachability proof) + local cron smoke script (2h, 14-item transaction chain verification).'
---

# Two-Layer Monitoring Architecture

## Action

For any public-facing service, set up two monitoring layers:

1. **External uptime service** (UptimeRobot, Betterstack, etc.): 5-min interval, monitors `/health`, provides independent third-party evidence of availability. This is the primary layer — it survives even if your infrastructure is down.

2. **Local/CI deep probe**: Lower frequency (30min-2h), runs full transaction smoke (register + discover + send + negative paths). Provides business logic verification that a simple health check cannot.

Neither layer alone is sufficient:
- External-only: proves reachability, not functionality
- Local-only: self-reporting audit, lacks independence (if your machine dies, the report dies too)

## Evidence

- 2026-03-21: Commander's FP review caught that "8/8 smoke pass" from a single local run is quantity not quality. Identified anti-patterns: A2 self-reporting audit, C2 no-data decision. Remediation: UptimeRobot as primary external evidence + cron smoke as supplementary deep verification.
