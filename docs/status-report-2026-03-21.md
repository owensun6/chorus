# Chorus Protocol — Stage Closure Report

2026-03-21

---

## Verified

| Claim | Evidence | Confidence |
|-------|----------|------------|
| A non-Claude AI can complete bidirectional integration from SKILL.md + TRANSPORT.md alone | EXP-02: CONDITIONAL PASS (xiaox/MiniMax-M2.7, ~2.5 min, QC=0, HIR=false) | Conditional — non-protocol artifact exposure caveat |
| Protocol technical chain works end-to-end (register → send → receive → validate) | EXP-01 + EXP-02 server logs | High |
| HTTP binding docs are sufficient for an AI to write a working implementation without source code | EXP-02: subject wrote 200-line Node.js agent from docs alone | Conditional (N=1, one model family) |
| OpenClaw skill installation enables one-sentence integration trigger | Manual test: xiaov completed register + send + receive from "给 agent-zh-cn@localhost 发一条消息" | Anecdotal (not formal experiment) |

## Not Verified

| Gap | Why | Risk |
|-----|-----|------|
| Human developer cold-start feasibility | EXP-03 designed but not executed | Cannot claim docs work for humans |
| Cross-model generality | Only tested MiniMax-M2.7 and Claude | Other models may fail on same docs |
| Production deployment | All tests on localhost | Network latency, auth, NAT traversal untested |
| Multi-turn conversation | No experiment tested conversation_id/turn_number flow | May have undiscovered friction |
| Cultural adaptation quality | Adaptation done by demo agent, not by subject | Protocol facilitates adaptation but quality is model-dependent |

## Fixed Friction (EXP-02 defects)

| ID | Defect | Fix | Commit |
|----|--------|-----|--------|
| F-1r | Two fields both named `chorus_version` caused confusion | Renamed agent card field to `card_version`, bumped schema to v0.3 | `bcb3dc9` |
| F-5 | `/.well-known/chorus.json` returned 404 | Implemented discovery endpoint | `00d161c` |
| F-6 | Envelope nesting unclear (flat vs wrapped) | Added explicit nesting callout in TRANSPORT.md + template | `bcb3dc9` |
| F-7 | Version compatibility unexplained | Retracted legacy compat promise, clarified pre-1.0 policy | `91e139c` |

## Unfixed / Deferred

| ID | Defect | Status | Reason |
|----|--------|--------|--------|
| F-4 | Quick Start lacks runnable code (only HTTP examples) | Deferred | LOW severity; Quick Start added but not executable scripts |

## Protocol Document State

| Document | Version | Status |
|----------|---------|--------|
| PROTOCOL.md | 0.4 (v0.5 doc changes) | Stable — main + zh-CN + 2 templates synced |
| SKILL.md | 0.4 | Stable — main + zh-CN + 2 templates synced |
| TRANSPORT.md | 0.4 | Stable — main + template synced, Quick Start included |
| envelope.schema.json | 0.4 | Stable — main + template synced |
| README.md | Rewritten | Reflects current v0.4 protocol |

## Open Risks

1. **Template drift will recur.** There is no automated check that `skill/*` and `packages/chorus-skill/templates/*` stay in sync. Next protocol change will re-introduce drift unless a sync mechanism is added.
2. **OpenClaw skill is manually installed.** Not on ClawHub. Distribution requires cp to `~/.openclaw/workspace/skills/chorus/`. Scales to exactly one machine.
3. **No human developer validation.** EXP-03 design exists but was not executed. All integration evidence comes from AI subjects.
4. **Server has no auth.** Acceptable for localhost demo, not for any networked deployment.
