#!/usr/bin/env bash
set -euo pipefail

COMMAND="${1:-up}"
shift || true
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$SCRIPT_DIR/.env"

load_config() {
  if [[ -f "$CONFIG_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"
  fi

  IMAGE_NAME="${AGENT_IMAGE_NAME:-agent-workspace:latest}"
  DIND_IMAGE_NAME="${AGENT_DIND_IMAGE_NAME:-agent-dind:latest}"
  SECRETS_MODE="${AGENT_SYNC_SECRETS_MODE:-overwrite}"
  APP_UP_CMD="${AGENT_APP_UP_CMD:-docker compose up --build -d}"
  APP_DOWN_CMD="${AGENT_APP_DOWN_CMD:-docker compose down}"
  APP_LOGS_CMD="${AGENT_APP_LOGS_CMD:-docker compose logs -f}"
  APP_STATUS_CMD="${AGENT_APP_STATUS_CMD:-docker compose ps}"
  BROWSER_TEST_URL="${AGENT_BROWSER_TEST_URL:-}"
}

load_config

PROJECT_NAME_RAW="${AGENT_PROJECT_NAME:-$(basename "$REPO_ROOT")}"
PROJECT_SLUG="$(printf '%s' "$PROJECT_NAME_RAW" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//; s/-$//')"
NETWORK_NAME="agent-${PROJECT_SLUG}-net"
WORKSPACE_NAME="agent-${PROJECT_SLUG}"
DIND_NAME="agent-${PROJECT_SLUG}-dind"
HOME_VOLUME="agent-${PROJECT_SLUG}-home"
DOCKER_VOLUME="agent-${PROJECT_SLUG}-docker"

workspace_exists() { docker ps -a --format '{{.Names}}' | grep -Fxq "$WORKSPACE_NAME"; }
workspace_running() { docker ps --format '{{.Names}}' | grep -Fxq "$WORKSPACE_NAME"; }
dind_exists() { docker ps -a --format '{{.Names}}' | grep -Fxq "$DIND_NAME"; }
dind_running() { docker ps --format '{{.Names}}' | grep -Fxq "$DIND_NAME"; }

docker_exec_args() {
  if [[ -t 0 && -t 1 ]]; then
    printf '%s\n' -it
  else
    printf '%s\n' -i
  fi
}

ensure_network() {
  docker network inspect "$NETWORK_NAME" >/dev/null 2>&1 || docker network create "$NETWORK_NAME" >/dev/null
}

ensure_volumes() {
  docker volume inspect "$HOME_VOLUME" >/dev/null 2>&1 || docker volume create "$HOME_VOLUME" >/dev/null
  docker volume inspect "$DOCKER_VOLUME" >/dev/null 2>&1 || docker volume create "$DOCKER_VOLUME" >/dev/null
}

build_images() {
  docker build -t "$IMAGE_NAME" -f "$SCRIPT_DIR/Dockerfile" "$SCRIPT_DIR"
  docker build -t "$DIND_IMAGE_NAME" -f "$SCRIPT_DIR/Dockerfile.dind" "$SCRIPT_DIR"
}

build_if_missing() {
  docker image inspect "$IMAGE_NAME" >/dev/null 2>&1 || docker build -t "$IMAGE_NAME" -f "$SCRIPT_DIR/Dockerfile" "$SCRIPT_DIR"
  docker image inspect "$DIND_IMAGE_NAME" >/dev/null 2>&1 || docker build -t "$DIND_IMAGE_NAME" -f "$SCRIPT_DIR/Dockerfile.dind" "$SCRIPT_DIR"
}

port_args_from_raw() {
  local raw="$1"
  local -a args=()
  local item
  IFS=',' read -r -a items <<< "$raw"
  for item in "${items[@]:-}"; do
    [[ -n "$item" ]] || continue
    args+=( -p "$item" )
  done
  printf '%s\n' "${args[@]}"
}

start_dind() {
  local ports_raw="${1:-${AGENT_PROJECT_PORTS:-}}"
  local -a port_args=()
  mapfile -t port_args < <(port_args_from_raw "$ports_raw")

  ensure_network
  ensure_volumes
  build_if_missing

  if dind_running; then
    return 0
  fi

  if dind_exists; then
    docker start "$DIND_NAME" >/dev/null
  else
    local -a dind_extra=()
    [[ -n "${AGENT_DIND_RUN_ARGS:-}" ]] && read -ra dind_extra <<< "${AGENT_DIND_RUN_ARGS}"
    docker run -d \
      --name "$DIND_NAME" \
      --privileged \
      --network "$NETWORK_NAME" \
      -e DOCKER_TLS_CERTDIR= \
      ${port_args:+"${port_args[@]}"} \
      ${dind_extra:+"${dind_extra[@]}"} \
      -v "$REPO_ROOT:/workspace" \
      -v "$DOCKER_VOLUME:/var/lib/docker" \
      -w /workspace \
      "$DIND_IMAGE_NAME" >/dev/null
  fi

  until docker exec "$DIND_NAME" docker info >/dev/null 2>&1; do
    sleep 1
  done
}

start_workspace() {
  build_if_missing

  if workspace_running; then
    return 0
  fi

  if workspace_exists; then
    docker start "$WORKSPACE_NAME" >/dev/null
  else
    docker run -d \
      --name "$WORKSPACE_NAME" \
      --network "$NETWORK_NAME" \
      --security-opt no-new-privileges:true \
      --shm-size=2g \
      -e DOCKER_HOST="tcp://${DIND_NAME}:2375" \
      -e AGENT_SYNC_SECRETS_MODE="$SECRETS_MODE" \
      -v "$REPO_ROOT:/workspace" \
      -v "$HOME_VOLUME:/home/agent" \
      -v "$HOME/.claude:/run/host-secrets/claude:ro" \
      -v "$HOME/.pi:/run/host-secrets/pi:ro" \
      -v "$HOME/.codex:/run/host-secrets/codex:ro" \
      -v "$HOME/.local/share/opencode:/run/host-secrets/opencode:ro" \
      -w /workspace \
      "$IMAGE_NAME" \
      tail -f /dev/null >/dev/null
  fi
}

cmd_build() {
  build_images
}

cmd_start() {
  local ports_raw="${1:-${AGENT_PROJECT_PORTS:-}}"
  start_dind "$ports_raw"
  start_workspace
}

cmd_up() {
  local -a exec_args=()
  mapfile -t exec_args < <(docker_exec_args)
  cmd_start "${1:-${AGENT_PROJECT_PORTS:-}}"
  docker exec "${exec_args[@]}" "$WORKSPACE_NAME" bash
}

cmd_shell() {
  local cmd_string="${1:-}"
  local -a exec_args=()
  mapfile -t exec_args < <(docker_exec_args)
  workspace_running || cmd_start

  if [[ -z "$cmd_string" || "$cmd_string" == "bash" ]]; then
    docker exec "${exec_args[@]}" "$WORKSPACE_NAME" bash
  else
    docker exec "${exec_args[@]}" -w /workspace "$WORKSPACE_NAME" bash -lc "$cmd_string"
  fi
}

cmd_exec() {
  local cmd_string="${1:-}"
  local -a exec_args=()
  mapfile -t exec_args < <(docker_exec_args)
  [[ -n "$cmd_string" ]] || { echo "Missing command" >&2; exit 1; }
  cmd_start
  docker exec "${exec_args[@]}" -w /workspace "$WORKSPACE_NAME" bash -lc "$cmd_string"
}

cmd_stop() {
  workspace_running && docker stop "$WORKSPACE_NAME" >/dev/null || true
}

cmd_down() {
  workspace_exists && docker rm -f "$WORKSPACE_NAME" >/dev/null || true
  dind_exists && docker rm -f "$DIND_NAME" >/dev/null || true
}

cmd_reset() {
  cmd_down
  docker volume rm "$HOME_VOLUME" "$DOCKER_VOLUME" >/dev/null 2>&1 || true
  docker network rm "$NETWORK_NAME" >/dev/null 2>&1 || true
}

cmd_status() {
  echo "project_name=$PROJECT_NAME_RAW"
  echo "project=$PROJECT_SLUG"
  echo "repo=$REPO_ROOT"
  echo "workspace=$WORKSPACE_NAME"
  echo "dind=$DIND_NAME"
  echo "ports=${AGENT_PROJECT_PORTS:-<none>}"
  echo "workspace_image=$IMAGE_NAME"
  echo "dind_image=$DIND_IMAGE_NAME"
  docker ps -a --filter "name=^/${WORKSPACE_NAME}$" --filter "name=^/${DIND_NAME}$"
}

cmd_ports() {
  if dind_exists; then
    docker port "$DIND_NAME" || true
  else
    echo "No dind container: $DIND_NAME"
  fi
}

cmd_logs() {
  if dind_exists; then
    echo "== dind =="
    docker logs "$DIND_NAME" | tail -n 200
  fi
  if workspace_exists; then
    echo "== workspace =="
    docker logs "$WORKSPACE_NAME" | tail -n 200
  fi
}

case "$COMMAND" in
  build) cmd_build ;;
  start) cmd_start "${1:-}" ;;
  up) cmd_up "${1:-}" ;;
  shell) cmd_shell "${1:-}" ;;
  exec) cmd_exec "${1:-}" ;;
  stop) cmd_stop ;;
  down) cmd_down ;;
  reset) cmd_reset ;;
  status) cmd_status ;;
  ports) cmd_ports ;;
  logs) cmd_logs ;;
  *) echo "Unknown command: $COMMAND" >&2; exit 1 ;;
esac
