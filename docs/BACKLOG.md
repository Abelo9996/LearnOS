# LearnOS — Backlog (Everything Missing to Ship)

> Exhaustive, prioritized, dev-agent-ready. Each item has an ID, priority, rough size, dependencies,
> and acceptance criteria. **P0** = required for the MVP vertical loop ([SPEC.md §6](SPEC.md)).
> **P1** = required to ship the full vision. **P2** = polish / post-launch.
> Size: S (≤½ day) · M (1–2 days) · L (3–5 days) · XL (>1 week).
>
> Work the epics top-to-bottom; within an epic respect `deps`.

---

## EPIC 0 — Platform plumbing for AI (P0, unblocks everything)

| ID | P | Size | Item | Deps | Acceptance |
|---|---|---|---|---|---|
| AI-1 | P0 | M | `/ai/llm.js` provider abstraction: `complete()` resolving managed key + BYOK + `agent_routing` model | — | A test route can call Claude through it with both a managed key and a BYOK key |
| AI-2 | P0 | S | Encrypt `api_keys.encrypted_key` at rest (AES-GCM); never return full key to client | — | Stored keys are ciphertext; UI shows masked value only |
| AI-3 | P0 | M | `agent_runs` table + logging wrapper (tokens, cost, latency, status) around every agent call | AI-1 | Every agent call produces a row; failures recorded |
| AI-4 | P0 | M | Async jobs: `agent_jobs` table, in-process worker, `POST→{jobId}`, `GET /api/jobs/:id` | — | A long job returns a jobId immediately and completes in background |
| AI-5 | P0 | S | Prompt-cache agent system prompts; one repair-retry on invalid JSON output | AI-1 | Cache hits visible in usage; malformed output recovered once |
| AI-6 | P1 | M | Usage metering + per-user caps on managed tier (`usage_counters`); graceful over-cap response | AI-3 | Over-cap returns a handled "add key/wait" state, not a 500 |
| AI-7 | P0 | S | Agent I/O schemas (`/ai/schemas/*`) + validation | AI-1 | Each agent validates output before persisting |

## EPIC 1 — Profiling & onboarding (PR) (P0)

| ID | P | Size | Item | Deps | Acceptance |
|---|---|---|---|---|---|
| PR-1 | P0 | S | `user_profiles` table + migration | — | Row created per user |
| PR-2 | P0 | M | PR agent: `intake(goal, answers)` → profile JSON | AI-1,AI-7 | Returns valid profile for a goal |
| PR-3 | P0 | M | Onboarding UI (goal + ~4 questions) before Dashboard for profile-less users | PR-2 | New user completes intake; profile persists |
| PR-4 | P1 | S | Re-profile entry point ("start a new goal") | PR-2 | User can create additional goals/profiles |

## EPIC 2 — Curriculum generation & dynamic routing (CR/AN) (P0)

| ID | P | Size | Item | Deps | Acceptance |
|---|---|---|---|---|---|
| CR-1 | P0 | S | `node_objectives` table; link `roadmaps.course_slug` | — | schema in place |
| CR-2 | P0 | L | CR `generateRoadmap(goal, profile)` → persisted nodes/edges/objectives (async job) | EPIC0,PR-2 | Goal → a real, ordered DAG rendered in the graph |
| CR-3 | P0 | M | "Create roadmap" UI + job progress in `Roadmap.jsx`; remove `ACTIVE_ROADMAP` fallback reliance | CR-2 | User generates a roadmap from a goal, sees progress, then the graph |
| AN-1 | P0 | M | `mastery_events` table; AN `evaluate()` computing per-node mastery + weak nodes | EPIC0 | Assessment results produce mastery + weak-node list |
| CR-4 | P0 | L | CR `replan()` — insert remediation / adjust statuses from AN signals | AN-1,CR-2 | Failing an assessment visibly changes the path |
| AN-2 | P1 | M | Replace Dashboard/roadmap hardcoded analytics with `mastery_events`-derived data | AN-1 | Progress chart/forecast reflect real activity |

## EPIC 3 — Course content + verified resources (RE) (P0)

| ID | P | Size | Item | Deps | Acceptance |
|---|---|---|---|---|---|
| RE-1 | P0 | S | `node_resources`, `module_content` tables | — | schema in place |
| RE-2 | P0 | M | RE `propose(node, objectives)` → structured candidate resources | EPIC0 | Returns typed candidates with source + rationale |
| RE-3 | P0 | L | Verification pipeline (`verify.js` + sources: youtube/arxiv/crossref/googlebooks/generic) | RE-2 | Dead/hallucinated links rejected; only verified persisted as trusted |
| RE-3b | P0 | M | **Content extraction** (YouTube transcript / arXiv PDF→text / article scrape) → `module_content` summaries the Tutor grounds on | RE-3 | A node's resources yield extracted key-points, not just links |
| RE-4 | P0 | M | RE `assemble()` job → persists verified resources + outline per node (lazy, on node-reach) | RE-2,RE-3,RE-3b,AI-4 | A node gets 3–6 verified resources + outline |
| RE-5 | P0 | M | **Node Content view** UI (resources + outline + key points + verified badge) | RE-4 | Clicking a node shows real, working material |
| RE-6 | P2 | S | Scheduled re-verification of stored links (rot) | RE-3 | Stale links flagged/re-checked |

## EPIC 4 — Tutor sessions, grounded (TU) (P0)

| ID | P | Size | Item | Deps | Acceptance |
|---|---|---|---|---|---|
| TU-1 | P0 | L | Replace canned `submit()` with TU endpoint: real LLM grounded in node resources/objectives, profile-aware | EPIC0,RE-4 | Ask about the node's topic → relevant, sourced answer |
| TU-2 | P0 | M | Drive session topic/title from the **active node**, not hardcoded `SESSION` constant | CR-2,TU-1 | Sessions opened from different nodes differ |
| TU-3 | P1 | M | Citations rendering + streaming responses | TU-1 | Replies cite resources; tokens stream |
| TU-4 | P1 | S | Real right-rail (outline/concepts/mastery) from node data | TU-2,AN-1 | Right rail reflects the actual node/session |

## EPIC 5 — Assessment & grading (AS) (P0)

| ID | P | Size | Item | Deps | Acceptance |
|---|---|---|---|---|---|
| AS-1 | P0 | S | `assessments`, `quiz_questions`, `assignment_submissions` tables | — | schema in place |
| AS-2 | P0 | M | AS `generate(node, objectives)` → real quiz/assignment | EPIC0 | Node-specific assessment generated |
| AS-3 | P0 | L | AS `grade(submission, rubric)` → score + rubric + feedback; emit `mastery_events` | AS-1,AN-1 | Graded submission changes mastery; feedback is specific |
| AS-4 | P0 | M | Submission UI (text/code) + grade/feedback display wired into Assignments/Session | AS-2,AS-3 | User submits, gets a real grade + feedback |
| AS-5 | P1 | S | Award XP based on real performance (replace heuristic) | AS-3 | XP scales with actual score |

## EPIC 6 — Certification (CE) (mostly done)

| ID | P | Size | Item | Deps | Acceptance |
|---|---|---|---|---|---|
| CE-1 | P1 | S | Gate cert issuance on AN mastery threshold (not just "all nodes done") | AN-1 | Cert requires proven mastery |
| CE-2 | P2 | S | Public verifiable cert page by `id_short` | — | A cert ID resolves to a verification page |

## EPIC 7 — Community (wire + extend) (P1)

| ID | P | Size | Item | Deps | Acceptance |
|---|---|---|---|---|---|
| CM-1 | P1 | M | Wire `Community` component to existing `api.js`/backend (threads/votes/replies/leaderboard) | — | Threads/votes/replies persist across reload & devices |
| CM-2 | P1 | M | Attachments: images + links (`community_attachments`) | CM-1 | Can attach an image/link to a thread/reply |
| CM-3 | P1 | S | Course/node references in threads; "mark solved" | CM-1 | A thread can reference a course; OP can mark solved |
| CM-4 | P2 | S | Award XP for accepted answers / contributions | CM-1 | Community activity grants XP |

## EPIC 8 — Course authoring, forking, publishing (P1)

| ID | P | Size | Item | Deps | Acceptance |
|---|---|---|---|---|---|
| CO-1 | P1 | M | `courses` author/`forked_from`/`visibility`/version; `course_modules` | — | schema in place |
| CO-2 | P1 | L | Authoring UI: create course, edit modules, AI-generate a module (reuses CR/RE) | CO-1,CR-2,RE-4 | A user authors a course with real content |
| CO-3 | P1 | M | Fork → edit → publish-back with versioning | CO-2 | Forked course can be edited and published as a new version |
| CO-4 | P2 | S | Course ↔ roadmap linkage surfaced in UI | CR-1 | Enrolling generates/links a roadmap |

## EPIC 9 — Agents page & Settings (P1)

| ID | P | Size | Item | Deps | Acceptance |
|---|---|---|---|---|---|
| AG-1 | P1 | S | Fix `AgentsPage` `setScreen` bug; real status from `agent_runs` | AI-3 | Routing button works; statuses are live |
| AG-2 | P1 | S | Settings: managed-vs-BYOK indicator + usage/limits panel | AI-6 | User sees their tier + usage |

## EPIC 10 — Bug sweep & cosmetic→live (P1/P2)

| ID | P | Size | Item | Acceptance |
|---|---|---|---|---|
| BG-1 | P1 | S | Fix Courses `TopContributorsCard` `openModal`/`ProfileModal` crash | Clicking a contributor works |
| BG-2 | P1 | S | Fix Session `ChatMessage` `session` ReferenceError | Rating a message works |
| BG-3 | P2 | S | Make `ForkBanner` "Visit Community" actually navigate | Button navigates |
| BG-4 | P2 | M | Replace remaining hardcoded widgets (STATUS §F) with live data | No invented numbers on real screens |

---

## Priority rollup

- **P0 (MVP vertical loop):** all of EPIC 0; PR-1..3; CR-1..4 + AN-1; RE-1..5; TU-1..2; AS-1..4. → ship target.
- **P1 (full vision):** AI-6; AN-2; TU-3..4; AS-5; CE-1; EPIC 7; EPIC 8; EPIC 9; BG-1..2.
- **P2 (polish/post-launch):** RE-6; CE-2; CM-4; CO-4; BG-3..4.

## Risk register (watch these)
- **Roadmap & content quality is the whole product** — CR roadmap-gen and RE assembly/extraction are make-or-break. Gate them with an eval set (golden goals → expected node coverage/quality) before trusting output. This is the **#1 risk**, not a nice-to-have.
- **Cost blowups** on managed tier → enforce caps (AI-6) before public launch.
- **Hallucinated resources** → never skip verification (RE-3); trust is the product's credibility.
- **Latency** of generation → async jobs (AI-4) + good progress UI, or it feels broken.
- **Key security** → AI-2 is non-negotiable before BYOK/managed ships.
- **Prompt injection** via user goals/submissions/community → sanitize agent inputs.
