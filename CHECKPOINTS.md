# 🎯 CHECKPOINTS.md — LearnOS Build Plan

> **Rule:** Complete each checkpoint fully. Don't move to the next until the current one is solid.
> Each checkpoint has clear **done criteria**. Ship it, verify it, then advance.

---

## CP-0: Repo Polish & Developer Experience ⏱️ ~2 hours
**Goal:** Make the repo irresistible to star and easy to contribute to.

- [x] README rewrite (star-bait, vision-forward)
- [x] VISION.md
- [x] PROJECT.md
- [x] CONTRIBUTING.md
- [x] Add `.github/ISSUE_TEMPLATE/` (bug report, feature request)
- [x] Add `.github/PULL_REQUEST_TEMPLATE.md`
- [x] Add `Dockerfile` + `docker-compose.yml` (one-command setup)
- [x] Add `Makefile` or scripts for common commands
- [ ] Screenshots / GIFs in README (show the product) — **needs manual capture**
- [ ] GitHub Topics — set via GitHub UI: `ai`, `education`, `open-source`, `agents`, `learning-platform`, `coursera-alternative`, `ai-tutor`, `edtech`

**Done when:** A dev can clone, `docker-compose up`, and see the app running. README has screenshots.

---

## CP-1: Auth & Multi-User 🔐 ⏱️ ~6-8 hours
**Goal:** Real users, real accounts. Kill `demo_user`.

- [ ] Auth system (JWT + OAuth2 — Google, GitHub)
- [ ] User model: id, email, name, avatar, created_at, subscription_tier
- [ ] Registration / login pages (frontend)
- [ ] Protected API routes (middleware)
- [ ] User profile page
- [ ] Migrate all `demo_user` references to authenticated user
- [ ] Session management (refresh tokens)

**Done when:** Two different people can sign up, log in, and see their own separate courses.

---

## CP-2: Database Migration (SQLite → Postgres) 🗄️ ⏱️ ~4 hours
**Goal:** Production-ready data layer.

- [ ] SQLAlchemy + Alembic integration (replace raw SQLite)
- [ ] Migration scripts for existing schema
- [ ] Connection pooling
- [ ] Keep SQLite as dev/local option via env toggle
- [ ] Seed data script for development

**Done when:** App runs on Postgres in production, SQLite locally. Migrations are versioned.

---

## CP-3: Deployment 🚀 ⏱️ ~3-4 hours
**Goal:** Live on the internet. Anyone can use it.

- [ ] Backend → Railway / Fly.io / Render
- [ ] Frontend → Vercel
- [ ] Postgres → Supabase / Railway
- [ ] Environment config (production .env)
- [ ] CI/CD pipeline (GitHub Actions: lint, test, deploy on push to main)
- [ ] Custom domain (learnos.ai or similar)
- [ ] Health check endpoint

**Done when:** `learnos.ai` (or equivalent) serves the app. Push to main auto-deploys.

---

## CP-4: Course Marketplace ("GitHub of Courses") 📚 ⏱️ ~8-10 hours
**Goal:** The core social feature. Users create, share, star, and fork courses.

- [ ] Course model expansion: author, visibility (public/private), stars, forks, tags
- [ ] Course creation wizard (AI-assisted — describe topic, AI builds structure)
- [ ] Course discovery page: trending, most starred, by category, search
- [ ] Star/unstar courses
- [ ] Fork a course (copy to your account, modify)
- [ ] Course detail page (public view with syllabus, reviews, star count)
- [ ] Category system: CS, Math, Data Science, Engineering, etc. (STEM first)
- [ ] Author profiles (public page showing courses created)

**Done when:** User A creates a course, User B finds it via search, stars it, forks it, and modifies it.

---

## CP-5: Cohort & Social Learning 👥 ⏱️ ~6-8 hours
**Goal:** Learn together. The "university" feel.

- [ ] Enroll in a course (join alongside others)
- [ ] Cohort system: groups of learners on the same course
- [ ] Discussion threads per course / per milestone
- [ ] Leaderboard: progress, mastery, streaks
- [ ] Activity feed: "Abel completed Milestone 3," "Sara starred your course"
- [ ] Basic notifications (in-app)

**Done when:** 5 users can enroll in the same course, see each other's progress, and discuss in threads.

---

## CP-6: Certificates & Mastery Verification 🏅 ⏱️ ~4-5 hours
**Goal:** Proof you actually learned something.

- [ ] Certificate model: course, user, completion_date, mastery_score, verification_hash
- [ ] Certificate generation (PDF with unique verification code)
- [ ] Public verification page: `learnos.ai/verify/<hash>`
- [ ] Mastery requirements per course (configurable by author)
- [ ] Certificate gallery on user profile
- [ ] LinkedIn-shareable format

**Done when:** Complete a course → get a PDF certificate → share a verification link that proves it.

---

## CP-7: Agent Upgrades 🤖 ⏱️ ~6-8 hours
**Goal:** Make the AI actually remarkable. This is the moat.

- [ ] Research Agent: real-time web search for resources (articles, videos, papers)
- [ ] Community Agent: recommend study partners, form groups
- [ ] Certification Agent: evaluate mastery, issue certs
- [ ] Agent memory persistence (long-term learner context across sessions)
- [ ] Multi-agent collaboration: agents share insights about a learner
- [ ] Agent quality metrics: track which agent interactions lead to mastery
- [ ] Pluggable LLM backend (OpenAI, Anthropic, local models)

**Done when:** The tutor references real articles. Agents share context. Users can choose their LLM.

---

## CP-8: Testing & Quality ✅ ⏱️ ~4-5 hours
**Goal:** Confidence to ship fast without breaking things.

- [ ] Backend unit tests (pytest) — agents, routers, db
- [ ] Frontend tests (Jest + React Testing Library) — key flows
- [ ] E2E tests (Playwright) — signup → create course → learn → certificate
- [ ] API tests (httpx test client)
- [ ] CI runs tests on every PR
- [ ] Code coverage target: 60%+ (not obsessive, but safe)

**Done when:** `make test` passes. CI blocks merges with failing tests.

---

## CP-9: Landing Page & Marketing Site 🌐 ⏱️ ~3-4 hours
**Goal:** Convert visitors into users and contributors.

- [ ] Hero section: vision statement + demo GIF/video
- [ ] Features section with agent showcase
- [ ] Comparison table (vs Coursera, Khan, edX)
- [ ] Open-source CTA (contribute on GitHub)
- [ ] Sign up / waitlist
- [ ] SEO basics (meta tags, OG images, sitemap)
- [ ] Blog section (for launch posts, updates)

**Done when:** Landing page is live, looks professional, and converts to signups/stars.

---

## CP-10: Scale & Polish 💎 ⏱️ Ongoing
**Goal:** Production-grade, hundreds-of-users ready.

- [ ] Rate limiting & API security
- [ ] Error monitoring (Sentry)
- [ ] Analytics (PostHog / Plausible — privacy-respecting)
- [ ] Performance optimization (caching, lazy loading, CDN)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Mobile responsiveness audit
- [ ] Dark mode
- [ ] i18n framework (prep for multi-language)
- [ ] API documentation (auto-generated from FastAPI)
- [ ] Contributor onboarding guide with "good first issues"

**Done when:** App handles 100+ concurrent users, looks polished, is accessible.

---

## Execution Order & Dependencies

```
CP-0 (Repo Polish) ─────────────────────────────────────────► DONE
  │
  ▼
CP-1 (Auth) ─► CP-2 (Postgres) ─► CP-3 (Deployment)
                                       │
                                       ▼
                                  CP-4 (Marketplace) ─► CP-5 (Social)
                                       │                    │
                                       ▼                    ▼
                                  CP-6 (Certificates)  CP-7 (Agents)
                                       │                    │
                                       └────────┬───────────┘
                                                │
                                                ▼
                                          CP-8 (Testing)
                                                │
                                                ▼
                                          CP-9 (Landing)
                                                │
                                                ▼
                                          CP-10 (Scale)
```

## Time Estimate

| Checkpoint | Hours | Cumulative |
|---|---|---|
| CP-0: Repo Polish | 2h | 2h |
| CP-1: Auth | 6-8h | 10h |
| CP-2: Postgres | 4h | 14h |
| CP-3: Deployment | 3-4h | 18h |
| CP-4: Marketplace | 8-10h | 28h |
| CP-5: Social | 6-8h | 36h |
| CP-6: Certificates | 4-5h | 41h |
| CP-7: Agents | 6-8h | 49h |
| CP-8: Testing | 4-5h | 54h |
| CP-9: Landing | 3-4h | 58h |
| CP-10: Scale | Ongoing | — |

**Total to MVP (CP-0 through CP-6): ~41 hours**
**Total to full v2: ~58 hours**

At 4h/day → **MVP in ~10 days, full v2 in ~15 days.**
At 8h/day → **MVP in ~5 days, full v2 in ~8 days.**

---

*We ship each checkpoint. We don't skip. We don't half-ass. Each one is a releasable milestone.*
