"""
OpenAI Configuration Router
Handles API key setup and AI feature configuration
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict
from models_ai import OpenAIConfig, AIFeatureToggle, ConfigureOpenAIRequest
from services.openai_service import get_openai_service
from datetime import datetime

router = APIRouter(prefix="/ai/config", tags=["ai-config"])

# In-memory storage (move to database in production)
openai_configs: Dict[str, OpenAIConfig] = {}
feature_toggles: Dict[str, AIFeatureToggle] = {}

class ConfigResponse(BaseModel):
    message: str
    config: OpenAIConfig
    ai_available: bool

class ToggleFeaturesRequest(BaseModel):
    user_id: str
    ai_assignments: bool = True
    ai_roadmaps: bool = True
    habit_adaptation: bool = True
    content_retrieval: bool = True
    socratic_enhancement: bool = True
    progress_insights: bool = True

@router.post("/setup", response_model=ConfigResponse)
async def setup_openai(request: ConfigureOpenAIRequest):
    """
    Configure OpenAI API key and settings for a user
    """
    try:
        # Create config
        config = OpenAIConfig(
            user_id=request.user_id,
            api_key=request.api_key,  # In production, encrypt this!
            model=request.model,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            enabled=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Store config
        openai_configs[request.user_id] = config
        
        # Initialize service to test
        service = get_openai_service(request.api_key)
        
        # Create default feature toggles
        if request.user_id not in feature_toggles:
            feature_toggles[request.user_id] = AIFeatureToggle(
                user_id=request.user_id
            )
        
        return ConfigResponse(
            message="OpenAI configured successfully. AI features are now enabled!",
            config=config,
            ai_available=service.is_available()
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to configure OpenAI: {str(e)}")

@router.get("/status/{user_id}")
async def get_config_status(user_id: str):
    """
    Get OpenAI configuration status for a user
    """
    if user_id not in openai_configs:
        return {
            "configured": False,
            "ai_available": False,
            "message": "OpenAI not configured. Please set up your API key."
        }
    
    config = openai_configs[user_id]
    service = get_openai_service(config.api_key)
    features = feature_toggles.get(user_id, AIFeatureToggle(user_id=user_id))
    
    return {
        "configured": True,
        "ai_available": service.is_available(),
        "model": config.model,
        "enabled": config.enabled,
        "features": {
            "ai_assignments": features.ai_assignments,
            "ai_roadmaps": features.ai_roadmaps,
            "habit_adaptation": features.habit_adaptation,
            "content_retrieval": features.content_retrieval,
            "socratic_enhancement": features.socratic_enhancement,
            "progress_insights": features.progress_insights
        },
        "last_updated": config.updated_at
    }

@router.put("/toggle-features")
async def toggle_features(request: ToggleFeaturesRequest):
    """
    Toggle individual AI features on/off
    """
    if request.user_id not in openai_configs:
        raise HTTPException(
            status_code=404,
            detail="OpenAI not configured. Please set up your API key first."
        )
    
    features = AIFeatureToggle(
        user_id=request.user_id,
        ai_assignments=request.ai_assignments,
        ai_roadmaps=request.ai_roadmaps,
        habit_adaptation=request.habit_adaptation,
        content_retrieval=request.content_retrieval,
        socratic_enhancement=request.socratic_enhancement,
        progress_insights=request.progress_insights
    )
    
    feature_toggles[request.user_id] = features
    
    return {
        "message": "Feature toggles updated successfully",
        "features": features
    }

@router.delete("/remove/{user_id}")
async def remove_openai_config(user_id: str):
    """
    Remove OpenAI configuration (user wants to disable AI features)
    """
    if user_id in openai_configs:
        del openai_configs[user_id]
    if user_id in feature_toggles:
        del feature_toggles[user_id]
    
    return {
        "message": "OpenAI configuration removed. AI features disabled."
    }

@router.get("/test/{user_id}")
async def test_openai_connection(user_id: str):
    """
    Test if OpenAI connection is working
    """
    if user_id not in openai_configs:
        raise HTTPException(
            status_code=404,
            detail="OpenAI not configured"
        )
    
    config = openai_configs[user_id]
    service = get_openai_service(config.api_key)
    
    if not service.is_available():
        return {
            "success": False,
            "message": "OpenAI service not available. Check API key and internet connection."
        }
    
    try:
        # Simple test: generate a short insight
        test_result = await service.generate_progress_insights(
            user_progress={"concepts_mastered": 5},
            learning_history=[],
            current_goals=["Test connection"]
        )
        
        return {
            "success": True,
            "message": "OpenAI connection working!",
            "test_result": test_result[0] if test_result else None
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection test failed: {str(e)}"
        }
