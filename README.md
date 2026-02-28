# 🧠 LearnOS — AI-Powered Learning Platform

LearnOS is an agentic learning operating system that uses GPT-4 to create personalized learning experiences. Tell it what you want to learn, and it generates a custom roadmap, assignments, and tracks your progress.

![Python](https://img.shields.io/badge/Python-3.11+-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **🗺️ AI Roadmaps** — GPT-4 generates personalized learning paths with milestones, resources, and timelines
- **📝 Smart Assignments** — Auto-generated assignments with rubrics, hints, test cases, and grading
- **📊 Progress Tracking** — Real-time analytics on sessions, concepts mastered, and milestone completion
- **🧠 Habit Analytics** — AI analyzes your learning patterns and suggests optimizations
- **🎯 Learner Profiling** — Onboarding questionnaire tailors content to your level and style
- **💾 Persistent Storage** — SQLite database — your data survives restarts

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- An OpenAI API key (for AI features)

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env to add your OPENAI_API_KEY (optional — can also set via UI)
python main.py
```

The API runs at `http://localhost:8000`. Docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

### First Steps

1. Go to **⚙️ Settings** and enter your OpenAI API key
2. Click **Create Course** and describe what you want to learn
3. Enable "Generate AI Roadmap" for a personalized learning path
4. Work through milestones, generate assignments, and track your progress

## Architecture

```
LearnOS/
├── backend/                 # FastAPI + SQLite
│   ├── main.py              # App entry point
│   ├── db.py                # SQLite persistence layer
│   ├── routers/             # API endpoints
│   │   ├── courses.py       # Course CRUD & analytics
│   │   ├── ai_roadmap.py    # AI roadmap generation
│   │   ├── ai_assignments.py # AI assignment generation
│   │   ├── ai_content.py    # Content retrieval
│   │   ├── ai_habits.py     # Habit tracking & AI insights
│   │   ├── ai_config.py     # OpenAI configuration
│   │   └── onboarding.py    # Learner profiling
│   ├── agents/              # AI agent modules
│   ├── services/            # OpenAI service layer
│   └── models_ai.py         # Pydantic v2 models
├── frontend/                # Next.js 14 + Tailwind CSS
│   ├── app/                 # App Router pages
│   │   ├── page.tsx         # Landing page
│   │   ├── courses/         # Course management
│   │   ├── assignments/     # Assignment detail view
│   │   ├── habits/          # Habit analytics
│   │   └── ai-settings/     # OpenAI configuration
│   ├── components/          # Shared components (Toast, etc.)
│   └── lib/                 # Utilities (API config, user ID)
└── .gitignore
```

## API Overview

| Endpoint | Description |
|---|---|
| `POST /api/courses/create` | Create a course (optionally with AI roadmap) |
| `GET /api/courses/list/{user_id}` | List user's courses |
| `GET /api/courses/{course_id}` | Course detail with roadmap & assignments |
| `POST /api/ai/roadmap/generate` | Generate a learning roadmap |
| `POST /api/ai/assignments/generate-milestone` | Generate assignment for a milestone |
| `POST /api/ai/config/setup` | Configure OpenAI API key |
| `POST /api/ai/habits/session/start` | Start a learning session |
| `POST /api/ai/habits/insights/generate` | Generate AI insights |

Full API docs available at `/docs` when the backend is running.

## Tech Stack

- **Backend:** FastAPI, SQLite (aiosqlite), Pydantic v2, OpenAI SDK
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, TypeScript
- **AI:** GPT-4 / GPT-4o for roadmaps, assignments, content, and insights

## Configuration

### Backend (`backend/.env`)

```env
DATABASE_PATH=learnos.db          # SQLite database file
HOST=0.0.0.0                      # Server host
PORT=8000                         # Server port
FRONTEND_URL=http://localhost:3000 # CORS origin
OPENAI_API_KEY=                   # Optional — can set via UI
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## License

MIT
