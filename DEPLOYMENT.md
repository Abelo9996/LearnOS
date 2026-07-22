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

LearnOS runs with zero config, but for a hosted instance copy `.env.example` to `.env` and set:

```bash
cp .env.example .env
```

```env
NODE_ENV=production
APP_URL=https://learnos.example.com         # CORS is locked to this origin in prod
PORT=3001

# LLM provider: OpenRouter (one key, every model). Set it here, or add it in-app
# under Settings → API Keys.
OPENROUTER_API_KEY=sk-or-...
LEARNOS_DEFAULT_MODEL=anthropic/claude-haiku-4.5
```

LearnOS is single-user and self-hosted — there is no login. If you don't set `OPENROUTER_API_KEY`, add a key in-app under **Settings → API Keys**.

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
| `APP_URL` | Prod | `http://localhost:3001` | Allowed CORS origin and outbound request attribution |
| `PORT` | No | `3001` | Port the server listens on |
| `OPENROUTER_API_KEY` | Optional | *(empty)* | Server-wide OpenRouter key (users can otherwise add one in-app) |
| `LEARNOS_DEFAULT_MODEL` | Optional | `anthropic/claude-haiku-4.5` | Default OpenRouter model slug when no per-agent routing is set |
| `LEARNOS_ENC_KEY` | Optional | *(derived)* | 32-byte base64/hex key to encrypt in-app API keys at rest |
| `LEARNOS_SEED` | Optional | *(unset)* | Set to `1` to seed example roadmaps/courses on first boot |

## Data & Persistence

- The SQLite database lives under `db/` and is **gitignored** — make sure your host has a persistent volume there (and for `uploads/`) so data survives restarts and redeploys.
- Back up `db/learnos.db` and the `uploads/` directory as your source of truth.

## Notes

- **HTTPS is required in production** — the app expects to sit behind a TLS-terminating proxy.
- Rate limiting and Helmet are on by default; review `server.js` before exposing publicly.
