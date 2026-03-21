---
id: gene-20260320-verify-against-implementation
trigger: 'when writing experiment specs, test plans, or any document that references API behavior'
action: 'do read the actual implementation code (routes, handlers, response shapes) before writing expected behavior; never assume from protocol docs alone'
confidence: 0.9
topic: 'workflow'
universality: 'global'
project_types: []
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-20'
updated: '2026-03-20'
evidence:
  - date: '2026-03-20'
    context: 'EXP-01 experiment doc had 3 implementation mismatches caught by Commander: (1) S-2 wrote data.status=delivered but real field is data.delivery=delivered (routes.ts:128). (2) S-3 expected "reply envelope with cultural_context" but receiver only returns {status:ok} (receiver.ts:86). (3) Step 3 mentioned "HTTP header routing" but POST /messages only uses JSON body receiver_id (routes.ts:80).'
graduated: true
graduated_date: '2026-03-21'
---

# Verify Against Implementation, Not Just Protocol

## Action

Before writing any expected API behavior in experiment specs or test plans, read the actual handler code to confirm: exact response field names, exact response structure, what the endpoint actually returns vs what the protocol says it should. Protocol docs describe intent; implementation is ground truth for experiment design.

## Evidence

- 2026-03-20: Three mismatches in one experiment doc — wrong field name, non-existent return value, fictional routing mechanism. All caught by Commander reading source code. Each required a separate revision cycle.
