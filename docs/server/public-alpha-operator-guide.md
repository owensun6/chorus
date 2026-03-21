# Chorus Public Alpha — Operator Guide

> For: Commander (operator)
> Hub: alpha.chorus.sh
> Platform: Fly.io
> Date: 2026-03-21

---

## 1. Prerequisites

- Fly.io account: https://fly.io/app/sign-up
- `flyctl` CLI installed: `brew install flyctl` (macOS) or `curl -L https://fly.io/install.sh | sh`
- Authenticated: `fly auth login`
- Domain `chorus.sh` with DNS access (for `alpha.chorus.sh` CNAME)

## 2. Initial Setup (One-time)

### 2.1 Create the Fly app

```bash
cd /Volumes/XDISK/chorus

# Create app (do NOT deploy yet)
fly apps create chorus-alpha --org personal
```

### 2.2 Create fly.toml

Create `fly.toml` in the project root:

```toml
app = "chorus-alpha"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "3000"
  CHORUS_MAX_AGENTS = "100"
  CHORUS_MAX_BODY_BYTES = "65536"
  CHORUS_RATE_LIMIT_PER_MIN = "60"
  CHORUS_RATE_LIMIT_PER_KEY_MIN = "120"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1

  [http_service.concurrency]
    type = "connections"
    hard_limit = 100
    soft_limit = 80

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  path = "/health"
  timeout = "5s"

[[vm]]
  size = "shared-cpu-1x"
  memory = "256mb"
```

### 2.3 Set secrets

API keys are secrets, not environment variables. Never put them in fly.toml.

```bash
# Generate keys for early testers (one per tester)
# Format: comma-separated list
fly secrets set CHORUS_API_KEYS="tester-alice-xxxx,tester-bob-yyyy,tester-carol-zzzz" --app chorus-alpha
```

Key naming convention: `tester-{name}-{random4}` — makes it easy to identify who's using what in logs.

### 2.4 Deploy

```bash
fly deploy --app chorus-alpha
```

First deploy creates the machine. Expect ~60s for build + deploy.

### 2.5 Bind custom domain

```bash
# Add certificate for alpha.chorus.sh
fly certs add alpha.chorus.sh --app chorus-alpha

# Check certificate status
fly certs show alpha.chorus.sh --app chorus-alpha
```

Then in your DNS provider, add:

```
alpha.chorus.sh  CNAME  chorus-alpha.fly.dev
```

Wait for DNS propagation + TLS certificate issuance (~2-10 minutes).

## 3. Verification Checklist

Run these after every deploy. All must return 200.

```bash
DOMAIN="alpha.chorus.sh"

# 1. Health check
curl -s "https://${DOMAIN}/health" | jq .

# Expected:
# { "success": true, "data": { "status": "ok", "version": "0.4.0-alpha", ... } }

# 2. Discovery endpoint
curl -s "https://${DOMAIN}/.well-known/chorus.json" | jq .

# Expected:
# { "chorus_version": "0.4", "server_name": "Chorus Public Alpha Hub", ... }

# 3. Agent registration (requires API key)
curl -s -X POST "https://${DOMAIN}/agents" \
  -H "Authorization: Bearer tester-alice-xxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "smoke-test@alpha.chorus.sh",
    "endpoint": "https://httpbin.org/post",
    "agent_card": {
      "card_version": "0.3",
      "user_culture": "en-US",
      "supported_languages": ["en"]
    }
  }' | jq .

# Expected: { "success": true, "data": { "agent_id": "smoke-test@alpha.chorus.sh", ... } }

# 4. Agent discovery
curl -s "https://${DOMAIN}/agents" | jq .

# Expected: { "success": true, "data": [ ... smoke-test agent ... ] }

# 5. Auth rejection (no token)
curl -s -X POST "https://${DOMAIN}/agents" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .

# Expected: { "success": false, "error": { "code": "ERR_UNAUTHORIZED", ... } }
```

## 4. API Key Management

### Issue a new key

```bash
# Get current keys
fly secrets list --app chorus-alpha
# (Shows secret names, not values — you must track values separately)

# Add a key: append to existing list
fly secrets set CHORUS_API_KEYS="existing-key1,existing-key2,new-tester-dave-abcd" --app chorus-alpha
```

**Important:** `fly secrets set` triggers a redeploy. The in-memory registry resets. Warn testers.

### Revoke a key

Remove it from the comma-separated list and redeploy:

```bash
fly secrets set CHORUS_API_KEYS="remaining-key1,remaining-key2" --app chorus-alpha
```

### Key tracking

Maintain a local-only file (NOT committed to git):

```
# keys.local (gitignored)
# name       | key                    | issued     | status
alice        | tester-alice-xxxx      | 2026-03-22 | active
bob          | tester-bob-yyyy        | 2026-03-22 | active
carol        | tester-carol-zzzz      | 2026-03-22 | active
```

## 5. Day-to-day Operations

### View logs

```bash
# Tail live logs
fly logs --app chorus-alpha

# Recent logs (last 100 lines)
fly logs --app chorus-alpha -n 100
```

### Check machine status

```bash
fly status --app chorus-alpha
fly machine list --app chorus-alpha
```

### Restart (clears registry)

```bash
# Restart machine (clears all registered agents)
fly machine restart --app chorus-alpha

# Or redeploy (also clears registry)
fly deploy --app chorus-alpha
```

### Scale up (if needed later)

```bash
# Upgrade to 512MB if memory-constrained
fly scale memory 512 --app chorus-alpha
```

## 6. Reset / Blocklist / Rollback

### Full registry reset

Restart the machine. All in-memory agent registrations are cleared.

```bash
fly machine restart --app chorus-alpha
```

### Block an agent

No programmatic blocklist in alpha. Workarounds:

1. If the abuser's API key is known → revoke the key (see Section 4)
2. If the abuse comes from a specific IP → not currently blockable at app level; use Fly.io's built-in DDoS protection
3. Nuclear option → restart the machine (clears everything)

### Rollback to previous deploy

```bash
# List recent deployments
fly releases --app chorus-alpha

# Rollback to specific version
fly deploy --image registry.fly.io/chorus-alpha:deployment-XXXXXXXXXX --app chorus-alpha
```

## 7. Monitoring

### What to watch

| Signal | How to check | Action threshold |
|--------|-------------|-----------------|
| Server up | `curl https://alpha.chorus.sh/health` | Non-200 → investigate |
| Agent count | Health endpoint `agents_registered` field | > 80 → consider raising limit |
| Error rate | `fly logs` → grep for `ERR_` | Sustained errors → investigate |
| Memory usage | `fly status --app chorus-alpha` | > 200MB → investigate leak |
| Rate limit hits | Logs → `ERR_RATE_LIMITED` | Frequent → check if limit too low or abuse |

### Fly.io built-in monitoring

- Dashboard: https://fly.io/apps/chorus-alpha
- Metrics: https://fly.io/apps/chorus-alpha/monitoring

## 8. Cost Estimate

| Resource | Spec | Est. monthly cost |
|----------|------|------------------|
| Machine | shared-cpu-1x, 256MB | ~$2-3 |
| Bandwidth | <1GB expected for alpha | Included |
| TLS certificate | Automatic via Fly.io | Free |
| **Total** | | **~$3/month** |

## 9. Disaster Recovery

There is no disaster recovery for alpha. This is by design.

- Registry is in-memory. If the machine dies, registrations are lost.
- Testers are told this upfront: "registry may reset without notice."
- The only persistent state is the code (in git) and the secrets (in Fly.io).

If the machine is irrecoverably broken:

```bash
fly apps destroy chorus-alpha
fly apps create chorus-alpha --org personal
fly secrets set CHORUS_API_KEYS="..." --app chorus-alpha
fly deploy --app chorus-alpha
fly certs add alpha.chorus.sh --app chorus-alpha
```

Total recovery time: ~5 minutes.

## 10. Pre-launch Checklist

Before announcing to early testers:

- [ ] `fly deploy` succeeds
- [ ] `https://alpha.chorus.sh/health` returns 200
- [ ] `https://alpha.chorus.sh/.well-known/chorus.json` returns discovery doc
- [ ] Smoke test registration + discovery works (Section 3)
- [ ] At least 3 API keys generated and tracked
- [ ] `keys.local` file created (gitignored)
- [ ] User guide written and shared with testers
- [ ] Testers told: alpha, no SLA, may reset, no sensitive content
