# Agent Environment

Everything for the repo-local agent sandbox lives in this folder.

## Root integration

Use one of these at repo root:

### Justfile

```make
import ".agent/Justfile"
```

### Makefile

```make
include .agent/Makefile
```

## Config

Copy and edit:

```sh
cp .agent/.env.example .agent/.env
```

If you want stronger separation than the repo folder name, set:

```sh
AGENT_PROJECT_NAME=my-team-myrepo
```

If unset, the project name falls back to the repo folder name.

## Bootstrap package design

Planned bootstrap/upgrade package behavior is documented in:

```txt
.agent/BOOTSTRAP.md
```

## Context source of truth

The agent environment contract lives in:

```txt
.agent/CONTEXT.md
```

The preferred wrapper commands inside the workspace use this file:
- `cld` for Claude
- `p` for Pi
- `c` for Codex reminder wrapper
- `agent_context` to print the contract

Pi also gets a prompt template installed as `/agent-context`.

## Common commands

### Just

```sh
just agent-build
just agent-doctor
just agent-up
just agent-shell
just agent-shell claude
just agent-shell codex
just agent-shell 'p'
just agent-app-up
just agent-app-logs
just agent-browser-test
```

### Make

```sh
make agent-build
make agent-doctor
make agent-up
make agent-shell
make agent-shell CMD=claude
make agent-shell CMD=codex
make agent-shell CMD='p'
make agent-app-up
make agent-app-logs
make agent-browser-test
```
