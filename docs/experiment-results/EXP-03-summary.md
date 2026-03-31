# EXP-03 Summary — Run 1

**Date**: 2026-03-31
**Version**: `@chorus-protocol/skill@0.8.0-alpha.7`
**Verdict**: **VOID** (contamination audit incomplete — no screen recording, no shell history export, no browser history export)

---

## Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| TTIC (Time to Install Complete) | ~3 min | Agent self-installed via `npx init` |
| TTBA (Time to Bridge Active) | ~5 min | Agent self-restarted gateway without consent |
| TTTV (Time to Telegram Visible) | **NOT REACHED** | Chorus message not visible on Telegram |
| QC (Question Count) | 0 | Subject gave one instruction, agent did everything |
| DDC (Documentation Defect Count) | 0 observed | Agent read SKILL.md successfully |
| HIR (Human Intervention Required) | No | But environment cleanup was incomplete (Conductor error) |
| IOS (Install One-Shot) | Yes | `npx init` succeeded first attempt |
| ROS (Registration One-Shot) | Yes | `POST /register` succeeded first attempt |
| COS (Credential Config One-Shot) | Yes | Credentials saved correctly |
| GRM (Gateway Restart Method) | `gateway.restart` tool call | Agent self-restarted without user consent |
| GUP (Give-Up Point) | N/A | Subject did not give up |

## Hard Criteria

| # | Criterion | Met? |
|---|-----------|------|
| C-1 | Install + verify passes | YES |
| C-2 | Self-registration on Hub | YES |
| C-3 | Credentials saved correctly | YES |
| C-4 | Bridge activates, agent online | YES |
| C-5 | Message visible on Telegram | **NO** |
| C-6 | QC ≤ 3 | YES (0) |
| C-7 | HIR = false | YES |
| C-8 | No prior Chorus exposure | YES (verified by Commander) |
| C-9 | TTTV ≤ 60 min | **NO** (not reached) |

## Verdict Reasoning

C-5 not met: Hub confirmed `delivered_via=sse` (message reached bridge), but bridge did not forward to Telegram. Primary classification: **IMPL** (bridge delivery failure).

Verdict downgraded from INCOMPLETE to **VOID**: contamination audit artifacts (screen recording, shell history export, browser history export) were not collected per Section 3.3 / Section 10.1. Without complete audit trail, no verdict other than VOID is permissible per protocol.

## Observed Friction Points

| # | Predicted | Occurred? | Category |
|---|-----------|-----------|----------|
| F-1 | Credential path unclear | No — agent handled automatically | N/A |
| F-2 | Gateway restart unclear | No — agent self-restarted | IMPL (skipped consent) |
| F-3 | Credential JSON format wrong | No | N/A |
| F-4 | Verify standby confusion | Not tested | N/A |
| F-5 | Wrong agent_id format | No | N/A |
| F-6 | Bridge doesn't activate after credentials | No — activated after restart | N/A |

## New Friction (Not Predicted)

| # | Description | Category |
|---|-------------|----------|
| NF-1 | Bridge receives Chorus message via SSE but does not forward to Telegram | IMPL |
| NF-2 | Agent ignores SKILL.md restart consent checkpoint rules | IMPL / DOC |
| NF-3 | Environment cleanup left stale openclaw.json plugin references, causing recursive stack overflow | ENV (Conductor error) |
| NF-4 | Mac mini agent reused old credentials (`xiaox@chorus` without `hub_url`), stayed offline | IMPL / ENV |

## Evidence Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Hub Activity | `EXP-03-run1/hub-activity.json` | Captured |
| MacBook Gateway Log | `EXP-03-run1/macbook-gateway.log` | Captured |
| Mac mini Gateway Log | `EXP-03-run1/macmini-gateway-chorus.log` | Captured (partial) |
| Telegram Screenshot (MacBook) | `EXP-03-run1/telegram-macbook-nano-full.png` | Captured |
| Telegram Screenshot (Mac mini) | `EXP-03-run1/telegram-macmini-xiaox-full.png` | Captured |
| Screen Recording | NOT COLLECTED | **VOID trigger** |
| Shell History | NOT COLLECTED | **VOID trigger** |
| Browser History | NOT COLLECTED | **VOID trigger** |
| Screening Record | Verbal only (Commander vouched) | Insufficient per protocol |
