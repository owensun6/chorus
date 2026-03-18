#!/usr/bin/env bash
# Author: Lead
# Fusion-Core lint script — Stage 5 GREEN→REFACTOR 间强制运行
# Usage: bash bin/fusion-lint.sh src/

set -euo pipefail

TARGET="${1:-.}"

echo "=== Fusion Lint: $TARGET ==="

# L1: 密钥泄露扫描 (CRITICAL)
echo "[L1] Secret scan..."
SECRETS=$(grep -rn 'API_KEY\|SECRET\|PASSWORD\|TOKEN' "$TARGET" --include="*.ts" --include="*.js" \
  | grep -v 'process\.env' \
  | grep -v '\.test\.' \
  | grep -v 'node_modules' \
  | grep -v '// Author:' \
  || true)
if [ -n "$SECRETS" ]; then
  echo "CRITICAL: Possible hardcoded secrets found:"
  echo "$SECRETS"
  exit 1
fi
echo "  OK"

# L2: Author 签名存在性 (ERROR)
echo "[L2] Author stamp check..."
MISSING_AUTHOR=0
for f in $(find "$TARGET" -name "*.ts" -not -path "*/node_modules/*" -not -name "*.test.*" -not -name "*.spec.*"); do
  if ! head -1 "$f" | grep -q "Author:"; then
    echo "  MISSING: $f"
    MISSING_AUTHOR=1
  fi
done
if [ "$MISSING_AUTHOR" -eq 1 ]; then
  echo "ERROR: Some files missing Author stamp"
fi
echo "  Done"

# L3: 调试残留 (WARNING)
echo "[L3] Debug artifact scan..."
DEBRIS=$(grep -rn 'console\.log\|console\.debug\|debugger' "$TARGET" --include="*.ts" --include="*.js" \
  | grep -v 'node_modules' \
  | grep -v '\.test\.' \
  || true)
if [ -n "$DEBRIS" ]; then
  echo "WARNING: Debug artifacts found:"
  echo "$DEBRIS"
fi
echo "  Done"

# L4: 文件行数检查 (WARNING, max 300)
echo "[L4] File size check..."
for f in $(find "$TARGET" -name "*.ts" -not -path "*/node_modules/*" -not -name "*.test.*"); do
  LINES=$(wc -l < "$f")
  if [ "$LINES" -gt 300 ]; then
    echo "  WARNING: $f has $LINES lines (max 300)"
  fi
done
echo "  Done"

echo "=== Fusion Lint Complete ==="
