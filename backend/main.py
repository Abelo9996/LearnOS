import os
import logging
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("learnos")

from routers import (
    goals, sessions, progress, onboarding, assignments, resources,
    ai_config, ai_roadmap, ai_content, ai_habits, ai_assignments, courses
)
from db import init_database

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app = FastAPI(
    title="LearnOS API",
    description="Agentic Learning Operating System — AI-Enhanced Learning Platform",
    version="4.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core course router
app.include_router(courses.router, prefix="/api", tags=["courses"])

# Original routers
app.include_router(goals.router, prefix="/api", tags=["goals"])
app.include_router(sessions.router, prefix="/api", tags=["sessions"])
app.include_router(progress.router, prefix="/api", tags=["progress"])

# Personalization
app.include_router(onboarding.router, prefix="/api", tags=["onboarding"])
app.include_router(assignments.router, prefix="/api", tags=["assignments"])
app.include_router(resources.router, prefix="/api", tags=["resources"])

# AI-powered
app.include_router(ai_config.router, prefix="/api", tags=["ai-config"])
app.include_router(ai_roadmap.router, prefix="/api", tags=["ai-roadmap"])
app.include_router(ai_content.router, prefix="/api", tags=["ai-content"])
app.include_router(ai_habits.router, prefix="/api", tags=["ai-habits"])
app.include_router(ai_assignments.router, tags=["ai-assignments"])


@app.on_event("startup")
async def startup_event():
    await init_database()
    logger.info("LearnOS API started")


@app.get("/")
async def root():
    return {"message": "LearnOS API is running", "version": "4.1.0"}


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)
