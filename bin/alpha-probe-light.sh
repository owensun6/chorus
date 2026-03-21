#!/usr/bin/env bash
# Light probe — health only, safe for high-frequency external/cron use
# Usage: ./bin/alpha-probe-light.sh [domain]
# Exit code: 0 = healthy, 1 = unhealthy
set -euo pipefail

DOMAIN="${1:-chorus-alpha.fly.dev}"
LOGFILE="${ALPHA_PROBE_LOG:-/tmp/chorus-alpha-probe.jsonl}"

RESPONSE=$(curl -s -w "\n%{http_code} %{time_total}" --max-time 10 "https://${DOMAIN}/health" 2>/dev/null || echo '{"error":"curl_failed"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1 | awk '{print $1}')
LATENCY=$(echo "$RESPONSE" | tail -1 | awk '{print $2}')
BODY=$(echo "$RESPONSE" | sed '$d')
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

STATUS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status','error'))" 2>/dev/null || echo "parse_error")

RECORD="{\"ts\":\"${TIMESTAMP}\",\"http\":\"${HTTP_CODE}\",\"latency_s\":\"${LATENCY}\",\"status\":\"${STATUS}\"}"
echo "$RECORD" >> "$LOGFILE"

if [ "$HTTP_CODE" = "200" ] && [ "$STATUS" = "ok" ]; then
  exit 0
else
  echo "UNHEALTHY: http=${HTTP_CODE} status=${STATUS} latency=${LATENCY}s" >&2
  exit 1
fi
