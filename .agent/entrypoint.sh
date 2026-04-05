#!/usr/bin/env bash
set -euo pipefail

HOME_DIR="${HOME:-/home/agent}"
SECRETS_ROOT="/run/host-secrets"
SYNC_MODE="${AGENT_SYNC_SECRETS_MODE:-overwrite}"
BASHRC_APPEND_SOURCE='[ -f /opt/agent/bashrc.append ] && . /opt/agent/bashrc.append'
BANNER_SOURCE='[[ $- == *i* ]] && bash /opt/agent/banner.sh 2>/dev/null || true'
BASH_ENV_FILE="$HOME_DIR/.bash_env"
PI_PROMPT_DIR="$HOME_DIR/.pi/agent/prompts"

copy_secret_dir() {
  local src="$1"
  local dest="$2"

  [[ -d "$src" ]] || return 0
  mkdir -p "$dest"

  if [[ "$SYNC_MODE" == "merge" ]]; then
    rsync -a "$src/" "$dest/"
  else
    rm -rf "$dest"
    mkdir -p "$dest"
    rsync -a "$src/" "$dest/"
  fi

  chmod -R u+rwX,go-rwx "$dest" || true
}

ensure_bashrc() {
  local bashrc="$HOME_DIR/.bashrc"
  touch "$bashrc"
  grep -Fqx "$BASHRC_APPEND_SOURCE" "$bashrc" || printf '\n%s\n' "$BASHRC_APPEND_SOURCE" >> "$bashrc"
  grep -Fqx "$BANNER_SOURCE" "$bashrc" || printf '%s\n' "$BANNER_SOURCE" >> "$bashrc"
}

ensure_bash_env() {
  touch "$BASH_ENV_FILE"
  grep -Fqx "$BASHRC_APPEND_SOURCE" "$BASH_ENV_FILE" || printf '%s\n' "$BASHRC_APPEND_SOURCE" >> "$BASH_ENV_FILE"
}

copy_secret_dir "$SECRETS_ROOT/claude" "$HOME_DIR/.claude"
copy_secret_dir "$SECRETS_ROOT/pi" "$HOME_DIR/.pi"
copy_secret_dir "$SECRETS_ROOT/codex" "$HOME_DIR/.codex"

mkdir -p "$HOME_DIR/.config" "$HOME_DIR/.cache" "$HOME_DIR/.local/share" "$PI_PROMPT_DIR"
if [[ -f /opt/agent/prompts/pi-agent-context.md ]]; then
  cp /opt/agent/prompts/pi-agent-context.md "$PI_PROMPT_DIR/agent-context.md"
  chmod 0644 "$PI_PROMPT_DIR/agent-context.md" || true
fi
ensure_bashrc
ensure_bash_env

exec "$@"
