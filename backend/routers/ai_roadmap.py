"""
AI Roadmap Router
Generate personalized learning roadmaps using GPT-4
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List
from models_ai import (
    LearningRoadmap, RoadmapMilestone, GenerateRoadmapRequest
)
from services.openai_service import get_openai_service
from routers.ai_config import openai_configs, feature_toggles
from routers.onboarding import learner_profiles
from datetime import datetime
import uuid

router = APIRouter(prefix="/ai/roadmap", tags=["ai-roadmap"])

# In-memory storage
roadmaps: Dict[str, LearningRoadmap] = {}

@router.post("/generate")
async def generate_roadmap(request: GenerateRoadmapRequest):
    """
    Generate an AI-powered personalized learning roadmap
    """
    # Check if AI is configured
    if request.user_id not in openai_configs:
        raise HTTPException(
            status_code=404,
            detail="OpenAI not configured. Please set up your API key first."
        )
    
    # Check if feature is enabled
    features = feature_toggles.get(request.user_id)
    if features and not features.ai_roadmaps:
        raise HTTPException(
            status_code=403,
            detail="AI roadmap generation is disabled. Enable it in settings."
        )
    
    config = openai_configs[request.user_id]
    service = get_openai_service(config.api_key)
    
    if not service.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI service not available"
        )
    
    # Get learner profile if requested
    profile_dict = {}
    if request.use_profile and request.user_id in learner_profiles:
        profile = learner_profiles[request.user_id]
        profile_dict = profile.dict()
    
    # Get learning habits if requested
    habits_dict = None
    if request.use_habits:
        # TODO: Get from habits tracker when implemented
        habits_dict = {
            "sessions_per_week": 5,
            "average_session_duration": 30,
            "preferred_time_of_day": "morning"
        }
    
    try:
        # Generate roadmap with AI
        roadmap_data = await service.generate_roadmap(
            goal=request.goal,
            learner_profile=profile_dict,
            learning_habits=habits_dict,
            target_weeks=request.target_weeks
        )
        
        # Create milestones with all fields including learning steps and resources
        milestones = []
        for milestone_data in roadmap_data.get("milestones", []):
            # Parse milestone data - using model_validate to handle nested structures
            try:
                milestone = RoadmapMilestone.model_validate(milestone_data)
            except Exception as e:
                # Fallback to manual parsing
                milestone = RoadmapMilestone(
                    title=milestone_data.get("title", "Untitled Milestone"),
                    description=milestone_data.get("description", ""),
                    overview=milestone_data.get("overview", ""),
                    concepts=milestone_data.get("concepts", []),
                    estimated_hours=milestone_data.get("estimated_hours", 10),
                    prerequisites=milestone_data.get("prerequisites", []),
                    why_important=milestone_data.get("why_important", ""),
                    real_world_applications=milestone_data.get("real_world_applications", []),
                    recommended_projects=milestone_data.get("recommended_projects", []),
                    learning_steps=milestone_data.get("learning_steps", []),
                    web_resources=milestone_data.get("web_resources", [])
                )
            milestones.append(milestone)
        
        # Calculate totals
        total_hours = sum(m.estimated_hours for m in milestones)
        estimated_weeks = int(total_hours / (habits_dict.get("sessions_per_week", 5) * habits_dict.get("average_session_duration", 30) / 60)) if habits_dict else int(total_hours / 10)
        
        # Create roadmap
        roadmap = LearningRoadmap(
            roadmap_id=str(uuid.uuid4()),
            user_id=request.user_id,
            goal=request.goal,
            milestones=milestones,
            total_estimated_hours=total_hours,
            estimated_completion_weeks=estimated_weeks,
            adapted_to_profile=request.use_profile,
            adapted_to_habits=request.use_habits,
            difficulty_level=profile_dict.get("expertise_level", "intermediate") if profile_dict else "intermediate",
            learning_strategy=roadmap_data.get("learning_strategy", ""),
            success_tips=roadmap_data.get("success_tips", []),
            potential_challenges=roadmap_data.get("potential_challenges", []),
            mitigation_strategies=roadmap_data.get("mitigation_strategies", []),
            generated_at=datetime.now(),
            last_updated=datetime.now(),
            ai_model=config.model
        )
        
        # Store roadmap
        print(f"💾 Storing roadmap with ID: {roadmap.roadmap_id}")
        print(f"📋 Roadmap goal: {roadmap.goal}")
        print(f"📊 Total milestones: {len(roadmap.milestones)}")
        roadmaps[roadmap.roadmap_id] = roadmap
        print(f"✅ Roadmap stored. Total roadmaps in storage: {len(roadmaps)}")
        print(f"🔑 Roadmap IDs in storage: {list(roadmaps.keys())}")
        
        return {
            "message": "Roadmap generated successfully!",
            "roadmap": roadmap,
            "estimated_time": f"{total_hours} hours over {estimated_weeks} weeks"
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate roadmap: {str(e)}"
        )

@router.get("/{roadmap_id}")
async def get_roadmap(roadmap_id: str):
    """
    Get a specific roadmap
    """
    if roadmap_id not in roadmaps:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    
    return roadmaps[roadmap_id]

@router.get("/user/{user_id}/roadmaps")
async def get_user_roadmaps(user_id: str):
    """
    Get all roadmaps for a user
    """
    user_roadmaps = [
        roadmap for roadmap in roadmaps.values()
        if roadmap.user_id == user_id
    ]
    
    return {
        "user_id": user_id,
        "roadmaps": user_roadmaps,
        "count": len(user_roadmaps)
    }

@router.put("/{roadmap_id}/milestone/{milestone_id}/complete")
async def complete_milestone(roadmap_id: str, milestone_id: str):
    """
    Mark a milestone as completed
    """
    if roadmap_id not in roadmaps:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    
    roadmap = roadmaps[roadmap_id]
    
    for milestone in roadmap.milestones:
        if milestone.milestone_id == milestone_id:
            milestone.completed = True
            milestone.completion_date = datetime.now()
            roadmap.last_updated = datetime.now()
            
            # Calculate actual completion percentage
            completed = sum(1 for m in roadmap.milestones if m.completed)
            total = len(roadmap.milestones)
            
            return {
                "message": "Milestone marked as complete!",
                "roadmap": roadmap,
                "progress": f"{completed}/{total} milestones completed ({int(completed/total*100)}%)"
            }
    
    raise HTTPException(status_code=404, detail="Milestone not found")

@router.delete("/{roadmap_id}")
async def delete_roadmap(roadmap_id: str):
    """
    Delete a roadmap
    """
    if roadmap_id in roadmaps:
        del roadmaps[roadmap_id]
        return {"message": "Roadmap deleted successfully"}
    
    raise HTTPException(status_code=404, detail="Roadmap not found")
