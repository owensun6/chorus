#!/usr/bin/env bash
# Chorus Alpha Hub — Automated Smoke Test
# Usage: CHORUS_ALPHA_KEY=xxx ./bin/alpha-smoke.sh [domain]
# Exit code: 0 = all pass, 1 = failures detected
set -euo pipefail

DOMAIN="${1:-chorus-alpha.fly.dev}"
KEY="${CHORUS_ALPHA_KEY:?CHORUS_ALPHA_KEY env var required}"
PASS=0
FAIL=0
RESULTS=()

json_field() {
  local expr="$1"
  node -e "const chunks=[];process.stdin.on('data',d=>chunks.push(d)).on('end',()=>{const obj=JSON.parse(chunks.join(''));const v=process.argv[1].split('.').slice(1).reduce((o,k)=>o!=null?o[k]:undefined,obj);process.stdout.write(String(v??''));});" "${expr}"
}

check() {
  local name="$1" expected_status="$2" expected_field="$3" expected_value="$4"
  shift 4
  local response http_code body

  response=$(curl -s -w "\n%{http_code}" "$@")
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  local actual_value=""
  if [ -n "$expected_field" ]; then
    actual_value=$(echo "$body" | json_field "$expected_field" 2>/dev/null || echo "PARSE_ERROR")
  fi

  if [ "$http_code" != "$expected_status" ]; then
    FAIL=$((FAIL+1))
    RESULTS+=("FAIL  $name  (expected HTTP $expected_status, got $http_code)")
    return
  fi

  if [ -n "$expected_field" ] && [ "$actual_value" != "$expected_value" ]; then
    FAIL=$((FAIL+1))
    RESULTS+=("FAIL  $name  (expected $expected_field=$expected_value, got $actual_value)")
    return
  fi

  PASS=$((PASS+1))
  RESULTS+=("PASS  $name")
}

echo "Chorus Alpha Smoke — $(date -u +%Y-%m-%dT%H:%M:%SZ) — ${DOMAIN}"
echo "================================================================"

# --- Happy path ---

check "H1 health" "200" "obj.data.status" "ok" \
  "https://${DOMAIN}/health"

check "H2 well-known" "200" "obj.server_status" "alpha" \
  "https://${DOMAIN}/.well-known/chorus.json"

check "H3 register agent" "201" "obj.data.agent_id" "smoke-a@test" \
  -X POST "https://${DOMAIN}/agents" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"smoke-a@test","endpoint":"https://httpbin.org/post","agent_card":{"card_version":"0.3","user_culture":"en-US","supported_languages":["en"]}}'

check "H4 discover" "200" "obj.success" "true" \
  "https://${DOMAIN}/agents"

# Register sender for message test
curl -s -X POST "https://${DOMAIN}/agents" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"smoke-b@test","endpoint":"https://httpbin.org/post","agent_card":{"card_version":"0.3","user_culture":"zh-CN","supported_languages":["zh"]}}' > /dev/null

check "H5 send message" "200" "obj.data.delivery" "delivered" \
  -X POST "https://${DOMAIN}/messages" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"receiver_id":"smoke-a@test","envelope":{"chorus_version":"0.4","sender_id":"smoke-b@test","original_text":"smoke test","sender_culture":"zh-CN"}}'

# --- Negative path ---

check "N1 no auth" "401" "obj.error.code" "ERR_UNAUTHORIZED" \
  -X POST "https://${DOMAIN}/agents" \
  -H "Content-Type: application/json" \
  -d '{}'

check "N2 bad key" "401" "obj.error.code" "ERR_UNAUTHORIZED" \
  -X POST "https://${DOMAIN}/agents" \
  -H "Authorization: Bearer fake-key-xxxx" \
  -H "Content-Type: application/json" \
  -d '{}'

check "N3 bad schema" "400" "obj.error.code" "ERR_VALIDATION" \
  -X POST "https://${DOMAIN}/agents" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"x"}'

check "N4 bad json" "400" "obj.error.code" "ERR_VALIDATION" \
  -X POST "https://${DOMAIN}/agents" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d 'not json'

check "N5 unknown receiver" "404" "obj.error.code" "ERR_AGENT_NOT_FOUND" \
  -X POST "https://${DOMAIN}/messages" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"receiver_id":"ghost@nowhere","envelope":{"chorus_version":"0.4","sender_id":"smoke-b@test","original_text":"x","sender_culture":"en-US"}}'

check "N6 bad envelope" "400" "obj.error.code" "ERR_VALIDATION" \
  -X POST "https://${DOMAIN}/messages" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"receiver_id":"smoke-a@test","envelope":{"chorus_version":"0.4"}}'

# Register a broken endpoint for 5xx test
curl -s -X POST "https://${DOMAIN}/agents" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"broken@test","endpoint":"https://httpbin.org/status/500","agent_card":{"card_version":"0.3","user_culture":"en-US","supported_languages":["en"]}}' > /dev/null

check "N7 receiver 5xx" "502" "obj.error.code" "ERR_AGENT_UNREACHABLE" \
  -X POST "https://${DOMAIN}/messages" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"receiver_id":"broken@test","envelope":{"chorus_version":"0.4","sender_id":"smoke-b@test","original_text":"x","sender_culture":"en-US"}}'

# --- Idempotency ---

check "I1 re-register (idempotent, 200)" "200" "obj.data.agent_id" "smoke-a@test" \
  -X POST "https://${DOMAIN}/agents" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"smoke-a@test","endpoint":"https://httpbin.org/post","agent_card":{"card_version":"0.3","user_culture":"en-US","supported_languages":["en"]}}'

# --- Counters ---

check "C1 health counters" "200" "obj.success" "true" \
  "https://${DOMAIN}/health"

# --- Report ---

echo ""
for r in "${RESULTS[@]}"; do
  echo "  $r"
done

echo ""
echo "================================================================"
echo "TOTAL: $((PASS+FAIL))  PASS: ${PASS}  FAIL: ${FAIL}"
echo "================================================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
