# LearnOS → Coursera-parity (and beyond) — Working Spec

**Goal:** make LearnOS a genuinely better learning product than Coursera by leaning
into what we can do that they can't: **AI that generates and adapts** a rigorous,
resource-rich learning experience from the free/open web, per learner.

This is the north star; the tasks below are the road to it. Updated as we go.

## Where Coursera beats us today (the gaps to close)

1. **Embedded, media-rich lessons.** Coursera embeds lecture *video* inline, with
   readings and downloadable resources woven together. We only *link* out.
   → We must **embed** public resources: YouTube lectures inline, article/blog/paper
   cards with previews, visualizations — a real multimedia lesson, not a link list.

2. **Assessments are real.** Coursera has substantial graded assignments, peer
   projects, and proper quizzes/exams. Ours are thin popup modals with almost no
   content, structure, or feedback.
   → Assignments/projects/quizzes/exams become **full-page experiences**: rich
   instructions, embedded reference material, a real work surface, detailed
   rubric-based AI grading, and for quizzes a proper multi-question exam flow.

3. **A guided, adaptive path.** Coursera has structured specializations. We have
   disconnected roadmaps and courses.
   → Roadmaps must compose **courses/modules into a pathway from the learner's
   current mastery (A) to a target (B)**, gated by demonstrated mastery.

4. **Adaptation.** Neither of us truly adapts — this is our edge to seize.
   → The AI agents must **track proficiency, speed, and assignment/quiz results**
   and actively **adjust** difficulty, pacing, next-step recommendations, and the
   roadmap. A visible "learning coach" that guides the learner through.

## Target experience (definition of done)

- Open a course → modules → a lesson that **plays an embedded lecture video**,
  shows a substantial reading, and surfaces vetted articles/papers/blogs as rich
  cards, with a "mark complete" that advances the path.
- Open an assignment/exam → a **full page**: context, reference resources, a work
  surface (editor), submit → **detailed rubric feedback** and a grade that flows
  into mastery, XP, and the path.
- A **coach** panel/feed: "you're ahead — here's a stretch project", "revisit X",
  "next up: module Y", driven by real performance signals.
- A roadmap that is a **course pathway A→B**, unlocking by demonstrated mastery,
  re-planned when the learner struggles or races ahead.

## Workstreams (tracked as tasks) — all shipped ✅

1. ✅ **Rich embedded lesson viewer** — embeds YouTube inline (youtube-nocookie
   16:9), resource cards by kind, MarkdownText readings, prev/next navigation,
   completion→advance. `src/screens/Courses.jsx`.
2. ✅ **Full-page examination/assignment experience** — `AssignmentExam` replaces
   the modal: instructions, requirements checklist, autosaving work surface (code
   editor for coding kinds), submit → rubric feedback with score bars, grading
   sidebar. `src/screens/Extras.jsx`. Quiz exam flow via `QuizModal`.
3. ✅ **Adaptive learning engine + coach** — `GET /api/ai/coach` proficiency/pace
   from quiz_attempts + graded assignments + node mastery + activity; mastery-
   derived assignment difficulty; `LearningCoach` panel on Dashboard with
   clickable recommendations. `routes/ai.js`, `ai/agents/assessment.js`.
4. ✅ **Roadmap = course pathway (A→B)** — every AI course spins up a companion
   roadmap: one node per module (capstone included), linear prereq edges as
   mastery gates, `course_slug` on each node, "Study content" opens the course.
   `ai/agents/course.js`, `src/screens/Roadmap.jsx`.
5. ✅ **Resource enrichment everywhere** — module resources are reachability-
   verified before shipping and copied onto roadmap nodes (node_resources);
   the roadmap embeds lecture video inline. RE agent `propose-resources` job
   enriches any node on demand. `ai/agents/research.js`, `routes/nodes.js`.

## Constraints / principles

- Public, free, open resources only. Every external URL is reachability-verified
  before it ships (no dead links).
- Honest states: no fabricated data; graceful degradation without an LLM key.
- Each workstream ships independently, built + verified, committed to `main`.
