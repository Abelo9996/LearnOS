from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import goals, sessions, progress
from database import init_db

app = FastAPI(
    title="LearnOS API",
    description="Agentic Learning Operating System",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(goals.router, prefix="/api", tags=["goals"])
app.include_router(sessions.router, prefix="/api", tags=["sessions"])
app.include_router(progress.router, prefix="/api", tags=["progress"])

@app.on_event("startup")
async def startup_event():
    await init_db()

@app.get("/")
async def root():
    return {"message": "LearnOS API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
