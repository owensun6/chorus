#!/usr/bin/env bash
# Sync skill/ source files → packages/chorus-skill/templates/
# Run after editing any file in skill/ to prevent documentation drift.
#
# Usage:
#   bash scripts/sync-skill-templates.sh          # sync (copy source → templates)
#   bash scripts/sync-skill-templates.sh --check   # verify only (CI mode, exit 1 on drift)

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

SRC="$ROOT/skill"
TPL="$ROOT/packages/chorus-skill/templates"
PKG="$ROOT/packages/chorus-skill"

# File mapping: "source|dest_relative_to_templates"
TEMPLATE_PAIRS=(
  "SKILL.md|en/SKILL.md"
  "SKILL.zh-CN.md|zh-CN/SKILL.zh-CN.md"
  "PROTOCOL.md|en/PROTOCOL.md"
  "PROTOCOL.zh-CN.md|zh-CN/PROTOCOL.zh-CN.md"
  "TRANSPORT.md|shared/TRANSPORT.md"
)

# Files synced to package root
PACKAGE_FILES=("endpoints.json" "envelope.schema.json")

MODE="${1:-sync}"
DRIFT=0

for pair in "${TEMPLATE_PAIRS[@]}"; do
  src_file="${pair%%|*}"
  dest_rel="${pair##*|}"
  dest="$TPL/$dest_rel"

  if [ "$MODE" = "--check" ]; then
    if ! diff -q "$SRC/$src_file" "$dest" > /dev/null 2>&1; then
      echo "DRIFT: skill/$src_file ≠ templates/$dest_rel"
      DRIFT=1
    fi
  else
    cp "$SRC/$src_file" "$dest"
    echo "  $src_file → templates/$dest_rel"
  fi
done

for pkg_file in "${PACKAGE_FILES[@]}"; do
  if [ "$MODE" = "--check" ]; then
    if ! diff -q "$SRC/$pkg_file" "$PKG/$pkg_file" > /dev/null 2>&1; then
      echo "DRIFT: skill/$pkg_file ≠ packages/chorus-skill/$pkg_file"
      DRIFT=1
    fi
  else
    cp "$SRC/$pkg_file" "$PKG/$pkg_file"
    echo "  $pkg_file → packages/chorus-skill/$pkg_file"
  fi
done

if [ "$MODE" = "--check" ]; then
  if [ "$DRIFT" -eq 1 ]; then
    echo ""
    echo "Fix: bash scripts/sync-skill-templates.sh"
    exit 1
  else
    echo "All templates in sync."
  fi
else
  echo "Done. All templates synced from skill/."
fi
