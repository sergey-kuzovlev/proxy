# proxy

Minimal HTTP relay suitable for CI or small services. Neutral and configurable; no assumptions about the upstream.

Features
- Forwards requests from `/p/*` to an upstream base URL
- Passes headers through; strips hop‑by‑hop headers
- Optional token guard via `x-proxy-token`
- CORS enabled with configurable origins
- Small footprint; Dockerfile included

Quick start
- Provide upstream either via env or CLI
  - Env: `TARGET_BASE` (required if no CLI arg): e.g. `https://<upstream-host>`
  - CLI: `--target=https://<upstream-host>` (takes precedence over env)
  - `PORT` (optional, default 8080)
  - `ALLOW_ORIGINS` (optional, default `*`)
  - `PROXY_TOKEN` (optional): if set, requests must include header `x-proxy-token: <value>`
  - `INSECURE_TLS=1` to allow self‑signed upstream (default secure)
  - `LOG_REQUESTS=1` to enable access logs; `START_VERBOSE=1` to print upstream host at start
- Run
  - `npm install`
  - `npm start` (uses env) or `node src/index.js --target=https://<upstream-host>`
  - Requests to `http://localhost:8080/p/...` are forwarded to `TARGET_BASE/...`

Docker
```
# build
docker build -t proxy .
# run
docker run -p 8080:8080 -e TARGET_BASE=https://<upstream-host> proxy
```

Render / PaaS
- Build command: `npm install`
- Start command: `npm start`
- Env: set `TARGET_BASE`, optional `PROXY_TOKEN`, etc.

Security notes
- Restrict who can reach this service: prefer private networks/VPC or at minimum use `PROXY_TOKEN` + CORS.
- Keep logs minimal by default; avoid printing upstream details and secrets in CI logs.
