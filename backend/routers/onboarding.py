from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from agents.learner_profiling import LearnerProfilingAgent
from models_extended import OnboardingQuestion, OnboardingResponse, OnboardingSession, LearnerProfile
import uuid

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

# Initialize agent
profiling_agent = LearnerProfilingAgent()

# In-memory storage (will move to database later)
onboarding_sessions: Dict[str, OnboardingSession] = {}
learner_profiles: Dict[str, LearnerProfile] = {}

class StartOnboardingRequest(BaseModel):
    user_id: str

class StartOnboardingResponse(BaseModel):
    session_id: str
    questions: List[Dict[str, Any]]  # Changed from List[OnboardingQuestion] to List[Dict]
    total_questions: int
    estimated_time_minutes: int

class SubmitOnboardingRequest(BaseModel):
    session_id: str
    responses: List[OnboardingResponse]

class SubmitOnboardingResponse(BaseModel):
    profile: LearnerProfile
    insights: List[str]
    message: str

@router.post("/start", response_model=StartOnboardingResponse)
async def start_onboarding(request: StartOnboardingRequest):
    """
    Start a new onboarding session to profile the learner.
    Returns a list of questions to be answered.
    """
    try:
        # Generate onboarding questions
        result = await profiling_agent.process({
            "generate_questions": True
        })
        
        questions = result["questions"]
        
        # Convert OnboardingQuestion objects to dicts for JSON serialization
        questions_dict = [q.model_dump() for q in questions]
        
        # Create onboarding session
        session_id = str(uuid.uuid4())
        session = OnboardingSession(
            id=session_id,
            user_id=request.user_id,
            questions=questions,
            responses=[]
        )
        
        onboarding_sessions[session_id] = session
        
        response_data = {
            "session_id": session_id,
            "questions": questions_dict,
            "total_questions": len(questions),
            "estimated_time_minutes": 10
        }
        
        return StartOnboardingResponse(**response_data)
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/submit", response_model=SubmitOnboardingResponse)
async def submit_onboarding(request: SubmitOnboardingRequest):
    """
    Submit onboarding responses and receive a learner profile.
    """
    try:
        # Validate session exists
        if request.session_id not in onboarding_sessions:
            raise HTTPException(status_code=404, detail="Onboarding session not found")
        
        session = onboarding_sessions[request.session_id]
        
        # Update session with responses
        session.responses = request.responses
        session.completed = True
        
        # Generate learner profile
        result = await profiling_agent.process({
            "questions": session.questions,
            "responses": request.responses
        })
        
        profile = result["profile"]
        insights = result["insights"]
        
        # Store profile
        learner_profiles[session.user_id] = profile
        
        return SubmitOnboardingResponse(
            profile=profile,
            insights=insights,
            message=f"Welcome! We've created a personalized learning profile for you. "
                    f"Your learning style is {profile.learning_style.value} and you're at the "
                    f"{profile.expertise_level.value} level."
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/profile/{user_id}", response_model=LearnerProfile)
async def get_profile(user_id: str):
    """
    Get the learner profile for a user.
    """
    if user_id not in learner_profiles:
        raise HTTPException(status_code=404, detail="Learner profile not found")
    
    return learner_profiles[user_id]

@router.put("/profile/{user_id}")
async def update_profile(user_id: str, profile: LearnerProfile):
    """
    Update a learner profile (allows manual adjustments).
    """
    learner_profiles[user_id] = profile
    return {"message": "Profile updated successfully", "profile": profile}
