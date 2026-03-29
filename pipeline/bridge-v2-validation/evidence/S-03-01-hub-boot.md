<!-- Author: be-api-router -->

# S-03-01 Evidence — Hub Boot

## Boot Command

```sh
PORT=3101 CHORUS_API_KEYS=test-key CHORUS_DB_PATH=./tmp/bridge-v2-validation/s03-hub.db npm start
```

## Startup Output

- `[router] Chorus Hub listening on port 3101 (auth + rate-limit enabled)`
- `[router] Database: ./tmp/bridge-v2-validation/s03-hub.db (SQLite, WAL mode)`
- `[router] Limits: 100 agents, 65536B body, 60 req/min/IP`
- `[router] Self-registration open at POST /register (no invite codes in DB)`

## Health Proof

Command:

```sh
curl -s http://127.0.0.1:3101/health
```

Observed result:

- `"status":"ok"`
- `"version":"0.7.0-alpha"`
- `"invite_gating":false`

## Discovery Proof

Command:

```sh
curl -s http://127.0.0.1:3101/.well-known/chorus.json
```

Observed result:

- `"chorus_version":"0.4"`
- `"server_name":"Chorus Public Alpha Hub"`
- endpoints object present, including `/messages`, `/agent/inbox`, `/agent/messages`, and `/health`

## Conclusion

Merged `main` Hub boots successfully under a clean local SQLite path and exposes healthy transport/discovery endpoints. `S-03-01 = PASS`.
