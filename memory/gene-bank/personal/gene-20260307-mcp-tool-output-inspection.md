---
id: gene-20260307-mcp-tool-output-inspection
trigger: 'when calling any MCP tool for the first time or integrating a new external tool'
action: 'inspect the complete return data structure before deciding what to use; never assume output shape based on tool name or category'
confidence: 0.8
domain: 'workflow'
role_binding: 'ux-designer,fe-ui-builder,be-ai-integrator'
source: 'session'
campaign_id: 'fusion-method-coaching'
created: '2026-03-07'
updated: '2026-03-07'
evidence:
  - date: '2026-03-07'
    context: 'Stitch MCP get_screen returns both screenshot (PNG) AND htmlCode (full HTML+Tailwind), but UX Designer skill only used screenshots. Agent assumed "wireframe tool = images only" without checking return structure. Lost opportunity to export production-ready frontend code as Stage 5 starting point.'
---

# MCP Tool Output Full Inspection

## Action

When calling any MCP tool (Stitch, Playwright, GitHub, etc.) for the first time in a project:

1. **Call `get_*` or `list_*` on one real entity** and read the COMPLETE return structure
2. **Document all available fields**, not just the ones you expected
3. **Challenge your assumption**: "Am I only using a subset because I assumed the tool's capability, or because I verified the full output?"
4. **If the tool returns code/data you didn't expect**: evaluate whether it changes the downstream workflow (e.g., Stitch HTML code = fe-ui-builder starting skeleton, not from-scratch build)

## Root Cause Pattern

**Assumption-driven partial usage**: Agent's mental model of a tool ("Stitch = wireframe images") overrode the actual API response ("Stitch = images + HTML code"). This is a first-principles violation: the assumption was never questioned.

## Downstream Impact

- UX Designer skill (`fusion-ux-wireframe`) defined Stitch as "wireframe generator" with no mention of code export
- fe-ui-builder would have started from scratch instead of using Stitch-generated HTML/Tailwind as skeleton
- Wasted effort + inconsistency between prototype and implementation

## Proposed Skill Patch

- `fusion-ux-wireframe.md`: Add step after Stitch screen generation — "Export htmlCode from each screen to `stitch-code/` directory"
- `fe-ui-builder SKILL.md`: Add pre-step — "Check if `stitch-code/` exists; if yes, use as starting skeleton instead of building from scratch"

## Evidence

- 2026-03-07: Stitch MCP `get_screen` confirmed to return `htmlCode` field with full HTML+Tailwind code (mimeType: text/html, downloadable). Agent only used `screenshot` field for 9 screens during Stage 0.5 of cutegame project.
