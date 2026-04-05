# Agent Environment Context

You are running inside a repo-scoped agent workspace container, not on the host.

## Environment

- Repo path: `/workspace`
- This container is the agent workspace for this repo only.
- Do not assume access to host files outside mounted paths.

## Filesystem boundaries

Writable locations:
- `/workspace`
- `/home/agent`

Host credential source mounts are read-only:
- `/run/host-secrets/claude`
- `/run/host-secrets/pi`
- `/run/host-secrets/codex`

Working copies of credentials live in:
- `/home/agent/.claude`
- `/home/agent/.pi`
- `/home/agent/.codex`
- `/home/agent/.local/share/opencode` (opencode auth — use `oc` alias to launch with context injected)

## Docker topology

- Docker commands in this workspace use the repo-local Docker-in-Docker daemon.
- `DOCKER_HOST` points to the repo dind container.
- This is **not** the host Docker socket.
- `docker`, `docker compose`, `docker build`, and related commands only affect this repo-local Docker environment.
- The repo is mounted into both workspace and dind at `/workspace`, so build contexts and compose bind mounts should work from `/workspace`.

## Ports and browser access

- Published ports are configured in `.agent/.env`.
- Host manual testing should use `http://127.0.0.1:<published-port>`.
- Internal browser automation should use `AGENT_BROWSER_TEST_URL` from `.agent/.env` when set.
- Published dind ports are fixed until the dind container is recreated.

## Preferred workflow

- Prefer the values and commands defined in `.agent/.env`.
- Prefer running repo Docker workflows from `/workspace`.
- Prefer the helper scripts in `.agent/scripts/` when they match the task.
- For browser smoke testing, prefer the repo helper that uses `agent-browser`.

## Constraints

- Do not assume host-global Docker access.
- Do not assume access to unrelated host files or sibling repos.
- If a port is missing, the dind container may need to be recreated with updated port mappings.

## More detail

- `.agent/.env`
- `.agent/scripts/`
- `.agent/README.md`
