#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$SCRIPT_DIR/.env"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi
PROJECT_NAME_RAW="${AGENT_PROJECT_NAME:-$(basename "$REPO_ROOT")}"
PROJECT_SLUG="$(printf '%s' "$PROJECT_NAME_RAW" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//; s/-$//')"
WORKSPACE_NAME="agent-${PROJECT_SLUG}"
DIND_NAME="${WORKSPACE_NAME}-dind"

check_cmd() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    echo "ok   host command: $name"
  else
    echo "fail host command: $name"
    return 1
  fi
}

check_container_cmd() {
  local container="$1"
  local cmd="$2"
  if docker exec "$container" sh -lc "command -v $cmd >/dev/null 2>&1"; then
    echo "ok   $container command: $cmd"
  else
    echo "fail $container command: $cmd"
    return 1
  fi
}

check_host_file() {
  local path="$1"
  if [[ -e "$path" ]]; then
    echo "ok   host path: $path"
  else
    echo "warn host path missing: $path"
  fi
}

status=0

check_cmd docker || status=1
check_host_file "$HOME/.claude"
check_host_file "$HOME/.pi"
check_host_file "$HOME/.codex"
check_host_file "$REPO_ROOT/.agent/Dockerfile"
check_host_file "$REPO_ROOT/.agent/Dockerfile.dind"
check_host_file "$REPO_ROOT/.agent/launch.sh"
check_host_file "$REPO_ROOT/.agent/.env"

if docker ps --format '{{.Names}}' | grep -Fxq "$WORKSPACE_NAME"; then
  echo "ok   workspace running: $WORKSPACE_NAME"
  check_container_cmd "$WORKSPACE_NAME" node || status=1
  check_container_cmd "$WORKSPACE_NAME" bun || status=1
  check_container_cmd "$WORKSPACE_NAME" go || status=1
  check_container_cmd "$WORKSPACE_NAME" docker || status=1
  check_container_cmd "$WORKSPACE_NAME" just || status=1
  check_container_cmd "$WORKSPACE_NAME" lazygit || status=1
  check_container_cmd "$WORKSPACE_NAME" lazydocker || status=1
  check_container_cmd "$WORKSPACE_NAME" claude || status=1
  check_container_cmd "$WORKSPACE_NAME" codex || status=1
  check_container_cmd "$WORKSPACE_NAME" pi || status=1
  check_container_cmd "$WORKSPACE_NAME" agent-browser || status=1
  if docker exec "$WORKSPACE_NAME" sh -lc 'agent-browser --help >/dev/null 2>&1'; then
    echo "ok   workspace agent-browser usable"
  else
    echo "fail workspace agent-browser unusable"
    status=1
  fi
else
  echo "warn workspace not running: $WORKSPACE_NAME"
fi

if docker ps --format '{{.Names}}' | grep -Fxq "$DIND_NAME"; then
  echo "ok   dind running: $DIND_NAME"
  if docker exec "$DIND_NAME" docker info >/dev/null 2>&1; then
    echo "ok   dind docker daemon reachable"
  else
    echo "fail dind docker daemon unreachable"
    status=1
  fi
  check_container_cmd "$DIND_NAME" just || status=1
  check_container_cmd "$DIND_NAME" docker || status=1
else
  echo "warn dind not running: $DIND_NAME"
fi

exit "$status"
