# Requirements: LearnOS

**Defined:** 2026-06-02
**Core Value:** A learner goes from a goal to proven mastery through one seamless agent-driven loop that works end to end.

> Derived from `docs/SPEC.md` + `docs/BACKLOG.md`. v1 = the MVP vertical mastery loop. v2 = full shippable vision.

## v1 Requirements (MVP — the vertical mastery loop)

### Platform / AI layer
- [ ] **PLAT-01**: Any agent can call an LLM through a single provider abstraction (managed key or user BYOK)
- [ ] **PLAT-02**: A brand-new account works on a managed default model with zero key setup
- [ ] **PLAT-03**: A user can add their own API key and have agents use it
- [ ] **PLAT-04**: API keys are encrypted at rest and never returned in full to the client
- [ ] **PLAT-05**: Every agent run is logged (tokens, cost, latency, status)
- [ ] **PLAT-06**: Long operations run as async jobs the UI can poll without blocking

### Profiling
- [ ] **PROF-01**: A new user completes a goal + short intake and a profile is persisted
- [ ] **PROF-02**: Generated roadmap/content reflects the user's stated goal (not seed data)

### Curriculum
- [ ] **CURR-01**: User generates a real roadmap (ordered DAG with objectives) from a goal
- [ ] **CURR-02**: The generated roadmap renders in the graph with real nodes/edges
- [ ] **CURR-03**: Failing an assessment re-routes the path (remediation inserted); mastering unlocks next

### Content
- [ ] **CONT-01**: Each active node shows 3–6 verified trusted resources
- [ ] **CONT-02**: Dead/hallucinated links are rejected by verification and never shown as trusted
- [ ] **CONT-03**: Resource content is extracted into study material (outline + key points)
- [ ] **CONT-04**: A Node Content view presents the resources + outline

### Tutor
- [ ] **TUT-01**: Tutor replies are real LLM output grounded in the node's extracted resources
- [ ] **TUT-02**: Session topic is driven by the active node, not a hardcoded constant
- [ ] **TUT-03**: Quiz / explain / examples actions produce relevant, node-specific output

### Assessment & Certification
- [ ] **ASMT-01**: The assessment agent generates a node-specific quiz/assignment
- [ ] **ASMT-02**: User submits text/code and receives an AI grade + specific feedback
- [ ] **ASMT-03**: Grades update mastery and award XP based on real performance
- [ ] **CERT-01**: A certificate issues when the mastery threshold is met across the roadmap

## v2 Requirements (full shippable vision)

### Community
- **COMM-01**: Threads / votes / replies persist across reload and devices (wire existing backend)
- **COMM-02**: Users can attach images and links to threads/replies
- **COMM-03**: Threads can reference a course/node and be marked solved

### Course authoring & forking
- **CRSE-01**: User can author a course with real modules/content (AI-assisted)
- **CRSE-02**: User can fork a course, edit it, and publish a new version visible to others
- **CRSE-03**: Enrolling in a course instantiates a personal roadmap

### Agents & Settings
- **AGNT-01**: Agents page shows live status; changing routing actually changes the model used
- **AGNT-02**: Settings shows managed-vs-BYOK tier and usage/limits

### Quality & hardening
- **QUAL-01**: No invented/hardcoded numbers remain on data-backed screens
- **QUAL-02**: Known latent UI bugs fixed (AgentsPage, TopContributors, Session rating, ForkBanner)
- **QUAL-03**: Managed-tier usage caps enforced gracefully; agent inputs sanitized

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile apps | Web-first for v1 |
| Payments / subscription billing engine | Plan cosmetic until post-MVP |
| Video / content hosting | Link to trusted sources, don't host |
| Real-time multi-user collaboration | Not core to the mastery loop |
| Marketplace monetization | Preserve open-source / forkable ethos |
| Multi-provider (OpenAI/Gemini) live | Anthropic-only for v1; stub behind abstraction |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01..06 | Phase 1 | Pending |
| PROF-01, PROF-02 | Phase 2 | Pending |
| CURR-01, CURR-02 | Phase 2 | Pending |
| CONT-01..04 | Phase 3 | Pending |
| TUT-01..03 | Phase 4 | Pending |
| ASMT-01..03 | Phase 5 | Pending |
| CURR-03 | Phase 5 | Pending |
| CERT-01 | Phase 5 | Pending |
| COMM-01..03 | Phase 6 | Pending |
| AGNT-01, QUAL-02 | Phase 6 | Pending |
| CRSE-01..03 | Phase 7 | Pending |
| AGNT-02 | Phase 7 | Pending |
| QUAL-01, QUAL-03 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 21 total — mapped to phases 1–5, unmapped: 0 ✓
- v2 requirements: 11 total — mapped to phases 6–8, unmapped: 0 ✓

---
*Requirements defined: 2026-06-02*
*Last updated: 2026-06-02 after ingest (lightweight formalize)*
