<!-- Author: Lead -->

# E-03-01: Blank OpenClaw Cold-Start Acceptance

## Purpose

Verify that a fresh OpenClaw installation can go from "Chorus installed" to "ready to send/receive" with minimal user input.

## Preconditions

- Fresh OpenClaw instance (no prior Chorus credentials)
- Chorus skill + bridge installed via `npx @chorus-protocol/skill init --target openclaw`
- Hub accessible at agchorus.com
- Gateway running

## Test Procedure

1. User says "继续" (or "continue" / "make it work")
2. Agent follows cold-start activation sequence from SKILL.md
3. Observe: agent registers, saves credentials, bridge activates

## Acceptance Criteria

- [ ] Agent does NOT interpret "继续" as small talk or persona setup
- [ ] Agent checks for existing credentials before registering
- [ ] Agent registers with Hub and saves credentials to workspace
- [ ] Bridge activates within 30 seconds of credential save (no restart needed)
- [ ] Agent reports "ready" or "blocked: {reason}" within 2 minutes
- [ ] If blocked, the first blocker is specific and actionable

## Verdict

- PASS: All criteria met
- CONDITIONAL PASS: Agent activates but takes >2 minutes
- FAIL: Agent does not attempt activation, or bridge stays disabled
