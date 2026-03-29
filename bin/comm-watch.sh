#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: ./bin/comm-watch.sh <agent> [--once]" >&2
  exit 1
}

if [ "$#" -lt 1 ]; then
  usage
fi

AGENT="$1"
shift
ONCE="false"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --once)
      ONCE="true"
      ;;
    *)
      usage
      ;;
  esac
  shift
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMM_DIR="${ROOT}/.codex/comm"
INBOX_DIR="${COMM_DIR}/inbox/${AGENT}"
ARCHIVE_DIR="${COMM_DIR}/archive/${AGENT}"
LOG_DIR="${COMM_DIR}/logs"

mkdir -p "${INBOX_DIR}" "${ARCHIVE_DIR}" "${LOG_DIR}"

drain_once() {
  local found="false"
  local path=""
  while IFS= read -r path; do
    [ -n "${path}" ] || continue
    found="true"
    local base
    base="$(basename "${path}")"
    echo "----- ${base} -----"
    cat "${path}"
    echo
    mv "${path}" "${ARCHIVE_DIR}/${base}"
  done < <(find "${INBOX_DIR}" -maxdepth 1 -type f -name '*.md' | sort)

  if [ "${found}" = "false" ] && [ "${ONCE}" = "true" ]; then
    echo "no messages for ${AGENT}"
  fi
}

if [ "${ONCE}" = "true" ]; then
  drain_once
  exit 0
fi

echo "watching inbox=${INBOX_DIR}"
while true; do
  drain_once
  sleep 2
done
