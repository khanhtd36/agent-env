# Bootstrap CLI Design

This document defines the intended UX and file generation rules for:

```sh
bunx @khanhtd36/agent-env bootstrap
```

## Goals

- Keep all managed repo-local files inside `.agent/`
- Only touch repo root for `Justfile` and/or `Makefile`
- Make bootstrap safe, explicit, and low-surprise
- Support future `upgrade` of an existing `.agent/` folder
- Work on macOS and Linux first, with Windows Git Bash as a best-effort target

## Commands

### Bootstrap

```sh
bunx @khanhtd36/agent-env bootstrap
```

Initialize or update `.agent/` in the current repo/directory.

### Upgrade

```sh
bunx @khanhtd36/agent-env upgrade
```

Initial intended behavior:
- require existing `.agent/manifest.json`
- replace managed files from template
- preserve `.agent/.env`
- ensure root `Justfile` / `Makefile` imports/includes remain present

## Interactive bootstrap flow

### 1. Detect repo/directory

- If inside a git repo, default target is the repo root
- Otherwise default target is current working directory

### 2. Prompt for project name

Suggested default:
- current directory basename

Prompt:

```txt
Project name [demo-fullstack]:
```

Result:
- persisted to `.agent/.env` as `AGENT_PROJECT_NAME=...`
- all later commands use this name if set
- fallback remains repo folder name when not set

### 3. Prompt for published ports

Prompt:

```txt
Published ports (comma-separated host:container, blank for none):
15173:15173,18080:18080,15432:15432
```

Result:
- persisted to `.agent/.env` as `AGENT_PROJECT_PORTS=...`

### 4. Prompt for root command integration

Prompt options:
- Justfile
- Makefile
- Both
- Neither

Behavior:
- if root `Justfile` does not exist and Justfile chosen, create:

```make
import ".agent/Justfile"
```

- if root `Makefile` does not exist and Makefile chosen, create:

```make
include .agent/Makefile
```

- if they already exist, bootstrap should detect whether the import/include is already present
- if missing, prompt before appending it
- bootstrap should not inline our commands into root files

### 5. Optional `.gitignore` support

Default:
- do not modify `.gitignore`

If user passes:

```sh
--gitignore
```

then bootstrap should:
- add `.agent/` to `.gitignore` if not already present
- explain that this makes `.agent/` local-only and non-versioned

## Non-interactive flags

Planned flags:

```sh
--project-name <name>
--ports <csv>
--just
--make
--gitignore
--non-interactive
--overwrite
```

Examples:

```sh
bunx @khanhtd36/agent-env bootstrap --project-name acme-api --ports 15173:15173,18080:18080 --just
bunx @khanhtd36/agent-env bootstrap --just --make --gitignore --non-interactive --overwrite
```

## Files bootstrap generates inside `.agent/`

Managed files:

- `.agent/.env`
- `.agent/.env.example`
- `.agent/CONTEXT.md`
- `.agent/README.md`
- `.agent/manifest.json`
- `.agent/Dockerfile`
- `.agent/Dockerfile.dind`
- `.agent/entrypoint.sh`
- `.agent/launch.sh`
- `.agent/doctor.sh`
- `.agent/Justfile`
- `.agent/Makefile`
- `.agent/shell/bashrc.append`
- `.agent/scripts/app-up.sh`
- `.agent/scripts/app-down.sh`
- `.agent/scripts/app-logs.sh`
- `.agent/scripts/app-status.sh`
- `.agent/scripts/browser-test.sh`
- `.agent/prompts/pi-agent-context.md`

## Files bootstrap may touch at repo root

Only:
- `Justfile`
- `Makefile`
- `.gitignore` when `--gitignore` is passed

## `.agent/.env` contract

Bootstrap should write at least:

```sh
AGENT_PROJECT_NAME=demo-fullstack
AGENT_IMAGE_NAME=agent-workspace:latest
AGENT_DIND_IMAGE_NAME=agent-dind:latest
AGENT_SYNC_SECRETS_MODE=overwrite
AGENT_PROJECT_PORTS=15173:15173,18080:18080,15432:15432
AGENT_APP_UP_CMD='docker compose up --build -d'
AGENT_APP_DOWN_CMD='docker compose down'
AGENT_APP_LOGS_CMD='docker compose logs -f'
AGENT_APP_STATUS_CMD='docker compose ps'
AGENT_BROWSER_TEST_URL=http://agent-demo-fullstack-dind:15173
```

## `.agent/CONTEXT.md` contract

Bootstrap should generate a repo-local environment contract that explains:

- the agent is inside the workspace container, not the host
- repo path is `/workspace`
- writable vs non-writable paths
- docker commands use repo-local dind via `DOCKER_HOST`
- ports/browser URL model
- preferred workflow
- environment constraints
- where to find more detail

This is the source of truth the harness wrappers should use.

## Harness startup behavior bootstrap should support

Inside the workspace shell config:

- `cld` runs Claude with `.agent/CONTEXT.md` appended to system prompt
- `p` runs Pi with `.agent/CONTEXT.md` appended to system prompt
- `c` runs Codex with a reminder banner to read `.agent/CONTEXT.md`
- `agent_context` prints `.agent/CONTEXT.md`

Pi should also get a prompt template installed as:

- `~/.pi/agent/prompts/agent-context.md`

so `/agent-context` is available.

## Manifest contract

Bootstrap should write `.agent/manifest.json` with fields like:

```json
{
  "package": "@khanhtd36/agent-env",
  "packageVersion": "0.1.0",
  "templateVersion": 1,
  "managedFiles": [".env", "CONTEXT.md", "Dockerfile"]
}
```

This will be used by future `upgrade`.

## Upgrade expectations

`upgrade` should:
- read `.agent/manifest.json`
- replace managed files safely
- preserve `.agent/.env` values unless migrating schema
- preserve user intent in root `Justfile` / `Makefile` imports/includes
- avoid touching unrelated root content

## Suggested implementation stack

For the npm package:
- TypeScript
- Bun/Node runtime
- prompt library like `@clack/prompts` or `prompts`
- simple string templates for generated files
- no Python dependency
