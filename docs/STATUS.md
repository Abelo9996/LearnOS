# LearnOS — Build Status (Living Tracker)

> Snapshot of **what's built vs missing**, kept current by dev agents as work lands.
> Update the Status column + date when you change something. Supersedes `../PRODUCT_AUDIT.md`.
> Legend: ✅ done & wired · 🟡 partial / cosmetic surface · 🔌 backend exists, UI not wired · ❌ missing · 🐞 has bug
>
> Last updated: 2026-06-05 (Round 4 — product completeness pass)

---

## A. Foundations (real today)

| Area | Status | Notes |
|---|---|---|
| Auth (JWT, bcrypt, register/login/logout, token revocation) | ✅ | `routes/auth.js`, `middleware/auth.js` |
| SQLite + WAL + idempotent migrations | ✅ | `db/database.js` |
| Gamification engine (XP, levels, streaks, badges) | ✅ | `awardXP`, `updateStreak` |
| Session-completion cascade (node→roadmap→cert) | ✅ | `routes/sessions.js:40-68` |
| Dashboard data (stats/roadmaps/sessions/activity) | 🟡 | live data; progress chart, streak bars, agent strip hardcoded |
| Roadmap graph/list/kanban + fork | 🟡 | renders from DB; "this week / forecast" tiles hardcoded |
| Assignments CRUD | ✅ | grading is heuristic, not AI |
| Flashcards (real SM-2 + XP) | ✅ | `routes/flashcards.js` |
| Schedule CRUD | ✅ | `routes/schedule.js` |
| Courses catalog / search / star / enroll | 🟡 | real; syllabus/versions/contributors static |
| Certificates & badges (display + auto-issue) | ✅ | issued by cascade |
| Feed / Notifications / Starred | ✅ | from `activity_log` |
| Global search (debounced, multi-entity) | ✅ | `App.jsx` |
| Settings (account/keys/routing/appearance/data) | ✅ | persists; keys NOT encrypted at rest |
| Marketing Landing | ✅ | static showcase by design |

## B. The AI agent system (the core — mostly missing)

| Agent / capability | Status | Notes |
|---|---|---|
| Model-provider abstraction (managed + BYOK, Anthropic v1) | ✅ | `ai/llm.js` `complete()` — key resolution + `agent_routing` model + run logging |
| Prompt caching | ✅ | agent system prompts cached in `complete()` |
| Usage metering / caps | 🟡 | `usage_counters` + `/api/ai/usage` live; caps (AI-6) not enforced yet |
| `agent_runs` observability | ✅ | logged per call; `GET /api/ai/runs` |
| Async job system (`agent_jobs`, `/api/jobs/:id`) | ✅ | `ai/jobs.js` in-process worker; resumes on boot |
| **PR** Profiling / onboarding intake | ❌ | no `user_profiles` |
| **CR** Curriculum — roadmap generation | ❌ | roadmaps are seeded, not generated |
| **CR** Curriculum — dynamic re-plan | ❌ | mastery never re-routes the path |
| **RE** Research — resource proposal | ✅ | `ai/agents/research.js` `proposeResources()` with structured-output schema (G2.B, 2026-06-05) |
| **RE** Research — verification pipeline | ✅ | `verifyResource()` background job: HEAD/GET reachability + content-type sanity (G2.C, 2026-06-05) |
| **TU** Tutor — grounded real LLM | ✅ | calls `complete()` via `/api/ai/chat`; offline fallback is now topic-aware (G1, 2026-06-05) |
| **AS** Assessment — generate quizzes/assignments | ✅ | `ai/agents/assessment.js`; node-aware structured-output; `/api/ai/assignments/generate` (G3, 2026-06-05) |
| **AS** Assessment — grade submissions | ❌ | grades are fake |
| **AN** Analytics — mastery + weak-spot detection | ❌ | — |
| **CE** Certification | ✅ | auto-issue via cascade (keep) |

## C. Content & courses (mostly missing)

| Area | Status | Notes |
|---|---|---|
| Node Content view (verified resources + outline) | ✅ | `node_resources` table + seeded verified resources + Resources panel in ModuleDetail (G2.A, 2026-06-05) |
| Real course modules/content (`course_modules`,`module_content`) | ❌ | syllabus = 5 fixed strings |
| Course authoring (create/edit) | ❌ | — |
| Fork → edit → publish-back + versioning | 🟡 | roadmap fork copies nodes; no course authoring/publish |
| Resource verification storage (`node_resources`) | ❌ | — |

## D. Community (backend built, UI orphaned)

| Area | Status | Notes |
|---|---|---|
| Backend: threads/replies/votes/leaderboard | ✅ | `routes/community.js` + 3 tables + seed |
| API client methods | ✅ | `api.js:124-133` |
| **Frontend Community component wired to it** | ✅ | live threads/replies/votes/leaderboard + create form |
| Attachments (images), course/roadmap references | ✅ | `image_url`+`ref_*` cols; URL-guarded; rendered in row+modal (2026-06-03) |
| Seed content authored by demo members (not the user) | ✅ | `DEMO_MEMBERS` + one-time re-attribution so leaderboard is honest (2026-06-03) |
| Feed integrated with real app activity | ✅ | `logActivity()` on session/assignment/cert/enroll/publish (2026-06-03) |
| Certificates gated to LearnOS-verified courses | ✅ | only `courses.verified=1` issues a credential; else completion record (2026-06-03) |
| "solved" marker | ❌ | — |

## E. Known bugs (latent runtime errors / no-ops) 🐞

| Bug | Location | Effect |
|---|---|---|
| ~~`setScreen` referenced but not a prop~~ **FIXED** | `Extras.jsx` AgentsPage | now passed from `App.jsx`; routing button opens Settings→Agents (2026-06-03) |
| ~~`openModal` out of scope in CertCard~~ **FIXED** | `Extras.jsx` CertCard | now uses `useModal()`; Verify button works (2026-06-03) |
| ~~Session markdown rendered as plain text~~ **FIXED** | `Session.jsx` | assistant msgs use `MarkdownText`; literal `\n` normalized (2026-06-03) |
| ~~Whiteboard cursor offset ~18px right~~ **FIXED** | `Session.jsx` WhiteboardView | DPR-aware canvas fit; 1:1 cursor mapping (2026-06-03) |
| ~~Courses page crashed (undefined `USER`/`COURSE_FEATURED`/`TOP_CONTRIBUTORS`/`ProfileModal`)~~ **FIXED** | `Courses.jsx` | rebuilt with real data + props; page renders (2026-06-03) |
| ~~`session` out of scope in ChatMessage~~ **FIXED** | `Session.jsx` | threaded `session` through `ChatColumn`; rating persists (2026-06-03) |
| ~~`navigate` CustomEvent has no listener~~ **FIXED** | `Session.jsx` RightRail | "View Assignment" now uses `setScreen` (2026-06-03) |
| ~~API keys stored unencrypted~~ **FIXED** | `ai/crypto.js` | AES-256-GCM at rest + masked on read (PLAT-04) |

## F. Round 2 — product-quality pass (2026-06-03) ✅

| # | Issue | Fix |
|---|---|---|
| 1 | Notifications counter hardcoded | already real (unread from `activity_log` vs `last_seen`) |
| 2 | Roadmaps stuck on ML Engineer | always-visible roadmap switcher (all roadmaps); backfilled nodes for `rm-data-sci`/`rm-genai` |
| 3 | Roadmap forking | removed `/fork` route + `forkRoadmap` API + cleaned `rm-fork-*` rows |
| 4 | Node detail too thin | added prerequisites + Research-agent resources section |
| 5,6 | Resume/Start opened static bias-variance | `openNodeSession` reuses/creates the node's own session (seeded greeting) + localStorage handoff so Session opens THAT one |
| 7 | End session "useless" | real completion cascade + local summary message + clear toast |
| 10 | "View Assignment" no-op | navigates to Assignments via `setScreen` |
| 11,15,16 | Assignments shallow/fake | `kind/description/tasks` columns; `ASSIGNMENT_LIBRARY` (coding/project/homework/quiz); `AssignmentWorkModal` with checklist → grade → feedback; activity logged |
| 13,14,24,25,26 | Courses crash/fake/blended | rebuilt: Browse/Enrolled/Starred tabs, sort+verified+tag filters, real stats/featured/contributors, create-from-roadmap, starring |
| 17 | Spaced review empty/disconnected | live nav count; completing a module seeds review cards from its objectives |
| 18 | Schedule disconnected | event modal "Start now →" launches the linked screen |
| 19 | Only Tutor visible | Agents page shows all 7 with real per-agent activity + roles |

## H. Round 3 — closing the agent loop (2026-06-05) ✅

| # | Gap | Fix |
|---|---|---|
| G1 | Tutor offline fallback hardcoded to bias-variance | Rewrote `Session.jsx` fallback to use `session.title/course/level` + `roadmap_node_id` for resources; added one-time no-key banner with deep-link to Settings → Keys |
| G2.A | No verified external content storage/UI | New `node_resources` table; seeded ~20 verified resources across Prompt Engineering, LLM fundamentals, RAG, Hypothesis testing, etc.; `GET /api/nodes/:id/resources`; live panel in ModuleDetail with kind chips + verified badges |
| G2.B | RE agent unimplemented | `ai/agents/research.js` `proposeResources()` — structured JSON output, URL safety guard (http(s) only), dedupe against existing |
| G2.C | No verification | `verifyResource()` background job (registered in `ai/jobs.js`) — HEAD with GET fallback, 8s timeout, content-type sanity, video-host check; flips status proposed → verified or rejected |
| G2.D | No in-session citation rendering | Session.jsx fallback now reads `node_resources` when user asks for sources and renders inline links |
| G3 | "Generate practice" picked from a static bank | `ai/agents/assessment.js` `generateAssignment()` with structured-output; `POST /api/ai/assignments/generate`; Extras.jsx tries AS first using the user's active node, falls back to the curated bank with a clear "From practice bank — add a key for AI-generated" toast |

## I. Round 4 — product completeness backend (2026-06-05) ✅

| # | Area | Status | Notes |
|---|---|---|---|
| §3.1 | PR onboarding wizard | 🔌 | `Onboarding.jsx` created + wired into `App.jsx`; 3-step wizard → auto-generates roadmap; `onboarded_at` column added |
| §3.2 | Course modules/lessons CRUD | 🔌 | `course_modules`, `module_lessons`, `enrollment_progress` tables; full CRUD routes in `routes/courses.js`; syllabus backfill migration |
| §3.3 | File uploads | 🔌 | `POST /api/uploads` with multer; `./uploads/` served statically at `/uploads`; `users.avatar_url`, `courses.thumbnail_url` columns added |
| §3.5 | LLM grading | 🔌 | `assignment_submissions` table; `gradeSubmission()` in `assessment.js` with structured-output + heuristic fallback; `grade-assignment` job registered |
| §3.6 | AN re-planning | 🔌 | `checkAndReplan()` in `analytics.js`; `replanNode()` in `curriculum.js`; inserts remedial nodes for weak areas; rate-limited to 1/week/node |
| §3.7 | In-session citations | ✅ | TU system prompt augmented with `node_resources`; `[N]` citations rendered as clickable superscript in `MarkdownText` component |
| §3.8 | Schedule reminders | 🔌 | `GET /api/schedule/due` endpoint; `reminder_sent_at` column; needs frontend polling in `App.jsx` |
| §3.9 | Admin course verification | 🔌 | `POST /api/courses/:slug/verify` + `/unverify` with admin role guard; `verified_by`, `verified_at` columns |
| §3.10 | Whiteboard persistence | 🔌 | `whiteboard_strokes` table; GET/POST/DELETE routes in `sessions.js`; needs frontend wiring in `Session.jsx` |
| §3.11 | Manual roadmap node editing | 🔌 | `POST /api/roadmaps/:id/nodes` + `DELETE`; needs frontend modal in `Roadmap.jsx` |
| §3.12 | Profile customization | 🔌 | `users.bio`, `users.avatar_url`, `users.links_json` columns; needs frontend form in Settings |
| §3.13 | Password reset + email verification | 🔌 | `email_verifications`, `password_resets` tables; `forgot`/`reset`/`verify` routes in `auth.js`; `email.js` helper with Resend fallback; verification token on register |
| §3.14 | SSRF protection | ✅ | `isPublicUrl()` + `dns.resolve()` check in `verifyResource()`; rejects private IPs, internal hostnames, link-local; also guards `proposeResources()` |

**🔌 = backend complete, frontend UI wiring still needed**

## G. Cosmetic/hardcoded surfaces still to replace with live data

- Dashboard: Learning-Progress chart (14.2h/26/89% + curve), streak mini-bars, Agent Activity strip statuses.
- Session right rail: outline, concepts, mastery signals (static `SESSION`), the visualizer (hardwired topic).
- Topbar "28.4k" GitHub chip.
- External trusted content (YouTube/articles/papers) — RE agent surfacing needs the extraction pipeline + an API key (Phase 4).
- Courses: syllabus (5 fixed modules), version history, featured, top contributors.
- Topbar "28.4k" GitHub chip.

---

### How to update this file
When you finish a unit of work, flip its Status, add a one-line note + date, and (if it closes a
[BACKLOG.md](BACKLOG.md) item) tick the corresponding task. Keep the legend honest — 🟡 means "looks
done but isn't fully real," which is the trap this product needs to climb out of.
