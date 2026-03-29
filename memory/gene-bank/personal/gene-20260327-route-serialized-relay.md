---
id: gene-20260327-route-serialized-relay
trigger: 'when outbound delivery must preserve strict per-route ordering across multiple state transitions'
action: 'collapse reply bind + relay submit + relay confirm into one route-scoped atomic API, make the runtime call only that API, and prove it with a same-route concurrency test before any live claim'
confidence: 0.8
topic: 'architecture'
universality: 'conditional'
project_types: ['bridge-runtime', 'message-relay']
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-27'
updated: '2026-03-27'
evidence:
  - date: '2026-03-27'
    context: 'Architecture expected same-route serialization, but runtime-v2 called bindReply(), submitRelay(), and confirmRelay() as separate steps. That made the planned strict-order live proof invalid until the API was collapsed behind a route lock.'
  - date: '2026-03-27'
    context: 'After adding RouteLock + OutboundPipeline.relayReply(), updating runtime callsites, and adding a same-route concurrency regression test, a live sample on xiaoyin recorded bound turns 1 then 2 on the same route with matching state and gateway-log evidence.'
---

# Route-Serialized Relay

## Action

If a relay pipeline spans multiple ordered state transitions on the same route, expose one route-scoped atomic method from the pipeline and have the runtime call only that method. Do not claim strict-order correctness while the runtime still stitches the steps together itself. Add a concurrency regression test first, then run the live proof.

## Evidence

- 2026-03-27: Same-route strict-order proof work uncovered a real gap between architecture and implementation. The architecture required per-route serialization, but runtime-v2 still orchestrated `bindReply()` / `submitRelay()` / `confirmRelay()` separately.
- 2026-03-27: Fixing the gap required both code-path consolidation (`relayReply()`) and a same-route test before the live sample on `xiaoyin@chorus` became meaningful evidence.
