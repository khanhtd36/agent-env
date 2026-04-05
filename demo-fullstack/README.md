# Demo Fullstack Repo

This is a demo repo for validating the `.agent` sandbox setup.

## Stack

- frontend: React + Vite
- backend: Go HTTP server
- db: PostgreSQL

## Ports

- frontend: `15173`
- backend: `18080`
- postgres: `15432`

These are declared in `.agent.env` so the outer dind sidecar publishes them.

## Run inside the agent workspace

```sh
docker compose up --build -d
```

Then test:

```sh
curl http://agent-demo-fullstack-dind:18080/api/health
curl http://agent-demo-fullstack-dind:15173
agent-browser open http://agent-demo-fullstack-dind:15173
```

## Manual browser test from host

Open:

- http://127.0.0.1:15173
- http://127.0.0.1:18080/api/health

`127.0.0.1` is the most reliable host URL here. Depending on your local resolver/network stack, `localhost` may prefer IPv6 and behave differently.
