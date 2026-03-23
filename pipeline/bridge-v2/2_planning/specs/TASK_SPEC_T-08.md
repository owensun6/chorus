<!-- Author: Lead -->

# TASK_SPEC_T-08

**Task**: A-B2 verification — OpenClaw Host Adapter capability assessment
**Assignee**: be-ai-integrator
**Source**: INTERFACE.md §5 (A-B2-01, A-B2-02)
**Blocker**: T-03

## Input

- INTERFACE.md §3: HostAdapter contract (what Bridge expects)
- T-03: HostAdapter interface types (what must be implemented)
- OpenClaw runtime: `~/.openclaw/extensions/` plugin system, session management, channel dispatch API

## Output

- `pipeline/bridge-v2/2_planning/specs/A-B2-verification-report.md`: findings for both assumptions

## Acceptance Criteria (BDD)

- Given: OpenClaw's channel dispatch API documentation or source code
  When: A-B2-01 is assessed
  Then: report states one of: "confirmed delivery supported (channels: X, Y)" or "fire-and-forget only (channels: X, Y)" with code evidence

- Given: OpenClaw's reply/session pipeline
  When: A-B2-02 is assessed
  Then: report states one of: "per-message reply attribution available (mechanism: X)" or "session-scoped only (constraint: single-peer per session)" with code evidence

- Given: verification report is complete
  When: reviewed
  Then: each finding includes: capability name, assessment, code location, and implementation path for T-09

## Test Specs

N/A — this is a read-only investigation task. Output is a document, not code.

## Structural Constraints

- immutability: N/A
- error_handling: N/A
- input_validation: N/A
- auth_boundary: N/A

## Prohibitions

- Do not write adapter code (that's T-09)
- Do not modify OpenClaw source code
- Do not assume capabilities without reading actual source or API surface
