#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: ./bin/comm-send.sh <from> <to> [message]" >&2
  echo "If [message] is omitted, the body is read from stdin." >&2
  exit 1
}

if [ "$#" -lt 2 ]; then
  usage
fi

FROM="$1"
TO="$2"
shift 2

if [ "$#" -gt 0 ]; then
  BODY="$*"
elif [ ! -t 0 ]; then
  BODY="$(cat)"
else
  usage
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMM_DIR="${ROOT}/.codex/comm"
INBOX_DIR="${COMM_DIR}/inbox/${TO}"
TMP_DIR="${COMM_DIR}/tmp"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
EPOCH="$(date +%s)"
PID="$$"
ID="${STAMP}-${FROM}-to-${TO}-${EPOCH}-${PID}"
TMP_FILE="${TMP_DIR}/${ID}.tmp"
MSG_FILE="${INBOX_DIR}/${ID}.md"

mkdir -p "${INBOX_DIR}" "${TMP_DIR}" "${COMM_DIR}/archive/${TO}" "${COMM_DIR}/logs"

{
  echo "from: ${FROM}"
  echo "to: ${TO}"
  echo "ts: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "id: ${ID}"
  echo
  printf '%s\n' "${BODY}"
} > "${TMP_FILE}"

mv "${TMP_FILE}" "${MSG_FILE}"
echo "sent id=${ID} to=${TO} path=${MSG_FILE}"
