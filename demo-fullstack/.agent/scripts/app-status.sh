#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$AGENT_DIR/.env"
[[ -f "$CONFIG_FILE" ]] && source "$CONFIG_FILE"
bash "$AGENT_DIR/launch.sh" exec "${AGENT_APP_STATUS_CMD:-docker compose ps}"
