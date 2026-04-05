#!/usr/bin/env bash
# Printed at workspace shell startup (interactive sessions only).
CONFIG="/workspace/.agent/.env"

[[ -f "$CONFIG" ]] && source "$CONFIG" 2>/dev/null || true

PROJECT="${AGENT_PROJECT_NAME:-$(basename /workspace)}"
SLUG="$(printf '%s' "$PROJECT" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//')"

B="\033[1m"; C="\033[36m"; G="\033[32m"; R="\033[0m"

printf "\n${B}${C}  agent workspace${R}\n"
printf "  ${B}project${R}  %s\n" "$PROJECT"
printf "  ${B}repo${R}     /workspace\n"
printf "  ${B}docker${R}   %s\n" "${DOCKER_HOST:-<not set>}"

if [[ -n "${AGENT_PROJECT_PORTS:-}" ]]; then
  FIRST_HOST="$(printf '%s' "$AGENT_PROJECT_PORTS" | cut -d',' -f1 | cut -d':' -f1)"
  [[ -n "$FIRST_HOST" ]] && printf "  ${B}app${R}      ${G}http://127.0.0.1:%s${R}\n" "$FIRST_HOST"
fi

if [[ -n "${AGENT_BROWSER_TEST_URL:-}" ]]; then
  printf "  ${B}browser${R}  ${G}%s${R}\n" "$AGENT_BROWSER_TEST_URL"
fi

printf "\n"
printf "  ${C}cld${R}  Claude with context   ${C}p${R}  Pi with context   ${C}c${R}  Codex\n"
printf "  ${C}agent_context${R} to print /workspace/.agent/CONTEXT.md\n"
printf "\n"
