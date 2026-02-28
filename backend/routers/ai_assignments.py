"""
AI-powered assignment generation endpoints.
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import db
from services.openai_service import get_openai_service

logger = logging.getLogger("learnos.ai_assignments")
router = APIRouter(prefix="/api/ai/assignments", tags=["ai-assignments"])


class MilestoneAssignmentRequest(BaseModel):
    user_id: str
    course_id: str
    milestone_id: str
    roadmap_id: str
    milestone_title: str
    milestone_description: str
    concepts: List[str]
    learning_steps: List[Dict[str, Any]]
    difficulty: str = "intermediate"


@router.post("/generate-milestone")
async def generate_milestone_assignment(request: MilestoneAssignmentRequest):
    config = await db.get_openai_config(request.user_id)
    if not config:
        raise HTTPException(status_code=404, detail="OpenAI not configured. Please set up your API key first.")

    features = await db.get_feature_toggles(request.user_id)
    if features and not features.get("ai_assignments", True):
        raise HTTPException(status_code=403, detail="AI assignment generation is disabled.")

    service = get_openai_service(config["api_key"])
    if not service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")

    try:
        assignment_data = await service.generate_milestone_assignment(
            milestone_title=request.milestone_title,
            milestone_description=request.milestone_description,
            concepts=request.concepts,
            learning_steps=request.learning_steps,
            difficulty=request.difficulty,
        )

        assignment_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        assignment_dict = {
            "assignment_id": assignment_id,
            "user_id": request.user_id,
            "course_id": request.course_id,
            "milestone_id": request.milestone_id,
            "roadmap_id": request.roadmap_id,
            "assignment_type": assignment_data.get("assignment_type", "essay"),
            "title": assignment_data.get("title", "Untitled Assignment"),
            "description": assignment_data.get("description", ""),
            "learning_objectives": assignment_data.get("learning_objectives", []),
            "instructions": assignment_data.get("instructions", []),
            "requirements": assignment_data.get("requirements", []),
            "questions": assignment_data.get("questions", []),
            "starter_materials": assignment_data.get("starter_materials"),
            "test_cases": assignment_data.get("test_cases", []),
            "rubric": assignment_data.get("rubric", []),
            "hints": assignment_data.get("hints", []),
            "resources": assignment_data.get("resources", []),
            "estimated_time_hours": assignment_data.get("estimated_time_hours", 2.0),
            "difficulty": request.difficulty,
            "status": "not_started",
            "created_at": now,
            "generated_by": config.get("model", "gpt-4"),
        }
        await db.save_assignment(assignment_dict)

        return {
            "message": "Assignment generated and saved successfully!",
            "assignment": assignment_dict,
            "assignment_id": assignment_id,
        }
    except Exception as e:
        logger.exception("Failed to generate assignment")
        raise HTTPException(status_code=500, detail=f"Failed to generate assignment: {e}")


@router.get("/list/{user_id}")
async def list_user_assignments(user_id: str, course_id: Optional[str] = None):
    assignments = await db.list_assignments(user_id, course_id=course_id)
    return {"assignments": assignments, "total": len(assignments)}


@router.get("/{assignment_id}")
async def get_assignment(assignment_id: str):
    assignment = await db.get_assignment(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


@router.put("/{assignment_id}/submit")
async def submit_assignment(assignment_id: str, submission: Dict[str, Any]):
    assignment = await db.get_assignment(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    assignment["submission"] = submission.get("submission", "")
    assignment["submission_date"] = datetime.now().isoformat()
    assignment["status"] = "submitted"
    await db.save_assignment(assignment)

    return {"message": "Assignment submitted successfully!", "assignment": assignment}


@router.put("/{assignment_id}/complete")
async def complete_assignment(
    assignment_id: str, score: Optional[float] = None, feedback: Optional[str] = None
):
    assignment = await db.get_assignment(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    assignment["status"] = "completed"
    assignment["completed_at"] = datetime.now().isoformat()
    if score is not None:
        assignment["score"] = score
    if feedback is not None:
        assignment["feedback"] = feedback
    await db.save_assignment(assignment)

    return {"message": "Assignment marked as completed!", "assignment": assignment}
