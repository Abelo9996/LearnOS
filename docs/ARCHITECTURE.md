# LearnOS — Technical Architecture (Target State)

> How the [SPEC.md](SPEC.md) gets built. Engineering-facing. Tracks the AI layer, data model,
> retrieval pipeline, async jobs, and API surface that don't exist yet.

---

## 1. Current stack (keep)
- **Frontend:** React 18 + Vite SPA, no router lib (`switch` in `App.jsx`), inline styles + `theme.css`.
- **Backend:** Express 5, `routes/*.js` mounted in `server.js`, single local user resolved in `middleware/auth.js` (no login — self-hosted).
- **DB:** SQLite via better-sqlite3 (synchronous), WAL, schema in `db/schema.sql`, helpers in `db/database.js`.
- **Gamification engine:** `awardXP` / `updateStreak` + session-completion cascade (`routes/sessions.js`). **Keep — it's real.**

## 2. What's missing structurally (the big adds)
1. An **AI orchestration layer** (`/ai` or `/agents` module) — does not exist.
2. A **model-provider abstraction** (managed key + BYOK, multi-provider) — does not exist.
3. A **retrieval + verification pipeline** for trusted resources — does not exist.
4. An **async job system** for long agent runs — does not exist (everything is synchronous today).
5. **~12 new tables** for profiles, content, assessments, submissions, agent runs, attachments.
6. **Frontend↔Community wiring** (backend + api.js exist; UI doesn't call them).

---

## 3. AI orchestration layer

```
/ai
  llm.js            # provider abstraction: complete({messages, model, system, response_format, userId})
  cache.js          # prompt-cache helpers (cache agent system prompts)
  orchestrator.js   # composes multi-agent workflows; writes agent_runs; enqueues jobs
  agents/
    profiling.js    # PR
    curriculum.js   # CR  (generateRoadmap, replan)
    research.js     # RE  (assemble) -> uses retrieval/
    tutor.js        # TU  (respond, grounded/RAG)
    assessment.js   # AS  (generate, grade)
    analytics.js    # AN  (evaluate)
    certification.js# CE  (evaluate)
  retrieval/
    propose.js      # RE asks model for candidate resources (structured)
    verify.js       # checks each candidate (resolve + match) -> verified bool
    sources/        # youtube.js, arxiv.js, crossref.js, googlebooks.js, generic.js
  prompts/          # versioned system prompts per agent
  schemas/          # zod/JSON schemas for every agent I/O (validate outputs)
```

### Agent contract
Each agent exports a pure-ish function: `async function run(input, ctx) -> output` where `ctx`
carries `{ userId, model, db }`. The function: builds messages from a versioned system prompt +
input, calls `llm.complete` with a **JSON response schema**, validates the output against
`schemas/<agent>.js`, persists writes, and logs to `agent_runs`. Invalid model output → one repair
retry, then surfaced as a failed run.

---

## 4. Model-provider abstraction (`/ai/llm.js`)

```
complete({ system, messages, model, response_format, userId, agentCode }) -> { text|json, usage }
```
Resolution order for the key/model:
1. If user has an **active BYOK** key for the provider of `model` → use it (no platform metering).
2. Else use the **managed platform key** (env `LEARNOS_<PROVIDER>_KEY`) → **meter usage** against the user's tier.
3. `model` chosen by `agent_routing[userId][agentCode]` or the managed default.

- **Providers:** OpenRouter (OpenAI-compatible) — one key, any model by slug (Claude, GPT, Gemini, Llama, …).
- **Prompt caching:** mark agent system prompts as cacheable (they're stable, large). See the `claude-api` skill.
- **Metering:** every managed call writes tokens+cost to `agent_runs`; a daily/monthly cap per user is enforced
  pre-call. Over cap → 402-style "add your own key or wait" response the UI handles gracefully.
- **Security:** BYOK keys are currently stored as plaintext-ish `encrypted_key`. **Must** be encrypted at rest
  (AES-GCM with a server secret) before managed/BYOK ships. Never returned in full to the client.

---

## 5. Retrieval + verification pipeline (content sourcing = "LLM-proposed + auto-verified")

```
RE.assemble(node):
  candidates = propose(node, objectives)          # model returns [{type,title,url,source,why}]
  verified   = await Promise.all(candidates.map(verify))
  keep only verified; dedupe; cap N; persist to node_resources (verified=1, checked_at)
  quarantine unverifiable -> node_resources(verified=0) (never shown as trusted)
```

`verify(candidate)` by type:
- **youtube** → oEmbed/Data API: confirm video exists, public, title matches intent.
- **paper** → arXiv API / Crossref DOI resolve: confirm metadata exists.
- **book** → Google Books API: confirm ISBN/title.
- **article/generic** → HTTP GET 200 + content-type + (optional) title/keyword match; block known-bad/login-walled.
Store `verified`, `checked_at`, `http_status`, `source`. Re-verify on a schedule (links rot).
Note: **"verified" = reachable + correct type + on-topic — NOT "high quality."** Quality signal comes later from community ratings, not the verifier.

**Content extraction (required for tutor grounding):** verifying a link is reachable is not enough — the
Tutor can't RAG over a raw YouTube URL. After verification, **extract the resource's text** (`retrieval/extract.js`):
YouTube → transcript/captions; arXiv → PDF→text; article → readable-text scrape. Summarize into
`module_content` (outline + key points); TU grounds on *this*, generated **lazily per node** when the learner
arrives — not for the whole course up front (cost control).

**API/cost notes:** prefer keyless/free checks — **YouTube oEmbed** (keyless) over the quota-limited Data API;
**arXiv** + **Crossref** are free/open; **Google Books** needs a key.

> Decision note: this is "LLM-proposed + auto-verified." If higher freshness is needed later, swap `propose.js`
> to call live web search (Firecrawl/Exa) — the verify stage stays identical.

---

## 6. Async job system

Long agent runs (roadmap generation, full-course content assembly, batch grading) **must not block** an
HTTP request. Minimal approach (no external queue needed for SQLite-scale):

- `agent_jobs` table: `{ id, user_id, kind, input_json, status(queued|running|done|failed), result_json, error, created_at, updated_at }`.
- A lightweight in-process worker (setInterval or on-demand `runJob`) processes `queued` jobs.
- API: `POST` that creates work returns `{ jobId }` immediately; client polls `GET /api/jobs/:id`.
- Frontend shows progress (e.g., "Generating your roadmap…") and hydrates when `done`.
- Scale path: swap the in-process worker for a real queue/worker when moving off single-node SQLite.

---

## 7. Data model changes

### New tables
| Table | Purpose | Key columns |
|---|---|---|
| `user_profiles` | PR output, personalization | user_id PK, goal, background, level, time_per_week, learning_style, motivations(JSON), updated_at |
| `node_objectives` | per-node learning objectives | id, node_id, text, order_idx |
| `node_resources` | verified trusted resources | id, node_id, type, title, url, source, why, verified, http_status, checked_at, added_by |
| `module_content` | AI/author assembled content per node/module | id, node_id\|module_id, outline(JSON), key_points(JSON), generated_by, version |
| `course_modules` | real course structure (replaces 5 fixed strings) | id, course_slug, title, order_idx, est_minutes |
| `assessments` | generated quizzes/assignments per node | id, node_id, user_id, kind, spec(JSON), created_at |
| `quiz_questions` | questions within an assessment | id, assessment_id, prompt, options(JSON), answer, rubric(JSON) |
| `assignment_submissions` | learner submissions + grading | id, assignment_id, user_id, body, files(JSON), score, rubric_scores(JSON), feedback, graded_at |
| `mastery_events` | granular signals feeding AN | id, user_id, node_id, source, score, created_at |
| `agent_runs` | observability + billing | id, user_id, agent_code, model, input_hash, tokens_in, tokens_out, cost, latency_ms, status, error, created_at |
| `agent_jobs` | async work | see §6 |
| `community_attachments` | images/links on threads/replies | id, parent_type, parent_id, kind(image\|link), url, meta(JSON) |
| `usage_counters` | managed-tier metering/caps | user_id, period, tokens, cost, requests |

### Altered tables
- `courses`: add `user_id` (author), `forked_from`, `visibility(draft|published)`, `current_version`.
- `roadmaps`: link to a course (`course_slug` nullable) so generated roadmaps and courses connect.
- `community_threads`: add `course_slug`/`node_id` reference, `solved` flag.
- `api_keys.encrypted_key`: actually encrypt (see §4).

### Migrations
Follow the existing pattern in `db/database.js` (idempotent `ALTER TABLE … ADD COLUMN` in try/catch,
`CREATE TABLE IF NOT EXISTS`). Add a `schema_version` row to make ordering explicit going forward.

---

## 8. API surface additions

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/profile/intake` | PR: submit goal + answers → profile |
| POST | `/api/roadmaps/generate` | CR: generate roadmap (async job) |
| POST | `/api/roadmaps/:id/replan` | CR/AN: re-route based on mastery |
| POST | `/api/nodes/:id/content` | RE: assemble+verify resources (async job) |
| GET  | `/api/nodes/:id/content` | fetch verified resources + outline |
| POST | `/api/sessions/:id/messages` | (REBUILD) TU grounded reply instead of canned |
| POST | `/api/nodes/:id/assessment` | AS: generate quiz/assignment |
| POST | `/api/assignments/:id/submit` | submit work |
| POST | `/api/assignments/:id/grade` | AS: grade submission |
| GET  | `/api/jobs/:id` | async job status |
| GET  | `/api/usage` | managed-tier usage/limits |
| POST | `/api/courses` / PATCH/`fork`/`publish` | authoring/forking/versioning |
| *(exists)* | `/api/community/*` | already built — just call it from the UI |

---

## 9. Frontend changes
- **Onboarding flow** (new screen) before Dashboard for users without a profile.
- **Node Content view** (new) — the missing "where's the content" screen.
- **Session.jsx** — replace canned `submit()` with a call to the grounded TU endpoint; drive topic from active node; render citations; stream if possible.
- **Roadmap.jsx** — "Generate roadmap" entry; show job progress; reflect re-plans.
- **Community (Extras.jsx)** — replace `DISCUSSIONS`/`LEADERBOARD`/local state with `API.getCommunityThreads/...` (already in `api.js`).
- **Course authoring** UI (Phase 2).
- **Job/progress + usage** UI primitives (toasts already exist).
- **Fix latent bugs** (see STATUS §Bugs): `AgentsPage` `setScreen`, Courses `TopContributorsCard` `openModal`/`ProfileModal`, Session `ChatMessage` `session`, `ForkBanner` `navigate` no-op.

## 10. Suggested build order (mirrors ROADMAP)
provider abstraction + agent_runs → PR intake → CR roadmap gen → RE assemble+verify + Content view →
TU grounded → AS generate+grade → AN mastery+replan → CE (mostly done) → usage metering/caps →
community wiring → authoring/forking → breadth polish + bug sweep.
