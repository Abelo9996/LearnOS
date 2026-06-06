# LearnOS — Product Specification (Target State)

> Source of truth for **what LearnOS does**. Pairs with [ARCHITECTURE.md](ARCHITECTURE.md) (how),
> [STATUS.md](STATUS.md) (built vs missing), [BACKLOG.md](BACKLOG.md) (the work), and
> [../.planning/ROADMAP.md](../.planning/ROADMAP.md) (sequencing).
> This document supersedes the now-stale `../PRODUCT_AUDIT.md`.

---

## 1. One-line definition

LearnOS is an **agent-orchestrated mastery engine**: a user declares "I want to master X," and a
team of specialized AI agents generates a real roadmap, assembles trusted course content, tutors
the user through it, assesses mastery, and **dynamically re-routes the path** based on results —
on top of an open, forkable, community-driven course ecosystem.

It is **not** a tutor chatbot with a dashboard around it. The chat tutor is one of seven agents.

---

## 2. Product decisions (locked)

| Decision | Choice | Implication |
|---|---|---|
| **AI execution / cost** | **Hybrid** — managed default model + BYOK | New accounts work instantly on a platform key (rate-limited); users add their own key in Settings to remove limits. Requires usage metering + a managed key + provider abstraction. |
| **Trusted content sourcing** | **LLM-proposed + auto-verified** | The Research agent proposes resources; a verification pass confirms each link resolves/matches before a learner ever sees it. Unverified resources are quarantined, never shown as trusted. |
| **First ship (MVP)** | **Vertical mastery loop** | One real end-to-end path for a single learner, polished, before breadth. Defined in §6. |
| **Spec format** | **Living docs + GSD roadmap** | These `docs/*.md` are the source of truth; `.planning/ROADMAP.md` sequences execution. |

### 2.1 Core data concept — Course vs Roadmap (clarified v1.1)

These are **two distinct things** and the schema must keep them separate:
- **Course** = a *shareable, forkable, publishable template* — authored content + structure, lives in the catalog, is versioned, can be forked and improved, owned by an author. (`courses`, `course_modules`, `module_content`.)
- **Roadmap** = a *personal learning instance* — one user's path through a subject, with per-node mastery and dynamic re-routing. It can be **generated standalone from a goal**, or **spawned when a user enrolls in / forks a course**. (`roadmaps`, `roadmap_nodes`, mastery.)

So: enrolling in a course instantiates a roadmap for you; generating from a goal creates a roadmap that *may* later be published as a course. AI generation (CR/RE) produces the reusable course artifact; the learner always progresses against a roadmap instance.

---

## 3. The Agent System (the core of the product)

Seven agents. Each is a **server-side, contract-bound** unit (typed input → typed JSON output),
runnable individually or composed by the Orchestrator. Today only "TU" exists, and it's faked
(keyword canned text). The real definitions:

| Code | Agent | Job (what it must actually do) | Primary writes |
|---|---|---|---|
| **PR** | Profiling | Onboarding intake → goal, prior knowledge, time budget, learning style, motivation. Re-profiles as behavior changes. | `user_profiles` |
| **CR** | Curriculum | Turn a goal + profile into a **real roadmap**: an ordered DAG of concept nodes with objectives, prerequisites, and an estimated path length. Re-plans when Analytics flags drift. | `roadmaps`, `roadmap_nodes`, `roadmap_edges`, `node_objectives` |
| **RE** | Research | For a node/topic, **find + verify** trusted resources (YouTube, papers, articles, books), then **extract their actual content** (video transcripts, paper/article text) into structured study material the Tutor can ground on. | `node_resources`, `module_content` |
| **TU** | Tutor | Teach a node interactively, **grounded in that node's verified resources + objectives** (RAG). Adapt explanations to the profile. | `sessions`, `session_messages` |
| **AS** | Assessment | Generate quizzes/assignments per node; **grade** free-text/code submissions against a rubric; emit a mastery score + targeted feedback. | `assessments`, `quiz_questions`, `assignment_submissions`, `assignments` |
| **AN** | Analytics | Consume assessment + session signals → compute per-node mastery, detect weak spots, and **trigger CR re-planning** (remediate weak nodes, skip mastered ones). | `mastery_events`, roadmap node status |
| **CE** | Certification | Verify mastery threshold across a roadmap → issue a verifiable certificate. | `certificates`, `badges` |

**Model routing:** each agent maps to a model via `agent_routing` (per-user override) or a managed
default. Suggested tiers — heavy reasoning (CR re-plan, AS grading) → Sonnet/Opus; high-volume
(TU chat, RE proposal) → Sonnet/Haiku; cheap classification (verification) → Haiku. See ARCHITECTURE §4.

### 3.1 Agent I/O contracts (summary — full schemas in ARCHITECTURE §5)

- **PR.intake**(goal, answers[]) → `{ profile: {background, time_per_week, level, style, motivations[]} }`
- **CR.generateRoadmap**(goal, profile) → `{ title, subtitle, nodes[{title, objectives[], prereqs[], est_hours}], edges[[from,to]] }`
- **CR.replan**(roadmapId, masteryEvents[]) → `{ nodeStatusUpdates[], insertedNodes[], rationale }`
- **RE.assemble**(nodeTitle, objectives[]) → `{ resources[{type, title, url, source, why}], outline[] }`
- **TU.respond**(sessionContext, resources[], userMsg) → `{ reply, kind, citations[] }`
- **AS.generate**(node, objectives[]) → `{ questions[], assignment? }`
- **AS.grade**(submission, rubric) → `{ score, rubricScores[], feedback }`
- **AN.evaluate**(masteryEvents[]) → `{ perNodeMastery[], weakNodes[], recommendation }`
- **CE.evaluate**(roadmap) → `{ eligible, mastery, certificateDraft? }`

Every agent call is logged to `agent_runs` (tokens, cost, latency, status) for observability and billing.

---

## 4. Core product loops

### Loop A — Create / acquire a course
1. **Generate from scratch:** user states a goal → CR produces a roadmap → RE fills each node with
   verified content → a real, navigable course exists.
2. **Enroll** in a community course (already partly built).
3. **Fork** a community course → user gets an editable copy → can regenerate/augment nodes with agents
   → **publish back** to the community (versioned).

### Loop B — Master a node (the inner loop, repeated step 1→N)
Profile-aware **TU session grounded in verified resources** → **AS assignment/quiz** → user submits →
**AS grades** → **AN updates mastery** → cascade unlocks next node OR **CR inserts remediation** →
repeat. At the end, **CE issues a certificate**.

### Loop C — Community improvement
Threads reference specific courses/nodes, support **images + links**, back-and-forth replies, upvotes,
"mark solved," and feed back into course quality (e.g., errata → author regenerates a node).

### Loop D — Gamification (already real)
XP / levels / streaks / badges / certificates already cross-cut all features via `awardXP` /
`updateStreak` / the session-completion cascade. Keep; extend to award XP for authoring/forking/community.

---

## 5. Feature specification (target behavior + acceptance)

> Status tags live in [STATUS.md](STATUS.md); this section defines the **intended** behavior.

### 5.1 Onboarding & Profiling (NEW)
- First login (or "new goal") opens an intake: goal, current level, weekly time, learning style.
- PR persists a `user_profiles` row used by every downstream agent.
- **Acceptance:** a new user, after intake, lands on a roadmap generated *for their stated goal* — not seed data.

### 5.2 Roadmap generation & dynamic adjustment (REBUILD)
- "Create roadmap" → CR generates nodes/edges/objectives, persisted and rendered in the existing graph.
- Completing assessments updates node mastery; AN re-routes (remediation nodes inserted, mastered nodes skippable).
- **Acceptance:** roadmap reflects the user's goal; failing an assessment visibly changes the path.

### 5.3 Course content (NEW — the "I don't know where the content is" gap)
- Each node has a **Content view**: verified resources (video/paper/article/book) + an AI outline + key points.
- Resources show source + "verified" state; dead/unverifiable links never appear.
- **Acceptance:** clicking a node shows real, working, relevant learning material.

### 5.4 Tutor sessions (REBUILD)
- Real LLM, grounded in the node's resources/objectives, profile-aware, with working quiz cards, citations,
  visualizer, whiteboard. Topic comes from the *active node*, not a hardcoded "Bias-Variance" constant.
- BYOK/managed routing per `agent_routing`.
- **Acceptance:** ask about the node's topic → get a relevant, sourced answer; "quiz me" → a real generated quiz.

### 5.5 Assessment & grading (REBUILD)
- AS generates node-specific quizzes/assignments; user submits text/code; AS grades against a rubric with feedback.
- Grades flow to AN → mastery → roadmap. XP awarded on real performance.
- **Acceptance:** a graded submission changes mastery and feedback is specific to the answer.

### 5.6 Course authoring, forking, publishing (NEW/EXTEND)
- Users create courses (manually or agent-generated), edit modules, fork others, version, and publish.
- `courses` gains author, `forked_from`, visibility (draft/published), real `course_modules`/`module_content`.
- **Acceptance:** a user can author a course, fork another, edit it, and publish a new version visible to others.

### 5.7 Community (WIRE + EXTEND)
- Wire the existing Community UI to the **already-built** backend + api.js methods.
- Extend: image/link attachments, course/node references, "mark solved," real leaderboard from `/community/leaderboard`.
- **Acceptance:** threads, votes, replies persist across reload and devices; can attach an image and reference a course.

### 5.8 Agents page & Settings (EXTEND)
- Agents page shows **live** status from `agent_runs`/`agent_status`; routing button works (fix prop bug).
- Settings: managed-vs-BYOK indicator, per-agent model, usage/limits.
- **Acceptance:** changing an agent's model changes which model that agent actually calls.

### 5.9 Dashboard / Feed / Notifications / Search / Schedule / Flashcards / Certificates
- Mostly real already. Replace remaining hardcoded widgets (progress chart, streak bars, roadmap "forecast",
  session right-rail) with live data. Keep Schedule/Flashcards/Certificates as-is (already real).

---

## 6. MVP — the Vertical Mastery Loop (FIRST SHIP)

The single thread that turns "I can't do anything of value" into "I mastered something here."
Everything else is sequenced after this proves out.

**A single learner can:**
1. State a goal → answer ~4 intake questions → **PR** builds a profile.
2. **CR** generates a real roadmap for that goal (persisted, rendered in the graph).
3. Open the active node → **RE** has assembled **3–6 verified resources** + an outline (real Content view).
4. Run a **TU** session on that node — real model, grounded in those resources, profile-aware.
5. Take an **AS**-generated quiz/assignment → submit → **AS** grades it.
6. **AN** updates mastery → cascade unlocks the next node, or inserts remediation if weak.
7. Reach threshold → **CE** issues a certificate.

**MVP explicitly includes:** managed-default model so it works with zero setup; BYOK path; the
verification pass for resources; usage metering. **MVP explicitly excludes (Phase 2+):** authoring/publishing
UI, fork-back, community attachments, multi-course management, the breadth wiring of every screen.

**MVP simplifications (to ship faster):** (1) **PR** can be a simple intake **form + one classification call**, not a heavyweight agent; (2) pin to **Anthropic-only** for both managed default and BYOK (stub OpenAI/Gemini); (3) generate node content **lazily — only when the learner reaches a node**, never the whole course up front (cost control); (4) use **async jobs only** for the two slow ops (roadmap generation, node-content assembly) — tutor replies and grading are synchronous; (5) "grounded" = grounded in the **extracted** content/key-points, not raw URLs.

**Definition of done for MVP:** a brand-new account, with no key configured, can go goal → roadmap →
content → tutored session → graded assessment → mastery update → certificate, with every resource verified.

---

## 7. Non-goals (for now)
- Mobile apps; real-time multi-user collaboration; payments/subscriptions billing engine
  (the "plan" is cosmetic until post-MVP); video hosting (we link out to trusted sources, not host).
- Marketplace monetization. Keep the open-source/forkable ethos.

## 8. Cross-cutting requirements
- **Trust & safety:** no unverified link shown as trusted; basic prompt-injection hardening on agent inputs;
  PII-safe logging. **Cost control:** per-user usage caps on managed tier; prompt caching on agent system prompts.
- **Observability:** every agent run logged; failed runs surfaced, retryable. **Resilience:** long agent jobs
  (roadmap/content generation) run async with job status, not blocking request/response.
