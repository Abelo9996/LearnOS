"""
Marketplace Router — Course discovery, stars, forks, search.
The "GitHub of Courses" — the social heart of LearnOS.
"""

import logging
import uuid
from datetime import datetime
from typing import Optional

import aiosqlite
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

import db

logger = logging.getLogger("learnos.marketplace")
router = APIRouter(prefix="/marketplace", tags=["marketplace"])


# ═══════════════ Request Models ═══════════════

class PublishCourseRequest(BaseModel):
    course_id: str
    user_id: str
    visibility: str = "public"
    category: str = "general"
    tags: list[str] = []
    short_description: str = ""
    author_name: str = ""
    author_avatar: str = ""
    thumbnail_url: str = ""


class StarRequest(BaseModel):
    user_id: str
    course_id: str


class ForkRequest(BaseModel):
    user_id: str
    course_id: str


class EnrollRequest(BaseModel):
    user_id: str
    course_id: str


# ═══════════════ EXPLORE / SEARCH ═══════════════

@router.get("/explore")
async def explore_courses(
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: str = Query("stars", regex="^(stars|newest|trending|enrolled)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Browse and search public courses."""
    courses = await db.explore_courses(
        category=category, tag=tag, search=search,
        sort=sort, limit=limit, offset=offset,
    )
    total = await db.count_explore_courses(
        category=category, tag=tag, search=search,
    )
    return {
        "courses": courses,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < total,
    }


@router.get("/categories")
async def list_categories():
    """Get all course categories with counts."""
    await db.update_category_counts()
    categories = await db.list_categories()
    return {"categories": categories}


@router.get("/featured")
async def featured_courses():
    """Get featured/trending courses for the homepage."""
    trending = await db.explore_courses(sort="trending", limit=6)
    newest = await db.explore_courses(sort="newest", limit=6)
    most_enrolled = await db.explore_courses(sort="enrolled", limit=6)
    return {
        "trending": trending,
        "newest": newest,
        "most_enrolled": most_enrolled,
    }


# ═══════════════ PUBLISH ═══════════════

@router.post("/publish")
async def publish_course(request: PublishCourseRequest):
    """Publish a course to the marketplace (make it public)."""
    course = await db.get_course(request.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course["user_id"] != request.user_id:
        raise HTTPException(status_code=403, detail="Only the course owner can publish")

    now = datetime.now().isoformat()
    meta = await db.get_course_meta(request.course_id)

    meta_dict = {
        "course_id": request.course_id,
        "visibility": request.visibility,
        "category": request.category,
        "tags": request.tags,
        "short_description": request.short_description or course.get("description", "")[:200],
        "author_name": request.author_name,
        "author_avatar": request.author_avatar,
        "thumbnail_url": request.thumbnail_url,
        "star_count": meta.get("star_count", 0) if meta else 0,
        "fork_count": meta.get("fork_count", 0) if meta else 0,
        "enrollment_count": meta.get("enrollment_count", 0) if meta else 0,
        "forked_from": meta.get("forked_from") if meta else None,
        "featured": meta.get("featured", False) if meta else False,
        "language": "en",
        "published_at": meta.get("published_at") if meta else now,
    }
    await db.save_course_meta(meta_dict)

    # Save tags
    async with aiosqlite.connect(db.DB_PATH) as conn:
        await conn.execute("DELETE FROM course_tags WHERE course_id = ?", (request.course_id,))
        for tag in request.tags:
            await conn.execute(
                "INSERT OR IGNORE INTO course_tags (tag, course_id) VALUES (?,?)",
                (tag.lower().strip(), request.course_id))
        await conn.commit()

    return {"message": "Course published!", "meta": meta_dict}


@router.post("/unpublish")
async def unpublish_course(course_id: str, user_id: str):
    """Make a course private again."""
    course = await db.get_course(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only the course owner can unpublish")

    meta = await db.get_course_meta(course_id)
    if meta:
        meta["visibility"] = "private"
        await db.save_course_meta(meta)

    return {"message": "Course unpublished"}


# ═══════════════ STARS ═══════════════

@router.post("/star")
async def star_course(request: StarRequest):
    """Star a course."""
    result = await db.star_course(request.user_id, request.course_id)
    if not result:
        return {"message": "Already starred", "starred": True}
    return {"message": "Course starred!", "starred": True}


@router.post("/unstar")
async def unstar_course(request: StarRequest):
    """Unstar a course."""
    result = await db.unstar_course(request.user_id, request.course_id)
    if not result:
        return {"message": "Was not starred", "starred": False}
    return {"message": "Course unstarred", "starred": False}


@router.get("/starred/{user_id}")
async def get_starred_courses(user_id: str):
    """Get courses starred by a user."""
    course_ids = await db.list_user_stars(user_id)
    courses = []
    for cid in course_ids:
        course = await db.get_course(cid)
        meta = await db.get_course_meta(cid)
        if course and meta:
            courses.append({**course, **meta})
    return {"courses": courses, "count": len(courses)}


@router.get("/is-starred/{user_id}/{course_id}")
async def check_starred(user_id: str, course_id: str):
    """Check if a user has starred a course."""
    starred = await db.has_starred(user_id, course_id)
    return {"starred": starred}


# ═══════════════ FORK ═══════════════

@router.post("/fork")
async def fork_course(request: ForkRequest):
    """Fork a public course to your account."""
    # Check source exists and is public
    meta = await db.get_course_meta(request.course_id)
    if not meta or meta.get("visibility") != "public":
        raise HTTPException(status_code=404, detail="Course not found or not public")

    new_id = str(uuid.uuid4())
    new_course = await db.fork_course(request.course_id, new_id, request.user_id)
    if not new_course:
        raise HTTPException(status_code=500, detail="Failed to fork course")

    return {
        "message": "Course forked!",
        "course": new_course,
        "forked_from": request.course_id,
    }


# ═══════════════ ENROLL ═══════════════

@router.post("/enroll")
async def enroll_course(request: EnrollRequest):
    """Enroll in a public course."""
    meta = await db.get_course_meta(request.course_id)
    if not meta or meta.get("visibility") != "public":
        raise HTTPException(status_code=404, detail="Course not found or not public")

    result = await db.enroll_in_course(request.user_id, request.course_id)
    if not result:
        return {"message": "Already enrolled", "enrolled": True}
    return {"message": "Enrolled successfully!", "enrolled": True}


@router.get("/enrollments/{user_id}")
async def get_enrollments(user_id: str):
    """Get courses a user is enrolled in."""
    enrollments = await db.list_user_enrollments(user_id)
    return {"enrollments": enrollments, "count": len(enrollments)}


# ═══════════════ COURSE PUBLIC VIEW ═══════════════

@router.get("/course/{course_id}")
async def get_public_course(course_id: str, user_id: Optional[str] = None):
    """Get public course detail with metadata."""
    course = await db.get_course(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    meta = await db.get_course_meta(course_id)
    is_owner = user_id and course["user_id"] == user_id

    if not is_owner and (not meta or meta.get("visibility") != "public"):
        raise HTTPException(status_code=404, detail="Course not found")

    # Roadmap (public view — hide answers)
    roadmap = None
    if course.get("roadmap_id"):
        roadmap = await db.get_roadmap(course["roadmap_id"])

    starred = False
    if user_id:
        starred = await db.has_starred(user_id, course_id)

    return {
        "course": course,
        "meta": meta or {},
        "roadmap": roadmap,
        "starred": starred,
        "is_owner": is_owner,
    }


# ═══════════════ AUTHOR PROFILES ═══════════════

@router.get("/author/{user_id}")
async def get_author_profile(user_id: str):
    """Get a public author profile."""
    courses = await db.get_author_courses(user_id)
    stats = await db.get_author_stats(user_id)

    # Get author name from first course or meta
    author_name = ""
    author_avatar = ""
    if courses:
        author_name = courses[0].get("author_name", "")
        author_avatar = courses[0].get("author_avatar", "")

    return {
        "user_id": user_id,
        "author_name": author_name,
        "author_avatar": author_avatar,
        "courses": courses,
        "stats": stats,
    }
