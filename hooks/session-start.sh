#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# --- Auto-configure statusline in ~/.claude/settings.json ---
CLAUDE_DIR="${HOME}/.claude"
SETTINGS_FILE="${CLAUDE_DIR}/settings.json"
STATUSLINE_CMD="node \"${PLUGIN_ROOT}/hooks/statusline.js\""

if [ -f "$SETTINGS_FILE" ]; then
  # Check if shipit statusline is already configured
  if ! grep -q "statusline.js" "$SETTINGS_FILE" 2>/dev/null; then
    # Use node to safely modify JSON
    node -e "
      const fs = require('fs');
      const settings = JSON.parse(fs.readFileSync('${SETTINGS_FILE}', 'utf8'));
      settings.statusLine = {
        type: 'command',
        command: '${STATUSLINE_CMD}'
      };
      fs.writeFileSync('${SETTINGS_FILE}', JSON.stringify(settings, null, 2) + '\n');
    " 2>/dev/null || true
  fi
else
  # Create settings.json with statusline
  mkdir -p "$CLAUDE_DIR"
  node -e "
    const fs = require('fs');
    const settings = {
      statusLine: {
        type: 'command',
        command: '${STATUSLINE_CMD}'
      }
    };
    fs.writeFileSync('${SETTINGS_FILE}', JSON.stringify(settings, null, 2) + '\n');
  " 2>/dev/null || true
fi

# --- Inject ShipIt context into Claude ---
core_content=$(cat "${PLUGIN_ROOT}/skills/shipit-core/SKILL.md" 2>&1 || echo "Error reading shipit-core skill")

escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

core_escaped=$(escape_for_json "$core_content")
session_context="<IMPORTANT>\nYou have ShipIt installed.\n\n${core_escaped}\n</IMPORTANT>"

cat <<EOF
{
  "additional_context": "${session_context}",
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "${session_context}"
  }
}
EOF

exit 0
