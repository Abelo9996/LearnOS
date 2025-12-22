from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import (
    goals, sessions, progress, onboarding, assignments, resources,
    ai_config, ai_roadmap, ai_content, ai_habits, courses
)
from database import init_db

app = FastAPI(
    title="LearnOS API",
    description="Agentic Learning Operating System - Course-Centric AI-Enhanced Platform",
    version="4.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core course router (v4.0 - central hub)
app.include_router(courses.router, prefix="/api", tags=["courses"])

# Original routers
app.include_router(goals.router, prefix="/api", tags=["goals"])
app.include_router(sessions.router, prefix="/api", tags=["sessions"])
app.include_router(progress.router, prefix="/api", tags=["progress"])

# Personalization routers (v2.0)
app.include_router(onboarding.router, prefix="/api", tags=["onboarding"])
app.include_router(assignments.router, prefix="/api", tags=["assignments"])
app.include_router(resources.router, prefix="/api", tags=["resources"])

# AI-powered routers (v3.0 - now course-integrated)
app.include_router(ai_config.router, prefix="/api", tags=["ai-config"])
app.include_router(ai_roadmap.router, prefix="/api", tags=["ai-roadmap"])
app.include_router(ai_content.router, prefix="/api", tags=["ai-content"])
app.include_router(ai_habits.router, prefix="/api", tags=["ai-habits"])

@app.on_event("startup")
async def startup_event():
    await init_db()

@app.get("/")
async def root():
    return {"message": "LearnOS API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
