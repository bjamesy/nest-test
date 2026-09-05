#!/usr/bin/env bash
# PostToolUse hook — fires on every Edit/Write/MultiEdit.
# Requires: jq, node
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
INPUT_JSON="$(cat)"

FILE_PATH="$(echo "$INPUT_JSON" | jq -r '.tool_input.file_path // empty')"
[ -z "$FILE_PATH" ] && exit 0

# ---- EDIT THESE FOR YOUR PROJECT LAYOUT --------------------------------
SCHEMA_PATH_PATTERN='\.schema\.ts$'                                  # mongoose schema files
ARCH_PATH_PATTERN='\.(controller|module|service|gateway)\.ts$|main\.ts$'  # architecture-relevant files
# Scans all apps/* (api today; worker/web later) rather than a single app's
# src/, so this doesn't need editing again when a second app grows schemas.
SRC_DIR="$PROJECT_DIR/apps"
SCHEMA_OUT="$PROJECT_DIR/docs/schema.mmd"
DIRTY_FLAG="$PROJECT_DIR/.claude/.architecture_dirty"
# -------------------------------------------------------------------------

if echo "$FILE_PATH" | grep -qE "$SCHEMA_PATH_PATTERN"; then
    if node "$PROJECT_DIR/.claude/hooks/schema_diagram.js" "$SRC_DIR" "$SCHEMA_OUT" 2>/tmp/schema_diagram_err.log; then
        echo "{\"systemMessage\": \"docs/schema.mmd regenerated from $FILE_PATH\"}"
    else
        echo "{\"systemMessage\": \"schema_diagram.js failed on $FILE_PATH — see /tmp/schema_diagram_err.log\"}"
    fi
    exit 0
fi

if echo "$FILE_PATH" | grep -qE "$ARCH_PATH_PATTERN"; then
    # Cheap: just record the path. No LLM call happens here.
    mkdir -p "$(dirname "$DIRTY_FLAG")"
    echo "$FILE_PATH" >> "$DIRTY_FLAG"
    exit 0
fi

exit 0
