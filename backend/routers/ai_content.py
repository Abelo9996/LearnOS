"""
AI-Powered Assignment & Content Router
Generate assignments and retrieve content using GPT-4
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List
from models_ai import (
    AIGeneratedAssignment, RetrievedContent,
    GenerateAIAssignmentRequest, RetrieveContentRequest
)
from services.openai_service import get_openai_service
from routers.ai_config import openai_configs, feature_toggles
from routers.onboarding import learner_profiles
from datetime import datetime
import uuid

router = APIRouter(prefix="/ai", tags=["ai-content"])

# In-memory storage
ai_assignments: Dict[str, AIGeneratedAssignment] = {}
retrieved_content: Dict[str, RetrievedContent] = {}

# ===== AI Assignment Generation =====

@router.post("/assignments/generate")
async def generate_ai_assignment(request: GenerateAIAssignmentRequest):
    """
    Generate a coding assignment using GPT-4
    """
    # Check if AI is configured
    if request.user_id not in openai_configs:
        raise HTTPException(
            status_code=404,
            detail="OpenAI not configured. Please set up your API key first."
        )
    
    # Check if feature is enabled
    features = feature_toggles.get(request.user_id)
    if features and not features.ai_assignments:
        raise HTTPException(
            status_code=403,
            detail="AI assignment generation is disabled. Enable it in settings."
        )
    
    config = openai_configs[request.user_id]
    service = get_openai_service(config.api_key)
    
    if not service.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI service not available"
        )
    
    # Get learner profile
    profile_dict = {}
    if request.user_id in learner_profiles:
        profile = learner_profiles[request.user_id]
        profile_dict = profile.dict()
    
    # Determine difficulty
    difficulty = request.difficulty_override
    if difficulty is None:
        # Use profile expertise level
        expertise_map = {
            "absolute_beginner": 0.2,
            "beginner": 0.4,
            "intermediate": 0.6,
            "advanced": 0.8,
            "expert": 0.95
        }
        difficulty = expertise_map.get(
            profile_dict.get("expertise_level", "intermediate"),
            0.6
        )
    
    try:
        # Generate assignment with AI
        assignment_data = await service.generate_assignment(
            concept=request.concept,
            difficulty=difficulty,
            learner_profile=profile_dict,
            include_test_cases=request.include_test_cases
        )
        
        # Create assignment object
        assignment = AIGeneratedAssignment(
            assignment_id=str(uuid.uuid4()),
            concept=request.concept,
            user_id=request.user_id,
            title=assignment_data["title"],
            description=assignment_data["description"],
            learning_objectives=assignment_data.get("learning_objectives", []),
            instructions=assignment_data.get("instructions", []),
            starter_code=assignment_data.get("starter_code"),
            test_cases=assignment_data.get("test_cases", []) if request.include_test_cases else [],
            rubric=assignment_data.get("rubric", []),
            hints=assignment_data.get("hints", []),
            solution_approach=assignment_data.get("solution_approach", ""),
            common_mistakes=assignment_data.get("common_mistakes", []),
            difficulty=difficulty,
            estimated_hours=assignment_data.get("estimated_hours", 3.0),
            requires_libraries=assignment_data.get("required_libraries", []),
            generated_by=config.model,
            generation_prompt=f"Generate assignment for {request.concept}",
            generated_at=datetime.now()
        )
        
        # Store assignment
        ai_assignments[assignment.assignment_id] = assignment
        
        return {
            "message": "Assignment generated successfully!",
            "assignment": assignment
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate assignment: {str(e)}"
        )

@router.get("/assignments/{assignment_id}")
async def get_ai_assignment(assignment_id: str):
    """
    Get a specific AI-generated assignment
    """
    if assignment_id not in ai_assignments:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    return ai_assignments[assignment_id]

@router.get("/assignments/user/{user_id}/list")
async def list_user_ai_assignments(user_id: str):
    """
    List all AI-generated assignments for a user
    """
    user_assignments = [
        assignment for assignment in ai_assignments.values()
        if assignment.user_id == user_id
    ]
    
    return {
        "user_id": user_id,
        "assignments": user_assignments,
        "count": len(user_assignments)
    }

# ===== AI Content Retrieval =====

@router.post("/content/retrieve")
async def retrieve_content(request: RetrieveContentRequest):
    """
    Retrieve and analyze relevant learning content using GPT-4
    """
    # Check if AI is configured
    if request.user_id not in openai_configs:
        raise HTTPException(
            status_code=404,
            detail="OpenAI not configured. Please set up your API key first."
        )
    
    # Check if feature is enabled
    features = feature_toggles.get(request.user_id)
    if features and not features.content_retrieval:
        raise HTTPException(
            status_code=403,
            detail="AI content retrieval is disabled. Enable it in settings."
        )
    
    config = openai_configs[request.user_id]
    service = get_openai_service(config.api_key)
    
    if not service.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI service not available"
        )
    
    # Get learner profile
    profile_dict = {}
    if request.user_id in learner_profiles:
        profile = learner_profiles[request.user_id]
        profile_dict = profile.dict()
    
    try:
        # Retrieve content with AI
        content_list = await service.retrieve_and_analyze_content(
            concept=request.concept,
            content_types=request.content_types,
            learner_profile=profile_dict,
            max_results=request.max_results
        )
        
        # Create content objects
        retrieved_items = []
        for content_data in content_list:
            if content_data.get("relevance_score", 0) >= request.min_relevance:
                content = RetrievedContent(
                    content_id=str(uuid.uuid4()),
                    concept=request.concept,
                    user_id=request.user_id,
                    title=content_data["title"],
                    url=content_data["url"],
                    content_type=content_data.get("content_type", "article"),
                    author=content_data.get("author"),
                    published_date=None,  # Could parse if available
                    relevance_score=content_data.get("relevance_score", 0.8),
                    difficulty_level=content_data.get("difficulty_level", "intermediate"),
                    estimated_reading_time=content_data.get("estimated_reading_time", 15),
                    key_topics=content_data.get("key_topics", []),
                    summary=content_data.get("summary", ""),
                    key_takeaways=content_data.get("key_takeaways", []),
                    recommended_for_expertise=[content_data.get("difficulty_level", "intermediate")],
                    complements_concepts=[request.concept],
                    best_consumed_at="beginning",
                    viewed=False,
                    retrieved_at=datetime.now(),
                    ai_model=config.model
                )
                
                retrieved_content[content.content_id] = content
                retrieved_items.append(content)
        
        return {
            "message": f"Retrieved {len(retrieved_items)} relevant resources",
            "content": retrieved_items,
            "concept": request.concept
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve content: {str(e)}"
        )

@router.get("/content/{content_id}")
async def get_retrieved_content(content_id: str):
    """
    Get a specific retrieved content item
    """
    if content_id not in retrieved_content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    return retrieved_content[content_id]

@router.get("/content/user/{user_id}/list")
async def list_user_retrieved_content(user_id: str, concept: str = None):
    """
    List all retrieved content for a user, optionally filtered by concept
    """
    user_content = [
        content for content in retrieved_content.values()
        if content.user_id == user_id and (concept is None or content.concept == concept)
    ]
    
    # Sort by relevance score
    user_content.sort(key=lambda x: x.relevance_score, reverse=True)
    
    return {
        "user_id": user_id,
        "concept": concept,
        "content": user_content,
        "count": len(user_content)
    }

@router.put("/content/{content_id}/mark-viewed")
async def mark_content_viewed(content_id: str):
    """
    Mark content as viewed by the user
    """
    if content_id not in retrieved_content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    content = retrieved_content[content_id]
    content.viewed = True
    
    return {"message": "Content marked as viewed", "content": content}

@router.put("/content/{content_id}/rate")
async def rate_content(content_id: str, rating: int, helpful: bool):
    """
    Rate retrieved content
    """
    if content_id not in retrieved_content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    content = retrieved_content[content_id]
    content.rating = rating
    content.helpful = helpful
    
    return {"message": "Content rated successfully", "content": content}
