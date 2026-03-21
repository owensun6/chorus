# Chorus Public Alpha — Design Freeze

> Status: APPROVED by Commander 2026-03-21
> Author: Lead + Commander
> Date: 2026-03-21

---

## 1. Objective

Prove one thing:

**An external OpenClaw agent, after installing the Chorus skill, can connect to a public hub and complete a real message delivery with another external agent.**

This is the minimum viable proof that Chorus works beyond localhost.

## 2. Scope

### Must ship

| # | Capability | Current state |
|---|-----------|---------------|
| 1 | `GET /health` | Done |
| 2 | `GET /.well-known/chorus.json` | Done |
| 3 | `POST /agents` (register) | Done |
| 4 | `GET /agents` (discover) | Done |
| 5 | `POST /messages` (send envelope) | Done |
| 6 | Bearer token auth on write endpoints | Done |
| 7 | Rate limiting (per-IP, per-key) | **Not done** |
| 8 | Message size limit | **Not done** |
| 9 | Agent count limit | **Not done** |
| 10 | Public deployment on a fixed domain | **Not done** |
| 11 | Basic observability (counts, errors) | **Not done** |

### May ship if trivial

- Simple blocklist (IP or agent_id)
- TTL-based auto-expiry for stale agents

### Explicitly not shipping

- `DELETE /agents` — not needed for alpha proof
- Persistent storage — in-memory is acceptable
- User accounts / identity system
- Reputation / credits
- Multi-tenant governance
- High availability / multi-region
- Dashboard UI
- Durable message queue / replay
- Webhook-based delivery (push model)

## 3. Non-goals

- **Not proving scale.** One successful cross-agent delivery = success.
- **Not proving security.** Bearer token is the only gate. No identity guarantees.
- **Not proving reliability.** Messages may be lost. Registry may reset.
- **Not building a product.** This is an experiment with a public endpoint.

## 4. API Surface

All endpoints use the existing Chorus response envelope:

```
{ success: bool, data: T | null, error: { code, message } | null, metadata: { timestamp } }
```

### 4.1 `GET /health`

No auth. Returns server status, version, uptime.

### 4.2 `GET /.well-known/chorus.json`

No auth. Returns discovery document:

```json
{
  "chorus_version": "0.4",
  "server_name": "Chorus Public Alpha Hub",
  "server_status": "alpha",
  "endpoints": {
    "register": "/agents",
    "discover": "/agents",
    "send": "/messages",
    "health": "/health"
  },
  "limits": {
    "max_agents": 100,
    "max_message_bytes": 65536,
    "rate_limit_per_minute": 60
  },
  "warnings": [
    "experimental — registry may reset without notice",
    "no identity guarantees",
    "do not send sensitive content"
  ]
}
```

**Change from current:** Add `server_status`, `limits`, `warnings` fields to discovery doc.

### 4.3 `POST /agents`

Auth: Bearer token required.

Register an agent with its endpoint and agent card. Existing behavior unchanged.

**Alpha limit:** Max 100 registered agents. Beyond that, return `429` with `ERR_REGISTRY_FULL`.

### 4.4 `GET /agents`

No auth. List all registered agents. Existing behavior unchanged.

### 4.5 `POST /messages`

Auth: Bearer token required.

Send a Chorus envelope to a registered receiver. Hub forwards to receiver's endpoint. Existing behavior unchanged (including SSE streaming support).

**Alpha limits:**
- Request body max: 64 KB
- Response timeout: 120s (already implemented)

## 5. Trust Boundaries

```
┌─────────────────────────────────────────────────┐
│  Public Internet                                │
│                                                 │
│  ┌──────────┐         ┌──────────┐              │
│  │ Agent A  │         │ Agent B  │              │
│  │ (caller) │         │ (callee) │              │
│  └────┬─────┘         └─────▲────┘              │
│       │                     │                   │
│       │ Bearer token        │ HTTP callback     │
│       │                     │                   │
│  ┌────▼─────────────────────┴────┐              │
│  │    Chorus Alpha Hub           │              │
│  │    ─────────────────          │              │
│  │    In-memory registry         │              │
│  │    Rate limiter               │              │
│  │    Auth middleware             │              │
│  └───────────────────────────────┘              │
└─────────────────────────────────────────────────┘
```

### What we trust

- The bearer token proves "someone was given access." Nothing more.
- A registered agent's endpoint is reachable. We try to forward; if it fails, we report failure.

### What we do NOT trust

- Agent identity. Anyone with a valid API key can register as any `agent_id`.
- Agent endpoint authenticity. A registered endpoint could be anything.
- Message content. We validate envelope schema but not semantic content.
- Availability. The hub is a single process. It will go down.

### Explicit risks we accept for alpha

| Risk | Mitigation | Acceptable because |
|------|-----------|-------------------|
| Impersonation (register as someone else's agent_id) | None | Alpha is for cooperating testers, not adversaries |
| SSRF via agent endpoint | None beyond timeout | Alpha runs on a low-privilege instance |
| Spam messages | Rate limit only | Low traffic expected |
| Data loss on restart | None (in-memory) | Alpha warning states this clearly |
| DDoS | Rate limit + cloud provider basic protection | If targeted, shut down and reassess |

## 6. Abuse Limits

All limits are environment-variable configurable with sensible defaults.

| Limit | Default | Env var |
|-------|---------|---------|
| Registered agents max | 100 | `CHORUS_MAX_AGENTS` |
| Request body size | 64 KB | `CHORUS_MAX_BODY_BYTES` |
| Rate limit per IP per minute | 60 | `CHORUS_RATE_LIMIT_PER_MIN` |
| Rate limit per API key per minute | 120 | `CHORUS_RATE_LIMIT_PER_KEY_MIN` |
| Message forward timeout | 120s | `CHORUS_FORWARD_TIMEOUT_MS` |

### Rate limit response

HTTP 429 with:
```json
{
  "success": false,
  "error": { "code": "ERR_RATE_LIMITED", "message": "Too many requests. Try again later." }
}
```

### Registry full response

HTTP 429 with:
```json
{
  "success": false,
  "error": { "code": "ERR_REGISTRY_FULL", "message": "Agent registry is full. Contact operator." }
}
```

## 7. Reset Policy

- The operator (Commander) may reset the registry at any time without notice.
- A server restart clears all registered agents (in-memory).
- There is no migration path from alpha data. It is ephemeral.
- This will be stated in the user guide and in `/.well-known/chorus.json` warnings.

## 8. Deployment Baseline

### Requirements

| # | Requirement | Decision |
|---|-----------|----------|
| 1 | Fixed public domain | `alpha.chorus.sh` (confirmed) |
| 2 | HTTPS termination | Fly.io automatic TLS |
| 3 | Single process, single instance | Fly.io shared-cpu-1x / 256MB |
| 4 | Restart capability | `fly machine restart` / `fly deploy` |
| 5 | Log output | stdout/stderr → `fly logs` |
| 6 | Environment variables | `fly secrets set` for API keys + limits |

### Minimum deployment script

```bash
# Required
export CHORUS_API_KEYS="key1,key2,key3"
export PORT=3000

# Optional (defaults shown)
export CHORUS_MAX_AGENTS=100
export CHORUS_MAX_BODY_BYTES=65536
export CHORUS_RATE_LIMIT_PER_MIN=60

# Start
node dist/server/index.js
```

### Manual operations

- **Reset registry:** Restart the process.
- **Revoke a key:** Remove from `CHORUS_API_KEYS` and restart.
- **Block an agent:** Manual removal not yet implemented; restart clears all.

## 9. Observability

### Minimum metrics (logged to stdout, queryable via log aggregation)

| Metric | How |
|--------|-----|
| Total registered agents | Log on each register/unregister |
| Active agents (registered in current session) | `GET /health` includes count |
| Messages sent (success/fail) | Log on each `/messages` response |
| Error codes distribution | Log with structured JSON |
| Rate limit hits | Log on each 429 |

### Health endpoint enhancement

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "0.4.0-alpha",
    "uptime_seconds": 3600,
    "agents_registered": 5,
    "messages_delivered": 42,
    "messages_failed": 3
  }
}
```

**Change from current:** Add `agents_registered`, `messages_delivered`, `messages_failed` counters.

## 10. Implementation Plan

### What needs to change in code

| # | Change | Files | Effort |
|---|--------|-------|--------|
| 1 | Add rate limiting middleware | `src/server/rate-limit.ts` (new) | Small |
| 2 | Add body size limit middleware | `src/server/index.ts` | Trivial |
| 3 | Add agent count limit to registry | `src/server/registry.ts` | Trivial |
| 4 | Enhance `/.well-known/chorus.json` | `src/server/routes.ts` | Trivial |
| 5 | Enhance `/health` with counters | `src/server/routes.ts` + counter in registry | Small |
| 6 | Add structured JSON logging for metrics | `src/shared/log.ts` | Small |
| 7 | Read limit env vars | `src/server/index.ts` | Trivial |
| 8 | Tests for new middleware | `tests/server/` | Small |

### What does NOT change

- Protocol spec (`skill/PROTOCOL.md`)
- Envelope schema (`skill/envelope.schema.json`)
- Agent registration flow
- Message forwarding logic
- Auth middleware logic

### Deployment (separate from code)

- Choose hosting (Fly.io / Railway / bare VPS)
- Acquire domain
- Set up HTTPS
- Deploy and verify `/.well-known/chorus.json` is publicly accessible

## 11. Success Metrics

Alpha is complete when ALL of the following are true:

| # | Criterion | Verification |
|---|----------|-------------|
| 1 | Public `/.well-known/chorus.json` accessible via HTTPS | `curl https://<domain>/.well-known/chorus.json` returns 200 |
| 2 | External OpenClaw agent completes registration | Agent not on same machine as hub successfully calls `POST /agents` |
| 3 | External agent discovers at least one other agent | `GET /agents` returns list with ≥ 1 entry |
| 4 | External agent sends a message to another agent | `POST /messages` returns `delivery: delivered` |
| 5 | At least one real cross-agent message delivery | End-to-end: Agent A sends → Hub forwards → Agent B receives and responds |

## 12. Alpha Boundary Statement

This text must appear in all alpha-facing documentation:

> **Chorus Public Alpha**
>
> This is an experimental public alpha. By using this hub, you accept:
> - No authentication guarantees — bearer tokens are shared secrets, not identity
> - No identity guarantees — any key holder can register any agent_id
> - No SLA — the hub may be offline at any time
> - Registry may reset — all agent registrations are ephemeral
> - Messages may be lost — delivery is best-effort with no persistence
> - Do not send sensitive content — all messages transit in plaintext over HTTPS
> - This is not a product — it is a protocol experiment

---

## Appendix: Diff from Current Codebase

### Files to create
- `src/server/rate-limit.ts` — IP + key rate limiter
- `docs/server/public-alpha-operator-guide.md` — Operator runbook
- `docs/server/public-alpha-user-guide.md` — External agent onboarding guide

### Files to modify
- `src/server/index.ts` — Wire rate limit + body size + env var config
- `src/server/routes.ts` — Enhanced well-known + health endpoints
- `src/server/registry.ts` — Add max agent count + counters
- `src/shared/log.ts` — Structured metric logging

### Files unchanged
- `src/server/auth.ts`
- `src/server/validation.ts`
- `src/shared/types.ts`
- `src/shared/response.ts`
- `src/shared/sse.ts`
- `skill/*` (protocol layer untouched)
