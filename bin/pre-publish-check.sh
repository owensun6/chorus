#!/usr/bin/env bash
# Pre-publish validation: ensures git tag, tarball content, and registry state are aligned.
# Sequence: commit → tag → this script → npm publish → push
# Usage: ./bin/pre-publish-check.sh
set -euo pipefail

PKG_DIR="packages/chorus-skill"
PKG_JSON="${PKG_DIR}/package.json"

if [ ! -f "${PKG_JSON}" ]; then
  echo "FAIL: ${PKG_JSON} not found. Run from repo root."
  exit 1
fi

LOCAL_VERSION="$(node -e "process.stdout.write(require('./${PKG_JSON}').version)")"
LOCAL_NAME="$(node -e "process.stdout.write(require('./${PKG_JSON}').name)")"
TAG_NAME="v${LOCAL_VERSION}"
HEAD_COMMIT="$(git rev-parse HEAD)"
SHORT_HEAD="$(git rev-parse --short HEAD)"

echo "== Pre-publish check for ${LOCAL_NAME}@${LOCAL_VERSION} =="
echo "  local HEAD: ${HEAD_COMMIT}"
echo "  expected tag: ${TAG_NAME}"

FAIL_COUNT=0
fail() { echo "FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

# 1. Working tree must be clean
echo ""
echo "== 1. Clean working tree =="
if [ -n "$(git status --porcelain)" ]; then
  fail "working tree is dirty. Commit or stash before publishing."
  git status --short
fi

# 2. All tests must pass
echo ""
echo "== 2. Tests =="
if ! npx jest --silent 2>&1 | tail -3; then
  fail "tests did not pass."
fi

# 3. Git tag must exist and point to HEAD
echo ""
echo "== 3. Git tag ${TAG_NAME} =="
if ! git rev-parse "${TAG_NAME}" >/dev/null 2>&1; then
  fail "git tag ${TAG_NAME} does not exist. Create it: git tag ${TAG_NAME} ${SHORT_HEAD} -m '${LOCAL_NAME}@${LOCAL_VERSION}'"
else
  TAG_COMMIT="$(git rev-parse "${TAG_NAME}^{commit}" 2>/dev/null)"
  if [ "${TAG_COMMIT}" != "${HEAD_COMMIT}" ]; then
    fail "tag ${TAG_NAME} points to $(git rev-parse --short "${TAG_COMMIT}") but HEAD is ${SHORT_HEAD}"
  else
    echo "  tag ${TAG_NAME} -> ${SHORT_HEAD} (matches HEAD)"
  fi
fi

# 4. npm pack dry-run: verify tarball contains all required files
echo ""
echo "== 4. Tarball content (npm pack --dry-run) =="
PACK_OUTPUT="$(cd "${PKG_DIR}" && npm pack --dry-run 2>&1)"

# 4a. Top-level package files
TOP_LEVEL_REQUIRED=(
  "cli.mjs"
  "endpoints.json"
  "envelope.schema.json"
  "README.md"
  "LICENSE"
  "package.json"
)

for F in "${TOP_LEVEL_REQUIRED[@]}"; do
  if echo "${PACK_OUTPUT}" | grep -q "${F}"; then
    echo "  [ok] ${F}"
  else
    fail "missing in tarball: ${F}"
  fi
done

# 4b. Bridge required files — must match BRIDGE_REQUIRED_FILES in cli.mjs:113
BRIDGE_REQUIRED_FILES=(
  "templates/bridge/index.ts"
  "templates/bridge/runtime-v2.ts"
  "templates/bridge/guard.ts"
  "templates/bridge/resolve.ts"
  "templates/bridge/relay.ts"
  "templates/bridge/router-hook.ts"
  "templates/bridge/openclaw.plugin.json"
  "templates/bridge/package.json"
  "templates/bridge/runtime/types.ts"
  "templates/bridge/runtime/route-key.ts"
  "templates/bridge/runtime/shared-types.ts"
  "templates/bridge/runtime/shared-log.ts"
  "templates/bridge/runtime/state.ts"
  "templates/bridge/runtime/hub-client.ts"
  "templates/bridge/runtime/inbound.ts"
  "templates/bridge/runtime/outbound.ts"
  "templates/bridge/runtime/recovery.ts"
)

echo ""
echo "  Bridge files (cli.mjs BRIDGE_REQUIRED_FILES):"
for F in "${BRIDGE_REQUIRED_FILES[@]}"; do
  if echo "${PACK_OUTPUT}" | grep -q "${F}"; then
    echo "  [ok] ${F}"
  else
    fail "missing bridge file in tarball: ${F}"
  fi
done

# 4c. Skill template files
SKILL_REQUIRED_FILES=(
  "templates/en/SKILL.md"
  "templates/en/PROTOCOL.md"
  "templates/zh-CN/SKILL.zh-CN.md"
  "templates/zh-CN/PROTOCOL.zh-CN.md"
)

echo ""
echo "  Skill template files:"
for F in "${SKILL_REQUIRED_FILES[@]}"; do
  if echo "${PACK_OUTPUT}" | grep -q "${F}"; then
    echo "  [ok] ${F}"
  else
    fail "missing skill template in tarball: ${F}"
  fi
done

# 5. Registry collision check
echo ""
echo "== 5. npm registry =="
REGISTRY_INFO="$(npm view "${LOCAL_NAME}@${LOCAL_VERSION}" gitHead 2>/dev/null || echo "NOT_PUBLISHED")"

if [ "${REGISTRY_INFO}" = "NOT_PUBLISHED" ]; then
  echo "  ${LOCAL_NAME}@${LOCAL_VERSION} not yet on registry — ready to publish"
else
  echo "  WARNING: ${LOCAL_NAME}@${LOCAL_VERSION} already published"
  echo "  registry gitHead: ${REGISTRY_INFO}"
  echo "  local HEAD:       ${HEAD_COMMIT}"
  if [ "${REGISTRY_INFO}" != "${HEAD_COMMIT}" ]; then
    fail "registry gitHead mismatch. Bump version before re-publishing."
  fi
fi

# Summary
echo ""
if [ "${FAIL_COUNT}" -gt 0 ]; then
  echo "BLOCKED: ${FAIL_COUNT} check(s) failed. Fix before publishing."
  exit 1
fi

echo "PASS: all pre-publish checks green. Safe to run:"
echo "  cd ${PKG_DIR} && npm publish"
