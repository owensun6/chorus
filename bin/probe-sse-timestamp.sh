#!/usr/bin/env bash
# Probe live/raw SSE inbox delivery and fail if the message event lacks timestamp.
# Usage: ./bin/probe-sse-timestamp.sh [domain]
set -euo pipefail

DOMAIN="${1:-agchorus.com}"
BASE="https://${DOMAIN}"
STAMP="$(date +%s)"
SENDER_ID="sse-probe-sender-${STAMP}@chorus"
RECEIVER_ID="sse-probe-receiver-${STAMP}@chorus"
CARD='{"card_version":"0.3","user_culture":"en","supported_languages":["en"]}'
SSE_FILE="$(mktemp /tmp/chorus-sse-probe.XXXXXX)"

cleanup() {
  if [ -n "${CURL_PID:-}" ]; then
    kill "${CURL_PID}" 2>/dev/null || true
    wait "${CURL_PID}" 2>/dev/null || true
  fi
  rm -f "${SSE_FILE}"
}

register_agent() {
  local agent_id="$1"
  curl -sS -X POST "${BASE}/register" \
    -H "Content-Type: application/json" \
    -d "{\"agent_id\":\"${agent_id}\",\"agent_card\":${CARD}}"
}

json_field() {
  local expr="$1"
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=(new Function('obj', 'return ' + process.argv[1]))(JSON.parse(s));process.stdout.write(String(v ?? ''));});" "${expr}"
}

extract_message_payload() {
  node - <<'NODE' "${SSE_FILE}"
const fs = require('node:fs');
const raw = fs.readFileSync(process.argv[2], 'utf8');
const blocks = raw.split('\n\n').map((b) => b.trim()).filter(Boolean);
for (const block of blocks) {
  const lines = block.split('\n');
  const eventLine = lines.find((line) => line.startsWith('event: '));
  const dataLine = lines.find((line) => line.startsWith('data: '));
  if (!eventLine || !dataLine) continue;
  if (eventLine.slice(7) !== 'message') continue;
  process.stdout.write(dataLine.slice(6));
  process.exit(0);
}
process.exit(1);
NODE
}

trap cleanup EXIT

sender_json="$(register_agent "${SENDER_ID}")"
receiver_json="$(register_agent "${RECEIVER_ID}")"
sender_key="$(printf '%s' "${sender_json}" | json_field "obj.data.api_key")"
receiver_key="$(printf '%s' "${receiver_json}" | json_field "obj.data.api_key")"

curl -NsS "${BASE}/agent/inbox?token=${receiver_key}" > "${SSE_FILE}" &
CURL_PID=$!

sleep 1

send_json="$(
  curl -sS -X POST "${BASE}/messages" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${sender_key}" \
    -d "{\"receiver_id\":\"${RECEIVER_ID}\",\"envelope\":{\"chorus_version\":\"0.4\",\"sender_id\":\"${SENDER_ID}\",\"original_text\":\"sse-timestamp-probe-${STAMP}\",\"sender_culture\":\"en\"}}"
)"

sleep 2

message_payload="$(extract_message_payload || true)"
delivery_mode="$(printf '%s' "${send_json}" | json_field "obj.data.delivery")"

if [ "${delivery_mode}" != "delivered_sse" ]; then
  echo "FAIL delivery=${delivery_mode:-missing} domain=${DOMAIN}"
  echo "${send_json}"
  echo "---SSE---"
  cat "${SSE_FILE}"
  exit 1
fi

if [ -z "${message_payload}" ]; then
  echo "FAIL reason=no_message_event domain=${DOMAIN}"
  echo "${send_json}"
  echo "---SSE---"
  cat "${SSE_FILE}"
  exit 1
fi

message_timestamp="$(printf '%s' "${message_payload}" | json_field "obj.timestamp")"
if [ -z "${message_timestamp}" ] || [ "${message_timestamp}" = "undefined" ]; then
  echo "FAIL reason=missing_timestamp domain=${DOMAIN}"
  echo "${send_json}"
  echo "---SSE---"
  cat "${SSE_FILE}"
  exit 1
fi

node -e "const ts = process.argv[1]; const iso = new Date(ts).toISOString(); if (iso !== ts) process.exit(1);" "${message_timestamp}" || {
  echo "FAIL reason=invalid_timestamp domain=${DOMAIN} timestamp=${message_timestamp}"
  echo "${send_json}"
  echo "---SSE---"
  cat "${SSE_FILE}"
  exit 1
}

echo "PASS domain=${DOMAIN} timestamp=${message_timestamp}"
echo "${send_json}"
