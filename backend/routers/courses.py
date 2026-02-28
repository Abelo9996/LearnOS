"""
Courses Router — Central hub for course management.
All roadmaps, assignments, and habits are tied to courses.
"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException

import db
from models_ai import (
    Course, CreateCourseRequest, UpdateCourseRequest, EnrollCourseRequest,
    CourseStatus,
)
from services.openai_service import get_openai_service

logger = logging.getLogger("learnos.courses")
router = APIRouter(prefix="/courses", tags=["courses"])


# ═══════════════ helpers ═══════════════

def _course_to_dict(course: Course) -> dict:
    """Convert a Pydantic Course to a flat dict for db.save_course."""
    d = course.model_dump() if hasattr(course, "model_dump") else course.dict()
    # Ensure datetimes are ISO strings
    for k in ("created_at", "updated_at", "last_accessed", "start_date",
              "target_completion_date", "actual_completion_date"):
        v = d.get(k)
        if v and not isinstance(v, str):
            d[k] = v.isoformat() if hasattr(v, "isoformat") else str(v)
    return d


# ═══════════════ CRUD ═══════════════

@router.post("/create")
async def create_course(request: CreateCourseRequest):
    now = datetime.now()
    course_id = str(uuid.uuid4())

    course_dict = {
        "course_id": course_id,
        "user_id": request.user_id,
        "title": request.title,
        "description": request.description,
        "goal": request.goal,
        "difficulty_level": request.difficulty_level,
        "target_weeks": request.target_weeks,
        "status": "planning",
        "progress_percentage": 0.0,
        "roadmap_id": None,
        "assignment_ids": [],
        "onboarding_completed": False,
        "custom_preferences": {},
        "total_time_spent_minutes": 0,
        "sessions_count": 0,
        "concepts_mastered": [],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "last_accessed": now.isoformat(),
        "generated_by_ai": False,
        "ai_model_used": None,
    }

    # Generate roadmap if requested
    roadmap_dict = None
    if request.generate_roadmap:
        config = await db.get_openai_config(request.user_id)
        if not config:
            await db.save_course(course_dict)
            return {
                "message": "Course created (without roadmap — AI not configured)",
                "course": course_dict,
                "roadmap": None,
            }

        try:
            service = get_openai_service(config["api_key"], model=config.get("model", "gpt-4o-mini"))
            roadmap_data = await service.generate_roadmap(
                goal=request.goal,
                current_knowledge=f"Starting {request.difficulty_level} level course",
                target_weeks=request.target_weeks,
                learning_style=f"Course-based learning: {request.title}",
            )

            roadmap_id = str(uuid.uuid4())
            milestones = roadmap_data.get("milestones", [])

            roadmap_dict = {
                "roadmap_id": roadmap_id,
                "user_id": request.user_id,
                "course_id": course_id,
                "goal": request.goal,
                "milestones": milestones,
                "total_estimated_hours": sum(m.get("estimated_hours", 10) for m in milestones),
                "estimated_completion_weeks": request.target_weeks,
                "adapted_to_profile": True,
                "adapted_to_habits": True,
                "difficulty_level": request.difficulty_level,
                "learning_strategy": roadmap_data.get("learning_strategy", ""),
                "success_tips": roadmap_data.get("success_tips", []),
                "potential_challenges": roadmap_data.get("potential_challenges", []),
                "mitigation_strategies": roadmap_data.get("mitigation_strategies", []),
                "generated_at": now.isoformat(),
                "last_updated": now.isoformat(),
                "ai_model": config.get("model", "gpt-4"),
            }
            await db.save_roadmap(roadmap_dict)

            course_dict["roadmap_id"] = roadmap_id
            course_dict["generated_by_ai"] = True
            course_dict["ai_model_used"] = config.get("model", "gpt-4")
        except Exception as e:
            logger.exception("Failed to generate roadmap during course creation")

    await db.save_course(course_dict)

    return {
        "message": "Course created successfully!",
        "course": course_dict,
        "roadmap": roadmap_dict,
    }


@router.get("/list/{user_id}")
async def list_user_courses(user_id: str, status: Optional[str] = None):
    courses = await db.list_courses(user_id, status=status)
    return {"user_id": user_id, "courses": courses, "count": len(courses)}


@router.get("/{course_id}")
async def get_course_detail(course_id: str):
    course = await db.get_course(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Update last accessed
    course["last_accessed"] = datetime.now().isoformat()
    await db.save_course(course)

    # Associated roadmap
    roadmap = None
    if course.get("roadmap_id"):
        roadmap = await db.get_roadmap(course["roadmap_id"])

    # Assignments for this course
    course_assignments = await db.list_assignments(course["user_id"], course_id=course_id)

    # Recent sessions
    all_sessions = await db.list_learning_sessions(course["user_id"], limit=10)

    completed_milestones = 0
    total_milestones = 0
    if roadmap:
        ms = roadmap.get("milestones", [])
        total_milestones = len(ms)
        completed_milestones = sum(1 for m in ms if m.get("completed"))

    completed_assignments = sum(1 for a in course_assignments if a.get("status") in ("completed", "graded"))

    return {
        "course": course,
        "roadmap": roadmap,
        "assignments": course_assignments,
        "recent_sessions": all_sessions[:10],
        "stats": {
            "total_milestones": total_milestones,
            "completed_milestones": completed_milestones,
            "total_assignments": len(course_assignments),
            "completed_assignments": completed_assignments,
            "total_time_hours": round(course.get("total_time_spent_minutes", 0) / 60, 1),
            "sessions_count": course.get("sessions_count", 0),
        },
    }


@router.put("/{course_id}")
async def update_course(course_id: str, request: UpdateCourseRequest):
    course = await db.get_course(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if request.title:
        course["title"] = request.title
    if request.description:
        course["description"] = request.description
    if request.status:
        course["status"] = request.status
    if request.progress_percentage is not None:
        course["progress_percentage"] = request.progress_percentage
    if request.roadmap_id is not None:
        course["roadmap_id"] = request.roadmap_id
    if request.custom_preferences:
        prefs = course.get("custom_preferences") or {}
        prefs.update(request.custom_preferences)
        course["custom_preferences"] = prefs

    course["updated_at"] = datetime.now().isoformat()
    await db.save_course(course)

    roadmap = None
    if course.get("roadmap_id"):
        roadmap = await db.get_roadmap(course["roadmap_id"])

    return {"message": "Course updated successfully", "course": course, "roadmap": roadmap}


@router.post("/{course_id}/enroll")
async def enroll_course(course_id: str, request: EnrollCourseRequest):
    course = await db.get_course(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    start = request.start_date or datetime.now()
    course["status"] = "active"
    course["start_date"] = start.isoformat() if hasattr(start, "isoformat") else str(start)
    course["onboarding_completed"] = True
    prefs = course.get("custom_preferences") or {}
    prefs.update(request.onboarding_preferences)
    course["custom_preferences"] = prefs

    if course.get("target_weeks"):
        target = start + timedelta(weeks=course["target_weeks"])
        course["target_completion_date"] = target.isoformat()

    course["updated_at"] = datetime.now().isoformat()
    await db.save_course(course)

    return {
        "message": "Successfully enrolled in course!",
        "course": course,
        "next_steps": [
            "Start with the first milestone in your roadmap",
            "Generate your first assignment",
            "Track your learning sessions",
        ],
    }


@router.delete("/{course_id}")
async def archive_course(course_id: str):
    course = await db.get_course(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course["status"] = "archived"
    course["updated_at"] = datetime.now().isoformat()
    await db.save_course(course)

    return {"message": "Course archived successfully", "course_id": course_id}


# ═══════════════ Session & Analytics ═══════════════

@router.post("/{course_id}/session")
async def record_course_session(
    course_id: str,
    duration_minutes: int,
    concepts_studied: List[str],
    notes: Optional[str] = None,
):
    course = await db.get_course(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course["total_time_spent_minutes"] = course.get("total_time_spent_minutes", 0) + duration_minutes
    course["sessions_count"] = course.get("sessions_count", 0) + 1
    course["last_accessed"] = datetime.now().isoformat()

    mastered = course.get("concepts_mastered") or []
    for c in concepts_studied:
        if c not in mastered:
            mastered.append(c)
    course["concepts_mastered"] = mastered

    # Recalculate progress from roadmap
    if course.get("roadmap_id"):
        roadmap = await db.get_roadmap(course["roadmap_id"])
        if roadmap:
            ms = roadmap.get("milestones", [])
            completed = sum(1 for m in ms if m.get("completed"))
            total = len(ms)
            course["progress_percentage"] = (completed / total * 100) if total > 0 else 0

    await db.save_course(course)

    return {
        "message": "Session recorded successfully",
        "course": course,
        "session_summary": {
            "duration": f"{duration_minutes} minutes",
            "concepts_count": len(concepts_studied),
            "total_time": f"{course['total_time_spent_minutes'] // 60}h {course['total_time_spent_minutes'] % 60}m",
            "progress": f"{course['progress_percentage']:.1f}%",
        },
    }


@router.get("/{course_id}/analytics")
async def get_course_analytics(course_id: str):
    course = await db.get_course(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    roadmap_progress = {}
    if course.get("roadmap_id"):
        roadmap = await db.get_roadmap(course["roadmap_id"])
        if roadmap:
            ms = roadmap.get("milestones", [])
            total = len(ms)
            completed = sum(1 for m in ms if m.get("completed"))
            roadmap_progress = {
                "total_milestones": total,
                "completed_milestones": completed,
                "percentage": (completed / total * 100) if total > 0 else 0,
            }

    assignments = await db.list_assignments(course["user_id"], course_id=course_id)
    completed_a = sum(1 for a in assignments if a.get("status") in ("completed", "graded"))

    ttm = course.get("total_time_spent_minutes", 0)
    sc = course.get("sessions_count", 0)

    return {
        "course_id": course_id,
        "course_title": course.get("title"),
        "overall_progress": course.get("progress_percentage", 0),
        "status": course.get("status"),
        "roadmap_progress": roadmap_progress,
        "assignment_progress": {
            "total_assignments": len(assignments),
            "completed_assignments": completed_a,
        },
        "time_analytics": {
            "total_hours": round(ttm / 60, 1),
            "sessions_count": sc,
            "average_session_minutes": round(ttm / sc) if sc > 0 else 0,
        },
        "concepts_mastered": len(course.get("concepts_mastered", [])),
        "concepts_list": course.get("concepts_mastered", []),
    }
