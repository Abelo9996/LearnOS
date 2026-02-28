"""
AI Roadmap Router — Generate personalized learning roadmaps using GPT-4.
"""

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

import db
from models_ai import LearningRoadmap, RoadmapMilestone, GenerateRoadmapRequest
from services.openai_service import get_openai_service

logger = logging.getLogger("learnos.ai_roadmap")
router = APIRouter(prefix="/ai/roadmap", tags=["ai-roadmap"])


@router.post("/generate")
async def generate_roadmap(request: GenerateRoadmapRequest):
    config = await db.get_openai_config(request.user_id)
    if not config:
        raise HTTPException(status_code=404, detail="OpenAI not configured. Please set up your API key first.")

    features = await db.get_feature_toggles(request.user_id)
    if features and not features.get("ai_roadmaps", True):
        raise HTTPException(status_code=403, detail="AI roadmap generation is disabled.")

    service = get_openai_service(config["api_key"])
    if not service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")

    # Get learner profile
    profile_dict = {}
    if request.use_profile:
        profile_dict = await db.get_learner_profile(request.user_id) or {}

    habits_dict = None
    if request.use_habits:
        habit = await db.get_learning_habit(request.user_id)
        if habit:
            habits_dict = habit
        else:
            habits_dict = {"sessions_per_week": 5, "average_session_duration": 30, "preferred_time_of_day": "morning"}

    try:
        roadmap_data = await service.generate_roadmap(
            goal=request.goal,
            learner_profile=profile_dict,
            learning_habits=habits_dict,
            target_weeks=request.target_weeks,
        )

        milestones = []
        for md in roadmap_data.get("milestones", []):
            try:
                milestone = RoadmapMilestone.model_validate(md)
            except Exception:
                milestone = RoadmapMilestone(
                    title=md.get("title", "Untitled"),
                    description=md.get("description", ""),
                    overview=md.get("overview", ""),
                    concepts=md.get("concepts", []),
                    estimated_hours=md.get("estimated_hours", 10),
                    prerequisites=md.get("prerequisites", []),
                    why_important=md.get("why_important", ""),
                    real_world_applications=md.get("real_world_applications", []),
                    recommended_projects=md.get("recommended_projects", []),
                    learning_steps=md.get("learning_steps", []),
                    web_resources=md.get("web_resources", []),
                )
            milestones.append(milestone)

        total_hours = sum(m.estimated_hours for m in milestones)
        spw = (habits_dict or {}).get("sessions_per_week", 5)
        asd = (habits_dict or {}).get("average_session_duration", 30)
        estimated_weeks = int(total_hours / (spw * asd / 60)) if spw and asd else int(total_hours / 10)

        roadmap_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        model = config.get("model", "gpt-4")

        roadmap_dict = {
            "roadmap_id": roadmap_id,
            "user_id": request.user_id,
            "goal": request.goal,
            "milestones": [m.model_dump() if hasattr(m, "model_dump") else m.dict() for m in milestones],
            "total_estimated_hours": total_hours,
            "estimated_completion_weeks": estimated_weeks,
            "adapted_to_profile": request.use_profile,
            "adapted_to_habits": request.use_habits,
            "difficulty_level": profile_dict.get("expertise_level", "intermediate") if profile_dict else "intermediate",
            "learning_strategy": roadmap_data.get("learning_strategy", ""),
            "success_tips": roadmap_data.get("success_tips", []),
            "potential_challenges": roadmap_data.get("potential_challenges", []),
            "mitigation_strategies": roadmap_data.get("mitigation_strategies", []),
            "generated_at": now,
            "last_updated": now,
            "ai_model": model,
        }
        await db.save_roadmap(roadmap_dict)

        return {
            "message": "Roadmap generated successfully!",
            "roadmap": roadmap_dict,
            "estimated_time": f"{total_hours} hours over {estimated_weeks} weeks",
        }

    except Exception as e:
        logger.exception("Failed to generate roadmap")
        raise HTTPException(status_code=500, detail=f"Failed to generate roadmap: {e}")


@router.get("/{roadmap_id}")
async def get_roadmap(roadmap_id: str):
    roadmap = await db.get_roadmap(roadmap_id)
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    return roadmap


@router.get("/user/{user_id}/roadmaps")
async def get_user_roadmaps(user_id: str):
    roadmaps = await db.list_roadmaps(user_id)
    return {"user_id": user_id, "roadmaps": roadmaps, "count": len(roadmaps)}


@router.put("/{roadmap_id}/milestone/{milestone_id}/complete")
async def complete_milestone(roadmap_id: str, milestone_id: str):
    roadmap = await db.get_roadmap(roadmap_id)
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")

    milestones = roadmap.get("milestones", [])
    found = False
    for m in milestones:
        if m.get("milestone_id") == milestone_id:
            m["completed"] = True
            m["completion_date"] = datetime.now().isoformat()
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Milestone not found")

    roadmap["milestones"] = milestones
    roadmap["last_updated"] = datetime.now().isoformat()
    await db.save_roadmap(roadmap)

    completed = sum(1 for m in milestones if m.get("completed"))
    total = len(milestones)

    return {
        "message": "Milestone marked as complete!",
        "roadmap": roadmap,
        "progress": f"{completed}/{total} milestones completed ({int(completed / total * 100)}%)",
    }


@router.delete("/{roadmap_id}")
async def delete_roadmap(roadmap_id: str):
    await db.delete_roadmap(roadmap_id)
    return {"message": "Roadmap deleted successfully"}
