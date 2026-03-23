---
id: gene-20260322-shutdown-order-matters
trigger: 'when implementing graceful shutdown for a server with external connections + internal state (DB, cache)'
action: 'do stop accepting new connections first (server.close), then drain in-flight requests, then close internal resources (DB) last'
confidence: 0.7
topic: 'architecture'
universality: 'global'
project_types: []
role_binding: 'be-api-router'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-22'
updated: '2026-03-22'
evidence:
  - date: '2026-03-22'
    context: 'Initial implementation closed DB before HTTP server. Commander caught this: in-flight SSE connections and pending requests would hit a closed database. Correct order: server.close() callback fires after connections drain, then db.close(), then process.exit(0).'
---

# Graceful Shutdown: Outside-In

## Action

Shutdown order must be outside-in: stop the outermost layer first (HTTP server / load balancer), let in-flight work complete, then close inner resources (database, cache, message queues). Never close the database while the server is still accepting or processing requests.

## Evidence

- 2026-03-22: Chorus hub had `db.close()` before `server.close()`. During SSE streaming or concurrent requests, this would cause SQLite errors on in-flight queries. Fixed to: SIGTERM → server.close(callback) → db.close() → exit.
