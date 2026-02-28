"""
Onboarding Router — Learner profiling questionnaire.
"""

import logging
import uuid
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import db
from agents.learner_profiling import LearnerProfilingAgent
from models_extended import OnboardingQuestion, OnboardingResponse, OnboardingSession, LearnerProfile

logger = logging.getLogger("learnos.onboarding")
router = APIRouter(prefix="/onboarding", tags=["onboarding"])

profiling_agent = LearnerProfilingAgent()

# Onboarding sessions are short-lived — in-memory is fine
_onboarding_sessions: Dict[str, dict] = {}


class StartOnboardingRequest(BaseModel):
    user_id: str


class SubmitOnboardingRequest(BaseModel):
    session_id: str
    responses: List[OnboardingResponse]


@router.post("/start")
async def start_onboarding(request: StartOnboardingRequest):
    try:
        result = await profiling_agent.process({"generate_questions": True})
        questions = result["questions"]
        questions_dict = [q.model_dump() for q in questions]

        session_id = str(uuid.uuid4())
        _onboarding_sessions[session_id] = {
            "session_id": session_id,
            "user_id": request.user_id,
            "questions": questions,
        }

        return {
            "session_id": session_id,
            "questions": questions_dict,
            "total_questions": len(questions),
            "estimated_time_minutes": 10,
        }
    except Exception as e:
        logger.exception("Failed to start onboarding")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submit")
async def submit_onboarding(request: SubmitOnboardingRequest):
    try:
        session = _onboarding_sessions.get(request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Onboarding session not found")

        result = await profiling_agent.process({
            "questions": session["questions"],
            "responses": request.responses,
        })

        profile: LearnerProfile = result["profile"]
        insights: List[str] = result["insights"]

        # Persist profile to SQLite
        await db.save_learner_profile(session["user_id"], profile.model_dump())

        # Clean up session
        _onboarding_sessions.pop(request.session_id, None)

        return {
            "profile": profile,
            "insights": insights,
            "message": (
                f"Welcome! Your learning style is {profile.learning_style.value} "
                f"and you're at the {profile.expertise_level.value} level."
            ),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to submit onboarding")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profile/{user_id}")
async def get_profile(user_id: str):
    profile = await db.get_learner_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Learner profile not found")
    return profile


@router.put("/profile/{user_id}")
async def update_profile(user_id: str, profile: dict):
    await db.save_learner_profile(user_id, profile)
    return {"message": "Profile updated successfully", "profile": profile}
