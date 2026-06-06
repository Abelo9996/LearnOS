# SPEC — Unresolved Round-2 Items

> Last updated: 2026-06-05
> Status of all 27 user-reported items: see [STATUS.md](STATUS.md) §F.
> This spec covers the 3 items still partial/unresolved and the agent-system gaps they depend on.

---

## Scope

Three user-reported gaps remain, all rooted in the same upstream cause: **the agent system is half-stubbed** (TU is real LLM with a hardcoded fallback; RE/AS/CR/AN/PR are unimplemented).

| Gap | User-reported issue | Root cause |
|---|---|---|
| G1 | #8 — Tutor falls back to bias-variance text when no key | `Session.jsx:124-139` fallback hardcoded to one topic |
| G2 | #9 — No external content (YouTube / articles / papers) | RE agent has no implementation; no extraction pipeline |
| G3 | #16 — "Generate practice" picks from a static bank | AS agent unimplemented; `ASSIGNMENT_LIBRARY` is a curated bank |

---

## G1 — Topic-aware Tutor fallback

**Problem.** `routes/ai.js` chat endpoint requires a key. When `complete()` throws `NO_KEY`, `Session.jsx` falls back to keyword text that's only correct for bias-variance.

**Fix (small, no new agent work).**
1. Rewrite the fallback in `Session.jsx` to use the **current session's `title`, `subtitle`, `course`, and `roadmap_node_id`** (already on `session`) to compose a generic, topic-aware reply:
   - "I can walk you through *{title}* — would you like an example, a recap, or a quiz?"
   - When the user message matches `quiz|test|assess`: still trigger the quiz UI (using the real `QUIZ` mock until AS lands).
   - When it matches `source|cite|paper`: list resources for **the current node** (pulled from `node_resources` once #G2.A lands; until then say "no verified sources yet").
2. Surface a **single, non-spammy banner** at the top of the chat when no key is configured: *"You're in offline mode. Add an Anthropic key in Settings to enable real tutor responses."* Suppress after dismissal (localStorage flag).
3. Add `ai/llm.js` already returns clear `code: 'NO_KEY'` — surface as a non-fatal toast on the first send.

**Files.** `src/screens/Session.jsx` (fallback block ~124-139), small banner component inline.
**Effort.** ~1 hour.
**Done when.** A no-key user starting a Genetic Engineering Mastery session sees responses about *that topic*, not bias-variance.

---

## G2 — Real external content via RE agent

**Goal.** When a user opens a node or asks the Tutor for sources, surface verified external content (YouTube, articles, papers, docs).

**Phased plan (no API keys required for phase A).**

### G2.A — Storage + UI shell (no LLM yet)
- **DB:** create `node_resources(id, node_id, kind, title, url, source, summary, verified_at, verified_by, status)` — already declared missing in STATUS C.
  - `kind ∈ {video, article, paper, docs, repo}`
  - `status ∈ {proposed, verified, rejected}`
- **Seed:** 3–5 verified resources per existing node (manual, one-time) — gives the UI something real to show today.
- **API:** `GET /api/nodes/:id/resources?status=verified` already implied by Roadmap node detail; wire it.
- **UI:** ModuleDetail "Resources" panel already exists; switch from agent-resource shim to the real table.

### G2.B — RE agent: proposal pipeline (needs Anthropic key)
- `ai/agents/research.js` — `proposeResources({nodeTitle, objectives, kind?}) → [{title, url, source, summary, kind}]`
  - Uses `complete()` with structured output (JSON schema in `ai/schemas.js`).
  - **Never** invent URLs. The agent must either (a) cite known canonical resources from its training data with explicit "candidate, unverified" flag, or (b) call out that human verification is required. (Locked decision: no hallucinated links shown as trusted.)
- Persist as `status='proposed'`.

### G2.C — Verification pipeline (needs an HTTP fetcher; no LLM cost for the check itself)
- Background job in `ai/jobs.js`: for each `proposed` resource, fetch the URL (HEAD + small GET), confirm 200 + content-type matches `kind`, extract `<title>` / `og:title` / oEmbed (for YouTube).
- On match → `status='verified'`, set `verified_at`.
- On 404/mismatch → `status='rejected'` with reason.
- Show verified-only by default; "Show unverified" toggle for power users.

### G2.D — Dynamic in-session insertion
- TU agent, when a user asks for resources, calls `research.proposeResources()` + reads `node_resources` and renders inline citations with the URL + source domain + verified badge.

**Files.** `db/database.js` (new table + migration), `ai/agents/research.js` (new), `ai/jobs.js` (verifier job), `routes/roadmaps.js` or new `routes/resources.js`, `src/screens/Roadmap.jsx` (ModuleDetail panel), `src/screens/Session.jsx` (citation rendering).
**Effort.** Phase A: ~2 hrs. Phase B+C: ~1 day. Phase D: ~3 hrs.
**Done when.** Opening "Prompt Engineering" in Generative AI Mastery shows ≥3 verified external resources; asking the Tutor "what should I read?" returns links the user can actually click.

---

## G3 — Real AI-generated assignments (AS agent)

**Goal.** "Generate practice" produces assignments **tailored to the current node and what the user has actually struggled with** — not a coin-flip from a static bank.

### G3.A — AS agent: generation
- `ai/agents/assessment.js` — `generateAssignment({nodeId, kind, difficulty, recentMistakes?}) → {title, course, kind, description, tasks[]}`
  - Structured output schema in `ai/schemas.js` (title ≤120 chars; tasks: 3–8 items; description: 200–800 chars).
  - System prompt scoped to "produce assignments that test the *objectives* of this node; do not invent topics outside the node's scope."

### G3.B — Wiring
- Replace `ASSIGNMENT_LIBRARY` pick in `Extras.jsx:355` with a call to `POST /api/ai/assignments/generate { node_id, kind }`.
- Keep `ASSIGNMENT_LIBRARY` only as the no-key fallback (already what STATUS implies).
- Add a "Difficulty" selector (easy/medium/hard) on the Generate button.
- For `kind === 'project'`: prompt the agent to also produce a `rubric` (list of scoring criteria) and store as `assignments.rubric_json`.

### G3.C — Real grading (separate, follow-up)
- `gradeSubmission({assignmentId, submission, rubric})` — out of scope here; tracked in STATUS B as a separate ❌ item.

**Files.** `ai/agents/assessment.js` (new), `ai/schemas.js` (+ schema), `routes/ai.js` (+ `/assignments/generate`), `src/api.js` (+ method), `src/screens/Extras.jsx` (replace the static pick block).
**Effort.** ~half a day.
**Done when.** Hitting "Generate practice" while in *Generative AI Mastery → Prompt Engineering* produces an assignment whose tasks specifically reference prompt engineering concepts — not "Build a feature flag system."

---

## Cross-cutting prerequisites

These are pulled forward from STATUS §B because G2/G3 depend on them:

| Prereq | Why it blocks the above |
|---|---|
| `node_objectives` already populated for all backfilled roadmaps | ✅ Done in round 2 — AS uses these as the basis for "tasks" |
| `ai/llm.js` `complete()` with structured output | ✅ Done — schema arg already supported |
| `agent_runs` + `usage_counters` | ✅ Done — RE/AS calls will log automatically |
| `node_resources` table | ❌ New — see G2.A |
| Background-job worker | ✅ `ai/jobs.js` exists; verifier job is just a new job type |

---

## Out of scope for this spec (tracked elsewhere)

- **PR (profiling/onboarding)** — STATUS §B. Needs `user_profiles` table + onboarding flow rework.
- **CR (roadmap generation / dynamic re-plan)** — STATUS §B. Major; separate spec.
- **AN (mastery + weak-spot detection)** — STATUS §B. Feeds back into G3 (`recentMistakes`) but can ship with a placeholder.
- **Real LLM grading of submissions** — separate item; G3.C above is a placeholder.
- **Cosmetic surfaces** from STATUS §G (Dashboard chart, session right rail concepts, GitHub chip). User did not call these out in the 27.

---

## Suggested execution order

1. **G1** (~1 hr) — biggest perceived-quality win for the smallest effort; ships without any new agent code.
2. **G2.A** (~2 hr) — gets real verified resources on screen with zero LLM dependency.
3. **G3.A + G3.B** (~half day) — turns Generate Practice into a real AS-agent feature.
4. **G2.B + G2.C + G2.D** (~1 day) — full RE pipeline; depends on a key being configured.

Total: ~2 working days to close every item the user raised, plus the agent-system prerequisites they imply.
