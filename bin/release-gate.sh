#!/usr/bin/env bash
# Chorus release gate: verify live gate truth and local bridge checks.
# Usage:
#   EXPECT_INVITE_GATING=false ./bin/release-gate.sh
#   EXPECT_INVITE_GATING=true BASE_URL=https://agchorus.com ./bin/release-gate.sh
#
# Side effect:
# - Performs one anonymous self-registration probe with a one-off agent_id.
# - Best-effort cleanup deletes the probe agent before exit if registration succeeds.
set -euo pipefail

BASE_URL="${BASE_URL:-https://agchorus.com}"
EXPECT_INVITE_GATING="${EXPECT_INVITE_GATING:-false}"
TMP_DIR="$(mktemp -d /tmp/chorus-release-gate.XXXXXX)"
HEALTH_JSON="${TMP_DIR}/health.json"
REGISTER_BODY="${TMP_DIR}/register-body.json"
JEST_LOG="${TMP_DIR}/jest.log"
AGENT_ID="release-gate-$(date +%s)@agchorus"
REGISTERED_API_KEY=""

cleanup() {
  if [ -n "${REGISTERED_API_KEY}" ]; then
    curl -fsS -X DELETE "${BASE_URL}/agents/${AGENT_ID}" \
      -H "Authorization: Bearer ${REGISTERED_API_KEY}" >/dev/null 2>&1 || true
  fi
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

json_field() {
  local expr="$1"
  node -e "const chunks=[];process.stdin.on('data',d=>chunks.push(d)).on('end',()=>{const obj=JSON.parse(chunks.join(''));const v=process.argv[1].split('.').slice(1).reduce((o,k)=>o!=null?o[k]:undefined,obj);process.stdout.write(String(v??''));});" "${expr}"
}

echo "== Live health =="
curl -fsS "${BASE_URL}/health" > "${HEALTH_JSON}"
cat "${HEALTH_JSON}"
echo ""

ACTUAL_INVITE_GATING="$(cat "${HEALTH_JSON}" | json_field "obj.data.invite_gating")"
if [ "${ACTUAL_INVITE_GATING}" != "${EXPECT_INVITE_GATING}" ]; then
  echo "FAIL invite_gating expected=${EXPECT_INVITE_GATING} actual=${ACTUAL_INVITE_GATING}"
  exit 1
fi

echo "== Anonymous register probe =="
REGISTER_RESPONSE="$(
  curl -sS -w "\n%{http_code}" -X POST "${BASE_URL}/register" \
    -H "Content-Type: application/json" \
    -d "{\"agent_id\":\"${AGENT_ID}\",\"agent_card\":{\"card_version\":\"0.3\",\"user_culture\":\"en\",\"supported_languages\":[\"en\"]}}"
)"
REGISTER_CODE="$(printf '%s' "${REGISTER_RESPONSE}" | tail -1)"
printf '%s' "${REGISTER_RESPONSE}" | sed '$d' > "${REGISTER_BODY}"
cat "${REGISTER_BODY}"
echo ""
echo "http_code=${REGISTER_CODE}"

EXPECTED_REGISTER_CODE="201"
if [ "${EXPECT_INVITE_GATING}" = "true" ]; then
  EXPECTED_REGISTER_CODE="403"
fi

if [ "${REGISTER_CODE}" != "${EXPECTED_REGISTER_CODE}" ]; then
  echo "FAIL anonymous_register expected=${EXPECTED_REGISTER_CODE} actual=${REGISTER_CODE}"
  exit 1
fi

if [ "${REGISTER_CODE}" = "201" ]; then
  REGISTERED_API_KEY="$(cat "${REGISTER_BODY}" | json_field "obj.data.api_key")"
fi

echo "== TypeScript =="
npx tsc --noEmit

echo "== Bridge tests =="
if ! npx jest --runInBand --coverage=false --detectOpenHandles tests/bridge \
  2>&1 | tee "${JEST_LOG}"; then
  echo "FAIL jest_exit"
  exit 1
fi

echo "PASS release gate"
