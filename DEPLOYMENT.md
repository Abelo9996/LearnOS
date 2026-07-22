# 🚀 Deployment Guide

LearnOS is a **single Node service**: Express serves the REST API *and* the built React SPA from the same origin. There's no separate frontend host to manage.

## Overview

```
npm run build     →  compiles the React app into dist/
npm start         →  Express serves dist/ + /api on one port (default 3001)
```

Any host that can run a Node 18+ process works — a VPS, Railway, Render, Fly.io, a container, etc.

---

## 1. Build

```bash
git clone https://github.com/Abelo9996/LearnOS.git
cd LearnOS
npm ci
npm run build
```

> Uses `better-sqlite3` (a native addon). If your deploy target's Node version differs from your build machine's, build on the target or run `npm rebuild better-sqlite3` there.

## 2. Configure

Copy `.env.example` to `.env` and set at least the production essentials:

```bash
cp .env.example .env
```

```env
NODE_ENV=production
LEARNOS_JWT_SECRET=<openssl rand -hex 32>   # REQUIRED — server refuses to start without it in prod
APP_URL=https://learnos.example.com         # CORS is locked to this origin in prod
PORT=3001

# Optional: a managed Anthropic key so users don't have to bring their own
ANTHROPIC_API_KEY=
LEARNOS_DEFAULT_MODEL=claude-haiku-4-5
MANAGED_MONTHLY_TOKEN_CAP=500000
MANAGED_MONTHLY_COST_CAP=50
```

If you don't set a managed key, users add their own under **Settings → API Keys**.

## 3. Run

```bash
NODE_ENV=production npm start
```

The app listens on `PORT`. Put it behind a reverse proxy (Caddy, nginx, or your host's router) to terminate **HTTPS** and forward to the Node process.

<details>
<summary>Example: systemd unit</summary>

```ini
[Unit]
Description=LearnOS
After=network.target

[Service]
WorkingDirectory=/opt/LearnOS
ExecStart=/usr/bin/node server.js
EnvironmentFile=/opt/LearnOS/.env
Restart=always
User=learnos

[Install]
WantedBy=multi-user.target
```
</details>

## 4. Verify

```bash
curl https://learnos.example.com/api/health
# → {"status":"ok","timestamp":"..."}
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Prod | `development` | Set to `production` to enable prod behavior (CORS lock, static serving) |
| `LEARNOS_JWT_SECRET` | **Prod** | *(per-boot random in dev)* | JWT signing secret — server exits if unset in production |
| `APP_URL` | Prod | `http://localhost:3001` | Allowed CORS origin and base URL for email links |
| `PORT` | No | `3001` | Port the server listens on |
| `ANTHROPIC_API_KEY` | Optional | *(empty)* | Managed Anthropic key (users can otherwise bring their own) |
| `LEARNOS_ANTHROPIC_KEY` | Optional | *(empty)* | Alias, checked before `ANTHROPIC_API_KEY` |
| `LEARNOS_DEFAULT_MODEL` | Optional | `claude-haiku-4-5` | Default model when no per-agent routing is set |
| `MANAGED_MONTHLY_TOKEN_CAP` | Optional | `500000` | Per-user monthly token cap on the managed key (0 = unlimited) |
| `MANAGED_MONTHLY_COST_CAP` | Optional | `50` | Per-user monthly USD cap on the managed key (0 = unlimited) |
| `RESEND_API_KEY` | Optional | *(empty)* | Enables password-reset / verification email (else those endpoints 503 in prod) |
| `EMAIL_FROM` | Optional | `LearnOS <noreply@learnos.dev>` | From address for outbound email |
| `LEARNOS_SEED` | Optional | *(unset)* | Set to `1` to seed a demo user on first boot — leave unset in production |

## Data & Persistence

- The SQLite database lives under `db/` and is **gitignored** — make sure your host has a persistent volume there (and for `uploads/`) so data survives restarts and redeploys.
- Back up `db/learnos.db` and the `uploads/` directory as your source of truth.

## Notes

- **HTTPS is required in production** — the app expects to sit behind a TLS-terminating proxy.
- Rate limiting and Helmet are on by default; review `server.js` before exposing publicly.
