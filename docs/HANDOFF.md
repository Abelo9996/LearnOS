# LearnOS — Handoff Spec (for the next coding agent)

> **Last updated:** 2026-06-05
> **Audience:** an autonomous coding agent picking up this codebase cold.
> **Goal of this document:** finish turning LearnOS from a demo-with-real-bits into a *real product* a customer would pay for. The owner's specific complaint was that the product is full of fakeness — fake seeded data shown to every user, hardcoded messages, no preservation of user-created content, missing authoring surfaces, agents that don't actually do anything autonomously. This spec captures what's been fixed in prior passes, what's *still* fake or thin, and how to fix it without breaking what already works.

---

## 0. Read this first

LearnOS is a React 18 + Vite SPA + Express 5 + SQLite (better-sqlite3) + JWT app. The frontend is served as a static build out of `dist/` by `server.js` on port 3001. A separate Vite dev server runs on 3000 but **production traffic and demos use 3001**.

There are 7 agents in scope. Their codes are referenced throughout the codebase:
- **TU** Tutor — `routes/ai.js` `/chat` route, calls `ai/llm.js complete()`
- **CR** Curriculum — `ai/agents/curriculum.js` (roadmap generation)
- **AS** Assessment — `ai/agents/assessment.js` (assignments + quizzes)
- **RE** Research — `ai/agents/research.js` (proposes + verifies external resources)
- **AN** Analytics — `ai/agents/analytics.js` (post-session mastery analysis)
- **CE** Certification — auto-issued via session completion cascade in `routes/sessions.js`
- **PR** Profiling — `ai/agents/profiling.js` and `routes/profile.js` (intake stub)

Every agent call ultimately goes through `ai/llm.js complete()`, which:
- Resolves the user's BYOK key (or falls back to `LEARNOS_ANTHROPIC_KEY` env var if set)
- Logs every run to `agent_runs`
- Bumps `usage_counters` for managed-tier requests
- Returns `{text, json, usage, model, cost, runId, stopReason}`

If no key is configured, `complete()` throws `code: 'NO_KEY'`. **Every agent surface must degrade gracefully** — the product needs to be useful with zero API key, and progressively richer as one is added.

The codebase is in `/Users/abelyagubyan/Downloads/LearnOS_UI`. To run:
```bash
npm install
npm run build          # builds React → dist/
node server.js         # serves on :3001
# OR for dev: npm run dev (Vite on :3000) — frontend only, no backend
```

Dev login: `alex@learnos.dev` / `learnos123`

---

## 1. What's already done (DO NOT redo)

You must read the existing source before changing it. The following surfaces are real and working — duplicating them will break things.

### Backend / data layer
- `db/database.js` — idempotent migrations + seed gate (`seedIfEmpty` checks user count). Tables include: `users`, `user_settings`, `api_keys`, `agent_routing`, `agent_runs`, `agent_jobs`, `usage_counters`, `roadmaps`, `roadmap_nodes`, `roadmap_edges`, `node_objectives`, `node_resources`, `node_lessons`, `sessions`, `session_messages`, `assignments`, `flashcards`, `courses`, `enrollments`, `certificates`, `badges`, `community_threads`, `community_replies`, `community_votes`, `schedule_events`, `activity_log`, `starred`, `revoked_tokens`, `user_profiles`.
- Auth (`routes/auth.js`): JWT, bcrypt, register/login/logout, token revocation. Password hashes stored. **No password reset, no email verification yet** — see §3.13.
- Encrypted BYOK at rest (`ai/crypto.js` AES-256-GCM). Keys are never returned in full, only masked.
- Async job runner (`ai/jobs.js`): in-process, resumes queued jobs on boot. Used by RE (`propose-resources`, `verify-resource`), CR (`generate-roadmap`), AN (`analyze-session`).
- All CRUD endpoints exist for: roadmaps, nodes, sessions, assignments, flashcards, courses, schedule, community, certificates, activity, starred, profile. See `routes/`.
- Rate limiting: **NONE.** Brute force is wide open. See §3.13.

### AI agents
- **TU** — real LLM chat via `/api/ai/chat`. **Offline fallback is topic-aware** (uses `session.title/course/level/roadmap_node_id`) — do not regress this.
- **CR** — `POST /api/roadmaps/generate` enqueues `generate-roadmap` job. Returns a real DAG with nodes/objectives/edges. Has a deterministic template fallback when no key.
- **AS** — `POST /api/ai/assignments/generate` and `/api/ai/quiz/generate`. Structured-output schemas in `ai/agents/assessment.js`. Frontend Extras.jsx tries AS first, falls back to `ASSIGNMENT_LIBRARY` curated bank with an explicit toast.
- **RE** — `POST /api/nodes/:id/resources/propose` enqueues. Verifier job fetches URLs (HEAD with GET fallback, 8s timeout, content-type sanity, video-host check). **SSRF gap: there's NO internal-IP block** — see §3.14.
- **AN** — fires automatically on `PATCH /api/sessions/:id` with `status=completed`. Scores objectives, produces summary, seeds weak-area flashcards, enqueues additional RE for weak areas. Has a deterministic heuristic fallback when no key.
- **CE** — auto-issues a verified certificate when a `verified=1` course's roadmap is fully completed.
- **PR** — `routes/profile.js` accepts intake data but there's **no first-run UI** wired to use it. See §3.4.

### Frontend
- `src/screens/Session.jsx` — header, composer placeholder, right rail (objectives/topics/assignment/mastery) all bound to the real `session` object. Right rail fetches `roadmap_node_id`'s objectives via `API.getRoadmap(...).nodes`. Visualizer column replaced with `Notes` (auto-saved per-session in localStorage) + `Code` (scratchpad) + `Whiteboard` (DPR-correct cursor, **but strokes vanish** — §3.10). No more bias-variance hardcoding anywhere in the chat flow.
- `src/screens/Roadmap.jsx` — multi-roadmap switcher chip bar (all roadmaps clickable), `openNodeSession` reuses/creates a real session per-node with topic-aware greeting, ModuleDetail panel shows prereqs + lesson body + real `node_resources` with verified/proposed badges + "+ Propose more" RE button (polls the job).
- `src/screens/Courses.jsx` — Browse/Enrolled/Starred tabs, sort + verifiedOnly + tag filters, real featured/contributors from leaderboard, CreateCourseModal bundles a roadmap's nodes into `syllabus` JSON. CourseDetail renders the **real** syllabus JSON (per-module objectives) — not the previous 5 hardcoded modules.
- `src/screens/Extras.jsx` — Assignments, Spaced Review, Schedule, Agents, Certificates, Community, Settings. **Spaced review review-loop is real** (SM-2 grading + CreateCardsModal). Assignments has "Create manually" (`CreateAssignmentModal`) and "Generate with AI" (AS agent) side-by-side.
- `src/screens/Dashboard.jsx` — real stats, real Agent Activity strip (from `agent_runs`). Empty-state CTA points new users at roadmap generation. **"28.4k" GitHub chip removed from topbar.**
- `src/App.jsx` — `USER` constant in `data/data.js` is hydrated from `/api/auth/me` on boot via `hydrate(user)`. Notification bell opens a real list with mark-read. Nav counts (assignments, due flashcards) come from API.

### What "fake" means now vs before
The two big legacy fakes were (1) hardcoding bias-variance everywhere and (2) seed user-1's progress leaking into new accounts. Both are fixed. **What remains fake is mostly: missing surfaces (no UI to edit X), not displayed lies.**

---

## 2. The seam — where you pick up

The product today is: a learner can sign up, get pushed to generate a roadmap, walk through nodes (each has a real lesson + real resources), open a session, chat with the Tutor (real LLM if keyed, topic-aware offline if not), complete the session (AN agent runs autonomously, surfaces weak areas, seeds flashcards), review flashcards (real SM-2 loop), take AS-generated quizzes/assignments, and post to a community thread with media + course/roadmap references. Certificates are gated to LearnOS-verified courses.

What's still missing for a *real product*, in priority order:

1. **PR onboarding wizard** for first-time users
2. **Course lesson authoring** (module-by-module editor — currently syllabus is a JSON blob bundled at course creation, never edited)
3. **File uploads** for community attachments + course thumbnails + user avatars
4. **Per-lesson progress tracking** when enrolled in a course
5. **Real LLM-based grading** for assignment submissions (currently a heuristic % of tasks checked)
6. **AN-driven roadmap re-planning** (AN flags weak areas → CR rewrites the DAG with remedial nodes)
7. **In-session citations** from `node_resources` (Tutor responses should cite sources by default when answering)
8. **Schedule reminders** (push/email when a scheduled event is due)
9. **Admin course-verification UI** (a course can't be marked `verified=1` from the product UI today)
10. **Whiteboard persistence** (per-session save of strokes)
11. **Manual roadmap node editing** (CR-generated only today; no edit-after-generate)
12. **Profile customization** (avatar, bio, social links — table exists but no UI)
13. **Password reset + email verification** (table-stakes account hygiene)
14. **SSRF allow-list on the RE verifier** (security blocker — see §3.14)

The next 14 sections are each a self-contained spec. Tackle them roughly in this order, but the exact ordering can flex based on what you find when you start.

---

## 3. Work items

### 3.1 PR onboarding wizard

**Why it matters:** A new user hits the Dashboard and sees an empty state. They have to know to navigate to Roadmaps and click "Generate" to bootstrap their experience. That's a 10% activation product.

**What to build:**

1. **New screen** `src/screens/Onboarding.jsx`. A 3-step wizard, full-screen modal style:
   - **Step 1 — Goal:** free-text "What do you want to learn?" (≥3 chars). Suggest 4 chips ("Machine Learning", "Generative AI", "Data Science", "Web development") that prefill the input.
   - **Step 2 — Level + time:** radio "Beginner / Intermediate / Advanced" + slider "Hours per week" (1–20, default 5).
   - **Step 3 — Style:** 4 chips (multi-select OK): "Visual examples", "Hands-on projects", "Theory first", "Quick sprints". This feeds the PR profile.
2. **Wire it into App.jsx `RootApp`:** after a fresh login, if `API.getRoadmaps()` returns `[]` AND `API.getProfile()` returns no `goal`, render `<Onboarding>` *before* the main `App`. Persist a "onboarded" flag in `user_settings` (add column `onboarded_at TEXT`) so we don't re-show after the first roadmap is generated.
3. **On submit:** call `API.postIntake({goal, answers:{level, time_per_week, learning_style: chips}})` then `API.genRoadmap(goal, {level, time_per_week, learning_style})`. Show a real progress UI ("CR agent is designing your roadmap…") that polls `getJob(jobId)` and routes to `/roadmap` on success. **Do not block on key:** if NO_KEY, `genRoadmap` returns a deterministic template — the wizard still completes.
4. **Edge case:** if a user already has a roadmap (e.g. seed user), do not show onboarding. Detect with `roadmaps.length > 0`.

**Files to touch:** `src/screens/Onboarding.jsx` (new), `src/App.jsx`, `src/api.js`, `db/database.js` (add `onboarded_at` migration), `routes/users.js` or `routes/profile.js`.

**Done when:** registering a new account → first paint is onboarding → after submit → 30–90s wait → lands on the user's *own* roadmap with their *own* nodes generated for *their* goal.

---

### 3.2 Course lesson authoring (module editor)

**Why it matters:** Today courses have a `syllabus` JSON column. A course author bundles their roadmap into modules at creation time. After that there's no way to add real lesson content. So enrolling teaches you nothing — there's no body to read.

**What to build:**

1. **Schema** — two new tables, both reference the course slug:
   ```sql
   CREATE TABLE course_modules (
     id TEXT PRIMARY KEY,
     course_slug TEXT NOT NULL,
     title TEXT NOT NULL,
     summary TEXT,
     order_idx INTEGER DEFAULT 0,
     estimated_minutes INTEGER DEFAULT 45,
     created_at TEXT DEFAULT (datetime('now'))
   );
   CREATE TABLE module_lessons (
     id TEXT PRIMARY KEY,
     module_id TEXT NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     body_md TEXT NOT NULL DEFAULT '',
     kind TEXT NOT NULL DEFAULT 'reading',  -- 'reading'|'exercise'|'video'|'code'
     order_idx INTEGER DEFAULT 0,
     created_at TEXT DEFAULT (datetime('now')),
     updated_at TEXT DEFAULT (datetime('now'))
   );
   ```
2. **Migration to backfill from `syllabus` JSON:** on first boot, for every course with a non-empty `syllabus`, insert one `course_modules` row per syllabus entry and one default `module_lessons` row per module with `body_md = ''` and `kind='reading'`. Mark courses as migrated (`courses.migrated_modules INTEGER DEFAULT 0`).
3. **Routes** (`routes/courses.js`):
   - `GET /api/courses/:slug/modules` → returns `[{...module, lessons:[...]}]`
   - `POST /api/courses/:slug/modules` (author-only — `req.userId === courses.author_id`)
   - `PATCH /api/courses/:slug/modules/:id` (reorder, retitle)
   - `DELETE /api/courses/:slug/modules/:id`
   - `POST /api/courses/:slug/modules/:mid/lessons`
   - `PATCH /api/courses/:slug/modules/:mid/lessons/:lid` (body_md, kind, title, order_idx)
   - `DELETE /api/courses/:slug/modules/:mid/lessons/:lid`
4. **Frontend — CourseDetail.jsx (extract from Courses.jsx if it has grown too large):**
   - If user is the author OR an admin: render an "Edit course" button that opens a full-page editor.
   - The editor: left panel = module/lesson tree (drag-to-reorder). Right panel = simple Markdown editor (textarea + live preview using the existing `MarkdownText` from Session.jsx — extract into `src/components/Markdown.jsx`).
5. **Learner view:** when enrolled, clicking a module → opens a lesson reader (full lesson body_md rendered) → "Mark complete" button → records to `enrollment_progress`. Add table:
   ```sql
   CREATE TABLE enrollment_progress (
     user_id TEXT NOT NULL,
     course_slug TEXT NOT NULL,
     lesson_id TEXT NOT NULL,
     completed_at TEXT DEFAULT (datetime('now')),
     PRIMARY KEY (user_id, course_slug, lesson_id)
   );
   ```
6. **Course progress %** in EnrolledTab: `completed_lessons / total_lessons`.

**Gotcha:** `MarkdownText` in `Session.jsx` already exists and handles code fences, headings, lists, blockquotes, and inline `**bold**`/`*italic*`/`[link](url)`. Extract it; don't rewrite from scratch.

**Done when:** an author can create a course → add modules → add lessons with Markdown bodies → publish; a learner can enroll → click through lessons → mark complete → see progress %.

---

### 3.3 File uploads

**Why it matters:** community threads can attach an image but only via URL paste. Same for course thumbnails. There's no real upload, which means in practice nobody attaches anything because finding hostable URLs is annoying.

**What to build:**

1. **Storage** — for v1, write to a local `./uploads/` directory served statically:
   ```js
   // server.js, before SPA fallback
   import { join } from 'path';
   const uploadsPath = join(__dirname, 'uploads');
   if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
   app.use('/uploads', express.static(uploadsPath, { maxAge: '7d' }));
   ```
2. **Endpoint** — `POST /api/uploads`:
   - Use `multer` (`npm install multer`).
   - Limit: 5 MB, MIME-type allowlist `['image/png','image/jpeg','image/webp','image/gif']`.
   - Filename: `${userId}-${Date.now()}-${randomslug}.${ext}` — never accept the original filename.
   - Returns `{url: '/uploads/<filename>', kind: 'image'}`.
3. **Wire into community new-thread form** — replace the URL-only image input in `src/screens/Extras.jsx` (search for `newThreadImage`) with a file picker that uploads, then puts the returned URL into the same `image_url` field. Show a preview thumbnail before submit.
4. **Course thumbnails** — add `courses.thumbnail_url TEXT` migration. In `CreateCourseModal`, add a thumbnail upload. Show thumbnails on course cards in Browse.
5. **User avatars** — add `users.avatar_url TEXT` migration. Settings → Profile gets an upload field. `Avatar` component in `src/components/UI.jsx` should prefer `avatar_url` over the initials/hue fallback.

**Security:** the multer config should `dest: uploadsPath`. Do not trust client `Content-Type`; verify via the `file-type` package or by reading the first 12 bytes (magic numbers). Reject if mismatch.

**Done when:** posting a community thread with an attached PNG works end-to-end; the image renders in the thread list AND the modal; reloading the page still shows it (it's on disk).

---

### 3.4 Per-lesson progress (depends on 3.2)

Already specified inline in §3.2 — table `enrollment_progress`, mark-complete endpoint, progress % in EnrolledTab. Make sure this fires the `logActivity` helper so the activity feed picks it up.

---

### 3.5 Real LLM grading

**Why it matters:** today `AssignmentWorkModal` (in Extras.jsx) computes a grade as 60–100% based on the % of checklist tasks the user ticks. That's not grading — that's an attendance system.

**What to build:**

1. **Submission table:**
   ```sql
   CREATE TABLE assignment_submissions (
     id TEXT PRIMARY KEY,
     assignment_id TEXT NOT NULL,
     user_id TEXT NOT NULL,
     body_md TEXT NOT NULL,   -- the learner's written answer / pasted code / writeup
     submitted_at TEXT DEFAULT (datetime('now')),
     grade INTEGER,           -- 0-100, NULL until graded
     feedback_md TEXT,        -- AN-agent feedback
     rubric_json TEXT         -- structured per-criterion scores
   );
   ```
2. **Frontend:** add a "Your submission" textarea to `AssignmentWorkModal`. On "Submit for grading" → `POST /api/assignments/:id/submit { body_md }` → server stores the row, enqueues a `grade-assignment` job, returns submission id.
3. **AS agent — add to `ai/agents/assessment.js`:**
   ```js
   export async function gradeSubmission({ userId, assignmentId, submissionId }) {
     // Pull assignment (title, description, tasks, kind, rubric_json if present) +
     // the submission body. Build a structured-output prompt that returns
     // {overall_grade:0-100, per_criterion:[{criterion, score, why}], feedback_md}.
     // Persist to assignment_submissions. logActivity('assignment', ...).
   }
   ```
3. Background job `grade-assignment` registered in `routes/assignments.js`. On NO_KEY, fall back to a heuristic that scores body length, mentions of objective keywords, and presence of code blocks — not great but not zero.
4. **UI:** "Grading…" spinner with a poll, then renders the structured feedback with per-criterion scores.

**Done when:** submitting a written assignment for a Generative AI course produces real LLM feedback that references the actual objective wording, not generic praise.

---

### 3.6 AN-driven roadmap re-planning

**Why it matters:** the AN agent currently identifies weak objectives but only seeds extra flashcards. The product *claims* "agent-orchestrated mastery" — that requires the roadmap itself to adapt.

**What to build:**

1. In `ai/agents/analytics.js`, after computing `weak_areas`: if a user has had 2+ sessions on the same node with combined `mastery < 0.5`, enqueue a `replan-node` CR job for that node.
2. **CR agent — extend `ai/agents/curriculum.js`** with `replanNode({userId, nodeId})`:
   - Pull the node, its objectives, the user's recent transcripts for that node.
   - Ask CR for a **remedial node** (1 new node) that breaks down the weak objectives further, with prerequisites pointing to upstream foundations.
   - Insert the new node into `roadmap_nodes` at `col = node.col` (sibling) or `col = node.col - 0.5` (intermediate — you'll need to shift cols of downstream nodes, do this in a transaction).
   - Insert edges so the new node becomes a prereq for the failing one.
   - Mark it `status='next'` and the failing node `status='locked'` until the remedial is done.
3. **Activity feed entry** so the learner sees: *"Curriculum agent inserted 'Foundations of prompt formatting' before 'Prompt Engineering' based on your recent session."*

**Gotcha:** don't replan more than once per node per week (rate-limit). Persist a `last_replanned_at` on the node.

**Done when:** completing two low-mastery sessions on the same node visibly inserts a new remedial node in the roadmap graph view.

---

### 3.7 In-session citations from `node_resources`

**Why it matters:** RE agent already proposes + verifies resources, but the Tutor doesn't use them. Every reply is pure model output. That's a hallucination risk and a wasted feature.

**What to build:**

1. In `routes/ai.js` `/chat` endpoint, augment the system prompt with the session's node resources:
   ```js
   const resources = sessionContext?.nodeId
     ? db.prepare("SELECT title, url, source FROM node_resources WHERE node_id = ? AND status = 'verified' LIMIT 8").all(sessionContext.nodeId)
     : [];
   const resBlock = resources.length
     ? `\n\nAvailable verified sources for this module:\n${resources.map((r,i) => `[${i+1}] "${r.title}" — ${r.source} (${r.url})`).join('\n')}\nWhen you reference a claim, cite by [N] using these.`
     : '';
   const system = ORIGINAL_SYSTEM + resBlock;
   ```
2. The frontend `Session.jsx` should pass `{nodeId: session.roadmap_node_id}` in the `sessionContext` payload.
3. `MarkdownText` should render `[1]`, `[2]` as clickable superscript chips that open the resource URL in a new tab. Match the format with a regex and turn them into anchors.
4. **System prompt tweak:** add a rule "Prefer citing the provided sources over making claims from memory. If the sources don't cover something, say so explicitly."

**Done when:** during a Prompt Engineering tutor session, asking "where does that come from?" produces a response with `[1]`-style citations that link to the seeded Anthropic/OpenAI/Lilian Weng pages.

---

### 3.8 Schedule reminders

**Why it matters:** schedule events sit in a table and render in a calendar. Nothing reminds you. So nobody uses it.

**What to build:**

For v1, browser-only notifications (no email dependency):

1. Add `routes/schedule.js` endpoint `GET /api/schedule/due` → events where `start_at` is within the next 15 minutes and `reminder_sent_at IS NULL`. Add the column.
2. On the frontend, in `App.jsx` after `getMe()`, set up a 60s polling interval: if `getScheduleDue()` returns rows, show an in-app banner toast "Your study session 'X' starts in 10 minutes — Open" with a deep-link button. Use the existing `useToast` infrastructure.
3. On click "Open" → mark `reminder_sent_at` so it doesn't fire again, and launch the linked screen (existing `launchScreen` mapping in `Extras.jsx`).
4. **Optional v1.5:** request Web Notification permission on first schedule create. If granted, also fire a native `Notification(...)` from the same poll loop.

**Done when:** scheduling an event for "5 minutes from now" produces a toast 5 minutes later that opens the correct screen.

---

### 3.9 Admin course-verification UI

**Why it matters:** certificates only issue for `courses.verified=1`, but there's no UI to flip that bit. Today it's a SQL UPDATE.

**What to build:**

1. The `users.role` column already exists with default `'user'`. Treat `role='admin'` as the verification authority. Manually flip one user to admin for now (SQL); a real signup-to-admin workflow is out of scope.
2. **New routes** in `routes/courses.js`:
   - `POST /api/courses/:slug/verify` — requires `req.userRole === 'admin'`. Sets `verified=1`, `verified_by=req.userId`, `verified_at=now()`. Add columns.
   - `POST /api/courses/:slug/unverify` — same role guard.
3. **Frontend** — in CourseDetail, if the current user is admin, show a green "Verify course" button. Show the verified badge prominently on every course card (already wired in CoursesView, just confirm).
4. **Admin badge** in the topbar avatar dropdown for clarity.

**Done when:** logging in as admin → opening a community-created course → "Verify" → reloading any roadmap tied to that course → completing it → a real certificate row appears in `certificates` with `verified=1`.

---

### 3.10 Whiteboard persistence

**What to build:**

1. Add `whiteboard_strokes(session_id, stroke_json, created_at)` — JSON array of strokes (each stroke = `{tool, points:[{x,y}], color, width}`).
2. In `WhiteboardView` (`src/screens/Session.jsx`), maintain strokes in React state (not just canvas paint). On `stopDraw` → POST the new stroke. On mount → GET strokes and replay.
3. Add an "Undo" button (pops last stroke locally + DELETE last by id).
4. The Clear button should DELETE all strokes for that session.

**Done when:** drawing on the whiteboard, switching to Notes, switching back → drawings still there. Logging out + back in → drawings still there.

---

### 3.11 Manual roadmap node editing

**Why it matters:** CR-generated roadmaps are good but not perfect. A learner should be able to add a node ("Linear algebra refresher") manually.

**What to build:**

In `src/screens/Roadmap.jsx`:
1. On the roadmap detail header, add `[+ Add node]` (next to the existing "Generate" button).
2. Modal: title, objectives (multi-line, one per line), col (numeric, default = max col + 1), row (default = 0), prereqs (multi-select dropdown of existing nodes).
3. POST to `/api/roadmaps/:id/nodes` (add the route — currently only PATCH exists). Wire to `roadmap_nodes` + `roadmap_edges` + `node_objectives` in a transaction.
4. Add `[Edit]`, `[Delete]` actions on node hover in the Modules view. Edit reopens the same modal pre-filled.

**Done when:** a user can add "My custom topic" to any of their roadmaps and it appears in the graph.

---

### 3.12 Profile customization

**What to build:**

1. Settings tab "Profile" (already exists per `settings_tab` localStorage handoff — find it in Extras.jsx Settings).
2. Add a form: display name, bio (textarea, 280 chars), avatar upload (uses §3.3), 3 link fields (twitter, github, website — validated as URLs).
3. Schema: add `users.bio TEXT`, `users.avatar_url TEXT`, `users.links_json TEXT`.
4. Public-facing profile page at `/u/:userId` (route via `setScreen('user-profile', userId)`) showing the user's verified certs, public roadmaps (a `roadmaps.is_public` column would be nice), and community contributions count.

**Done when:** uploading an avatar in settings → it appears in the sidebar, the topbar, and community thread author cards.

---

### 3.13 Password reset + email verification

**This is the table-stakes account hygiene item.** Today users can register with any email; if they forget their password they're locked out. You need email plumbing.

**What to build:**

1. **Email provider:** use Resend (`npm install resend`) or Postmark — pick one, document the env var (`RESEND_API_KEY=...`). Add `routes/email.js` with a `send({to, subject, html})` helper that no-ops with a console log if no key is set (so local dev still works).
2. **Email verification:**
   - On register: generate `verification_token`, store with 24h expiry in a `email_verifications` table.
   - Send `<APP_URL>/verify?token=...`.
   - On token visit: mark `users.email_verified=1`, delete the token.
   - Gate sensitive actions (issuing certs, posting to community) on `email_verified=1` — show a banner "Verify your email to unlock community posting."
3. **Password reset:**
   - `POST /api/auth/forgot { email }` → if email exists, send `<APP_URL>/reset?token=...` (always return 200 to avoid user enumeration).
   - `POST /api/auth/reset { token, new_password }` → verify token, bcrypt the new pass, revoke all current JWTs for that user (insert into `revoked_tokens`).

**Done when:** "Forgot password" link on the login form → email arrives → click link → set new password → log in.

---

### 3.14 SSRF allow-list on RE verifier

**This is a real security blocker before any deploy.** Today `verifyResource()` in `ai/agents/research.js` does `fetch(r.url, {method:'HEAD'})` against arbitrary URLs the LLM produced. The LLM is generally well-behaved, but a prompt-injection attack could feed it a URL like `http://169.254.169.254/latest/meta-data/iam/security-credentials/` and our server would happily fetch AWS cloud metadata.

**What to build:**

1. Add an allow-list check before every fetch in `verifyResource`:
   ```js
   function isPublicUrl(u) {
     try {
       const parsed = new URL(u);
       if (!/^https?:$/.test(parsed.protocol)) return false;
       const host = parsed.hostname;
       // Reject literal IPs entirely (numeric or IPv6).
       if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
       if (host.includes(':')) return false;  // crude IPv6 reject
       // Reject obviously-internal hostnames.
       if (/^(localhost|.*\.local|.*\.internal|169\.254\..*|10\..*|192\.168\..*|172\.(1[6-9]|2[0-9]|3[01])\..*)$/i.test(host)) return false;
       return true;
     } catch { return false; }
   }
   ```
2. **Resolve DNS at verify time too** — `dns.promises.lookup(host)` and reject if any returned IP is private. Use the `is-ip-private` package (`npm install is-ip-private`) so you don't have to hand-roll RFC 1918 / RFC 4193 / link-local CIDRs.
3. Return `status='rejected'` with `reason='private_target'` for any URL that fails.
4. **Tighten the AS schema check** too — reject any AS-returned URL that fails `isPublicUrl`.

**Done when:** seeding a resource with `url='http://169.254.169.254/'` and running the verifier → row ends as `status='rejected', summary='[rejected: private_target]'`.

---

## 4. Test protocol (run after every chunk)

After each section above, before marking it done:

1. `npm run build` (must produce no errors).
2. `node server.js` starts cleanly (no migration warnings except known ones in stderr).
3. Hit the affected endpoint with `curl` while logged in. The token lives in localStorage after `/auth/login`:
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"alex@learnos.dev","password":"learnos123"}' | jq -r .token)
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/<your-new-endpoint>
   ```
4. Browser smoke test via the Preview MCP (if available): walk through the user flow you touched. Compare against the legacy seeded data (Alex's account is the easiest baseline).
5. **Critical workflows to keep passing** (run them after EVERY chunk):
   - Login → Dashboard renders without console errors → real stats visible
   - Open Roadmaps → switch to Generative AI Mastery → click "Prompt Engineering" → lesson body + 4 verified resources render
   - Open a session → header is dynamic to session → composer placeholder matches → send a message → reply lands → quiz request → quiz renders (static fallback ok without key)
   - End session → AN agent runs → summary contains the session title + objectives, not bias-variance
   - Open Assignments → "Create manually" → fill in → submit → row appears in list
   - Open Spaced Review → if any cards due, flip + grade Good → next card appears
   - Open Community → New thread → with image URL + course ref → submit → thread appears in list with both badges
   - Open Schedule → create event → it shows in calendar

If any of these regresses, your change broke something — fix before moving on.

---

## 5. Institutional knowledge (gotchas)

- **Dev seed user-1 has API key rows but they're FAKE strings** (`sk-ant-…7Z2`). These will throw real Anthropic errors if you try to call live. Either delete them (`DELETE FROM api_keys WHERE user_id='user-1'`) when testing or set `LEARNOS_ANTHROPIC_KEY` env var to a real key for managed-tier testing.
- **The Vite dev server (`npm run dev`, :3000) does NOT serve the API.** Only `node server.js` (:3001) has the backend. The frontend at :3000 will get CORS-friendly responses from :3001 only because `server.js` sets `Access-Control-Allow-Origin: *`. **For demos and production, always serve from :3001.**
- **After source changes, `dist/` is stale until you rerun `npm run build`.** This has bitten previous agents — they'd edit source, see no change in the browser, and chase ghosts. Always rebuild for :3001 testing.
- **`USER` constant in `data/data.js` is mutated at runtime by `hydrate()` in App.jsx.** Don't rely on the file contents as truth — at runtime it has the real user's fields. Don't add new fields by editing the file; add them to the API response from `/auth/me` and they'll flow through.
- **Markdown rendering** lives in `src/screens/Session.jsx` `MarkdownText`. It handles fenced code, headings, lists, blockquotes, inline. Extract into `src/components/Markdown.jsx` early — Course lessons (§3.2), node lessons, and AN summaries all need it.
- **`logActivity()` in `db/database.js`** is the single point of truth for the activity feed. EVERY meaningful user action funnels through it. When you add a new surface (e.g. enrollment_progress), call `logActivity(userId, {kind, text, sub, xp, agent})` from the route handler so the Feed/notifications pick it up.
- **The job worker is in-process and synchronous-ish** (`ai/jobs.js` calls `setImmediate(drain)`). It's fine for low-volume work but don't enqueue 100+ jobs in a loop — they'll all serialize on a single thread. For per-resource verification, the existing 1-job-per-resource pattern is acceptable.
- **`assignment.kind === 'project'` deserves a 14-day default due date; others 7 days.** This pattern is repeated in two places — `routes/assignments.js` defaults and `Extras.jsx` Generate Practice / Create Assignment. Keep them consistent.
- **Don't reintroduce the SESSION constant for header rendering** in `Session.jsx`. It's still imported for the fallback in offline mode (e.g. when localStorage hasn't yet handed off a session) but the *rendered* header, composer placeholder, right rail, etc. all read from the `session` state. If you find yourself reaching for `SESSION.title`, you're regressing.
- **`session.id === 'local'`** is the sentinel for offline mode (no backend yet). All API writes are guarded with `if (session && session.id && session.id !== 'local')`. Maintain this pattern.
- **Markdown links in MarkdownText:** the regex is `\[([^\]]+)\]\(([^)]+)\)` and only matches http(s). If you add new link handling (e.g. for resource citations [§3.7]), do it in the same function — don't re-implement.
- **Tests:** there are no automated tests in this repo today. You should be adding some, especially for the auth + agent paths. Use `vitest` (already a Vite project) — `npm install -D vitest @vitest/ui` and add a `test:` script. At minimum, integration-test the routes that handle money-flow actions (LLM cost, cert issuance, course verification).

---

## 6. Definition of done for this engagement

When you finish §3.1–§3.14:

- A new user can sign up → onboard → get a real personalized roadmap → walk through real lessons → take real LLM-graded assignments → review real flashcards → post to a community thread with a real image upload → eventually earn a real verified certificate from a real admin-verified course.
- Zero hardcoded user content appears anywhere except deliberate seed content (Alex's account, or topic seeds for first-touch experience).
- The RE verifier cannot fetch internal IPs.
- The AN agent autonomously inserts remedial roadmap nodes when a learner struggles.
- Password reset works.
- Whiteboard strokes persist across reloads.
- Course authors can edit modules and lessons; learners can mark lessons complete.

At that point, the product is no longer demo-quality. It still won't be ready to *sell* (see `docs/SPEC-UNRESOLVED.md` and §3.13 for security/legal/billing) — but it'll be a real product that a closed-beta cohort could actually use to learn.

---

## 7. Out of scope (do not do)

The owner explicitly does not want infrastructure / business / legal work in this engagement. Specifically, leave these alone:

- Billing / Stripe / pricing tiers
- ToS, Privacy Policy, GDPR data export
- Postgres migration (SQLite is fine for now)
- Multi-region / horizontal scale
- SOC2 / audit logging
- Real-time websockets for community
- Mobile responsiveness audit

Focus is **product completeness**. Make the product real.

---

## 8. Pre-flight check

Before you start coding, confirm:

- [ ] You've read `docs/STATUS.md` for the legend and history
- [ ] You've read this entire document
- [ ] You've run `npm install && npm run build && node server.js` and confirmed the app boots
- [ ] You've logged in as `alex@learnos.dev / learnos123` and clicked through Dashboard → Roadmaps → Sessions → Assignments → Spaced Review → Community → Settings without errors
- [ ] You understand the seam in §2

Then start at §3.1. Good luck.
