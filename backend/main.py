from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import goals, sessions, progress, onboarding, assignments, resources, llm_config, auth
from database import init_db

app = FastAPI(
    title="LearnOS API",
    description="Agentic Learning Operating System - Multi-LLM Edition",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.on_event("startup")
async def startup_event():
    await init_db()

@app.get("/")
async def root():
    return {
        "message": "LearnOS API is running",
        "version": "3.0.0",
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


# ─── AI Settings (runtime config from UI) ─────────────────────────────

from ai_config import ai_config, AIConfigRequest, AIConfigStatusResponse

@app.get("/api/ai/config/status/{user_id}", response_model=AIConfigStatusResponse)
async def get_ai_config(user_id: str):
    """Get current AI configuration (keys masked)."""
    return ai_config.get_status()

@app.post("/api/ai/config/update/{user_id}", response_model=AIConfigStatusResponse)
async def update_ai_config(user_id: str, req: AIConfigRequest):
    """Update AI configuration. Changes take effect immediately."""
    return ai_config.update(req)

@app.post("/api/ai/config/test/{user_id}")
async def test_ai_config(user_id: str):
    """Test current API key and model."""
    return await ai_config.test_connection()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

