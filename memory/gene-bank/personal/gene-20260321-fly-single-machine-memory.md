---
id: gene-20260321-fly-single-machine-memory
trigger: 'when deploying in-memory stateful service to Fly.io'
action: 'set max_machines_running = 1 and auto_stop_machines = off to prevent state inconsistency across replicas'
confidence: 0.9
topic: 'architecture'
universality: 'conditional'
project_types: ['web-service']
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-21'
updated: '2026-03-21'
evidence:
  - date: '2026-03-21'
    context: 'Fly.io created 2 machines by default. POST /agents went to machine A, GET /agents went to machine B — empty response. In-memory registry was split across replicas with no sync. Had to destroy second machine and lock max=1.'
---

# Fly.io Single Machine for In-Memory State

## Action

When deploying a service that relies on in-memory state (e.g. agent registry, session store, counters) to Fly.io, explicitly configure:

```toml
auto_stop_machines = "off"
min_machines_running = 1
max_machines_running = 1
```

Fly.io creates a second machine by default "for high availability and zero downtime deployments." For stateless services this is fine. For in-memory stateful services, it splits state across replicas with no synchronization, causing invisible data inconsistency.

## Evidence

- 2026-03-21: Chorus Alpha Hub deployed to Fly.io. Registration went to machine A (201 success), discovery hit machine B (returned empty array). Health on machine B showed `agents_registered: 0` while machine A had `agents_registered: 1`. Resolved by destroying the second machine and adding `max_machines_running = 1` to fly.toml.
