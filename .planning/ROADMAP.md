# Roadmap: LearnOS

> GSD-parseable roadmap. Pairs with [PROJECT.md](PROJECT.md), [REQUIREMENTS.md](REQUIREMENTS.md), and the
> living specs in [../docs/](../docs/SPEC.md). Plan a phase with `/gsd-plan-phase`; the AI phases are strong
> candidates for `/gsd-ai-integration-phase`.

## Overview

LearnOS has a working chassis (auth, DB, gamification) but no AI value loop. The journey: first stand up the
**AI platform** (provider abstraction, logging, async jobs), then build the **vertical mastery loop** one
agent at a time — profiling → curriculum → verified content → grounded tutor → assessment + dynamic
re-routing → certificate (Milestone 1 = MVP). Then make it a real product: wire community, add course
authoring/forking, and harden for launch (Milestone 2). Polish follows (Milestone 3).

## Milestones

- 🚧 **v1.0 MVP — Vertical Mastery Loop** — Phases 1–5 (in progress)
- 📋 **v1.1 Full Product** — Phases 6–8 (planned)
- 📋 **v1.2 Post-launch Polish** — Phase 9 (planned)

> **De-risk first (recommended):** before generalizing, build a **thin vertical spike** — one hardcoded goal
> driven through the *real* agent chain end-to-end (CR→RE→extract→TU→AS→AN) — to prove the hardest integration
> on a known-good case before trusting generation on arbitrary goals.

## Phases

- [ ] **Phase 1: AI Platform Plumbing** — provider abstraction (managed+BYOK), agent_runs, async jobs, key encryption
- [ ] **Phase 2: Profiling & Roadmap Generation** — intake → profile → real generated roadmap
- [ ] **Phase 3: Verified Course Content** — propose → verify → extract → Node Content view
- [ ] **Phase 4: Grounded Tutor** — real LLM sessions grounded in node resources, topic-driven
- [ ] **Phase 5: Assessment, Grading & Dynamic Routing** — generate/grade → mastery → re-route → certificate
- [ ] **Phase 6: Community (wire + extend)** — persist threads/votes/replies, attachments, references, bug sweep
- [ ] **Phase 7: Course Authoring, Forking & Publishing** — create/fork/edit/publish real course content
- [ ] **Phase 8: Launch Hardening** — usage caps, kill hardcoded surfaces, injection sanitization, eval gates

## Phase Details

### Phase 1: AI Platform Plumbing
**Goal**: Any agent can call a model (managed or BYOK), every run is logged, and long jobs run async.
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06
**Success Criteria** (what must be TRUE):
  1. A test agent call works on both the managed key and a user BYOK key
  2. Every agent call produces an `agent_runs` row (tokens, cost, latency, status)
  3. A long operation returns a jobId immediately and completes in the background
  4. Stored API keys are encrypted at rest and shown only masked
**Plans**: TBD

### Phase 2: Profiling & Roadmap Generation
**Goal**: A user states a goal, answers intake, and gets a real generated roadmap for that goal.
**Depends on**: Phase 1
**Requirements**: PROF-01, PROF-02, CURR-01, CURR-02
**Success Criteria** (what must be TRUE):
  1. A new user finishes onboarding and a profile is persisted
  2. CR generates an ordered DAG (nodes/edges/objectives) from the goal
  3. The generated roadmap renders in the graph with no seed-data fallback
**Plans**: TBD

### Phase 3: Verified Course Content
**Goal**: Each active node shows 3–6 verified trusted resources plus extracted study material.
**Depends on**: Phase 2
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04
**Success Criteria** (what must be TRUE):
  1. Opening a node shows real, working, on-topic resources
  2. Injected dead/fake links are rejected by the verifier and never shown as trusted
  3. Resource content is extracted into an outline + key points
**Plans**: TBD

### Phase 4: Grounded Tutor
**Goal**: The session is a real LLM grounded in the node's resources, with topic driven by the active node.
**Depends on**: Phase 3
**Requirements**: TUT-01, TUT-02, TUT-03
**Success Criteria** (what must be TRUE):
  1. Asking about the node's topic yields a relevant, sourced answer
  2. Sessions opened from different nodes differ (no hardcoded topic)
  3. The session uses the routed/BYOK model, logged to `agent_runs`
**Plans**: TBD

### Phase 5: Assessment, Grading & Dynamic Routing
**Goal**: Generated assessments are graded, mastery updates, the path re-routes, and a certificate issues.
**Depends on**: Phase 4
**Requirements**: ASMT-01, ASMT-02, ASMT-03, CURR-03, CERT-01
**Success Criteria** (what must be TRUE):
  1. A graded submission changes mastery and feedback is specific to the answer
  2. Failing inserts remediation; passing unlocks the next node
  3. Reaching the mastery threshold issues a certificate
**Plans**: TBD

### Phase 6: Community (wire + extend)
**Goal**: Real, persistent, social community on the existing backend.
**Depends on**: Phase 1
**Requirements**: COMM-01, COMM-02, COMM-03, AGNT-01, QUAL-02
**Success Criteria** (what must be TRUE):
  1. Threads/votes/replies persist across reload and devices
  2. A thread can carry an image/link attachment and reference a course
  3. The four known latent UI bugs are fixed
**Plans**: TBD

### Phase 7: Course Authoring, Forking & Publishing
**Goal**: Users create/fork/edit/publish courses with real, AI-assisted content.
**Depends on**: Phase 3, Phase 6
**Requirements**: CRSE-01, CRSE-02, CRSE-03, AGNT-02
**Success Criteria** (what must be TRUE):
  1. A user authors a course with real modules/content
  2. A forked course can be edited and published as a new version visible to others
  3. Enrolling instantiates a personal roadmap
**Plans**: TBD

### Phase 8: Launch Hardening
**Goal**: Safe and affordable at public scale.
**Depends on**: Phase 5, Phase 7
**Requirements**: QUAL-01, QUAL-03
**Success Criteria** (what must be TRUE):
  1. Managed-tier usage caps are enforced gracefully (no 500s)
  2. No invented/hardcoded numbers remain on data-backed screens
  3. Agent inputs are sanitized; CR/RE gated by an eval set before trusting output
**Plans**: TBD

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. AI Platform Plumbing | v1.0 | 0/TBD | Not started | - |
| 2. Profiling & Roadmap Gen | v1.0 | 0/TBD | Not started | - |
| 3. Verified Course Content | v1.0 | 0/TBD | Not started | - |
| 4. Grounded Tutor | v1.0 | 0/TBD | Not started | - |
| 5. Assessment & Dynamic Routing | v1.0 | 0/TBD | Not started | - |
| 6. Community | v1.1 | 0/TBD | Not started | - |
| 7. Course Authoring | v1.1 | 0/TBD | Not started | - |
| 8. Launch Hardening | v1.1 | 0/TBD | Not started | - |

## Milestone 3 — Post-launch polish (Phase 9, backlog)
Re-verification of stored links (RE-6), public verifiable certificate page (CE-2), community contribution XP
(CM-4), course↔roadmap UI linkage (CO-4), multi-provider (OpenAI/Gemini) behind the abstraction. See
[../docs/BACKLOG.md](../docs/BACKLOG.md) P2 items.
