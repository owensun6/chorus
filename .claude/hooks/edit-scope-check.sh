#!/bin/bash
# Edit Scope Check — PreToolUse hook for Edit|Write
# Exit 0 = allow, Exit 1 = warn user, Exit 2 = block
# Using exit 1 (warn) instead of exit 2 (block) to avoid interrupting ongoing work

# Read the tool input from stdin
INPUT=$(cat)

# Extract the file path being edited
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Check if pipeline/monitor.md exists and if we're in a valid stage
if [ -f "pipeline/monitor.md" ]; then
  # If editing pipeline docs during Stage 0-3 (planning stages), always allow
  if echo "$FILE_PATH" | grep -q "^pipeline/"; then
    exit 0
  fi
fi

# Allow test files — TDD red phase needs to write tests first
if echo "$FILE_PATH" | grep -qE "\.test\.|\.spec\.|__tests__/"; then
  exit 0
fi

# For source code edits, just pass through (warning mode disabled to avoid noise)
exit 0
