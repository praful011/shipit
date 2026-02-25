#!/usr/bin/env bash
set -euo pipefail

# Read hook input from stdin
HOOK_INPUT=$(cat)

# Check if shipit loop is active
LOOP_STATE_FILE=".shipit/loop.md"

if [[ ! -f "$LOOP_STATE_FILE" ]]; then
  exit 0
fi

# Parse YAML frontmatter
FRONTMATTER=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$LOOP_STATE_FILE")
ACTIVE=$(echo "$FRONTMATTER" | grep '^active:' | sed 's/active: *//')
ITERATION=$(echo "$FRONTMATTER" | grep '^iteration:' | sed 's/iteration: *//')
MAX_ITERATIONS=$(echo "$FRONTMATTER" | grep '^max_iterations:' | sed 's/max_iterations: *//')
TASKS_TOTAL=$(echo "$FRONTMATTER" | grep '^tasks_total:' | sed 's/tasks_total: *//')
TASKS_COMPLETED=$(echo "$FRONTMATTER" | grep '^tasks_completed:' | sed 's/tasks_completed: *//')

# If not active, allow exit
if [[ "$ACTIVE" != "true" ]]; then
  exit 0
fi

# Validate numeric fields
for field_name in ITERATION MAX_ITERATIONS; do
  field_val="${!field_name}"
  if [[ ! "$field_val" =~ ^[0-9]+$ ]]; then
    echo "Warning: ShipIt loop state corrupted ($field_name='$field_val'). Stopping loop." >&2
    rm "$LOOP_STATE_FILE"
    exit 0
  fi
done

# Check max iterations
if [[ $MAX_ITERATIONS -gt 0 ]] && [[ $ITERATION -ge $MAX_ITERATIONS ]]; then
  echo "ShipIt: Max iterations ($MAX_ITERATIONS) reached. Tasks completed: ${TASKS_COMPLETED:-0}/${TASKS_TOTAL:-?}"
  rm "$LOOP_STATE_FILE"
  exit 0
fi

# Check if all tasks complete by reading STATE.md
STATE_FILE=".shipit/STATE.md"
if [[ -f "$STATE_FILE" ]]; then
  if grep -q '^status: complete' "$STATE_FILE" 2>/dev/null; then
    echo "ShipIt: All tasks complete!"
    rm "$LOOP_STATE_FILE"
    exit 0
  fi
fi

# Get transcript path and check for blocker signals
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path' 2>/dev/null || echo "")

if [[ -n "$TRANSCRIPT_PATH" ]] && [[ -f "$TRANSCRIPT_PATH" ]]; then
  LAST_LINE=$(grep '"role":"assistant"' "$TRANSCRIPT_PATH" | tail -1 || true)
  if [[ -n "$LAST_LINE" ]]; then
    LAST_OUTPUT=$(echo "$LAST_LINE" | jq -r '
      .message.content |
      map(select(.type == "text")) |
      map(.text) |
      join("\n")
    ' 2>/dev/null || echo "")

    # Check for explicit stop signal
    if echo "$LAST_OUTPUT" | grep -q '<shipit-done/>' 2>/dev/null; then
      rm "$LOOP_STATE_FILE"
      exit 0
    fi

    # Check for blocker signal
    if echo "$LAST_OUTPUT" | grep -q '<shipit-blocked>' 2>/dev/null; then
      rm "$LOOP_STATE_FILE"
      exit 0
    fi
  fi
fi

# Continue loop — increment iteration
NEXT_ITERATION=$((ITERATION + 1))

# Update iteration in state file atomically
TEMP_FILE="${LOOP_STATE_FILE}.tmp.$$"
sed "s/^iteration: .*/iteration: $NEXT_ITERATION/" "$LOOP_STATE_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$LOOP_STATE_FILE"

# Extract the task description from after the frontmatter
TASK_TEXT=$(awk '/^---$/{i++; next} i>=2' "$LOOP_STATE_FILE")

# Build continuation prompt
CONTINUE_PROMPT="Continue working. Read .shipit/STATE.md for current position, .shipit/PLAN.md for the plan, and .shipit/HANDOFF.md for context from previous tasks. Use TDD for implementation tasks. After completing each task, append a summary to HANDOFF.md and update STATE.md. When all tasks are done, output <shipit-done/> to exit the loop. If you hit a blocker that needs user input, output <shipit-blocked>description</shipit-blocked>."

SYSTEM_MSG="ShipIt iteration $NEXT_ITERATION | Tasks: ${TASKS_COMPLETED:-0}/${TASKS_TOTAL:-?} | To finish: <shipit-done/>"

jq -n \
  --arg prompt "$CONTINUE_PROMPT" \
  --arg msg "$SYSTEM_MSG" \
  '{
    "decision": "block",
    "reason": $prompt,
    "systemMessage": $msg
  }'

exit 0
