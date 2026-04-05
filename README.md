# @khanhtd36/agent-env

Bootstrap and manage a repo-local Docker-based AI agent coding environment.

## Install/use

```sh
bunx @khanhtd36/agent-env bootstrap
bunx @khanhtd36/agent-env upgrade
```

or

```sh
npx @khanhtd36/agent-env bootstrap
npx @khanhtd36/agent-env upgrade
```

## Bootstrap options

```sh
agent-env bootstrap --project-name my-repo --ports 15173:15173,18080:18080 --just
agent-env bootstrap --just --make --gitignore --non-interactive --overwrite
agent-env upgrade --non-interactive --overwrite
```

## What bootstrap creates

Inside the repo:

- `.agent/.env`
- `.agent/CONTEXT.md`
- `.agent/manifest.json`
- `.agent/Dockerfile`
- `.agent/Dockerfile.dind`
- `.agent/launch.sh`
- `.agent/doctor.sh`
- `.agent/Justfile`
- `.agent/Makefile`
- `.agent/scripts/*`
- `.agent/shell/bashrc.append`
- `.agent/prompts/pi-agent-context.md`

At repo root, bootstrap may add:

- `Justfile` with `import ".agent/Justfile"`
- `Makefile` with `include .agent/Makefile`
- `.gitignore` entry for `.agent/` only when `--gitignore` is passed

## Runtime model

Per repo:
- one workspace container
- one dind sidecar
- persistent workspace home volume
- persistent dind docker state volume

Inside the workspace:
- `cld` launches Claude with `.agent/CONTEXT.md` appended to the system prompt
- `p` launches Pi with `.agent/CONTEXT.md` appended to the system prompt
- `c` launches Codex with a reminder to read `.agent/CONTEXT.md`
- `agent_context` prints `.agent/CONTEXT.md`
- Pi also gets `/agent-context` as a prompt template

## Development notes

The template source used by bootstrap lives in:

- `templates/.agent/`

Bootstrap design details live in:

- `.agent/BOOTSTRAP.md`

Demo repo:

- `demo-fullstack/`
