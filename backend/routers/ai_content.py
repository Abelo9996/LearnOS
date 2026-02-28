"""
AI-Powered Content Router — Generate assignments and retrieve content using GPT-4.
"""

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

import db
from models_ai import GenerateAIAssignmentRequest, RetrieveContentRequest
from services.openai_service import get_openai_service

logger = logging.getLogger("learnos.ai_content")
router = APIRouter(prefix="/ai", tags=["ai-content"])


# ===== AI Assignment Generation =====

@router.post("/assignments/generate")
async def generate_ai_assignment(request: GenerateAIAssignmentRequest):
    config = await db.get_openai_config(request.user_id)
    if not config:
        raise HTTPException(status_code=404, detail="OpenAI not configured.")

    features = await db.get_feature_toggles(request.user_id)
    if features and not features.get("ai_assignments", True):
        raise HTTPException(status_code=403, detail="AI assignment generation is disabled.")

    service = get_openai_service(config["api_key"])
    if not service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")

    profile_dict = await db.get_learner_profile(request.user_id) or {}

    difficulty = request.difficulty_override
    if difficulty is None:
        expertise_map = {"absolute_beginner": 0.2, "beginner": 0.4, "intermediate": 0.6, "advanced": 0.8, "expert": 0.95}
        difficulty = expertise_map.get(profile_dict.get("expertise_level", "intermediate"), 0.6)

    try:
        assignment_data = await service.generate_assignment(
            concept=request.concept,
            difficulty=difficulty,
            learner_profile=profile_dict,
            include_test_cases=request.include_test_cases,
        )

        assignment_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        assignment_dict = {
            "assignment_id": assignment_id,
            "concept": request.concept,
            "user_id": request.user_id,
            "title": assignment_data["title"],
            "description": assignment_data["description"],
            "learning_objectives": assignment_data.get("learning_objectives", []),
            "instructions": assignment_data.get("instructions", []),
            "starter_code": assignment_data.get("starter_code"),
            "test_cases": assignment_data.get("test_cases", []) if request.include_test_cases else [],
            "rubric": assignment_data.get("rubric", []),
            "hints": assignment_data.get("hints", []),
            "solution_approach": assignment_data.get("solution_approach", ""),
            "common_mistakes": assignment_data.get("common_mistakes", []),
            "difficulty": str(difficulty),
            "estimated_time_hours": assignment_data.get("estimated_hours", 3.0),
            "requires_libraries": assignment_data.get("required_libraries", []),
            "generated_by": config.get("model", "gpt-4"),
            "generation_prompt": f"Generate assignment for {request.concept}",
            "created_at": now,
            "status": "not_started",
        }
        await db.save_assignment(assignment_dict)

        return {"message": "Assignment generated successfully!", "assignment": assignment_dict}
    except Exception as e:
        logger.exception("Failed to generate assignment")
        raise HTTPException(status_code=500, detail=f"Failed to generate assignment: {e}")


@router.get("/assignments/{assignment_id}")
async def get_ai_assignment(assignment_id: str):
    a = await db.get_assignment(assignment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return a


@router.get("/assignments/user/{user_id}/list")
async def list_user_ai_assignments(user_id: str):
    assignments = await db.list_assignments(user_id)
    return {"user_id": user_id, "assignments": assignments, "count": len(assignments)}


# ===== AI Content Retrieval =====

@router.post("/content/retrieve")
async def retrieve_content(request: RetrieveContentRequest):
    config = await db.get_openai_config(request.user_id)
    if not config:
        raise HTTPException(status_code=404, detail="OpenAI not configured.")

    features = await db.get_feature_toggles(request.user_id)
    if features and not features.get("content_retrieval", True):
        raise HTTPException(status_code=403, detail="AI content retrieval is disabled.")

    service = get_openai_service(config["api_key"])
    if not service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")

    profile_dict = await db.get_learner_profile(request.user_id) or {}

    try:
        content_list = await service.retrieve_and_analyze_content(
            concept=request.concept,
            content_types=request.content_types,
            learner_profile=profile_dict,
            max_results=request.max_results,
        )

        retrieved_items = []
        for cd in content_list:
            if cd.get("relevance_score", 0) >= request.min_relevance:
                content_id = str(uuid.uuid4())
                item = {
                    "content_id": content_id,
                    "concept": request.concept,
                    "user_id": request.user_id,
                    "title": cd["title"],
                    "url": cd["url"],
                    "content_type": cd.get("content_type", "article"),
                    "author": cd.get("author"),
                    "relevance_score": cd.get("relevance_score", 0.8),
                    "difficulty_level": cd.get("difficulty_level", "intermediate"),
                    "estimated_reading_time": cd.get("estimated_reading_time", 15),
                    "key_topics": cd.get("key_topics", []),
                    "summary": cd.get("summary", ""),
                    "key_takeaways": cd.get("key_takeaways", []),
                    "recommended_for_expertise": [cd.get("difficulty_level", "intermediate")],
                    "complements_concepts": [request.concept],
                    "best_consumed_at": "beginning",
                    "viewed": False,
                    "retrieved_at": datetime.now().isoformat(),
                    "ai_model": config.get("model", "gpt-4"),
                }
                await db.save_retrieved_content(item)
                retrieved_items.append(item)

        return {"message": f"Retrieved {len(retrieved_items)} relevant resources", "content": retrieved_items, "concept": request.concept}
    except Exception as e:
        logger.exception("Failed to retrieve content")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve content: {e}")


@router.get("/content/{content_id}")
async def get_content(content_id: str):
    c = await db.get_retrieved_content(content_id)
    if not c:
        raise HTTPException(status_code=404, detail="Content not found")
    return c


@router.get("/content/user/{user_id}/list")
async def list_user_content(user_id: str, concept: str = None):
    items = await db.list_retrieved_content(user_id, concept=concept)
    return {"user_id": user_id, "concept": concept, "content": items, "count": len(items)}


@router.put("/content/{content_id}/mark-viewed")
async def mark_content_viewed(content_id: str):
    c = await db.get_retrieved_content(content_id)
    if not c:
        raise HTTPException(status_code=404, detail="Content not found")
    c["viewed"] = True
    await db.save_retrieved_content(c)
    return {"message": "Content marked as viewed", "content": c}


@router.put("/content/{content_id}/rate")
async def rate_content(content_id: str, rating: int, helpful: bool):
    c = await db.get_retrieved_content(content_id)
    if not c:
        raise HTTPException(status_code=404, detail="Content not found")
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    c["rating"] = rating
    c["helpful"] = helpful
    await db.save_retrieved_content(c)
    return {"message": "Content rated successfully", "content": c}
