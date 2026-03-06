# 📋 PROJECT.md — LearnOS Current State & Architecture

## Overview

**LearnOS** — The Open-Source AI University
**Version:** 4.1.0
**Repo:** https://github.com/Abelo9996/LearnOS
**License:** MIT

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + SQLite (aiosqlite) + Pydantic v2 |
| Frontend | Next.js 14 (App Router) + Tailwind CSS + TypeScript |
| AI | OpenAI GPT-4o — roadmaps, tutoring, assignments, analytics |
| Storage | SQLite (local), designed for Postgres migration |

## Agent System (8 Active Agents)

| Agent | Responsibility | Size |
|---|---|---|
| GoalDecomposition | Learning goals → concept graphs | 11KB |
| ConceptGraphEngine | Concept dependencies & mastery tracking | 5KB |
| LearningOrchestrator | Decides what/how to teach next | 8KB |
| AttentionAdaptation | Monitors signals, adapts pacing | 8KB |
| SocraticEvaluation | Evaluates understanding via reasoning | 8KB |
| LearnerProfiling | Models style, level, preferences | 18KB |
| ResourceCuration | Curates & ranks learning resources | 19KB |
| AssignmentGeneration | Generates assignments with rubrics | 17KB |

All agents inherit from `agents/base.py` (ABC with memory system).
Agent orchestration lives in `services/openai_service.py` (41KB).

## Architecture

```
LearnOS/
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── db.py                    # SQLite persistence (37KB)
│   ├── models.py                # Core data models
│   ├── models_ai.py             # AI-specific Pydantic models (18KB)
│   ├── models_extended.py       # Extended models (8KB)
│   ├── agents/                  # 8 AI agent modules
│   ├── services/
│   │   └── openai_service.py    # OpenAI integration (41KB)
│   └── routers/                 # 13 API route files
│       ├── courses.py           # Course CRUD & analytics
│       ├── ai_roadmap.py        # Roadmap generation
│       ├── ai_assignments.py    # Assignment generation
│       ├── ai_tutor.py          # Tutor chat
│       ├── ai_habits.py         # Habit tracking
│       ├── ai_content.py        # Content retrieval
│       ├── ai_config.py         # OpenAI config
│       ├── sessions.py          # Learning sessions
│       ├── onboarding.py        # Learner profiling
│       ├── assignments.py       # Assignment management
│       ├── goals.py             # Goal management
│       ├── progress.py          # Progress tracking
│       └── resources.py         # Resource management
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Landing page
│   │   ├── courses/             # Course views (35KB detail page)
│   │   ├── tutor/               # AI tutor (20KB)
│   │   ├── habits/              # Habit analytics (25KB)
│   │   ├── onboarding/          # Profiling questionnaire (18KB)
│   │   ├── ai-settings/         # Config UI (16KB)
│   │   ├── assignments/         # Assignment detail
│   │   ├── graph/               # Concept graph viz
│   │   ├── learn/               # Learning session
│   │   ├── progress/            # Progress dashboard
│   │   ├── ai-assignments/      # AI assignments
│   │   └── roadmap/             # Roadmap page
│   ├── components/              # Shared components
│   └── lib/                     # API config, user ID utils
├── VISION.md                    # Full vision document
├── CONTRIBUTING.md              # Contributor guide
├── README.md                    # Public-facing README
└── LICENSE                      # MIT
```

## Current Capabilities

✅ Course creation & management
✅ AI-generated learning roadmaps with milestones
✅ Personalized AI tutoring (Socratic dialogue)
✅ Auto-generated assignments with rubrics & grading
✅ Learning habit analytics with AI insights
✅ Learner profiling & adaptive content
✅ Concept graph visualization
✅ Progress tracking & session management
✅ Persistent SQLite storage

## Known Limitations

- ❌ Single-user mode (hardcoded `demo_user`)
- ❌ No authentication
- ❌ No deployment (localhost only)
- ❌ No tests
- ❌ No Docker
- ❌ No community features
- ❌ No course sharing/marketplace
