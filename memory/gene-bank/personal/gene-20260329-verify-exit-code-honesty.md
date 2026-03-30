---
id: gene-20260329-verify-exit-code-honesty
trigger: 'when a verify/check command has partial success (some checks pass, some fail)'
action: 'exit non-zero if ANY actionable check fails — never let "installation OK but not activated" report as success. Split output into layers (integrity vs readiness) but final exit code must reflect the worst layer.'
confidence: 0.8
topic: 'workflow'
universality: 'global'
project_types: []
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-29'
updated: '2026-03-29'
evidence:
  - date: '2026-03-29'
    context: 'chorus-skill verify --target openclaw printed warning about missing credentials but exited 0. Users saw "verified" and assumed everything worked. Fix: exit 1 when bridge is in standby, clearly separate installation integrity (pass) from activation readiness (fail).'
---

# Verify Commands Must Exit Non-Zero on Partial Failure

## Action

When building a verify/check CLI command that validates multiple layers:
1. Split output into named layers (e.g., "Installation Integrity", "Activation Readiness")
2. Report each layer's status clearly
3. Final exit code = worst layer result. If ANY layer fails, exit non-zero.
4. Never use a warning icon (⚠) with exit 0 for a state that prevents functionality.

## Evidence

- 2026-03-29: Users ran `verify --target openclaw`, got `⚠ No agent configs found`, exit 0. They believed installation was complete. Bridge was disabled. Fix: changed to `✗ Bridge standby`, exit 1.
