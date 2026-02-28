"""
OpenAI Configuration Router — API key setup and AI feature toggles.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import db
from models_ai import OpenAIConfig, AIFeatureToggle, ConfigureOpenAIRequest
from services.openai_service import get_openai_service

logger = logging.getLogger("learnos.ai_config")
router = APIRouter(prefix="/ai/config", tags=["ai-config"])


class ConfigResponse(BaseModel):
    message: str
    config: dict
    ai_available: bool


class ToggleFeaturesRequest(BaseModel):
    user_id: str
    ai_assignments: bool = True
    ai_roadmaps: bool = True
    habit_adaptation: bool = True
    content_retrieval: bool = True
    socratic_enhancement: bool = True
    progress_insights: bool = True


@router.post("/setup")
async def setup_openai(request: ConfigureOpenAIRequest):
    now = datetime.now().isoformat()
    config_dict = {
        "user_id": request.user_id,
        "api_key": request.api_key,
        "model": request.model,
        "max_tokens": request.max_tokens,
        "temperature": request.temperature,
        "enabled": True,
        "created_at": now,
        "updated_at": now,
    }
    await db.save_openai_config(config_dict)

    service = get_openai_service(request.api_key)

    # Ensure default feature toggles
    existing = await db.get_feature_toggles(request.user_id)
    if not existing:
        await db.save_feature_toggles({"user_id": request.user_id})

    return {
        "message": "OpenAI configured successfully. AI features are now enabled!",
        "config": config_dict,
        "ai_available": service.is_available(),
    }


@router.get("/status/{user_id}")
async def get_config_status(user_id: str):
    config = await db.get_openai_config(user_id)
    if not config:
        return {"configured": False, "ai_available": False, "message": "OpenAI not configured."}

    service = get_openai_service(config["api_key"], model=config.get("model", "gpt-4o-mini"))
    features = await db.get_feature_toggles(user_id) or {
        "ai_assignments": True, "ai_roadmaps": True, "habit_adaptation": True,
        "content_retrieval": True, "socratic_enhancement": True, "progress_insights": True,
    }

    return {
        "configured": True,
        "ai_available": service.is_available(),
        "model": config.get("model"),
        "enabled": config.get("enabled"),
        "features": {k: features.get(k, True) for k in (
            "ai_assignments", "ai_roadmaps", "habit_adaptation",
            "content_retrieval", "socratic_enhancement", "progress_insights",
        )},
        "last_updated": config.get("updated_at"),
    }


@router.put("/toggle-features")
async def toggle_features(request: ToggleFeaturesRequest):
    config = await db.get_openai_config(request.user_id)
    if not config:
        raise HTTPException(status_code=404, detail="OpenAI not configured.")

    toggles = {
        "user_id": request.user_id,
        "ai_assignments": request.ai_assignments,
        "ai_roadmaps": request.ai_roadmaps,
        "habit_adaptation": request.habit_adaptation,
        "content_retrieval": request.content_retrieval,
        "socratic_enhancement": request.socratic_enhancement,
        "progress_insights": request.progress_insights,
    }
    await db.save_feature_toggles(toggles)

    return {"message": "Feature toggles updated successfully", "features": toggles}


@router.delete("/remove/{user_id}")
async def remove_openai_config(user_id: str):
    await db.delete_openai_config(user_id)
    return {"message": "OpenAI configuration removed. AI features disabled."}


@router.get("/test/{user_id}")
async def test_openai_connection(user_id: str):
    config = await db.get_openai_config(user_id)
    if not config:
        raise HTTPException(status_code=404, detail="OpenAI not configured")

    service = get_openai_service(config["api_key"], model=config.get("model", "gpt-4o-mini"))
    if not service.is_available():
        return {"success": False, "message": "OpenAI service not available."}

    try:
        test_result = await service.generate_progress_insights(
            user_progress={"concepts_mastered": 5},
            learning_history=[],
            current_goals=["Test connection"],
        )
        return {"success": True, "message": "OpenAI connection working!", "test_result": test_result[0] if test_result else None}
    except Exception as e:
        return {"success": False, "message": f"Connection test failed: {e}"}
