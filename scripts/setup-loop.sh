#!/usr/bin/env bash
set -euo pipefail

# ShipIt Loop Setup Script
# Creates .shipit/loop.md state file for the auto-loop mechanism

SHIPIT_DIR=".shipit"

# Parse arguments
TASK_PARTS=()
MAX_ITERATIONS=50

while [[ $# -gt 0 ]]; do
  case $1 in
    --max-iterations)
      if [[ -z "${2:-}" ]] || [[ ! "$2" =~ ^[0-9]+$ ]]; then
        echo "Error: --max-iterations requires a positive integer" >&2
        exit 1
      fi
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    *)
      TASK_PARTS+=("$1")
      shift
      ;;
  esac
done

TASK="${TASK_PARTS[*]}"

if [[ -z "$TASK" ]]; then
  echo "Error: No task description provided" >&2
  echo "Usage: /shipit:go <task description> [--max-iterations N]" >&2
  exit 1
fi

# Create .shipit directory if needed
mkdir -p "$SHIPIT_DIR"

# Create loop state file
cat > "${SHIPIT_DIR}/loop.md" <<EOF
---
active: true
iteration: 1
max_iterations: ${MAX_ITERATIONS}
started_at: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
tasks_total: 0
tasks_completed: 0
---

${TASK}
EOF

cat <<EOF
ShipIt loop activated!

Task: ${TASK}
Max iterations: ${MAX_ITERATIONS}
State: ${SHIPIT_DIR}/loop.md

The auto-loop is now active. Claude will keep working until:
- All tasks are complete (<shipit-done/>)
- A blocker is hit (<shipit-blocked>...</shipit-blocked>)
- Max iterations reached (${MAX_ITERATIONS})
EOF
