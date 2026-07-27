# LearnOS v2 — "Coursera, but it adapts to you"

**North star:** a free, self-hosted product where anyone can say *"I want to go from
knowing nothing about X to being genuinely good at X"* and get a rigorous,
media-rich, assessment-heavy pathway that **adapts to them** — the thoroughness of
Coursera plus the flexibility only generative AI can provide.

Parity v1 (`COURSERA_PARITY_SPEC.md`) closed the *surface* gaps: embedded video,
full-page exams, a coach, course-linked roadmaps. This spec closes the **depth**
gap, which is the real one. It is written against measured data, not impressions.

---

## Part 1 — What Coursera actually does (measured)

Reference course: **Supervised Machine Learning: Regression and Classification**
(DeepLearning.AI / Stanford, Andrew Ng) — 3 modules, ~33 hours.

| Module | Videos | Readings | Practice quizzes | Graded programming | Ungraded labs | Time |
|--------|--------|----------|------------------|--------------------|---------------|------|
| 1. Introduction to ML | 20 videos / 147 min | 1 | 3 quizzes / 35 min | — | 4 labs / 240 min | 7 h |
| 2. Multiple variables | 10 videos / 66 min | — | 2 quizzes / 45 min | 1 lab / 180 min | 5 labs / 300 min | 10 h |
| 3. Classification | 12 videos / 140 min | 2 | 4 quizzes / 120 min | 1 lab / 180 min | 9 labs / 540 min | 16 h |
| **Total** | **42 videos / 353 min** | **3** | **9 quizzes** | **2 graded** | **18 labs / 1080 min** | **33 h** |

### The structural primitives that make it thorough

1. **Two-tier assessment.** *Practice* quizzes are ungraded with unlimited
   attempts and immediate explanations; *graded* quizzes/assignments carry attempt
   limits and a pass threshold. Learners rehearse safely, then prove it.
2. **Hands-on labs dominate.** 1080 min of labs vs 353 min of video — **3× more
   doing than watching**. Optional-but-expected, sandboxed, worked.
3. **Auto-graded programming.** Code runs against visible *and hidden* test cases;
   score = % of tests passed.
4. **Peer review with rubrics** for work requiring judgment (essays, projects,
   design) — ~25% of courses. Each rubric item scored numerically. Coursera now
   augments this with AI grading for faster feedback.
5. **Per-item time estimates and explicit learning objectives** on every module.
6. **In-video retrieval practice** — questions posed mid-lecture, answered in the
   following video.
7. **Specializations**: 3–6 courses sequenced into one credential, terminating in a
   **capstone** that synthesizes everything.

---

## Part 2 — Where we actually are (measured today)

Query against our live DB:

| Course | Modules | Lessons | Avg lesson body | Videos | Quizzes | Labs | Claimed hours |
|--------|---------|---------|-----------------|--------|---------|------|---------------|
| ml-foundations | 3 | 6 | 370 chars | 2 | 0 | 0 | 16 |
| deep-learning | 3 | 6 | 291 chars | 2 | 0 | 0 | 20 |
| linear-algebra | 3 | 5 | 275 chars | 2 | 0 | 0 | 10 |
| systems-design | 3 | 4 | 379 chars | 0 | 0 | 0 | 12 |
| prompt-eng | 3 | 4 | 396 chars | 0 | 0 | 0 | 8 |
| pgm | 3 | 3 | 454 chars | 0 | 0 | 0 | 9 |
| *(AI-generated)* distributed-systems | 2 | 6 | 1128 chars | 1 | 0 | 0 | 120 |

Lesson body length across all 34 lessons: **min 39, median 451, max 3393 chars.**

Seed assignments: **description 0 chars, 0 tasks** for 5 of 6.

### The honest gap

| Dimension | Coursera | LearnOS today | Gap |
|-----------|----------|---------------|-----|
| Items per module | ~14 videos + 3 quizzes + 6 labs | ~2 lessons | **~20×** |
| Authored words per course | tens of thousands + 6h video | ~2.2k chars total | **~50×** |
| Practice vs graded tiers | Yes | No distinction | missing |
| Hands-on labs | 3× video time | none | missing |
| Auto-graded code | test cases | none | missing |
| Rubric-scored projects | peer + AI | AI rubric exists, thin | partial |
| Per-item time estimates | every item | module-level only | partial |
| In-lesson retrieval practice | yes | no | missing |
| Multi-course specialization | 3–6 courses + capstone | 1 course = 1 roadmap | missing |
| Placement / diagnostic | — *(Coursera lacks this)* | none | **our opportunity** |
| Adaptive re-planning | — *(Coursera lacks this)* | heuristic coach only | **our opportunity** |

**Verdict:** we have the right *skeleton* and none of the *muscle*. A user opening
`ml-foundations` today gets six paragraphs. Coursera gives them 33 hours. The
single biggest reason is that we generate an entire course in **one 8000-token LLM
call** — that ceiling makes shallowness structural, not incidental.

---

## Part 3 — Target architecture

### 3.1 Content model (what a course must contain)

A course is a **specialization-grade** artifact:

```
Course
├── outcomes[]        what you can DO after (not "topics covered")
├── prerequisites[]   with a diagnostic to check them
├── skills[]          tagged, tracked to mastery
└── Module (6–12 per course)
    ├── objectives[]        explicit, measurable
    ├── estimated_minutes
    └── Lesson (6–14 per module)
        ├── kind: video | reading | lab | practice_quiz
        │         | graded_quiz | programming | project | discussion
        ├── estimated_minutes     (per item, like Coursera)
        ├── is_graded, is_optional
        ├── body_md               1500–4000 chars for readings
        ├── url                   verified, embeddable
        └── checkpoints[]         in-lesson retrieval questions
```

**Depth floors (enforced by tests, not hope):**

| Item | Floor |
|------|-------|
| Modules per course | ≥ 6 |
| Lessons per module | ≥ 6 |
| Reading body | ≥ 1500 chars |
| Practice quiz items per module | ≥ 8 |
| Graded assessment per module | ≥ 1 |
| Lab/exercise per module | ≥ 1 |
| Verified external resources per module | ≥ 2 |

### 3.2 Assessment engine

- **Practice** — ungraded, unlimited attempts, explanation revealed per question.
- **Graded** — attempt limit (default 3), pass threshold (default 80%), recorded to
  mastery, blocks progression until passed.
- **Programming** — learner code run against declared test cases; score = % passed.
  Visible tests shown, hidden tests withheld.
- **Project** — AI rubric review: each criterion scored 0–4 with written
  justification, replacing Coursera's peer review with something *faster and
  always available*.
- **Item bank** — questions persist per module and are drawn from, so retakes
  aren't identical and spaced review can reuse them.

### 3.3 Roadmap = specialization (A → B)

- Roadmap sequences **multiple courses**, not one.
- **Point A** established by a diagnostic placement assessment.
- **Point B** is the user's stated goal, decomposed into skills.
- Nodes gate on **demonstrated mastery** (graded pass), not clicks.
- Failure triggers a **remediation loop**: targeted review items, then retest.

### 3.4 Generation pipeline (why depth becomes possible)

Replace the single call with a staged pipeline, each stage its own call:

```
1. Blueprint   → outcomes, prerequisites, skills, module titles + objectives
2. Per module  → lesson plan (kinds, titles, time estimates)   [1 call/module]
3. Per lesson  → full body / quiz items / lab spec             [1 call/lesson]
4. Resources   → search + verify (existing RE agent)
5. Assemble    → persist, enforce depth floors, retry thin sections
```

Runs as background jobs with progress, so a course takes minutes and arrives
*deep*. This is the structural fix.

---

## Part 4 — Milestones (sequenced, each independently shippable)

**M1 — Content model & depth floors.** Schema for lesson kinds, per-item time,
graded/optional flags, checkpoints, item bank, module objectives as first-class.
Depth-floor validator + tests. *Unblocks everything else.*

**M2 — Staged generation pipeline.** Blueprint → module → lesson calls as jobs
with progress. Retry thin output against the floors. *This is what makes courses
genuinely thorough.*

**M3 — Assessment engine.** Practice/graded tiers, attempt limits, pass
thresholds, item bank, programming auto-grade, rubric project review, mastery
write-back and gating.

**M4 — Specialization roadmaps.** Multi-course pathways, diagnostic placement,
mastery gates, remediation loops.

**M5 — Learner experience.** Per-item time in the UI, in-lesson checkpoints,
progress that reflects graded completion, schedule/pacing with deadlines.

**M6 — Verification harness.** Depth assertions, workflow E2E, grading
correctness, no-key degradation.

---

## Part 5 — Verification (what "done" means)

Run everything with **`npm run verify`** (server must be up). Individual suites:
`depth:check`, `verify:assessment`, `verify:specialization`, `verify:integrity`.

| # | Check | Passes when | Status |
|---|-------|-------------|--------|
| V1 | Depth floors | A generated course meets every floor in §3.1 | ✅ generated courses pass; seed courses known-fail |
| V2 | Time honesty | Σ per-item minutes ≈ course `hours` (±20%) | ✅ hours are derived from items, never asserted |
| V3 | Practice ≠ graded | Practice attempts don't move grade; graded do | ✅ |
| V4 | Attempt limits | 4th attempt on a 3-limit graded quiz is refused | ✅ 409 NO_ATTEMPTS_LEFT |
| V5 | Pass gate | Node stays locked until graded pass ≥ threshold | ✅ |
| V6 | Programming grade | Score == % of declared tests passed | ✅ incl. throw/syntax/infinite-loop safety |
| V7 | Rubric review | Every criterion returns score + justification | ✅ weighted |
| V8 | Gating | Pathway courses progress on demonstrated mastery | ✅ |
| V9 | Placement | Diagnostic sets a defensible starting node | ✅ prefix-only skipping |
| V10 | Resources live | 100% of shipped URLs reachability-verified | ✅ 73/73 |
| V11 | No-key degradation | Every AI surface degrades honestly, no crash | ✅ |
| V12 | No fabrication | No placeholder/lorem content ships | ✅ 150 lessons, 96 items scanned |

**Current verdict:** 41/41 blocking checks pass. The one known failure is the six
hand-written seed courses, which predate the depth model — they clear once
regenerated through the builder.

### Measured before/after

| | Before | After |
|---|--------|-------|
| Modules per generated course | 3 | 9 |
| Lessons | 6 | 116 |
| Quiz items | 0 | 96 |
| Verified resources | ~2 | 53 |
| Graded assessments | 0 | 10 |
| Declared hours | asserted by the model | 115, derived from per-item estimates |

---

## Part 6 — Principles

- **Measured, not asserted.** Every depth claim is a query or a test.
- **Doing > watching.** Labs and assessment outweigh passive content, as Coursera
  proves (3:1).
- **Honest states.** No fabricated progress, no dead links, graceful without a key.
- **Adaptive is the differentiator.** Coursera is static and identical for
  everyone. Placement, remediation, and re-planning are where we beat it.
- **Free and open.** Public resources only, verified before shipping.
