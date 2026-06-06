# LearnOS

## What This Is

LearnOS is an **agent-orchestrated mastery engine**: a learner declares "I want to master X," and a team
of seven specialized AI agents generates a real roadmap, assembles **verified** trusted content (YouTube,
papers, articles, books), tutors them through it, assesses mastery, and **dynamically re-routes** the path
based on results — on top of an open, forkable, community-driven course ecosystem. It is *not* a tutor
chatbot with a dashboard around it; the chat tutor is one of seven agents.

## Core Value

A learner can go from a goal to proven mastery through one seamless agent-driven loop —
**generate → learn from trusted sources → get assessed → adapt** — that actually works end to end.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet. Foundations exist, but the value-delivering loop is unbuilt — ship the MVP to validate.)

### Active

<!-- Current scope. Full, ID'd list in REQUIREMENTS.md. -->

- [ ] MVP **vertical mastery loop** working on a managed model out of the box (REQUIREMENTS.md v1)
- [ ] Full vision: community, course authoring/forking, launch hardening (REQUIREMENTS.md v2)

### Out of Scope

- **Mobile apps** — web-first for v1
- **Payments / subscription billing engine** — the "plan" stays cosmetic until post-MVP
- **Video/content hosting** — we link to trusted external sources, never host
- **Real-time multi-user collaboration** — not core to the mastery loop
- **Marketplace monetization** — preserve the open-source / forkable ethos

## Context

Brownfield. Existing **React 18 + Vite** SPA → **Express 5** → **SQLite (better-sqlite3, WAL)** with JWT auth.
**Real today:** auth, the gamification engine (XP/levels/streaks/badges + session→roadmap→certificate cascade),
schedule/flashcards/certificates, courses catalog/search/star/enroll. **Missing:** the entire AI agent layer —
*zero LLM calls happen anywhere*; the tutor is canned keyword text; roadmaps/content/grades are seeded or fake;
the Community backend is built but the UI is orphaned. Full current-state inventory in `docs/STATUS.md`;
target behavior in `docs/SPEC.md`; technical plan in `docs/ARCHITECTURE.md`; task list in `docs/BACKLOG.md`.

## Constraints

- **Tech stack**: React 18 + Vite, Express 5, SQLite/better-sqlite3, JWT — keep; don't rewrite the chassis.
- **AI execution**: Hybrid — managed default model + BYOK — so a fresh account works instantly *and* power users can remove limits.
- **Content trust**: every external resource must be verified (reachable + correct type + on-topic) before a learner sees it; never show hallucinated/dead links as trusted.
- **Cost**: managed-tier usage must be capped; node content generated lazily (on node-reach), not whole-course up front.
- **Provider (v1)**: Anthropic-only for managed + BYOK; OpenAI/Gemini stubbed behind the abstraction.
- **Security**: API keys encrypted at rest; agent inputs (goals/submissions/community) sanitized against prompt injection.

## Key Decisions

<!-- Locked decisions that constrain future work. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid AI (managed default + BYOK) | New accounts work with zero setup; power users avoid limits | — Locked (2026-06-02) |
| Content = LLM-proposed + auto-verified | Avoid shipping dead/hallucinated links; trust is the product's credibility | — Locked (2026-06-02) |
| MVP = vertical mastery loop (depth over breadth) | Directly fixes "I can't do anything of value" | — Locked (2026-06-02) |
| Spec format = living docs (`docs/`) + GSD `.planning/` | Human- and agent-readable source of truth + executable phases | — Locked (2026-06-02) |
| Course vs Roadmap are distinct (template vs personal instance) | Keeps catalog/enrollment meaningful; enroll/fork spawns a roadmap | — Locked v1.1 (2026-06-02) |
| Grounding requires content extraction (transcripts/text), not raw URLs | Tutor can't RAG over a YouTube link | — Locked v1.1 (2026-06-02) |
| Lazy per-node content generation | Cost control | — Locked v1.1 (2026-06-02) |

---
*Last updated: 2026-06-02 after ingesting docs/ into GSD (lightweight formalize)*
