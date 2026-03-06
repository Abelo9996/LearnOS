"""
Social Router — Discussions, Cohorts, Leaderboards, Activity Feed, Notifications.
The "university feel" of LearnOS.
"""

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

import db

logger = logging.getLogger("learnos.social")
router = APIRouter(prefix="/social", tags=["social"])


# ═══════════════ Request Models ═══════════════

class DiscussionCreate(BaseModel):
    course_id: str
    user_id: str
    content: str
    title: str = ""
    milestone_id: Optional[str] = None
    parent_id: Optional[str] = None
    display_name: str = ""


class VoteRequest(BaseModel):
    user_id: str
    discussion_id: str
    vote: int = 1  # 1 = upvote, -1 = downvote


class CohortCreate(BaseModel):
    course_id: str
    name: str
    description: str = ""
    max_members: int = 50
    created_by: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class CohortJoin(BaseModel):
    cohort_id: str
    user_id: str
    display_name: str = ""


# ═══════════════ DISCUSSIONS ═══════════════

@router.post("/discussions")
async def create_discussion(request: DiscussionCreate):
    """Create a discussion post or reply."""
    discussion = {
        "discussion_id": str(uuid.uuid4()),
        "course_id": request.course_id,
        "milestone_id": request.milestone_id,
        "user_id": request.user_id,
        "parent_id": request.parent_id,
        "title": request.title,
        "content": request.content,
    }
    await db.save_discussion(discussion)

    # Create activity
    action = "replied to a discussion" if request.parent_id else "started a discussion"
    await db.save_activity({
        "activity_id": str(uuid.uuid4()),
        "user_id": request.user_id,
        "course_id": request.course_id,
        "activity_type": "discussion_reply" if request.parent_id else "discussion_post",
        "title": f"{request.display_name or 'Someone'} {action}",
        "description": request.title or request.content[:100],
    })

    return {"discussion": discussion}


@router.get("/discussions/{course_id}")
async def list_discussions(
    course_id: str,
    milestone_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
):
    """List discussions for a course."""
    discussions = await db.list_discussions(course_id, milestone_id=milestone_id, limit=limit)
    return {"discussions": discussions, "count": len(discussions)}


@router.get("/discussions/{course_id}/{discussion_id}")
async def get_discussion(course_id: str, discussion_id: str):
    """Get a discussion with its replies."""
    discussion = await db.get_discussion(discussion_id)
    if not discussion:
        raise HTTPException(status_code=404, detail="Discussion not found")
    replies = await db.list_discussions(course_id, parent_id=discussion_id)
    return {"discussion": discussion, "replies": replies}


@router.post("/discussions/vote")
async def vote_discussion(request: VoteRequest):
    """Upvote or downvote a discussion."""
    new_count = await db.vote_discussion(request.user_id, request.discussion_id, request.vote)
    return {"upvotes": new_count}


# ═══════════════ COHORTS ═══════════════

@router.post("/cohorts")
async def create_cohort(request: CohortCreate):
    """Create a cohort for a course."""
    cohort = {
        "cohort_id": str(uuid.uuid4()),
        "course_id": request.course_id,
        "name": request.name,
        "description": request.description,
        "max_members": request.max_members,
        "created_by": request.created_by,
        "start_date": request.start_date,
        "end_date": request.end_date,
    }
    await db.save_cohort(cohort)

    # Auto-join creator
    await db.join_cohort(cohort["cohort_id"], request.created_by)

    return {"cohort": cohort}


@router.get("/cohorts/{course_id}")
async def list_cohorts(course_id: str):
    """List active cohorts for a course."""
    cohorts = await db.list_cohorts(course_id)
    return {"cohorts": cohorts}


@router.post("/cohorts/join")
async def join_cohort(request: CohortJoin):
    """Join a cohort."""
    result = await db.join_cohort(request.cohort_id, request.user_id, request.display_name)
    if not result:
        return {"message": "Already a member or cohort is full", "joined": False}
    return {"message": "Joined cohort!", "joined": True}


@router.post("/cohorts/leave")
async def leave_cohort(cohort_id: str, user_id: str):
    """Leave a cohort."""
    await db.leave_cohort(cohort_id, user_id)
    return {"message": "Left cohort"}


@router.get("/cohorts/{course_id}/{cohort_id}/members")
async def get_cohort_members(course_id: str, cohort_id: str):
    """Get members of a cohort (leaderboard view)."""
    members = await db.list_cohort_members(cohort_id)
    return {"members": members, "count": len(members)}


# ═══════════════ LEADERBOARD ═══════════════

@router.get("/leaderboard/{course_id}")
async def get_leaderboard(course_id: str, limit: int = Query(20, ge=1, le=100)):
    """Get leaderboard for a course."""
    entries = await db.get_course_leaderboard(course_id, limit)
    return {"leaderboard": entries, "count": len(entries)}


# ═══════════════ ACTIVITY FEED ═══════════════

@router.get("/activity")
async def get_activity_feed(
    course_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = Query(30, ge=1, le=100),
):
    """Get activity feed (global, course-specific, or user-specific)."""
    activities = await db.list_activity_feed(course_id=course_id, user_id=user_id, limit=limit)
    return {"activities": activities, "count": len(activities)}


# ═══════════════ NOTIFICATIONS ═══════════════

@router.get("/notifications/{user_id}")
async def get_notifications(
    user_id: str,
    unread_only: bool = False,
    limit: int = Query(30, ge=1, le=100),
):
    """Get notifications for a user."""
    notifications = await db.list_notifications(user_id, unread_only=unread_only, limit=limit)
    unread_count = await db.count_unread_notifications(user_id)
    return {"notifications": notifications, "unread_count": unread_count}


@router.post("/notifications/{notification_id}/read")
async def mark_read(notification_id: str):
    """Mark a notification as read."""
    await db.mark_notification_read(notification_id)
    return {"message": "Marked as read"}


@router.post("/notifications/{user_id}/read-all")
async def mark_all_read(user_id: str):
    """Mark all notifications as read."""
    await db.mark_all_notifications_read(user_id)
    return {"message": "All notifications marked as read"}


# ═══════════════ STREAKS ═══════════════

@router.get("/streak/{user_id}")
async def get_streak(user_id: str):
    """Get streak data for a user."""
    streak = await db.get_streak(user_id)
    return {"streak": streak}


@router.post("/streak/{user_id}/log")
async def log_activity(user_id: str):
    """Log a learning activity (updates streak)."""
    await db.update_streak(user_id)
    streak = await db.get_streak(user_id)
    return {"streak": streak}
