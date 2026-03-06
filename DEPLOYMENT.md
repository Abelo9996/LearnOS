# 🚀 Deployment Guide

## Quick Deploy (Recommended Stack)

| Service | Provider | Why |
|---|---|---|
| Backend | [Railway](https://railway.app) | Free tier, auto-deploy from GitHub, Docker support |
| Frontend | [Vercel](https://vercel.com) | Free tier, Next.js native, instant deploys |
| Database | [Supabase](https://supabase.com) | Free Postgres, 500MB, built-in auth (we use our own) |

---

## Step 1: Database (Supabase)

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name: `learnos`, set a strong DB password
3. Wait for provisioning (~2 min)
4. Go to **Settings → Database → Connection string → URI**
5. Copy the URI (looks like `postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres`)
6. Save this — you'll need it as `DATABASE_URL`

## Step 2: Backend (Railway)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub Repo
2. Select `Abelo9996/LearnOS`
3. Railway will auto-detect the Dockerfile. Set **Root Directory** to `backend`
4. Add environment variables:

```
DATABASE_URL=postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres
LEARNOS_MODE=online
JWT_SECRET=<generate-a-random-64-char-string>
FRONTEND_URL=https://learnos.vercel.app
BACKEND_URL=https://your-railway-url.up.railway.app
OPENAI_API_KEY=<your-key-or-leave-empty>
GOOGLE_CLIENT_ID=<optional>
GOOGLE_CLIENT_SECRET=<optional>
GITHUB_CLIENT_ID=<optional>
GITHUB_CLIENT_SECRET=<optional>
```

5. Deploy → Railway gives you a public URL
6. Note the URL (e.g., `https://learnos-backend-production.up.railway.app`)

## Step 3: Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) → Import Project → GitHub → `Abelo9996/LearnOS`
2. Set **Root Directory** to `frontend`
3. Framework Preset: **Next.js**
4. Add environment variable:

```
NEXT_PUBLIC_API_URL=https://your-railway-url.up.railway.app
```

5. Deploy
6. Note the URL (e.g., `https://learnos.vercel.app`)
7. Go back to Railway and update `FRONTEND_URL` to match your Vercel URL

## Step 4: Run Migrations

SSH into Railway or use the Railway CLI:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link
railway login
railway link

# Run migrations
railway run alembic upgrade head

# Seed data (optional)
railway run python seed.py
```

## Step 5: Custom Domain (Optional)

### Vercel
1. Vercel Dashboard → Project → Settings → Domains
2. Add `learnos.ai` (or your domain)
3. Update DNS records as instructed

### Railway  
1. Railway Dashboard → Settings → Networking → Custom Domain
2. Add `api.learnos.ai`
3. Update DNS CNAME record

Then update env vars:
- Railway: `BACKEND_URL=https://api.learnos.ai`, `FRONTEND_URL=https://learnos.ai`
- Vercel: `NEXT_PUBLIC_API_URL=https://api.learnos.ai`

---

## Alternative: Docker Self-Host

For running on your own VPS (DigitalOcean, Hetzner, etc.):

```bash
# Clone
git clone https://github.com/Abelo9996/LearnOS.git
cd LearnOS

# Create .env
cp backend/.env.example .env
# Edit .env with your values

# Run
docker-compose up -d

# Access
# Frontend: http://your-server:3000
# Backend:  http://your-server:8000
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Production | *(empty=SQLite)* | PostgreSQL connection string |
| `DATABASE_PATH` | Dev only | `learnos.db` | SQLite file path |
| `LEARNOS_MODE` | Yes | `offline` | `online` (auth enforced) or `offline` |
| `JWT_SECRET` | Production | `dev-secret` | Secret for JWT signing |
| `FRONTEND_URL` | Yes | `http://localhost:3000` | Frontend URL for CORS & redirects |
| `BACKEND_URL` | Yes | `http://localhost:8000` | Backend URL for OAuth callbacks |
| `OPENAI_API_KEY` | Optional | *(empty)* | Default OpenAI key (users can set their own) |
| `GOOGLE_CLIENT_ID` | Optional | *(empty)* | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Optional | *(empty)* | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | Optional | *(empty)* | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | Optional | *(empty)* | GitHub OAuth client secret |

---

## Verify Deployment

```bash
# Health check
curl https://your-backend-url/health
# → {"status":"healthy"}

# Check auth
curl https://your-backend-url/api/auth/providers
# → {"google":true,"github":false}
```
