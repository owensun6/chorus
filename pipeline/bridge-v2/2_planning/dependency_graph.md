<!-- Author: Lead -->

# Bridge v2 Dependency Graph

## Phase 1 — Parallel (no dependencies)

```
T-01 [be-api-router]      Hub transport contract          (Blocker: None)
T-02 [be-api-router]      Hub Idempotency-Key             (Blocker: None)
T-03 [be-domain-modeler]  Bridge types + state manager    (Blocker: None)
```

## Phase 2 — Bridge pipelines (depend on types + state)

```
T-04 [be-domain-modeler]  Inbound pipeline                (Blocker: T-03)
T-05 [be-domain-modeler]  Outbound pipeline               (Blocker: T-03)
T-06 [be-domain-modeler]  Hub client (SSE + relay)        (Blocker: T-01, T-03)
```

## Phase 3 — Recovery + verification

```
T-07 [be-domain-modeler]  Recovery engine                  (Blocker: T-04, T-05, T-06)
T-08 [be-ai-integrator]   A-B2 verification (read-only)   (Blocker: T-03)
```

## Phase 4 — Host adapter (depends on verification)

```
T-09 [be-ai-integrator]   OpenClaw Host Adapter            (Blocker: T-04, T-05, T-08)
```

## DAG (no cycles)

```
T-01 ──────────────────────────────┐
T-02 (independent)                 │
T-03 ──┬──────┬──────┬────────┐   │
       │      │      │        │   │
       ▼      ▼      ▼        ▼   ▼
      T-04   T-05   T-08    T-06 ◄┘
       │      │      │        │
       │      ├──────┤        │
       │      │      │        │
       └──┬───┘      │        │
          │    ┌──────┘   ┌───┘
          ▼    ▼          ▼
         T-09           T-07
```

No circular dependencies. Phase grouping is visual only — scheduling is driven by Blocker fields.
