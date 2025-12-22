"""
Courses Router - Central hub for course management
All roadmaps, assignments, and habits are tied to courses
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List, Optional
from models_ai import (
    Course, CreateCourseRequest, UpdateCourseRequest, EnrollCourseRequest,
    CourseStatus, LearningRoadmap as Roadmap
)
from services.openai_service import get_openai_service
from routers.ai_config import openai_configs
from routers.ai_roadmap import roadmaps
from routers.ai_content import ai_assignments
from routers.ai_habits import learning_sessions, learning_habits
from datetime import datetime, timedelta
import uuid

router = APIRouter(prefix="/courses", tags=["courses"])

# In-memory storage
courses: Dict[str, Course] = {}

# ===== Course CRUD =====

@router.post("/create")
async def create_course(request: CreateCourseRequest):
    """
    Create a new course (and optionally generate roadmap)
    """
    course = Course(
        course_id=str(uuid.uuid4()),
        user_id=request.user_id,
        title=request.title,
        description=request.description,
        goal=request.goal,
        difficulty_level=request.difficulty_level,
        target_weeks=request.target_weeks,
        status=CourseStatus.PLANNING,
        created_at=datetime.now()
    )
    
    # Store course
    courses[course.course_id] = course
    
    # Generate roadmap if requested
    roadmap = None
    if request.generate_roadmap:
        # Check if AI is configured
        if request.user_id not in openai_configs:
            return {
                "message": "Course created successfully (without roadmap - AI not configured)",
                "course": course,
                "roadmap": None
            }
        
        try:
            config = openai_configs[request.user_id]
            service = get_openai_service(config.api_key)
            
            # Generate roadmap using AI
            roadmap_data = await service.generate_roadmap(
                goal=request.goal,
                current_knowledge=f"Starting {request.difficulty_level} level course",
                target_weeks=request.target_weeks,
                learning_style=f"Course-based learning: {request.title}"
            )
            
            # Create roadmap object
            roadmap = Roadmap(
                roadmap_id=str(uuid.uuid4()),
                user_id=request.user_id,
                course_id=course.course_id,  # Link to course
                goal=request.goal,
                title=roadmap_data.get("title", f"Roadmap for {request.title}"),
                description=roadmap_data.get("description", ""),
                estimated_weeks=roadmap_data.get("estimated_weeks", request.target_weeks),
                milestones=roadmap_data.get("milestones", []),
                prerequisites=roadmap_data.get("prerequisites", []),
                recommended_resources=roadmap_data.get("resources", []),
                created_at=datetime.now(),
                generated_by_ai=True,
                ai_model=config.model
            )
            
            # Store roadmap
            roadmaps[roadmap.roadmap_id] = roadmap
            
            # Link roadmap to course
            course.roadmap_id = roadmap.roadmap_id
            course.generated_by_ai = True
            course.ai_model_used = config.model
            
        except Exception as e:
            print(f"Error generating roadmap: {e}")
            # Continue without roadmap
    
    return {
        "message": "Course created successfully!",
        "course": course,
        "roadmap": roadmap
    }

@router.get("/list/{user_id}")
async def list_user_courses(
    user_id: str,
    status: Optional[str] = None,
    sort_by: str = "last_accessed"
):
    """
    Get all courses for a user, optionally filtered by status
    """
    user_courses = [
        course for course in courses.values()
        if course.user_id == user_id
    ]
    
    # Filter by status if provided
    if status:
        user_courses = [c for c in user_courses if c.status == status]
    
    # Sort
    if sort_by == "last_accessed":
        user_courses.sort(key=lambda x: x.last_accessed, reverse=True)
    elif sort_by == "created_at":
        user_courses.sort(key=lambda x: x.created_at, reverse=True)
    elif sort_by == "progress":
        user_courses.sort(key=lambda x: x.progress_percentage, reverse=True)
    
    return {
        "user_id": user_id,
        "courses": user_courses,
        "count": len(user_courses)
    }

@router.get("/{course_id}")
async def get_course(course_id: str):
    """
    Get detailed course information
    """
    print(f"📖 GET COURSE called for: {course_id}")
    
    if course_id not in courses:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course = courses[course_id]
    print(f"📚 Course found: {course.title}")
    print(f"🗺️ Course roadmap_id: {course.roadmap_id}")
    
    # Update last accessed
    course.last_accessed = datetime.now()
    
    # Get associated roadmap
    roadmap = None
    if course.roadmap_id:
        print(f"🔍 Looking for roadmap: {course.roadmap_id}")
        print(f"📦 Roadmaps in storage: {list(roadmaps.keys())}")
        if course.roadmap_id in roadmaps:
            roadmap = roadmaps[course.roadmap_id]
            print(f"✅ Roadmap FOUND: {roadmap.goal}")
        else:
            print(f"❌ Roadmap NOT FOUND in storage!")
    else:
        print(f"ℹ️ No roadmap_id set on course")
    
    # Get associated assignments
    course_assignments = [
        ai_assignments[aid] for aid in course.assignment_ids
        if aid in ai_assignments
    ]
    
    # Get learning sessions for this course
    course_sessions = []
    if course.user_id in learning_sessions:
        # Filter sessions that have course concepts
        all_sessions = learning_sessions[course.user_id]
        # For now, include all sessions - in future, filter by course-specific tags
        course_sessions = all_sessions[-10:]  # Last 10 sessions
    
    return {
        "course": course,
        "roadmap": roadmap,
        "assignments": course_assignments,
        "recent_sessions": course_sessions,
        "stats": {
            "total_milestones": len(roadmap.milestones) if roadmap else 0,
            "completed_milestones": len([m for m in roadmap.milestones if getattr(m, "completed", False)]) if roadmap else 0,
            "total_assignments": len(course_assignments),
            "completed_assignments": len([a for a in course_assignments if a.completed]),
            "total_time_hours": round(course.total_time_spent_minutes / 60, 1),
            "sessions_count": course.sessions_count
        }
    }

@router.put("/{course_id}")
async def update_course(course_id: str, request: UpdateCourseRequest):
    """
    Update course details
    """
    print(f"🔧 UPDATE COURSE called for: {course_id}")
    print(f"📝 Request data: {request}")
    
    if course_id not in courses:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course = courses[course_id]
    
    print(f"📋 Current course roadmap_id: {course.roadmap_id}")
    print(f"📝 Request roadmap_id: {request.roadmap_id}")
    print(f"📝 Request dict: {request.dict()}")
    
    # Update fields
    if request.title:
        course.title = request.title
    if request.description:
        course.description = request.description
    if request.status:
        course.status = request.status
    if request.progress_percentage is not None:
        course.progress_percentage = request.progress_percentage
    if request.roadmap_id is not None:
        print(f"🗺️ Linking roadmap_id: {request.roadmap_id} to course")
        print(f"📦 Roadmap exists in storage: {request.roadmap_id in roadmaps}")
        if request.roadmap_id in roadmaps:
            print(f"✅ Roadmap found: {roadmaps[request.roadmap_id].goal}")
        else:
            print(f"⚠️ Roadmap NOT found in storage!")
        course.roadmap_id = request.roadmap_id
        print(f"✅ Course roadmap_id set to: {course.roadmap_id}")
    else:
        print(f"⚠️ request.roadmap_id is None - not updating")
    if request.custom_preferences:
        course.custom_preferences.update(request.custom_preferences)
    
    course.updated_at = datetime.now()
    
    print(f"✅ Course updated - roadmap_id is now: {course.roadmap_id}")
    
    # Get the roadmap if one is linked
    roadmap = None
    if course.roadmap_id and course.roadmap_id in roadmaps:
        roadmap = roadmaps[course.roadmap_id]
        print(f"📋 Including roadmap in response: {roadmap.goal}")
    
    return {
        "message": "Course updated successfully",
        "course": course,
        "roadmap": roadmap
    }

@router.post("/{course_id}/enroll")
async def enroll_course(course_id: str, request: EnrollCourseRequest):
    """
    Officially enroll/start a course (moves from PLANNING to ACTIVE)
    """
    if course_id not in courses:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course = courses[course_id]
    
    # Update course status
    course.status = CourseStatus.ACTIVE
    course.start_date = request.start_date or datetime.now()
    course.onboarding_completed = True
    course.custom_preferences.update(request.onboarding_preferences)
    
    # Calculate target completion date
    if course.target_weeks:
        course.target_completion_date = course.start_date + timedelta(weeks=course.target_weeks)
    
    course.updated_at = datetime.now()
    
    return {
        "message": "Successfully enrolled in course!",
        "course": course,
        "next_steps": [
            "Start with the first milestone in your roadmap",
            "Generate your first assignment",
            "Track your learning sessions"
        ]
    }

@router.delete("/{course_id}")
async def delete_course(course_id: str):
    """
    Delete a course (archives it)
    """
    if course_id not in courses:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course = courses[course_id]
    course.status = CourseStatus.ARCHIVED
    course.updated_at = datetime.now()
    
    return {
        "message": "Course archived successfully",
        "course_id": course_id
    }

# ===== Course Progress Tracking =====

@router.post("/{course_id}/session")
async def record_course_session(
    course_id: str,
    duration_minutes: int,
    concepts_studied: List[str],
    notes: Optional[str] = None
):
    """
    Record a learning session for this course
    """
    if course_id not in courses:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course = courses[course_id]
    
    # Update course stats
    course.total_time_spent_minutes += duration_minutes
    course.sessions_count += 1
    course.last_accessed = datetime.now()
    
    # Add new concepts to mastered list
    for concept in concepts_studied:
        if concept not in course.concepts_mastered:
            course.concepts_mastered.append(concept)
    
    # Recalculate progress based on roadmap
    if course.roadmap_id and course.roadmap_id in roadmaps:
        roadmap = roadmaps[course.roadmap_id]
        completed = len([m for m in roadmap.milestones if m.get("completed", False)])
        total = len(roadmap.milestones)
        course.progress_percentage = (completed / total * 100) if total > 0 else 0
    
    return {
        "message": "Session recorded successfully",
        "course": course,
        "session_summary": {
            "duration": f"{duration_minutes} minutes",
            "concepts_count": len(concepts_studied),
            "total_time": f"{course.total_time_spent_minutes // 60}h {course.total_time_spent_minutes % 60}m",
            "progress": f"{course.progress_percentage:.1f}%"
        }
    }

@router.get("/{course_id}/analytics")
async def get_course_analytics(course_id: str):
    """
    Get detailed analytics for a course
    """
    if course_id not in courses:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course = courses[course_id]
    
    # Get roadmap progress
    roadmap_progress = {}
    if course.roadmap_id and course.roadmap_id in roadmaps:
        roadmap = roadmaps[course.roadmap_id]
        total_milestones = len(roadmap.milestones)
        completed_milestones = len([m for m in roadmap.milestones if m.get("completed", False)])
        roadmap_progress = {
            "total_milestones": total_milestones,
            "completed_milestones": completed_milestones,
            "percentage": (completed_milestones / total_milestones * 100) if total_milestones > 0 else 0
        }
    
    # Get assignment progress
    course_assignments = [ai_assignments[aid] for aid in course.assignment_ids if aid in ai_assignments]
    assignment_progress = {
        "total_assignments": len(course_assignments),
        "completed_assignments": len([a for a in course_assignments if a.completed]),
        "average_difficulty": sum(a.difficulty for a in course_assignments) / len(course_assignments) if course_assignments else 0
    }
    
    # Time analytics
    time_analytics = {
        "total_hours": round(course.total_time_spent_minutes / 60, 1),
        "sessions_count": course.sessions_count,
        "average_session_minutes": round(course.total_time_spent_minutes / course.sessions_count) if course.sessions_count > 0 else 0,
        "days_since_start": (datetime.now() - course.start_date).days if course.start_date else 0
    }
    
    return {
        "course_id": course_id,
        "course_title": course.title,
        "overall_progress": course.progress_percentage,
        "status": course.status,
        "roadmap_progress": roadmap_progress,
        "assignment_progress": assignment_progress,
        "time_analytics": time_analytics,
        "concepts_mastered": len(course.concepts_mastered),
        "concepts_list": course.concepts_mastered
    }
