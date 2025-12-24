"""
AI-powered assignment generation endpoints
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from services.openai_service import get_openai_service
from routers.ai_config import openai_configs, feature_toggles, assignments_storage
from models_ai import AIGeneratedAssignment, AssignmentStatus
from datetime import datetime

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
    """
    Generate a comprehensive assignment for a milestone/module
    """
    # Check if user has OpenAI configured
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
    
    try:
        assignment_data = await service.generate_milestone_assignment(
            milestone_title=request.milestone_title,
            milestone_description=request.milestone_description,
            concepts=request.concepts,
            learning_steps=request.learning_steps,
            difficulty=request.difficulty
        )
        
        # Create and store the assignment
        assignment = AIGeneratedAssignment(
            user_id=request.user_id,
            course_id=request.course_id,
            milestone_id=request.milestone_id,
            roadmap_id=request.roadmap_id,
            assignment_type=assignment_data.get('assignment_type', 'essay'),
            title=assignment_data.get('title', 'Untitled Assignment'),
            description=assignment_data.get('description', ''),
            learning_objectives=assignment_data.get('learning_objectives', []),
            instructions=assignment_data.get('instructions', []),
            requirements=assignment_data.get('requirements', []),
            questions=assignment_data.get('questions', []),
            starter_materials=assignment_data.get('starter_materials'),
            test_cases=assignment_data.get('test_cases', []),
            rubric=assignment_data.get('rubric', []),
            hints=assignment_data.get('hints', []),
            resources=assignment_data.get('resources', []),
            estimated_time_hours=assignment_data.get('estimated_time_hours', 2.0),
            difficulty=request.difficulty,
            status=AssignmentStatus.NOT_STARTED
        )
        
        # Store the assignment
        assignments_storage[assignment.assignment_id] = assignment
        
        print(f"✅ Assignment stored: {assignment.assignment_id}")
        print(f"   - Type: {assignment.assignment_type}")
        print(f"   - Title: {assignment.title}")
        print(f"   - Total assignments in storage: {len(assignments_storage)}")
        
        return {
            "message": "Assignment generated and saved successfully!",
            "assignment": assignment,
            "assignment_id": assignment.assignment_id
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate assignment: {str(e)}"
        )

@router.get("/list/{user_id}")
async def list_user_assignments(user_id: str, course_id: Optional[str] = None):
    """
    Get all assignments for a user, optionally filtered by course
    """
    user_assignments = [
        assignment for assignment in assignments_storage.values()
        if assignment.user_id == user_id and (course_id is None or assignment.course_id == course_id)
    ]
    
    return {
        "assignments": user_assignments,
        "total": len(user_assignments)
    }

@router.get("/{assignment_id}")
async def get_assignment(assignment_id: str):
    """
    Get a specific assignment by ID
    """
    if assignment_id not in assignments_storage:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    return assignments_storage[assignment_id]

@router.put("/{assignment_id}/submit")
async def submit_assignment(assignment_id: str, submission: Dict[str, Any]):
    """
    Submit an assignment solution
    """
    if assignment_id not in assignments_storage:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    assignment = assignments_storage[assignment_id]
    assignment.submission = submission.get('submission', '')
    assignment.submission_date = datetime.now()
    assignment.status = AssignmentStatus.SUBMITTED
    
    return {
        "message": "Assignment submitted successfully!",
        "assignment": assignment
    }

@router.put("/{assignment_id}/complete")
async def complete_assignment(assignment_id: str, score: Optional[float] = None, feedback: Optional[str] = None):
    """
    Mark an assignment as completed
    """
    if assignment_id not in assignments_storage:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    assignment = assignments_storage[assignment_id]
    assignment.status = AssignmentStatus.COMPLETED
    assignment.completed_at = datetime.now()
    if score is not None:
        assignment.score = score
    if feedback is not None:
        assignment.feedback = feedback
    
    return {
        "message": "Assignment marked as completed!",
        "assignment": assignment
    }
