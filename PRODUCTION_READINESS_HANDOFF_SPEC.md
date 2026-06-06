# Production Readiness Handoff Spec — LearnOS

> Audience: a follow-on coding agent that will take LearnOS from "demo that boots" to "shippable v1."
> Source of truth for this audit: the actual repo at `/Users/abelyagubyan/Downloads/LearnOS_UI` on 2026-06-05.
> Cross-reference, but do **not** trust uncritically: `docs/SPEC.md`, `docs/STATUS.md`, `docs/BACKLOG.md`, `.planning/ROADMAP.md`, and the legacy `PRODUCT_AUDIT.md`. STATUS.md in particular overstates "done" for several rows (see §3).

---

## 1. Product Summary

LearnOS is a single-user **agent-orchestrated mastery engine**. A learner declares a goal ("I want to master X"), a team of seven specialized AI agents — Profiling (PR), Curriculum (CR), Research (RE), Tutor (TU), Assessment (AS), Analytics (AN), Certification (CE) — generates a personalized roadmap (a DAG of concept nodes), assembles verified resources per node, tutors the learner via a chat session, generates and grades assignments/quizzes, computes per-node mastery, dynamically re-routes the path (inserting remediation when the learner struggles, skipping mastered nodes), and finally issues a certificate when mastery thresholds are met.

Around that core loop sit: a course **catalog** (browse / star / enroll / fork / publish), a **community** layer (threads, replies, votes, leaderboard), **gamification** (XP, levels, streaks, badges), **spaced review** (SM-2 flashcards), a **schedule**, and **settings** (managed-default LLM vs BYOK Anthropic key, per-agent model routing).

Target user: a self-directed learner who wants a personalized, AI-driven study path with measurable mastery — not a passive Coursera-style consumer.

Core product promise: **"Tell us what you want to master; we will route you there and prove you got there."**

The product is **NOT** a tutor chatbot with a dashboard around it. The chat tutor (TU) is one of seven agents. Any change that re-centers the product on "chat with an AI tutor" violates the spec.

---

## 2. Current State Summary

The product has a working chassis but is not production-ready. What works today:

- **Backend chassis**: Express 5 + better-sqlite3 (WAL), JWT auth (bcrypt, register/login/logout, token revocation), idempotent migrations on boot, request logging, error middleware, multer file uploads, AES-256-GCM encryption of stored API keys.
- **AI platform plumbing (Phase 1)**: `ai/llm.js` provider abstraction (managed Anthropic key + per-user BYOK), prompt caching, `agent_runs` logging, `usage_counters` metering, in-process `agent_jobs` worker with resume-on-boot.
- **Real agents (partial)**: PR (`profiling.js`), CR (`curriculum.js`), RE (`research.js` propose + `verifyResource` background job), AS (`assessment.js` generate quiz & assignment, grade submission), AN (`analytics.js` session analysis + re-plan trigger). Each has a deterministic offline fallback when no API key is configured.
- **Gamification**: XP / levels / streaks / badges / certificates via `awardXP`, `updateStreak`, and the session-completion cascade in `routes/sessions.js`.
- **Real CRUD**: roadmaps, sessions, assignments, flashcards (SM-2), schedule, activity log, courses catalog (browse / search / star / enroll / create / fork), community threads/replies/votes/leaderboard, profile, certificates, badges.
- **Vite build** completes (`npm run build` → 447 KB JS bundle).
- **Dev server boots** (`PORT=3789 node server.js`), `/api/health`, `/api/auth/login` (alex@learnos.dev / learnos123), `/api/stats`, `/api/roadmaps`, `/api/courses`, `/api/ai/usage` all return real data.

What is **not** production-ready (the core of this handoff):

1. **Major backend work from "Round 4" (`docs/STATUS.md` §I) is built but the frontend never calls it.** Eight surfaces are tagged 🔌 ("backend complete, frontend UI wiring still needed"): course modules CRUD, file uploads (avatar / course thumbnail), LLM grading of assignments, AN re-planning, schedule reminders, admin course verification, whiteboard persistence, manual roadmap node editing, profile customization, and password reset / email verification.
2. **Static / seeded data still leaks into live screens.** `src/data/data.js` exports `USER`, `SESSION`, `QUIZ`, `STREAK_BARS`, `LEARNING_PROGRESS`, `COURSE_FEATURED`, `TOP_CONTRIBUTORS`, `COURSE_VERSIONS`, `SCHEDULE_DAYS`, `ASSIGNMENTS`, `FLASHCARDS`, `CERTIFICATES`, `BADGES`, `DISCUSSIONS`, `LEADERBOARD`, `FEED`, and `SEED_MESSAGES`. Many of these are still imported and rendered by live screens (Dashboard, Session, Landing, Courses).
3. **Session screen falls back to the hardcoded "Bias–Variance" topic** when API fails (`src/screens/Session.jsx:56–72`, `:254–266`, `:316–321`). The fallback is partially fixed (G1) but `SESSION.title/subtitle/course/level/index/total` are still the default when `session` is null.
4. **The app is desktop-only.** `src/App.jsx:289` hardcodes `minWidth: 1280` on the root container. No responsive breakpoints anywhere. Mobile and tablet are unusable.
5. **No tests of any kind.** No unit, integration, or E2E tests. `test_phase2.mjs` at repo root is a one-off script, not a suite.
6. **No CI, no health/readiness probe beyond `/api/health`, no structured logging, no error reporting.**
7. **JWT secret is hardcoded / fragile.** Default secret used when `LEARNOS_JWT_SECRET` is unset (verify `middleware/auth.js`).
8. **CORS is wide open** (`Access-Control-Allow-Origin: *` in `server.js:46`) — fine for a single-origin SPA, dangerous if any subdomain or third-party origin is ever introduced.
9. **No rate limiting** on auth, on AI endpoints, or anywhere else. Managed-key abuse is a live risk.
10. **AI usage caps (PLAT-06) not enforced.** `/api/ai/usage` returns counters but `complete()` never checks a cap before calling Anthropic.
11. **Landing page contains hardcoded vanity stats** (e.g. "28.4k" GitHub stars at `Landing.jsx:822`).
12. **No real email transport** — `routes/email.js` falls back to a no-op when `RESEND_API_KEY` is unset, so password reset and verification silently succeed but never deliver.
13. **No SSRF defense on user-supplied URLs in courses, community attachments, or thumbnails** — only `verifyResource` and `proposeResources` are guarded. A user supplying `image_url` or `thumbnail_url` is not validated.
14. **Two parallel deploy scripts** (`deploy.sh` and `deploy.local.sh`) of unknown current intent — likely contains stale assumptions.

The product is roughly **65% of the way to a v1**. The remaining 35% is mostly wiring, hardening, and de-faking — not new architecture.

---

## 3. Critical Problems Blocking Production

Ranked by impact on a real user finishing the core loop (onboard → roadmap → session → graded assignment → mastery → certificate).

| # | Severity | Problem | Where |
|---|---|---|---|
| 1 | **P0 / Blocker** | Static `SESSION` / `QUIZ` constants are rendered when `session` state is null or API fails, so users see "Bias–Variance Tradeoff" on a brand-new account. | `src/screens/Session.jsx` lines 56, 71, 72, 254–266, 316–321, 458 |
| 2 | **P0 / Blocker** | Roadmap generation works end-to-end only if Anthropic key is configured AND the job completes within 60s; otherwise Onboarding throws "Generation timed out" and leaves the user stranded with no roadmap and `onboarded_at` set. | `src/screens/Onboarding.jsx:41–55` |
| 3 | **P0 / Blocker** | AS grading endpoint exists but no UI submits to it. Assignments still show heuristic / static grades. | `ai/agents/assessment.js` gradeSubmission, `src/screens/Extras.jsx` AssignmentWorkModal |
| 4 | **P0 / Blocker** | AN re-planning runs but inserted remediation nodes don't visibly update the roadmap UI (no refetch trigger after job done). | `ai/agents/analytics.js`, `src/screens/Roadmap.jsx` |
| 5 | **P0 / Blocker** | Password reset / email verification land in the DB but no SMTP transport is configured by default. Users locked out cannot recover. | `routes/auth.js` + `routes/email.js` |
| 6 | **P1** | Whole app is `minWidth: 1280`. Mobile/tablet = horizontal scroll only. | `src/App.jsx:289`, every screen |
| 7 | **P1** | No tests anywhere. Cannot ship without at least smoke + critical-path coverage. | repo-wide |
| 8 | **P1** | JWT secret defaults; no rate limiting on `/api/auth/*` or `/api/ai/*`. | `middleware/auth.js`, `server.js` |
| 9 | **P1** | AI usage caps not enforced — managed key cost is unbounded per user. | `ai/llm.js` |
| 10 | **P1** | Static landing-page vanity metrics ("28.4k stars"), static `COURSE_FEATURED`, `TOP_CONTRIBUTORS`, `COURSE_VERSIONS` still rendered in Courses. | `src/screens/Landing.jsx:822`, `src/screens/Courses.jsx`, `src/data/data.js` |
| 11 | **P1** | Schedule reminders poll `/api/schedule/due` but the toast in `App.jsx` does not actually deep-link the user to the destination screen — `dest` is computed but unused. | `src/App.jsx:165–185` |
| 12 | **P2** | Whiteboard strokes persistence backend exists; canvas never loads/saves. | `routes/sessions.js`, `src/screens/Session.jsx` WhiteboardView |
| 13 | **P2** | Manual roadmap node add/delete endpoints exist; no UI. | `routes/roadmaps.js`, `src/screens/Roadmap.jsx` |
| 14 | **P2** | Avatar / bio / links columns + uploads endpoint exist; Settings has no form. | `routes/profile.js`, `routes/uploads.js`, `src/screens/Extras.jsx` Settings |
| 15 | **P2** | Course module/lesson CRUD exists; UI still renders 5 hardcoded syllabus strings. | `routes/courses.js`, `src/screens/Courses.jsx` |
| 16 | **P2** | SSRF guard missing on user-supplied `image_url`, `thumbnail_url`, community `ref_*`. | `routes/courses.js`, `routes/community.js` |
| 17 | **P2** | Wide-open CORS, no Helmet/CSP, no cookie-based auth (LocalStorage JWT is XSS-readable). | `server.js` |
| 18 | **P3** | No observability beyond stdout `console.log`. No request IDs propagated. No error tracking. | `middleware/logger.js`, `server.js` |
| 19 | **P3** | `deploy.sh` and `deploy.local.sh` are identical byte-for-byte but treated as separate — confirm intent or delete one. | repo root |
| 20 | **P3** | `PRODUCT_AUDIT.md` at repo root is marked superseded but not deleted; risk of agents reading stale docs. | `PRODUCT_AUDIT.md` |

---

## 4. Architecture Overview

```
LearnOS_UI/
├── server.js                      Express 5 entry. Mounts /api/* routes, serves /dist SPA + /uploads.
├── package.json                   ES modules. Scripts: dev (vite), build (vite build), start (node server.js).
├── vite.config.js                 Vite 6 + React plugin. Proxies /api → :3001 in dev.
├── index.html                     SPA shell. Loads src/main.jsx.
├── deploy.sh / deploy.local.sh    Bash deploy scripts (duplicates).
├── PRODUCT_AUDIT.md               STALE — superseded by docs/SPEC.md.
│
├── db/
│   ├── database.js                better-sqlite3 init, WAL, migrations, helpers (awardXP, updateStreak, logAgentRun, bumpUsage, logActivity).
│   ├── schema.sql                 Source-of-truth DDL — run on first boot via runMigrations().
│   ├── seed.sql                   Demo data for alex@learnos.dev.
│   └── learnos.db                 SQLite file (gitignored in prod).
│
├── middleware/
│   ├── auth.js                    JWT sign/verify, requireAuth, revoked-tokens check.
│   └── logger.js                  requestLogger, errorHandler, notFound.
│
├── routes/                        One file per resource. All mounted under /api/* in server.js.
│   ├── auth.js                    /register, /login, /logout, /me, /forgot, /reset, /verify.
│   ├── users.js, profile.js, starred.js
│   ├── roadmaps.js, nodes.js
│   ├── sessions.js                Session CRUD + completion cascade + whiteboard strokes endpoints.
│   ├── assignments.js, flashcards.js, schedule.js, activity.js
│   ├── courses.js                 Catalog + enroll + modules/lessons CRUD + verify (admin).
│   ├── community.js               Threads/replies/votes/leaderboard.
│   ├── certificates.js, badges.js
│   ├── ai.js                      /api/ai/chat, /api/ai/runs, /api/ai/usage, /api/ai/quiz/generate, /api/ai/assignments/generate.
│   ├── jobs.js                    /api/jobs/:id status poll.
│   ├── uploads.js                 POST /api/uploads (multer, 5 MB, png/jpeg/webp/gif only).
│   └── email.js                   Resend-or-noop transport helper.
│
├── ai/
│   ├── llm.js                     complete() — Anthropic SDK wrapper. Key resolution (BYOK > managed), model routing via agent_routing, prompt caching, structured-output schema, agent_runs + usage logging.
│   ├── crypto.js                  AES-256-GCM encrypt/decrypt for stored API keys.
│   ├── jobs.js                    In-process job queue. resumeJobs() on boot. registerJobHandler() per agent.
│   ├── schemas.js                 JSON schemas for structured outputs.
│   └── agents/                    profiling.js, curriculum.js, research.js, assessment.js, analytics.js.
│       (Tutor is implemented inline in routes/ai.js + Session.jsx; Certification is the completion cascade in routes/sessions.js.)
│
├── src/                           React 18 frontend (no router lib — single switch in App.jsx).
│   ├── main.jsx                   Mounts AppRoot.
│   ├── App.jsx                    AppRoot (auth gate: checking / loading / landing / auth / onboarding / app). Main App: Sidebar + TopBar + ScreenRouter. ToastProvider + ModalProvider contexts.
│   ├── api.js                     Single API client. localStorage JWT. Methods per resource.
│   ├── components/                Icons, Markdown (with [N] citation rendering), UI primitives (Btn, Card, StatCard, ProgressBar, Ring, MiniBars, Tag, Avatar, AgentChip, PageScroll, SectionHead).
│   ├── data/data.js               Static seed/demo data — much of it STILL imported by live screens. THE PRIMARY DE-FAKE TARGET.
│   ├── screens/
│   │   ├── Landing.jsx            Marketing page (acceptable to be static — but kill hardcoded "28.4k").
│   │   ├── Auth.jsx               Login / Register.
│   │   ├── Onboarding.jsx         3-step intake → POST /api/ai/intake → POST /api/ai/roadmaps/generate (async job).
│   │   ├── Dashboard.jsx          Stats, roadmaps, sessions, activity, agent-activity strip.
│   │   ├── Roadmap.jsx            Graph view of nodes + edges, node detail panel, "create new roadmap" goal flow.
│   │   ├── Session.jsx            Tutor chat + outline + concepts + signals + whiteboard + notes + code. THE STATIC-FALLBACK HOTSPOT.
│   │   ├── Courses.jsx            Browse / Enrolled / Starred tabs, search, filters, course detail, create from roadmap.
│   │   └── Extras.jsx             Schedule, Assignments (+AssignmentWorkModal), Flashcards, Certificates, Community, Feed, Starred, Settings, AgentsPage. 1831 lines — split when touching.
│   └── styles/theme.css           Design tokens, dark theme.
│
├── uploads/                       Static-served at /uploads/*. User-uploaded images.
├── logs/                          Server log file.
├── dist/                          Vite build output.
└── docs/, .planning/              Specs, roadmap, status, backlog. Living docs; trust SPEC.md > STATUS.md > BACKLOG.md.
```

Data flow:
- **Auth**: browser stores JWT in `localStorage` (`learnos_token`). Every `/api/*` except `/api/auth/*` requires `Authorization: Bearer <jwt>` via `requireAuth` middleware.
- **AI**: every agent call routes through `ai/llm.js::complete()`. Key resolution: BYOK from `api_keys` (decrypted) > managed `LEARNOS_ANTHROPIC_KEY`/`ANTHROPIC_API_KEY` env > NO_KEY error. Model routing: `agent_routing` row per (user, agent_code) > `LEARNOS_DEFAULT_MODEL` env > `claude-haiku-4-5`.
- **Async jobs**: Long agent operations (roadmap generation, resource verification, grading) enqueue into `agent_jobs`, return `jobId` immediately, the frontend polls `GET /api/jobs/:id` until `status === 'done' | 'failed'`. Jobs resume on server boot.
- **Cascade**: `routes/sessions.js` completion endpoint computes node mastery → updates roadmap → awards XP → triggers AN.analyze → triggers AN.checkAndReplan → may issue certificate via CE.

---

## 5. Core Workflows That Must Work

These are the workflows that define LearnOS. **If any of these fails on a fresh account, the product is not shippable.**

1. **Sign up → email verify → first login.**
2. **Onboarding intake → personalized roadmap generated and rendered.**
3. **Open a node → see verified resources + AI outline.**
4. **Start session for a node → tutor responds grounded in that node's resources, with citations.**
5. **Generate a quiz/assignment for a node → submit text/code → AS grades it → mastery updates → feedback shown.**
6. **Failing assessment triggers AN re-plan → remediation node visibly inserted in roadmap.**
7. **Passing assessment unlocks next node.**
8. **Reach mastery threshold across roadmap → CE issues certificate → certificate appears in /certificates.**
9. **Browse course catalog → enroll → roadmap instantiated for the user.**
10. **Fork a course → edit → publish back as new version.**
11. **Post a community thread referencing a course → another user replies → vote → "mark solved."**
12. **Configure BYOK Anthropic key → set per-agent model in Settings → next agent call uses that model (logged in `agent_runs`).**
13. **Hit managed-key usage cap → graceful "upgrade to BYOK" error, not silent overspend.**
14. **Password reset round-trip via email.**

---

## 6. Issue Inventory

Severity: **P0** = blocks core loop or causes user-visible failure on first run. **P1** = ships broken or insecure. **P2** = visibly fake / incomplete. **P3** = polish, dev-ex, docs.

| ID | Sev | Area | File(s) | Current Problem | Required Fix | Acceptance Criteria |
|---|---|---|---|---|---|---|
| F-01 | P0 | Session UI | `src/screens/Session.jsx` 56,71,72,254–266,316–321,458 | When no active session row exists, the screen renders `SESSION.title` ("Bias–Variance Tradeoff"), `SESSION.subtitle`, `SESSION.course`, `SESSION.level`, and `QUIZ`. New users see a stale ML topic. | Remove all imports of `SESSION` and `QUIZ` from `Session.jsx`. If no session is active, render an empty state with a CTA "Pick a roadmap node to start a session" linking to `/roadmaps`. Quiz card must use real `m.quiz`; if absent, render nothing. | Brand-new account, navigate directly to Sessions tab → empty state, no "Bias–Variance" anywhere. |
| F-02 | P0 | Onboarding | `src/screens/Onboarding.jsx:41–55` | Hardcoded 60×1s poll loop, then "Generation timed out". On failure user is left without a roadmap. | Increase poll budget OR make polling indefinite with a cancel button. On failure: do NOT set `onboarded_at`; leave the user on the intake screen with retry. On NO_KEY: fall back to the template roadmap (CR already supports this — surface a banner "We used an offline template — add an API key for AI-generated"). | Onboard with no Anthropic key → roadmap created via template, marked as such, user lands on Roadmap screen. |
| B-01 | P0 | AS grading wiring | `src/screens/Extras.jsx` AssignmentWorkModal, `ai/agents/assessment.js`, `routes/ai.js` | `gradeSubmission` exists server-side but the AssignmentWorkModal still updates status locally with a fake grade. | Add `POST /api/ai/assignments/:id/grade` (or wire the existing `grade-assignment` job). AssignmentWorkModal: on submit → call grade endpoint → poll job → show real `score`, `rubricScores`, `feedback`. Persist to `assignment_submissions`. Award XP via the cascade. | Submit a free-text answer → see a real per-rubric grade and feedback. Refresh → grade persists. `agent_runs` shows an AS entry. |
| B-02 | P0 | AN re-plan visibility | `ai/agents/analytics.js`, `src/screens/Roadmap.jsx` | `checkAndReplan` inserts remediation nodes but Roadmap screen doesn't refetch; user must hard-reload. | After grade-job completion, Frontend calls `API.getRoadmap(activeId)` and re-renders. Add a toast "Curriculum agent inserted a remediation node: X". | Submit a deliberately-bad answer → within 10s the roadmap shows a new node with a "remediation" badge between the failed node and the next. |
| B-03 | P0 | Email transport | `routes/email.js`, `routes/auth.js` | When `RESEND_API_KEY` is unset, `sendEmail` returns silently. Users who hit "Forgot password" get 200 OK but no email. | Either (a) require `RESEND_API_KEY` at boot and refuse to start if password reset is enabled, or (b) gate the routes behind a feature flag and return 503 with a clear message when transport is unconfigured. Document the env var in `.env.example`. Add a dev-mode fallback that writes the reset link to `logs/` instead of silently dropping. | With key set → real email received. Without key in prod mode → endpoint returns 503 "Email not configured". In dev mode → reset URL logged. |
| F-03 | P0 | Static `USER` leakage | `src/data/data.js:3`, every `import { USER }` | `USER` is mutated via `hydrate(user)` in `App.jsx:198` but is still imported as a module-level singleton, so logout/login of a different user leaves stale state across screens that read it directly. | Replace `USER` with a `UserContext` provider populated from `/api/auth/me`. Refactor every `import { USER }` (Dashboard, Session, App.jsx, ProgressPopup) to consume the context. Delete the `USER` export from `data.js`. | Log out as Alex, log in as a new user → all screens show the new user's name, level, XP. No cross-user data bleed. |
| F-04 | P0 | Static dashboard widgets | `src/screens/Dashboard.jsx:109,111` (`STREAK_BARS`), `LearningProgressCard` | `STREAK_BARS` is a hardcoded 12-element array used for the mini-bars on Streak + Sessions stat cards. | Add `GET /api/stats/daily?window=14` returning `[{date, xp_earned, sessions_completed}]` from `activity_log` aggregated by day. Replace `STREAK_BARS` with this data. | Mini-bars on Dashboard reflect the last 14 days of real activity. Empty days show empty bars. New user → all empty. |
| F-05 | P0 | Landing static stats | `src/screens/Landing.jsx:822` | Hardcoded "28.4k" GitHub stars chip. | Either remove the chip entirely or fetch live count via `GET https://api.github.com/repos/<owner>/<repo>` and cache it server-side (`/api/info/github-stars`). Recommend remove. | No hardcoded vanity metrics anywhere in `src/`. |
| F-06 | P0 | Courses static seams | `src/screens/Courses.jsx`, `src/data/data.js:174,186,194` | `COURSE_FEATURED`, `TOP_CONTRIBUTORS`, `COURSE_VERSIONS` still referenced; syllabus fallback uses 5 fixed strings when `course_modules` empty. | Add `GET /api/courses/featured` (top by stars/learners in last 30d), `GET /api/community/leaderboard?scope=contributors`, `GET /api/courses/:slug/versions` (from `course_versions` table — create if missing). Course detail must render from `course_modules` + `module_lessons`. Delete static fallbacks. | Course detail of a course with no modules shows an empty state, not 5 fake module names. Featured strip reflects real data. |
| F-07 | P0 | Schedule reminders no-op | `src/App.jsx:166–185` | `dest` is computed but the toast is non-clickable, so reminders don't actually navigate. | Make the toast action button (`Start now →`). On click → `setScreen(dest)` and prefill the session/assignment/review for the linked entity. | Schedule an event 1 minute out → 60s later a clickable toast → clicking opens the right screen for that entity. |
| W-01 | P1 | Whole-app responsive | `src/App.jsx:289` plus every screen using fixed pixel layouts | `minWidth: 1280` + sidebar fixed widths. Mobile shows horizontal scrollbar. | Introduce two breakpoints: `≤768` mobile (sidebar → bottom tab bar, collapsed sections, single-column grids), `≤1024` tablet (sidebar overlay). Replace fixed `minWidth: 1280` and `min-width: 1280px - sidebar` with responsive grids. Add a viewport meta in `index.html` (verify present). Use container queries or media queries — pick one and apply consistently. | On a 375×667 viewport, every screen renders without horizontal scroll. Sidebar is a hamburger / bottom tabs. |
| S-01 | P1 | JWT secret default | `middleware/auth.js` | Default secret falls back when env unset. | Refuse to boot if `LEARNOS_JWT_SECRET` is unset in production (`NODE_ENV === 'production'`). In dev, generate per-boot random secret + warn. Add to `.env.example`. | `NODE_ENV=production node server.js` with no secret → process exits with clear error. |
| S-02 | P1 | No rate limiting | `server.js`, `routes/auth.js`, `routes/ai.js` | Login can be brute-forced; AI endpoints can be drained. | Add `express-rate-limit`. `/api/auth/login` and `/api/auth/forgot`: 5 req / 15 min / IP. `/api/ai/*` and `/api/uploads`: 30 req / 1 min / user. Return 429 with `Retry-After`. | Hammering login → 429 after 5 attempts. Hammering chat → 429 after 30. |
| S-03 | P1 | AI usage caps not enforced | `ai/llm.js`, `usage_counters` table | `bumpUsage` writes but `complete()` never checks a ceiling. | Before each `complete()` call, read `usage_counters` for the current month for managed-key users. If `tokens > MANAGED_MONTHLY_TOKEN_CAP` (env, default 500k) or `cost_usd > CAP`, throw a typed `USAGE_CAP_EXCEEDED` error. Frontend catches and renders "Add your own Anthropic key in Settings → API Keys to continue". BYOK users bypass the cap. | Set cap to 100 tokens, run a chat → second call returns 402 with cap message. After user saves a BYOK key, calls succeed. |
| S-04 | P1 | CORS wide open | `server.js:46–50` | `Access-Control-Allow-Origin: *` allows any site. | Restrict to `process.env.APP_URL` (single origin). Allow same-origin in production. Drop the `*` entirely. | Cross-origin XHR from a non-listed origin is blocked by browser. |
| S-05 | P1 | XSS attack surface on JWT | `src/api.js:3`, `src/main.jsx` | JWT in `localStorage` is readable by any injected script. | Move to `HttpOnly; Secure; SameSite=Lax` cookie. Server reads token from cookie. CSRF: use `SameSite=Lax` (acceptable for SPA same-origin) or add a CSRF double-submit token if any cross-origin POST is needed. | `document.cookie` does not contain the JWT in browser console after login. Auth still works through page refresh. |
| S-06 | P1 | No CSP / helmet | `server.js` | No security headers. | Add `helmet()` with a CSP allowing `'self'`, `data:` images, `https://api.anthropic.com` etc. (verify which third-party origins SPA contacts — currently none). | Browser security headers include CSP, X-Frame-Options, X-Content-Type-Options. |
| T-01 | P1 | Zero tests | repo-wide | No unit/integration/E2E. | Add Vitest. Unit-test: `ai/llm.js` key resolution, `ai/crypto.js` round-trip, `db/database.js` awardXP/updateStreak, `middleware/auth.js`. Add Supertest integration tests against an in-memory SQLite for `/api/auth/*`, `/api/roadmaps`, `/api/sessions`, `/api/ai/chat` (with mocked Anthropic SDK). Add Playwright E2E for the core workflows §5.1–§5.8. | `npm test` runs and >70% line coverage on `routes/`, `ai/`, `db/`. `npm run e2e` runs Playwright and passes the 8 critical-path scenarios. |
| T-02 | P2 | No CI | `.github/workflows/` (absent) | Manual builds only. | Add GH Actions: install → typecheck (introduce JSDoc or migrate to TS later) → lint → `npm test` → `npm run e2e` → `npm run build`. Run on PR + main. | A red PR cannot merge to main. |
| F-08 | P2 | Whiteboard not persisted on frontend | `src/screens/Session.jsx` WhiteboardView | Strokes endpoints exist (GET/POST/DELETE in `routes/sessions.js`) but the React canvas only holds local state. | On session mount → fetch existing strokes → re-draw. On stroke end → POST batch. On "Clear" → DELETE all for session. Debounce POSTs (250 ms batching). | Draw, refresh session → strokes persist. Clear → strokes gone. |
| F-09 | P2 | Manual roadmap node CRUD has no UI | `routes/roadmaps.js`, `src/screens/Roadmap.jsx` | `POST /api/roadmaps/:id/nodes` and `DELETE` exist; no UI. | Add "Add node" button in Roadmap toolbar → modal (title, objectives, prereq). Add "Delete" in node detail panel (confirm). Re-fetch on success. | Add node → appears in graph. Delete → confirms then disappears + edges cleaned. |
| F-10 | P2 | Profile customization | `routes/profile.js`, `src/screens/Extras.jsx` Settings | `users.bio`, `avatar_url`, `links_json` columns + endpoints exist; no UI. | Add "Profile" tab in Settings. Fields: name, bio (textarea), avatar (upload via `/api/uploads`), links (array of `{label, url}` rows). PATCH `/api/profile`. Render avatar in TopBar and community member rows. | Save avatar/bio/links → visible immediately in TopBar and community thread headers. |
| F-11 | P2 | Course modules render fake syllabus | `src/screens/Courses.jsx`, `routes/courses.js` | `course_modules` / `module_lessons` exist; UI still renders 5 fixed module names when empty. | Course detail: render `GET /api/courses/:slug/modules` → list with lessons. Empty state if none. For authors: "Add module" / "Add lesson" inline editor. | Verified course with modules renders real syllabus. Empty course renders "No modules yet — be the first to contribute." |
| F-12 | P2 | Static `DISCUSSIONS`, `LEADERBOARD`, `FEED`, `CERTIFICATES`, `BADGES`, `ASSIGNMENTS`, `FLASHCARDS`, `SCHEDULE_DAYS` exports from `data.js` | `src/data/data.js`, importers | Several screens may still reference them as fallback when API returns empty. | Audit every `import { X } from '../data/data'` (`grep -rn "from '../data/data'" src/`). For every import: replace with a fetch + empty state. Then delete the export. Final `data.js` should contain only `AGENTS` (display metadata) and styling constants. | `git grep "from '.*data/data'"` shows only `AGENTS` imports. |
| S-07 | P2 | SSRF on user-supplied URLs | `routes/courses.js` (thumbnail_url), `routes/community.js` (image_url, ref_*) | The DNS+IP allowlist used in `verifyResource` (`isPublicUrl`) is not applied to user-typed URLs that land in DB and render as `<img src>`. | Centralize `isPublicUrl` in `ai/crypto.js` (or a new `lib/url.js`). Apply on every endpoint that accepts a URL from a user. Reject private IPs, link-local, localhost, internal hostnames. Limit content-type for image_url to `image/*`. | Submit `http://169.254.169.254/...` as thumbnail → 400. Submit `http://localhost:3001/...` → 400. |
| S-08 | P2 | Uploads do not virus/content-scan | `routes/uploads.js` | Multer accepts by `file.mimetype` (client-asserted) + extension; no magic-byte check. | Use `file-type` package to validate the first bytes match the claimed mime. Reject SVG (XSS vector via inline script) — already not in allowlist, keep it that way. Enforce 5 MB limit (already done). Add per-user upload quota (10/day default). | Renaming a JS file to `.png` and uploading → 400. |
| F-13 | P2 | `AgentsPage` may render stale routing | `src/screens/Extras.jsx` AgentsPage | "Routing" button opens Settings → Agents per Round 2 fix; verify the actual agent_runs grouping and idle states. | Confirm per-agent counts/cost match `/api/ai/runs?group_by=agent_code&since=24h`. Add a "Run a sample call" button per agent for diagnostics (admin only). | Each agent card shows real 24h run count, total tokens, avg latency. |
| O-01 | P2 | No structured logging | `middleware/logger.js`, `server.js` | `console.log` only. No request IDs, no JSON. | Use `pino` with `pino-http`. Generate request ID per request (`req.id`). Attach `userId` once auth resolves. Log to stdout JSON. Errors → `pino.error` with stack. | `npm start | jq` works. Each log line has `level, time, reqId, userId?, msg`. |
| O-02 | P2 | No error tracking | n/a | Production errors disappear. | Wire Sentry (or self-hosted GlitchTip). Capture `errorHandler` middleware errors and unhandled promise rejections. Scrub PII (email, names) before send. | An intentional `/api/__crash` endpoint (gated to dev only) → error appears in Sentry. |
| F-14 | P3 | `PRODUCT_AUDIT.md` stale | repo root | Marked superseded but still present, confuses agents. | Move to `docs/_archive/PRODUCT_AUDIT.md` with a one-line header pointing at `docs/SPEC.md`. | `ls` at repo root no longer shows `PRODUCT_AUDIT.md`. |
| F-15 | P3 | Duplicate deploy scripts | `deploy.sh`, `deploy.local.sh` | Identical files; intent unclear. | Diff them: if identical, delete `deploy.local.sh` and document `deploy.sh` in `docs/DEPLOY.md`. If they should differ (env, host), make them differ correctly. | Exactly one canonical deploy script. README + docs explain how to run it. |
| F-16 | P3 | `Extras.jsx` is 1831 lines | `src/screens/Extras.jsx` | Hard to reason about; touches Schedule, Assignments, Flashcards, Certificates, Community, Feed, Starred, Settings, AgentsPage. | Split into one file per screen under `src/screens/extras/`. Don't refactor logic — purely move. Keep named exports stable. | Each extracted file < 500 lines, all imports still resolve. |
| F-17 | P3 | No accessibility audit | repo-wide | No `aria-*`, no keyboard focus management on modals, no skip-link. | Run axe on every screen. Fix: dialog focus traps in `ModalProvider`, aria-labels on icon buttons, keyboard nav for sidebar, focus-visible styles. Target WCAG 2.1 AA. | axe-core CLI returns zero serious violations on each screen. |
| F-18 | P3 | Bundle size 447 KB | `dist/assets/index-*.js` | Single chunk. | Split routes via `React.lazy` per screen. Move Markdown renderer to lazy load. Target initial JS < 200 KB gz. | Lighthouse "First Load JS" < 200 KB gzipped. |

---

## 7. Detailed Implementation Tasks

The format below is the contract for every task. Treat the listed acceptance criteria as a strict checklist — do not check the box until the test passes on a fresh `learnos.db` (delete the file and let migrations re-run).

### Task F-01 — Remove static `SESSION`/`QUIZ` fallback from Session screen

- **Severity**: P0
- **Files**: `src/screens/Session.jsx` (lines 4, 56–72, 130–245 fallback path, 254–266, 316–321, 458), `src/data/data.js` (delete `SESSION`, `QUIZ`, `SEED_MESSAGES` exports after import sites updated)
- **Current behavior**: When `session` state is null (no API session, or API failure) the screen renders `SESSION.title` = "Bias–Variance Tradeoff", etc. Quiz card defaults to `QUIZ` (a hardcoded ML question).
- **Desired behavior**:
  - If no `?sessionId` in URL and no localStorage handoff and no most-recent active session in API → render empty state: "No active session. Pick a roadmap node to start." Button → `/roadmaps`.
  - If session-load API call fails → toast + same empty state (do not invent a session client-side).
  - QuizCard renders only when `m.kind === 'quiz' && m.quiz`. Never substitute `QUIZ`.
  - Outline / concepts / signals in the right rail come from session metadata (`session.outline_json`, `session.concepts_json`) or from `/api/ai/session/:id/outline` (new endpoint, see API Contract Fixes §8). If missing → "Outline will populate as you progress."
- **Implementation**:
  1. Remove `SESSION, QUIZ` from the import on line 4.
  2. Refactor `Session.jsx:50–80` initial-load to: `await API.getMostRecentActiveSession()` (new — returns 200 with session or 404). On 404 → set `session = null`. On error → toast and `session = null`.
  3. Replace `session?.title || SESSION.title` chains with `session?.title || ''` and gate the whole layout on `if (!session) return <EmptyState .../>;`.
  4. Delete the `SESSION` and `QUIZ` exports from `data.js`. Run `grep -rn "from '../data/data'" src/` and assert no other importer references them.
- **API/DB changes**: Add `GET /api/sessions/active?recent=true` → most-recent `status='active'` session for the user or 404.
- **Edge cases**: User has a session in localStorage handoff but it was deleted on the server → 404 → clear handoff and show empty state.
- **Acceptance criteria**:
  - Delete `db/learnos.db*`, restart server, register a brand-new account, log in, navigate to Sessions → see empty state. The strings "Bias–Variance", "Cross-validation", "Underfitting" do not appear anywhere on screen (use browser devtools "find in page").
  - Open an existing session for a node titled "Vectors and spaces" → outline and quiz cards reference vectors, never bias–variance.
- **Tests to run**: Vitest snapshot of `<Session>` with `session=null`, E2E Playwright `e2e/session-empty.spec.ts`.

### Task F-02 — Robust onboarding with offline fallback

- **Severity**: P0
- **Files**: `src/screens/Onboarding.jsx:41–55`, `ai/agents/curriculum.js` (already supports `templateSpec`)
- **Current**: 60×1s poll. On timeout throws "Generation timed out". On NO_KEY the backend already falls back to template — surface this clearly.
- **Desired**:
  - Poll up to 5 minutes with exponential backoff (1s, 2s, 3s, 5s, 5s, …).
  - Render a determinate spinner with the agent currently running ("CR is designing your roadmap…").
  - If job returns `source: 'template'`, set a flag and pass it to the next screen; show banner: "We used an offline template — add your Anthropic key in Settings → API Keys to enable AI-generated roadmaps."
  - On failure: do NOT set `onboarded_at`. Stay on the intake screen, show error inline, "Retry" button.
- **Implementation**:
  1. Move polling to a util `pollJob(jobId, {timeoutMs: 300000, onProgress})` in `src/api.js`.
  2. In `handleSubmit`, only `patchUserSettings({onboarded_at})` AFTER successful generation.
  3. Pass `source` to `onComplete(roadmapId, {source})` and surface a toast in `App.jsx`.
- **Acceptance**:
  - With no `ANTHROPIC_API_KEY` env and no BYOK → onboarding finishes in <10s with template roadmap and banner.
  - With key → onboarding finishes in <60s with `source='ai'`.
  - Kill the server mid-generation → user sees error + Retry, `onboarded_at` is null in DB.

### Task B-01 — Wire AS grading

- **Severity**: P0
- **Files**: `ai/agents/assessment.js` (verify `gradeSubmission` is registered as job handler), `routes/ai.js` (add endpoint), `routes/assignments.js`, `src/screens/Extras.jsx` AssignmentWorkModal, `src/api.js`
- **Current**: Submit updates `status='graded'` and stores a heuristic pct. No call to the AS agent.
- **Desired**:
  - `POST /api/ai/assignments/:id/grade` body `{ submission: string, language?: string }` → enqueues `grade-assignment` job → returns `{ jobId }`.
  - Job calls `gradeSubmission({userId, assignmentId, submission})`. Persists to `assignment_submissions` (table per Round 4 §3.5). Updates assignment `grade`, `feedback`, `status='graded'`. Awards XP based on score.
  - Modal: textarea + Submit → POST → poll job → render result: overall score (0–100), rubric breakdown (objective → score + evidence), feedback (markdown), "View in roadmap" CTA if mastery changed.
- **API contract**:
  ```
  POST /api/ai/assignments/:id/grade
  Body: { submission: string }                  // ≤ 32 KB
  Resp: 202 { jobId: string }
  Errors: 400 (empty/oversize), 404 (assignment not found / not owner), 429 (rate-limit), 402 (usage cap), 401
  ```
  ```
  GET /api/jobs/:id  // existing
  Resp: { id, status: 'queued'|'running'|'done'|'failed', result?, error? }
  result on done: {
    grade: number,                 // 0–100
    rubric: [{ objective: string, score: number, evidence: string }],
    feedback_md: string,
    mastery_delta: number          // applied to roadmap_nodes
  }
  ```
- **DB**: `assignment_submissions` (id, assignment_id, user_id, body, grade, rubric_json, feedback_md, graded_at) — confirm exists in schema; if not, add migration.
- **Acceptance**:
  - Submit a thoughtful answer to an assignment → within 30s see rubric + feedback. `assignment_runs` shows an AS row. XP awarded.
  - Submit gibberish → low grade, weak-area objectives flagged, AN triggers re-plan (see B-02).
  - Refresh → grade and feedback persist.

### Task B-02 — Show AN re-plan in roadmap UI

- **Severity**: P0
- **Files**: `ai/agents/analytics.js` checkAndReplan, `src/screens/Roadmap.jsx`, `src/api.js`
- **Current**: AN can insert remediation nodes via CR.replanNode but the React Roadmap holds stale graph.
- **Desired**:
  - Grading-job result includes `replanned: boolean, inserted_node_ids: string[]`.
  - On job completion, frontend invalidates roadmap cache and refetches. Inserted nodes are highlighted (pulse + "Suggested by AN" badge).
  - Toast: "Curriculum agent inserted N remediation node(s) based on your last assignment." Click → scroll to first inserted node.
- **Implementation**:
  1. Modify `checkAndReplan` to return inserted node ids.
  2. Plumb through job result.
  3. Frontend: after job done, `setRoadmaps(await API.getRoadmaps())` and `setActiveRoadmap(await API.getRoadmap(id))`.
- **Acceptance**: Submit a poor answer → within 60s new node visible in roadmap graph with "Suggested by AN" tag.

### Task B-03 — Email transport

- **Severity**: P0
- **Files**: `routes/email.js`, `routes/auth.js`, `.env.example`, `server.js` boot check
- **Current**: Silent no-op on missing key. Reset endpoint returns 200 OK regardless.
- **Desired**:
  - At boot, if `NODE_ENV=production` and `RESEND_API_KEY` missing → log error and refuse to mount `/api/auth/forgot` + `/api/auth/verify`. Return 503 from those routes with `{error:'EMAIL_NOT_CONFIGURED'}`.
  - In dev (`NODE_ENV !== 'production'`), log the email body and the reset/verify URL to `logs/email.log` with timestamp.
  - When key is present: send via Resend. Log success/failure.
- **Acceptance**:
  - `npm start` with key → real email lands.
  - `npm start` in dev without key → `logs/email.log` shows the link.
  - `NODE_ENV=production npm start` without key + hit `/api/auth/forgot` → 503.

### Task F-03 — UserContext

- **Severity**: P0
- **Files**: `src/data/data.js`, `src/App.jsx`, every screen using `USER`
- **Current**: Module-level mutable singleton.
- **Desired**: Replace with `UserContext` provider, populated from `/api/auth/me` after login, cleared on logout. Hook: `const user = useUser()`.
- **Implementation**:
  1. Create `src/UserContext.jsx`.
  2. Wrap `<App>` in `<UserProvider>` inside `AppRoot`.
  3. `grep -rn "import.*USER.*from.*data/data" src/` → replace each with `useUser()`.
  4. Delete `USER` from `data.js`.
- **Acceptance**: Logout / login as different user → all screens reflect new user. `git grep "USER"` in `src/` returns no module-import hits.

### Task F-04 — Real daily activity for stat cards

- **Severity**: P0
- **Files**: `routes/activity.js` (or new `routes/stats.js`), `src/screens/Dashboard.jsx`
- **API**: `GET /api/stats/daily?window=14` → `[{ date: 'YYYY-MM-DD', xp: number, sessions: number }]` filling all 14 days (including zeros).
- **Frontend**: Replace `STREAK_BARS` with state populated from this endpoint.
- **Acceptance**: New account → all bars empty. Complete a session → that day's bar non-zero.

### Task W-01 — Responsive layout

- **Severity**: P1
- **Files**: `src/App.jsx`, all screens, `src/styles/theme.css`
- **Approach**:
  - Add breakpoints CSS vars: `--bp-sm: 640px`, `--bp-md: 1024px`.
  - Mobile (≤640): bottom tab bar (5 most-used: Dashboard, Roadmaps, Session, Assignments, Settings). Sidebar groups become a "More" sheet.
  - Tablet (641–1024): collapsible sidebar default.
  - Desktop (>1024): current layout.
  - Replace all `minWidth: 1280`. Use CSS grids that collapse to single column on small screens.
  - Sessions chat: stack columns vertically on mobile (chat above, outline drawer).
- **Acceptance**: 375×667, 768×1024, 1440×900 viewports all render every screen without horizontal scroll and remain usable.

### Tasks S-01..S-08, T-01..T-02, O-01..O-02, F-05..F-18

Use the row in the §6 issue inventory as the task spec. For each, follow the format:
- locate file(s) in the row,
- implement the fix as described,
- meet the listed acceptance criteria,
- add the corresponding test from §12.

---

## 8. API Contract Fixes

New / changed endpoints. All require `Authorization: Bearer <jwt>` unless noted.

### New

```
GET  /api/stats/daily?window=14
  → 200 [{ date: 'YYYY-MM-DD', xp: int, sessions: int, assignments_graded: int }]

GET  /api/sessions/active?recent=true
  → 200 { id, title, ... } | 404 { error: 'NO_ACTIVE_SESSION' }

POST /api/ai/assignments/:id/grade
  Body: { submission: string (≤ 32_768 chars) }
  → 202 { jobId }
  Errors: 400, 401, 402 USAGE_CAP_EXCEEDED, 404, 413, 429

GET  /api/ai/session/:id/outline
  → 200 { items: [{ label, state: 'done'|'active'|'queued' }] }

GET  /api/courses/featured
  → 200 [{ slug, title, author, learners_30d, rating }]

GET  /api/courses/:slug/versions
  → 200 [{ version, label?, when, notes: string[] }]

GET  /api/courses/:slug/modules
  → 200 [{ id, title, order_idx, lessons: [{ id, title, body_md, est_minutes }] }]

GET  /api/community/leaderboard?scope=contributors&window=30d
  → 200 [{ user_id, name, contributions: int }]

GET  /api/info/github-stars     (optional — only if keeping the chip)
  → 200 { count: int, cached_at: iso }
```

### Changed

```
POST /api/auth/forgot     — now 503 EMAIL_NOT_CONFIGURED when transport missing in prod
POST /api/auth/verify     — same
POST /api/ai/chat         — enforces usage cap → 402 USAGE_CAP_EXCEEDED
POST /api/uploads         — rejects on magic-byte mismatch
PATCH /api/profile        — accepts { bio, avatar_url, links: [{label,url}] }
POST /api/community/threads — validates image_url and ref_* via isPublicUrl
POST /api/courses         — validates thumbnail_url via isPublicUrl
```

### Error envelope (standardize)

All error responses:
```json
{ "error": true, "code": "MACHINE_CODE", "message": "Human readable", "details": {} }
```
Frontend `api.js` reads `data.code` for branching, falls back to `data.message`.

---

## 9. Database / Schema Fixes

Confirm presence in `db/schema.sql`; add migrations in `db/database.js::runMigrations()` for any missing.

Verify these tables and columns exist (referenced by Round 4 work):

- `user_profiles (user_id PK, goal, background, level, time_per_week, learning_style, motivations_json, updated_at)`
- `user_settings.onboarded_at TEXT`
- `users.bio TEXT`, `users.avatar_url TEXT`, `users.links_json TEXT`
- `courses.thumbnail_url TEXT`, `verified_by TEXT`, `verified_at TEXT`
- `course_modules (id, course_slug, title, order_idx)`
- `module_lessons (id, module_id, title, body_md, est_minutes, order_idx)`
- `course_versions (course_slug, version, label, notes_json, created_at)` — **add if missing**
- `enrollment_progress (user_id, course_slug, module_id, completed_at)`
- `node_resources (id, node_id, kind, title, url, source, status, why)` + status enum
- `assignment_submissions (id, assignment_id, user_id, body, grade, rubric_json, feedback_md, graded_at)`
- `whiteboard_strokes (id, session_id, user_id, stroke_json, created_at)`
- `email_verifications (token PK, user_id, expires_at)`
- `password_resets (token PK, user_id, expires_at, used_at)`
- `agent_runs (id, user_id, agent_code, model, status, input_tokens, output_tokens, cost_usd, latency_ms, error, created_at)`
- `usage_counters (user_id, period, tokens, cost_usd, requests)`
- `agent_jobs (id, user_id, kind, payload_json, status, result_json, error, created_at, updated_at)`

Required indexes (verify and add if missing):
- `activity_log (user_id, created_at DESC)`
- `agent_runs (user_id, agent_code, created_at DESC)`
- `sessions (user_id, status, updated_at DESC)`
- `roadmap_nodes (roadmap_id, status)`

Migrations must be idempotent (`IF NOT EXISTS` / safe `ALTER TABLE ADD COLUMN`). Never drop columns. Test migrations on a copy of `learnos.db` before merging.

Seed cleanup: `db/seed.sql` should remain demo-only, gated by `LEARNOS_SEED=1`. Never auto-seed in production.

---

## 10. Frontend Fixes (page-level)

### `src/screens/Session.jsx`
- Kill `SESSION`/`QUIZ` imports (F-01).
- Wire whiteboard persistence (F-08).
- Implement loading / empty / error states (no fallback content).
- Session right rail: outline/concepts/signals fed from API (`/api/ai/session/:id/outline`).

### `src/screens/Dashboard.jsx`
- Replace `STREAK_BARS` with `/api/stats/daily` (F-04).
- `AgentActivityStrip`: confirm uses real `/api/ai/runs` (already partially done — verify all 7 agent codes show, not just 5).
- `LearningProgressCard`: derive curve from real daily XP.

### `src/screens/Landing.jsx`
- Remove "28.4k" GitHub chip or wire to live count (F-05).
- `LEARNING_PROGRESS` here is acceptable (marketing illustration), but rename the constant `MARKETING_CHART_DATA` so future agents know it is decorative.

### `src/screens/Courses.jsx`
- Course detail must render from `course_modules`/`module_lessons` (F-11).
- Featured strip from `/api/courses/featured` (F-06).
- Top contributors from `/api/community/leaderboard?scope=contributors` (F-06).
- Course versions from `/api/courses/:slug/versions` (F-06).
- Validate thumbnail URLs client-side and server-side (S-07).

### `src/screens/Roadmap.jsx`
- Add manual node add/delete UI (F-09).
- Re-fetch after grading job (B-02).
- Highlight "Suggested by AN" nodes.

### `src/screens/Extras.jsx`
- Split file (F-16).
- AssignmentWorkModal: wire to real grading (B-01).
- Settings: add Profile tab (F-10), add Usage card showing managed-key consumption + cap, add BYOK warning when consumption > 80%.
- AgentsPage: surface real 7-agent activity (verify).

### `src/screens/Onboarding.jsx`
- Robust polling + retry (F-02).
- Template fallback banner.

### `src/App.jsx`
- Schedule reminder toast → clickable deep-link (F-07).
- Responsive layout (W-01).
- `UserContext` provider (F-03).
- Drop hardcoded `minWidth: 1280`.

---

## 11. End-to-End Workflow Fixes

For each workflow, the format from the prompt:

### Workflow: Onboard → Roadmap → First Session
**Intended user goal**: Sign up, answer 3 questions, see a personalized roadmap, open the first node, get tutored.
**Current behavior**: Onboarding works happy-path with API key. Fails opaquely without. Session falls back to "Bias-Variance".
**Broken / missing**: F-01, F-02, F-03.
**Required backend**: `CR.generateRoadmap` returns `source: 'ai'|'template'`. Sessions endpoint allows creating session anchored to a `roadmap_node_id`. Session resources endpoint returns node's `node_resources`.
**Required frontend**: Robust polling, template banner, session opens with node-specific topic, never SESSION constants.
**Data model**: `user_profiles`, `roadmaps`, `roadmap_nodes`, `node_objectives`, `sessions(roadmap_node_id)`.
**Edge cases**: NO_KEY, job timeout, server restart mid-job, user closes tab during generation (resume on next login).
**Acceptance**: Fresh account → onboarded in <10s (template) or <60s (AI) → click first node → session has node title + objectives.
**Test plan**: Playwright e2e/onboard-to-session.spec.ts (two variants: with key, without key).

### Workflow: Take Quiz → Get Real Grade → See Roadmap Update
**Intended goal**: Submit an assignment, get rubric-based feedback, see mastery change.
**Current**: Static grade, no roadmap update.
**Broken / missing**: B-01, B-02.
**Required backend**: `POST /api/ai/assignments/:id/grade`, job persists submission + grade + applies mastery delta + may insert remediation node.
**Required frontend**: AssignmentWorkModal submits, polls, renders rubric, links to updated roadmap.
**Data model**: `assignment_submissions`, `mastery_events`, `roadmap_nodes.mastery`, `roadmap_nodes.status`.
**Edge cases**: Long submissions, code, NO_KEY (heuristic grading fallback), partial credit.
**Acceptance**: Submit good answer → high grade, node mastery up. Submit bad answer → low grade, remediation node visible, weak objectives surfaced.
**Test plan**: Playwright e2e/grade-and-replan.spec.ts.

### Workflow: Achieve Mastery → Earn Certificate
**Intended goal**: Pass threshold across roadmap → certificate auto-issued.
**Current**: Cascade exists; verify post-grading.
**Required**: After grading job updates mastery, run CE.evaluate. If eligible, insert into `certificates` and `activity_log`.
**Acceptance**: Mock all nodes to mastery ≥ 0.8 → certificate appears in /certificates within one request cycle.

### Workflow: BYOK Key → Per-Agent Routing
**Intended goal**: Add Anthropic key, route AS to Sonnet, next assignment generation uses Sonnet.
**Current**: Keys encrypted, routing table exists; verify end-to-end.
**Acceptance**: Save key in Settings → `agent_routing` UPSERT to claude-sonnet-4-6 for AS → trigger assignment generation → `agent_runs.model = 'claude-sonnet-4-6'` and `managed = 0`.

### Workflow: Managed-Key User Hits Cap
**Required**: S-03. `complete()` enforces cap. UI surfaces upgrade prompt.
**Acceptance**: Set cap small, drive chat → second call returns 402, UI shows "Add your key" CTA linking to Settings → Keys.

### Workflow: Community Thread with Image Attachment
**Required**: SSRF guard (S-07), image hosting validated, leaderboard from real votes.
**Acceptance**: Post thread referencing course + image → renders for other users → vote count persists → leaderboard reflects vote.

### Workflow: Course Author → Publish v2
**Required**: F-11, `course_versions` table, author-only editor.
**Acceptance**: Create course → add modules/lessons → publish → other users see it in catalog with version label.

### Workflow: Password Reset Round-Trip
**Required**: B-03. SMTP transport configured.
**Acceptance**: "Forgot password" → email arrives → click link → set new password → login with new password works, JWT issued.

---

## 12. Test Plan

### Unit (Vitest)
- `ai/llm.js`: BYOK vs managed precedence; rejects fake `sk-ant-…7Z2` keys; cost calc with cache tokens.
- `ai/crypto.js`: encrypt/decrypt round trip; legacy plaintext passthrough.
- `db/database.js::awardXP`: level-up math.
- `db/database.js::updateStreak`: same-day no double, broken-streak reset, best-streak tracking.
- `middleware/auth.js`: rejects revoked tokens, expired tokens, malformed tokens; sign+verify round trip.
- `ai/agents/curriculum.js::validateSpec`: rejects empty nodes, accepts valid spec.

### Integration (Supertest + in-memory SQLite)
- `routes/auth.js`: register → 201; duplicate email → 409; weak password → 400; login wrong password → 401; logout revokes token.
- `routes/roadmaps.js`: create, get, patch, list — owner isolation (user A cannot read user B's roadmap → 404).
- `routes/sessions.js`: create session for node, post message, complete → cascade applies XP + mastery.
- `routes/ai.js`: chat with mocked Anthropic returns success + logs `agent_runs`; cap exceeded → 402.
- `routes/uploads.js`: oversize → 400; bad mime → 400; magic-byte mismatch → 400.

### E2E (Playwright)
- `e2e/onboard-with-key.spec.ts`
- `e2e/onboard-without-key.spec.ts`
- `e2e/session-empty.spec.ts` (no bias-variance leak)
- `e2e/grade-and-replan.spec.ts`
- `e2e/certificate.spec.ts`
- `e2e/byok-routing.spec.ts`
- `e2e/password-reset.spec.ts` (against mailhog or capture)
- `e2e/responsive.spec.ts` (run at 375, 768, 1440 viewports — assert no horizontal scrollbars)

### Manual QA checklist (block ship until all pass)
1. Fresh account onboarding completes (with and without env key).
2. Sessions screen has no static "Bias–Variance" anywhere on a fresh account.
3. Assignment grading shows real rubric + persists on refresh.
4. Roadmap shows remediation node within 60s of a bad submission.
5. Logout / login as different user — all screens reflect new identity.
6. Mobile (375×667) — every nav target reachable, no horizontal scroll.
7. Tablet (768×1024) — sidebar overlay works, all screens usable.
8. Hitting login 6× wrong → 429.
9. Hitting `/api/ai/chat` 31× as managed user → 429 or 402.
10. Save BYOK key → next AI call uses BYOK + chosen model (verify in `/api/ai/runs`).
11. Course detail of an empty course → empty state, no fake syllabus.
12. Password reset email arrives, link works.
13. `npm run build && node server.js` (production-like) boots without errors with all required env vars.
14. Lighthouse: Performance ≥ 80, A11y ≥ 90, Best Practices ≥ 90 on Dashboard.
15. axe-core: zero serious violations per screen.

### Browser / device coverage
- Chrome (latest), Safari (latest), Firefox (latest).
- iOS Safari (iPhone 14 simulator), Android Chrome (Pixel 6 simulator).

### Production build check
- `NODE_ENV=production LEARNOS_JWT_SECRET=$(openssl rand -hex 32) RESEND_API_KEY=... ANTHROPIC_API_KEY=... node server.js` boots clean, serves SPA from `dist/`, all API routes respond.

---

## 13. Definition of Done

The product is shippable when ALL of the following are true. A coding agent claiming completion without verifying each item is not done.

- [ ] All P0 issues from §6 closed and verified by the corresponding test in §12.
- [ ] All P1 issues from §6 closed.
- [ ] All P2 issues from §6 closed OR explicitly deferred to v1.1 with a written rationale in `docs/BACKLOG.md`.
- [ ] `git grep "SESSION\." src/screens/` returns no hits (i.e. no static SESSION usage).
- [ ] `git grep -E "import .*\{(SESSION|QUIZ|STREAK_BARS|LEARNING_PROGRESS|COURSE_FEATURED|TOP_CONTRIBUTORS|COURSE_VERSIONS|DISCUSSIONS|LEADERBOARD|FEED|CERTIFICATES|BADGES|ASSIGNMENTS|FLASHCARDS|SCHEDULE_DAYS|SEED_MESSAGES)" src/` returns no hits in screen files (only allowed in marketing `Landing.jsx` if renamed to `MARKETING_*`).
- [ ] `src/data/data.js` exports only `AGENTS` (and any pure-presentational constants explicitly justified).
- [ ] `npm test` passes; coverage ≥ 70% on `routes/`, `ai/`, `db/`.
- [ ] `npm run e2e` passes all 8 critical-path scenarios.
- [ ] Fresh-DB walkthrough (delete `db/learnos.db*`, register, onboard, complete a session with a graded assignment, earn a certificate) succeeds end-to-end without manual intervention.
- [ ] Production-mode boot refuses to start without required env (`LEARNOS_JWT_SECRET`, `RESEND_API_KEY` if reset enabled). Documented in `.env.example`.
- [ ] Mobile viewport (375×667) renders every screen without horizontal scroll.
- [ ] Rate limiting active on auth, AI, uploads.
- [ ] Usage cap enforced for managed-key users.
- [ ] JWT moved to HttpOnly cookie OR explicit decision documented to keep localStorage + mitigation noted.
- [ ] CSP / Helmet headers present; CORS restricted to `APP_URL`.
- [ ] Structured logging via pino with request IDs.
- [ ] CI pipeline runs on PR and blocks merge on failure.
- [ ] `PRODUCT_AUDIT.md` archived; `docs/SPEC.md` and `docs/STATUS.md` reflect current reality.
- [ ] `README.md` updated with: env vars, dev setup, running tests, deployment.

---

## 14. Suggested Execution Order

Execute strictly in this order. Phases are gates — do not start phase N+1 until phase N's tasks pass their acceptance criteria. Within a phase, tasks may be parallelized.

**Phase 0 — Make the app runnable & truthful (½ day)**
1. F-14 (archive PRODUCT_AUDIT.md), F-15 (deduplicate deploy scripts).
2. Add `.env.example` with every required env documented.
3. Confirm `npm install && npm run build && node server.js` boots cleanly.

**Phase 1 — Fix core product truth (2–3 days)**
1. F-03 (UserContext).
2. F-01 (kill SESSION/QUIZ leakage).
3. F-02 (robust onboarding).
4. F-04 (real daily activity).
5. F-05 (kill 28.4k chip).
6. F-06 (real featured / contributors / versions).
7. F-12 (audit all `data/data.js` imports, delete what is no longer referenced).
8. B-03 (email transport — at minimum: gate routes correctly).

**Phase 2 — Complete the AI loop (3–4 days)**
1. B-01 (AS grading wiring).
2. B-02 (AN re-plan UI refresh).
3. S-03 (usage caps).
4. Verify cascade: graded → mastery → re-plan → certificate end-to-end.

**Phase 3 — Repair remaining frontend (2–3 days)**
1. F-07 (schedule reminders clickable).
2. F-08 (whiteboard persistence).
3. F-09 (manual node CRUD UI).
4. F-10 (profile customization UI).
5. F-11 (course modules UI).
6. F-13 (AgentsPage real-data verification).
7. F-17 (a11y).

**Phase 4 — Production polish (2–3 days)**
1. W-01 (responsive).
2. F-16 (split Extras.jsx).
3. F-18 (bundle splitting).
4. Empty states / loading states / error boundaries across all screens.

**Phase 5 — Production hardening (2–3 days)**
1. S-01 (JWT secret enforcement).
2. S-02 (rate limiting).
3. S-04 (CORS).
4. S-05 (HttpOnly cookie auth).
5. S-06 (Helmet/CSP).
6. S-07 (SSRF guard).
7. S-08 (magic-byte upload check).
8. O-01 (structured logging).
9. O-02 (Sentry).
10. T-01 (unit + integration tests).
11. T-02 (CI pipeline).
12. E2E + manual QA per §12.
13. Update `docs/SPEC.md`, `docs/STATUS.md`, `README.md`.

Total estimated effort: **~13–17 dev-days**.

---

## 15. Notes for the Coding Agent

**Read before touching code:**

- The repo's `docs/STATUS.md` is the closest thing to a current source of truth, but it **overstates** completeness. A row marked 🔌 means *the backend was implemented but no UI exists yet*. A row marked ✅ may still depend on an env var that is unset by default. Verify by running, not by reading.
- `docs/SPEC.md` is the **intent**. When you must guess at desired behavior, prefer SPEC.md over your own intuition. The product is explicitly NOT "chat tutor with a dashboard around it." Do not refactor toward that.
- The `.planning/ROADMAP.md` lists phases 1–8. Phases 1 (AI platform), 4 (grounded tutor), and parts of 5 (assessment) are partially done. Phases 6 (community wire-extend), 7 (course authoring), and 8 (hardening) are mostly the same as the work in this handoff.

**Conventions in this codebase (preserve):**

- ES modules everywhere (`type: "module"`). Use `import`, not `require`.
- `better-sqlite3` synchronous API — DB calls do NOT need `await`.
- Migrations are idempotent and run on every boot. Add new migrations as new statements; never edit historical ones.
- Every agent call must go through `ai/llm.js::complete()` so it gets routing, caching, and logging. Do not call the Anthropic SDK directly from agents or routes.
- Async work returns a `jobId`; clients poll `GET /api/jobs/:id`. Do not make agent calls synchronous inside HTTP handlers — they will time out.
- React state is local-first; data flows top-down through props. No Redux, no Zustand. Adding global state machinery is over-engineering — stick to Context (`ToastProvider`, `ModalProvider`, new `UserProvider`).
- Styling is inline + CSS variables from `src/styles/theme.css`. Do not introduce Tailwind or styled-components.

**Fragile areas — handle with care:**

- `routes/sessions.js` completion cascade — the order of mastery update → AN.analyze → CR.replan → CE.evaluate matters. Don't reorder without re-running cascade tests.
- `ai/jobs.js` worker — singleton in-process. `resumeJobs()` on boot picks up `status='queued'|'running'` rows. Don't accidentally double-run jobs by reusing IDs.
- `ai/crypto.js` legacy plaintext passthrough — keep it. Removing it will break demo seed key rows.
- `middleware/auth.js` `revoked_tokens` JTI check — every authenticated request hits this table. Index `jti` and expire old rows in a cron, or token revocation becomes a perf foot-gun.
- `db/database.js::updateStreak` — already idempotent per-day. Calling it from multiple endpoints in one request is fine but pointless.

**Things NOT to do:**

- Do **not** introduce a new framework (TypeScript migration, Next.js, tRPC, Prisma). Stay on the current stack.
- Do **not** rip out the offline fallbacks in agents (`templateSpec`, heuristic grading, heuristic analysis). They are intentional — the product must remain usable without an API key.
- Do **not** delete `db/seed.sql` or the demo user. Gate it with `LEARNOS_SEED=1` instead.
- Do **not** modify schema in ways that break the existing `learnos.db`. Always `ALTER TABLE ADD COLUMN` with safe defaults; never `DROP`.
- Do **not** centralize all data fetching into a "store" / "service layer." The current per-screen `useEffect + API.x()` pattern is fine for this codebase size.
- Do **not** mark a task done in `docs/STATUS.md` without verifying on a freshly-deleted `learnos.db`.

**Assumptions made in this spec (flag if wrong):**

- The product is single-tenant per user. No org/team concept exists in the schema; do not add multi-tenancy.
- "Production" means a single-region Node + SQLite deployment for now. No need for Postgres migration, no horizontal scaling. If targeting hosting like Fly/Render, document and stop. Postgres migration is a separate v2 effort.
- Email is via Resend (per existing helper). If the user prefers SES or Postmark, swap inside `routes/email.js` only.
- Managed Anthropic key is the only LLM provider in v1. The `ai/llm.js` abstraction is intentional but not exercised; do not add OpenAI/Gemini until BYOK Anthropic + cap enforcement is rock-solid.

When in doubt, prefer the smaller, more honest implementation. The product's existing trap is exactly the opposite: surfaces look done but the data behind them is fake. Every change in this spec should either make a surface real or remove it.
