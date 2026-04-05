#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$AGENT_DIR/.." && pwd)"
CONFIG_FILE="$AGENT_DIR/.env"

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

PROJECT_NAME_RAW="${AGENT_PROJECT_NAME:-$(basename "$REPO_ROOT")}"
PROJECT_SLUG="$(printf '%s' "$PROJECT_NAME_RAW" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//; s/-$//')"
DIND_NAME="agent-${PROJECT_SLUG}-dind"

URL="${AGENT_BROWSER_TEST_URL:-}"
if [[ -z "$URL" ]]; then
  FIRST_PORT="$(printf '%s' "${AGENT_PROJECT_PORTS:-}" | cut -d',' -f1 | cut -d':' -f1)"
  [[ -n "$FIRST_PORT" ]] || { echo "Set AGENT_BROWSER_TEST_URL or AGENT_PROJECT_PORTS in .agent/.env" >&2; exit 1; }
  URL="http://${DIND_NAME}:${FIRST_PORT}"
fi

bash "$AGENT_DIR/scripts/app-up.sh" >/dev/null
bash "$AGENT_DIR/launch.sh" exec "agent-browser close >/dev/null 2>&1 || true; agent-browser open '$URL' >/dev/null && agent-browser snapshot --json"
