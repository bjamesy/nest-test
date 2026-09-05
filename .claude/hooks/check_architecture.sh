#!/usr/bin/env bash
# Stop hook — fires once when Claude Code is about to end its turn.
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
DIRTY_FLAG="$PROJECT_DIR/.claude/.architecture_dirty"

[ -f "$DIRTY_FLAG" ] || exit 0
[ -s "$DIRTY_FLAG" ] || exit 0

CHANGED_FILES="$(sort -u "$DIRTY_FLAG" | tr '\n' ',' | sed 's/,$//')"

# Clear the flag now — if the reconcile pass itself edits more files,
# those will set it again for next turn.
: > "$DIRTY_FLAG"

# Exit code 2 + stderr = "blocking" stop hook output for Claude Code:
# it tells Claude to keep going and do this before actually stopping.
cat >&2 <<EOF
Architecture-relevant files changed this turn: $CHANGED_FILES

Per the architecture-diagram skill, reconcile docs/modules.mmd against
these changes before finishing (new/removed controllers, modules, services,
or gateways; changed dependency-injection wiring). Only touch
docs/architecture.mmd (the system topology) if a new app/service was
actually scaffolded (e.g. apps/worker, Redis, R2) — not for routine
controller/service changes within apps/api.
EOF
exit 2
