#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Read version from plugin.json
VERSION=$(grep '"version"' "${PLUGIN_ROOT}/.claude-plugin/plugin.json" 2>/dev/null | sed 's/.*: *"\([^"]*\)".*/\1/' || echo "1.0.0")

# Visible feedback to terminal (stderr so user sees it)
echo -e "\033[1;36m🚀 ShipIt v${VERSION}\033[0m \033[2m— One command to ship features. Try /shipit:go\033[0m" >&2

# Read core skill content
core_content=$(cat "${PLUGIN_ROOT}/skills/shipit-core/SKILL.md" 2>&1 || echo "Error reading shipit-core skill")

# Escape string for JSON embedding
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
