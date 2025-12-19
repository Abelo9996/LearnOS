from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from agents.assignment_generation import AssignmentGenerationAgent
from models_extended import Assignment, AssignmentSubmission, LearnerProfile
from routers.onboarding import learner_profiles  # Access to profiles
import uuid
from datetime import datetime

router = APIRouter(prefix="/assignments", tags=["assignments"])

# Initialize agent
assignment_agent = AssignmentGenerationAgent()

# In-memory storage
assignments: Dict[str, Assignment] = {}
submissions: Dict[str, AssignmentSubmission] = {}

class GetAssignmentRequest(BaseModel):
    concept: str
    user_id: str

class GetAssignmentResponse(BaseModel):
    assignment: Assignment
    message: str

class SubmitAssignmentRequest(BaseModel):
    assignment_id: str
    user_id: str
    submitted_code: str
    notes: Optional[str] = None

class SubmitAssignmentResponse(BaseModel):
    submission: AssignmentSubmission
    feedback: str
    next_steps: str

@router.post("/generate", response_model=GetAssignmentResponse)
async def generate_assignment(request: GetAssignmentRequest):
    """
    Generate a hands-on assignment for a specific concept.
    Adapts to learner's expertise level and preferences.
    """
    try:
        # Get learner profile
        if request.user_id not in learner_profiles:
            raise HTTPException(
                status_code=404,
                detail="Learner profile not found. Please complete onboarding first."
            )
        
        profile = learner_profiles[request.user_id]
        
        # Generate assignment
        result = await assignment_agent.process({
            "concept": request.concept,
            "learner_profile": profile
        })
        
        assignment = result["assignment"]
        
        # Store assignment
        assignments[assignment.id] = assignment
        
        return GetAssignmentResponse(
            assignment=assignment,
            message=f"Generated {assignment.assignment_type.value} assignment for {request.concept}. "
                    f"Estimated time: {assignment.estimated_hours}h. Good luck!"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{assignment_id}", response_model=Assignment)
async def get_assignment(assignment_id: str):
    """
    Retrieve a specific assignment by ID.
    """
    if assignment_id not in assignments:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    return assignments[assignment_id]

@router.post("/submit", response_model=SubmitAssignmentResponse)
async def submit_assignment(request: SubmitAssignmentRequest):
    """
    Submit a completed assignment for evaluation.
    """
    try:
        # Validate assignment exists
        if request.assignment_id not in assignments:
            raise HTTPException(status_code=404, detail="Assignment not found")
        
        assignment = assignments[request.assignment_id]
        
        # Create submission
        submission = AssignmentSubmission(
            submission_id=str(uuid.uuid4()),
            assignment_id=request.assignment_id,
            user_id=request.user_id,
            submitted_code=request.submitted_code,
            submitted_at=datetime.now(),
            notes=request.notes
        )
        
        # Simple evaluation (in production, this would run code/check tests)
        feedback_parts = []
        score = 0.0
        
        # Check if code is non-empty
        if len(request.submitted_code.strip()) > 100:
            score += 0.3
            feedback_parts.append("✓ Substantial code submitted")
        
        # Check for key concepts (simple keyword matching)
        key_terms = []
        if "Markov" in assignment.concept or "MDP" in assignment.concept:
            key_terms = ["state", "action", "reward", "transition"]
        elif "Q-Learning" in assignment.concept:
            key_terms = ["q_table", "epsilon", "learning_rate", "update"]
        elif "Neural" in assignment.concept:
            key_terms = ["forward", "backward", "weights", "gradient"]
        
        found_terms = sum(1 for term in key_terms if term in request.submitted_code)
        if found_terms >= len(key_terms) * 0.5:
            score += 0.4
            feedback_parts.append(f"✓ Found key concepts: {found_terms}/{len(key_terms)}")
        
        # Check for documentation
        if "#" in request.submitted_code or '"""' in request.submitted_code:
            score += 0.2
            feedback_parts.append("✓ Code includes documentation")
        
        # Check for proper structure (functions/classes)
        if "def " in request.submitted_code or "class " in request.code:
            score += 0.1
            feedback_parts.append("✓ Proper code structure")
        
        submission.score = min(score, 1.0)
        submission.feedback = "\n".join(feedback_parts)
        submission.graded = True
        
        # Store submission
        submissions[submission.submission_id] = submission
        
        # Generate next steps
        next_steps = ""
        if submission.score >= 0.8:
            next_steps = "Excellent work! You're ready to move to the next concept."
        elif submission.score >= 0.6:
            next_steps = "Good effort! Review the rubric and consider refining your implementation."
        else:
            next_steps = "Keep working on it. Review the hints and try again."
        
        return SubmitAssignmentResponse(
            submission=submission,
            feedback=submission.feedback,
            next_steps=next_steps
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user/{user_id}/submissions")
async def get_user_submissions(user_id: str):
    """
    Get all submissions for a user.
    """
    user_submissions = [
        sub for sub in submissions.values()
        if sub.user_id == user_id
    ]
    
    return {
        "user_id": user_id,
        "submissions": user_submissions,
        "total": len(user_submissions),
        "average_score": sum(s.score or 0 for s in user_submissions) / len(user_submissions) if user_submissions else 0
    }
