from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict
from agents.resource_curation import ResourceCurationAgent
from models_extended import ExternalResource, LearnerProfile
from routers.onboarding import learner_profiles  # Access to profiles

router = APIRouter(prefix="/resources", tags=["resources"])

# Initialize agent
resource_agent = ResourceCurationAgent()

class GetResourcesRequest(BaseModel):
    concept: str
    user_id: str
    max_resources: int = 5

class GetResourcesResponse(BaseModel):
    resources: List[ExternalResource]
    primary_resource: ExternalResource
    supplementary_resources: List[ExternalResource]
    summary: str

@router.post("/curate", response_model=GetResourcesResponse)
async def curate_resources(request: GetResourcesRequest):
    """
    Get curated external resources for a concept.
    Personalized based on learner profile (expertise, preferences).
    """
    try:
        # Get learner profile
        if request.user_id not in learner_profiles:
            raise HTTPException(
                status_code=404,
                detail="Learner profile not found. Please complete onboarding first."
            )
        
        profile = learner_profiles[request.user_id]
        
        # Curate resources
        result = await resource_agent.process({
            "concept": request.concept,
            "learner_profile": profile,
            "max_resources": request.max_resources
        })
        
        return GetResourcesResponse(
            resources=result["resources"],
            primary_resource=result["primary_resource"],
            supplementary_resources=result["supplementary_resources"],
            summary=result["resource_summary"]
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/concept/{concept}")
async def get_resources_by_concept(concept: str, user_id: str, max_resources: int = 5):
    """
    Alternative endpoint using query parameters instead of POST body.
    """
    request = GetResourcesRequest(
        concept=concept,
        user_id=user_id,
        max_resources=max_resources
    )
    return await curate_resources(request)

@router.get("/popular")
async def get_popular_resources():
    """
    Get a list of popular resources across all concepts.
    Useful for discovery before starting learning.
    """
    popular_resources = [
        {
            "title": "Introduction to Reinforcement Learning",
            "url": "https://www.youtube.com/playlist?list=PLqYmG7hTraZBKeNJ-JE_eyJHZ7XgBoAyb",
            "author": "DeepMind",
            "type": "video_series",
            "concepts": ["MDP", "Q-Learning", "Policy Gradients"],
            "difficulty": "beginner",
            "quality_score": 0.95
        },
        {
            "title": "Spinning Up in Deep RL",
            "url": "https://spinningup.openai.com/",
            "author": "OpenAI",
            "type": "documentation",
            "concepts": ["Policy Optimization", "Actor-Critic", "DDPG"],
            "difficulty": "intermediate",
            "quality_score": 0.9
        },
        {
            "title": "Reinforcement Learning: An Introduction",
            "url": "http://incompleteideas.net/book/the-book.html",
            "author": "Sutton and Barto",
            "type": "book",
            "concepts": ["Fundamentals", "Dynamic Programming", "TD Learning"],
            "difficulty": "beginner",
            "quality_score": 1.0
        }
    ]
    
    return {
        "popular_resources": popular_resources,
        "message": "These are highly-rated resources recommended by the community"
    }
