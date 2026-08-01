<p align="center">
  <h1 align="center">🎓 LearnOS</h1>
  <p align="center"><strong>The Open-Source AI University</strong></p>
  <p align="center">
    What if Coursera was rebuilt from scratch — with AI agents instead of pre-recorded lectures?
  </p>
</p>

<p align="center">
  <a href="https://github.com/Abelo9996/LearnOS/stargazers"><img src="https://img.shields.io/github/stars/Abelo9996/LearnOS?style=for-the-badge&logo=github&color=yellow" alt="Stars"></a>
  <a href="https://github.com/Abelo9996/LearnOS/network/members"><img src="https://img.shields.io/github/forks/Abelo9996/LearnOS?style=for-the-badge&logo=github&color=blue" alt="Forks"></a>
  <a href="https://github.com/Abelo9996/LearnOS/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/Abelo9996/LearnOS/issues"><img src="https://img.shields.io/github/issues/Abelo9996/LearnOS?style=for-the-badge" alt="Issues"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Claude-D97757?style=flat-square&logo=anthropic&logoColor=white" />
</p>

---

> **Education shouldn't be locked behind logins, paywalls, or a single vendor.**
>
> LearnOS is an **agentic AI university** you run yourself — where AI agents teach, adapt, and certify. Clone it, drop in an OpenRouter key, and go. No accounts, no paywall, no lock-in. Open-source and community-driven.

---

## 📸 Screenshots

<p align="center">
  <img src="docs/screenshots/landing.png" alt="LearnOS Landing Page" width="100%">
  <br><em>🏠 Landing — AI-powered learning at a glance</em>
</p>

<p align="center">
  <img src="docs/screenshots/course_page.png" alt="Course Module View" width="100%">
  <br><em>📚 Course Modules — structured content with real-world applications</em>
</p>

<p align="center">
  <img src="docs/screenshots/ai_tutor.png" alt="AI Tutor" width="100%">
  <br><em>🧑‍🏫 AI Tutor — pick a module, start a Socratic tutoring session</em>
</p>

---

## 🌍 The Problem

Online education is broken:

- 💸 **Expensive** — Coursera, edX, and Udacity charge per course, per certificate, per degree
- 📹 **Static** — Pre-recorded lectures from 2019 teaching a 2026 world
- 🧱 **One-size-fits-all** — Same content whether you're a beginner or an expert
- 🏝️ **Isolated** — You learn alone, drop out alone (completion rates: ~5-15%)

## 🚀 The Vision

LearnOS is an **AI-native university platform** where:

| Traditional Platforms | LearnOS |
|---|---|
| Pre-recorded video lectures | AI agents that teach in real-time, adapting to *you* |
| Locked to one vendor's models | One OpenRouter key — pick any model, pay only for tokens |
| Static content that ages | Living courses generated on demand |
| Learn alone, drop out alone | Cohort-based learning with AI + human communities |
| Certificates that nobody trusts | Mastery-verified certificates backed by AI assessment |
| Courses created by institutions only | **GitHub of Courses** — anyone can create, star, and share |

Read the full [VISION.md](VISION.md) for where this is headed.

### 🤖 Agentic Architecture

LearnOS isn't "a platform with an AI chatbot." It's a **system of specialized AI agents** that collaborate to deliver a complete university experience. Every agent is a real module under [`ai/agents/`](ai/agents):

| Agent | Role |
|---|---|
| 🗺️ **Curriculum Agent** | Designs personalized learning roadmaps from your goals |
| 🧑‍🏫 **Tutor** | Teaches via Socratic dialogue in live sessions — adapts in real-time |
| 📝 **Assessment Agent** | Generates assignments, grades work, and gives targeted feedback |
| 🔍 **Research Agent** | Pulls in supporting resources from the open web |
| 📊 **Analytics Agent** | Tracks learning patterns and surfaces habit insights |
| 🎯 **Profiling Agent** | Models your level, style, and goals during onboarding |

All agents run through a single LLM layer ([`ai/llm.js`](ai/llm.js)) that talks to **[OpenRouter](https://openrouter.ai)** — one key unlocks every major model (Claude, GPT, Gemini, Llama, and more) with per-agent model routing and usage metering. Pick whatever balance of quality and cost you want, per agent.

## ✨ Features (What Works Today)

- 🗺️ **AI-Generated Learning Roadmaps** — Describe a goal, get a structured path of milestones and nodes
- 🧑‍🏫 **Personal AI Tutor** — Live Socratic tutoring sessions that adapt to your understanding
- 📝 **Smart Assignments** — Auto-generated with rubrics and AI grading
- 🃏 **Flashcards** — Spaced-repetition review generated from your material
- 📚 **Courses** — Generate full courses with readings, labs and question banks; star what you keep coming back to
- 🤝 **Sharing** — A course is a portable file. Export it, send it, import it whole. Optionally publish to a registry so others can find it — LearnOS works completely without one
- 🏅 **Certificates & Badges** — Mastery-verified certificates and achievement badges
- 📅 **Study Schedule** — Plan and track your learning cadence
- 📊 **Learning Analytics** — Daily stats, streaks, XP, and activity history
- 🎯 **Learner Profiling** — Onboarding that tailors the experience to your level and style
- 👤 **Local Profile** — Your name, avatar, bio, and links — no account, no login
- 🔑 **One OpenRouter Key** — A single key unlocks every model; set it in-app or via env
- 💾 **Persistent Progress** — SQLite storage, your data survives restarts

## 🛣️ Roadmap

| Phase | Status | Description |
|---|---|---|
| **Foundation** | ✅ Done | Roadmaps, tutor, assignments, flashcards, analytics, profiling |
| **Sharing** | ✅ Done | Courses as portable files, publish/browse via an optional registry, certificates, badges |
| **Hardening** | ✅ Done | SSRF guard, upload validation, rate limiting, CI |
| **Scale** | 🔨 Building | Cohort learning, richer course library, streaming responses |
| **Reach** | 🔮 Vision | Multi-language, mobile, accreditation & employer verification |

**Currently focused on:** STEM (CS, Math, Data Science, Engineering) → expanding outward.

## 🏗️ Quick Start

### Prerequisites

- **Node.js 18+**
- An **[OpenRouter API key](https://openrouter.ai/keys)** (optional for the UI; required for AI features — you can also add it in-app under Settings → API Keys)

### 1. Install

```bash
git clone https://github.com/Abelo9996/LearnOS.git
cd LearnOS
npm install
```

> **Native module note:** LearnOS uses `better-sqlite3`, a native addon. If you switch Node versions and see `ERR_DLOPEN_FAILED`, run `npm rebuild better-sqlite3`.

### 2. Run (two terminals)

```bash
# Terminal 1 — API server (http://localhost:3001)
npm start

# Terminal 2 — Vite dev server with hot reload (http://localhost:3000)
npm run dev
```

Open **http://localhost:3000** — there's no login. LearnOS runs as a single local user (it's *your* machine) and starts completely from scratch: no example data, no demo courses. Generate your first roadmap or course and everything grows from there. No `.env` is required for local dev; see [`.env.example`](.env.example) for all configurable options.

### 3. Start Learning

1. Go to **⚙️ Settings → API Keys** and add your [OpenRouter key](https://openrouter.ai/keys) (or set `OPENROUTER_API_KEY` for the server)
2. **Create a course / roadmap** → describe what you want to learn
3. Work through milestones, start tutor sessions, take assignments, and track your progress

### Production build

```bash
npm run build      # builds the React app into dist/
NODE_ENV=production OPENROUTER_API_KEY=sk-or-... npm start
```

In production the Express server serves the built frontend from `dist/` and the API from the same origin. See [DEPLOYMENT.md](DEPLOYMENT.md).

## 🏛️ Architecture

Single Node service: Express serves both the REST API and the built React SPA.

```
LearnOS/
├── server.js             # Express 5 entry point — API + static SPA
├── routes/               # REST endpoints (courses, roadmaps, sessions, …)
├── middleware/           # local-user resolver, logger, url-safety (SSRF guard)
├── db/                   # better-sqlite3 — schema.sql, database.js
├── ai/
│   ├── llm.js            # provider-agnostic LLM layer (Claude) + metering
│   ├── jobs.js           # async AI job runner
│   ├── schemas.js        # structured-output schemas
│   └── agents/           # curriculum, assessment, research, analytics, profiling
├── src/                  # React 18 frontend (Vite)
│   ├── screens/          # Landing, Auth, Dashboard, Courses, Roadmap, Session, …
│   └── ...
├── uploads/              # user uploads (avatars, etc.)
├── tests/                # Vitest suite
└── docs/                 # architecture, specs, status
```

Frontend talks to the backend via a `/api` proxy in dev ([`vite.config.js`](vite.config.js)) and same-origin in production.

## 🤝 Sharing courses

A course you generate is not trapped in your install. **Share → Export** writes the
whole thing — modules, readings, resources, labs, and the question bank — to a single
`.learnos.json` file. Anyone with that file gets the entire course by dropping it into
their own LearnOS. No server, no account, no network involved.

That is the baseline, and it is enough on its own. On top of it, LearnOS can talk to a
**course registry**: a small optional service (see
[LearnOSWeb](https://github.com/Abelo9996/LearnOSWeb)) where instances publish courses
for each other to find. Publishing claims a handle — no account, no email — and the
registry issues a token that stays on your machine and never reaches the browser; it
authorises exactly one thing, updating what you published.

The registry is a convenience and never a dependency. Switch it off in
**Settings → Community** and LearnOS contacts nothing at all; leave it on and it still
works normally when the registry is down, saying so plainly instead of breaking. Nothing
imported is trusted either: URLs are re-checked against the same SSRF policy as any other
outside content, and imported questions arrive **unverified** no matter what the exporter
believed, because verification is evidence your instance gathered — not a claim that
travels with a file.

There is no forum, no leaderboard, and no member directory, because a single-user local
app cannot honestly host one.

## 🔒 Security

LearnOS is meant to be self-hosted for your own use, so it ships without accounts by design. It still keeps real hardening — an SSRF guard on outbound fetches, magic-byte validation on uploads, Helmet headers, encrypted-at-rest API keys, CORS locked to `APP_URL` in production, and rate limiting. See [SECURITY.md](SECURITY.md) to report a vulnerability.

## 🤝 Contributing

LearnOS is **open-source because education should be free.** We welcome contributions of all kinds — code, agents, courses, and docs. See [CONTRIBUTING.md](CONTRIBUTING.md) and look for issues labeled `good first issue`.

## 📄 License

[MIT](LICENSE) — because knowledge should be free.

---

<p align="center">
  <strong>⭐ Star this repo if you believe education should be free and AI-native.</strong>
  <br>
  <sub>Built with conviction that the next university won't have a campus — it'll have a GitHub repo.</sub>
</p>
