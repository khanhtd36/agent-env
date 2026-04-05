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
agent-env bootstrap --project-name my-repo --ports 3000-20000:3000-20000 --just
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

## Decision records

### DR-1: Run AI agents inside Docker, not directly on the host

**Problem**
AI agent CLIs like Claude Code, Codex, and Pi can read and write arbitrary files, execute shell commands, and interact with Docker. Running them directly on the host exposes your entire home directory, host Docker socket, and all sibling repos to the agent.

**Approach chosen**
Run each agent session inside a per-repo workspace container. The host only runs Docker. The agent runs inside a container with tightly scoped mounts.

**Why**
- Limits blast radius to the repo mount and the agent's own home volume
- Keeps host filesystem, host Docker, and other repos out of reach by default
- Still lets the agent do real work: edit code, run builds, manage services
- Works on macOS and Linux without platform-specific tooling

---

### DR-2: Per-repo Docker-in-Docker sidecar, not host Docker socket

**Problem**
The agent needs to run `docker compose`, build images, and manage services. Giving it the host Docker socket is effectively giving it root on the host — it can mount arbitrary paths, spawn privileged containers, and see all host containers.

**Approach chosen**
Run a dedicated `docker:dind` sidecar container per repo. The workspace container talks to it via `DOCKER_HOST=tcp://agent-<project>-dind:2375`. The host Docker socket is never mounted into the agent.

**Why**
- Agent has full Docker power scoped to its own private daemon
- Cannot see or affect host containers or other repos' containers
- Build contexts and compose bind mounts work because the repo is mounted into both workspace and dind at the same path (`/workspace`)
- Downside: dind needs `--privileged`. Accepted as the contained blast radius is still much better than host socket exposure

---

### DR-3: One workspace container per repo, many shells

**Problem**
Running multiple agent terminals or opening a second shell session for the same repo could mean spawning a new container each time, which wastes resources and loses shared state.

**Approach chosen**
One persistent workspace container per repo. Additional shells are `docker exec` sessions into the same running container.

**Why**
- Shared repo mount, shared credentials, shared Docker access, shared browser state
- Low overhead: `just agent-shell` is just `docker exec -it`
- Persistent `/home/agent` volume means shell history, tool caches, and agent state survive across sessions
- Simpler lifecycle: one container to start, stop, reset

---

### DR-4: All repo-local config under `.agent/`, only `Justfile`/`Makefile` at root

**Problem**
Bootstrapping an agent environment needs to write files somewhere. Writing scattered files across the repo root (`.env`, `README.agent.md`, `agent.yml`, etc.) is surprising and pollutes the repo.

**Approach chosen**
All managed files live under `.agent/`. The only files bootstrap touches at repo root are `Justfile` and/or `Makefile`, adding a single `import`/`include` line pointing into `.agent/`.

**Why**
- Minimal surprise: one folder, easy to inspect, easy to gitignore if desired
- Root `Justfile`/`Makefile` remain clean one-liners
- Teammates can see the full environment contract in one place
- Easy to upgrade: `upgrade` replaces `.agent/` managed files while preserving `.agent/.env`

---

### DR-5: `.agent/CONTEXT.md` as the agent environment contract

**Problem**
AI agents inside the workspace don't know they're inside a container, don't know how Docker works in this environment, don't know the port model, and will make wrong assumptions — wasting tokens on failed retries.

**Approach chosen**
A plain Markdown file `.agent/CONTEXT.md` describes the full topology: where the repo is, how Docker is routed, what ports are published, what the browser URL is, and what not to assume.

The harness wrapper commands (`cld`, `p`) inject this file into the agent's system prompt via `--append-system-prompt` at startup.

**Why**
- Single source of truth that both humans and agents can read
- Injecting at startup means the agent never needs to discover it
- Using official harness flags (`--append-system-prompt`) is more reliable than environment variable hinting or relying on the agent to read a file unprompted
- Claude and Pi both support `--append-system-prompt`. Codex gets a reminder banner as a fallback until an official hook is confirmed

---

### DR-6: `templates/.agent/` as single source of truth for generated files

**Problem**
The package needs to generate `.agent/` in user repos, and the demo repo keeps a checked-in copy for convenience. Without a single canonical source, those trees drift.

**Approach chosen**
`templates/.agent/` is the canonical source. Bootstrap and upgrade copy from `templates/.agent/` at runtime. `scripts/sync.js` copies it to `demo-fullstack/.agent/` (preserving `.env`). This package repo does not keep its own checked-in root `.agent/`.

**Why**
- One place to edit when changing agent scripts, Dockerfile, or configuration
- Sync is explicit and scriptable (`npm run sync`)
- `.agent/` keeps its normal meaning as generated repo-local state in consumer repos
- Published package bundle only contains `templates/.agent/`, never generated working copies
- `manifest.json` in the template has placeholder values (`packageVersion: 0.0.0`, no `generatedAt`) — real values are written at bootstrap/upgrade time

---

### DR-7: Node/Bun for the bootstrap CLI, bash for runtime scripts

**Problem**
The bootstrap tool needs interactive prompts with arrow-key selection, file templating, and npm publishing. The runtime scripts (launch, doctor, app helpers) need to run on the host wherever Docker and bash are available.

**Approach chosen**
- Bootstrap CLI: Node.js ESM with `@clack/prompts`, published as an npm package
- Runtime: pure bash scripts under `.agent/`

**Why**
- `bunx`/`npx` is a natural distribution channel for a one-command bootstrap
- `@clack/prompts` gives arrow-key select and inline validation with no native addon dependencies — works on both Node and Bun
- Bash runtime scripts have no runtime dependency beyond bash and Docker, which are already required
- Keeps the package small (~15 kB) and fast to fetch

---

### DR-8: Credentials mounted read-only, copied into container home on startup

**Problem**
Agent CLIs need credentials from `~/.claude`, `~/.pi`, `~/.codex`. Mounting them writable risks the agent corrupting host config. Not mounting them means the agent cannot authenticate.

**Approach chosen**
Mount host credential directories read-only at `/run/host-secrets/*`. The entrypoint script copies them into `/home/agent/` on container startup.

**Why**
- Host originals are never writable by the agent
- Agent sees a normal home directory layout and authenticates correctly
- Copies live in the persistent home volume; the agent can mutate them without affecting the host
- Sync mode is configurable: `overwrite` (default) re-copies from host on each start, `merge` preserves agent-local changes

---

## Development notes

The template source used by bootstrap lives in:

- `templates/.agent/`

Bootstrap design details live in:

- `templates/.agent/BOOTSTRAP.md`

This package repo intentionally does not keep a checked-in root `.agent/`. In consumer repos, `.agent/` is generated output.

Demo repo:

- `demo-fullstack/`
