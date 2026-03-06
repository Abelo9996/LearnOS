from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from auth_middleware import AuthMiddleware
from routers import (
    goals, sessions, progress, onboarding, assignments, resources,
    llm_config, auth, courses, ai_roadmap, ai_content, ai_habits,
    ai_assignments, ai_tutor, ai_config, marketplace, social
)
from routers import certificates
from routers import agents as agents_router
from database import init_db
from db import init_database
from models_db import init_models
import os

# CORS: allow localhost + production frontend URL
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
]
if FRONTEND_URL not in ALLOWED_ORIGINS:
    ALLOWED_ORIGINS.append(FRONTEND_URL)

app = FastAPI(
    title="LearnOS API",
    description="The Open-Source AI University — Agentic Learning Platform",
    version="4.2.0"
)

# Middleware (order matters: CORS first, then auth)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuthMiddleware)

# Authentication & User Management
app.include_router(auth.router, prefix="/api", tags=["auth"])

# Core learning routers
app.include_router(goals.router, prefix="/api", tags=["goals"])
app.include_router(sessions.router, prefix="/api", tags=["sessions"])
app.include_router(progress.router, prefix="/api", tags=["progress"])

# Personalization routers
app.include_router(onboarding.router, prefix="/api", tags=["onboarding"])
app.include_router(assignments.router, prefix="/api", tags=["assignments"])
app.include_router(resources.router, prefix="/api", tags=["resources"])

# LLM Management router
app.include_router(llm_config.router, tags=["llm"])

# Course & AI routers (prefixes are baked into each router)
app.include_router(courses.router, prefix="/api", tags=["courses"])
app.include_router(ai_roadmap.router, prefix="/api", tags=["ai-roadmap"])
app.include_router(ai_content.router, prefix="/api", tags=["ai-content"])
app.include_router(ai_habits.router, prefix="/api", tags=["ai-habits"])
app.include_router(ai_assignments.router, tags=["ai-assignments"])  # already has /api prefix
app.include_router(ai_tutor.router, prefix="/api", tags=["ai-tutor"])
app.include_router(ai_config.router, prefix="/api", tags=["ai-config"])

# Marketplace
app.include_router(marketplace.router, prefix="/api", tags=["marketplace"])

# Social
app.include_router(social.router, prefix="/api", tags=["social"])

# Certificates
app.include_router(certificates.router, prefix="/api", tags=["certificates"])

# Agents
app.include_router(agents_router.router, prefix="/api", tags=["agents"])

@app.on_event("startup")
async def startup_event():
    await init_models()      # SQLAlchemy: create new tables (users, llm_configs, etc.)
    await init_db()          # Legacy: in-memory auth store
    await init_database()    # Legacy: aiosqlite tables (courses, roadmaps, etc.)
    from db import init_social_tables
    await init_social_tables()  # Social: discussions, cohorts, activity feed
    from db import init_certificate_tables
    await init_certificate_tables()  # Certificates
    from db import init_agent_tables
    await init_agent_tables()  # Agent memory + interactions

@app.get("/")
async def root():
    return {
        "message": "LearnOS API is running",
        "version": "4.2.0",
        "features": [
            "Multi-LLM support (OpenAI, Anthropic, Groq, Ollama)",
            "Adaptive content generation",
            "Personalized assessments",
            "Real-time feedback adaptation",
            "Resource curation",
            "User authentication & management",
            "Usage analytics & billing"
        ],
        "documentation": "http://localhost:8000/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

