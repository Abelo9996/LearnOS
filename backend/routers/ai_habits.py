"""
Habit Tracking & AI Insights Router.
"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, HTTPException

import db
from models_ai import (
    LearningHabit, LearningSession, HabitAdaptation, AIInsight,
    GetHabitAdaptationsRequest, GetAIInsightsRequest,
)
from services.openai_service import get_openai_service

logger = logging.getLogger("learnos.ai_habits")
router = APIRouter(prefix="/ai/habits", tags=["ai-habits"])


def _get_time_of_day() -> str:
    hour = datetime.now().hour
    if 5 <= hour < 12:
        return "morning"
    elif 12 <= hour < 17:
        return "afternoon"
    elif 17 <= hour < 21:
        return "evening"
    return "night"


# ===== Session Tracking =====

@router.post("/session/start")
async def start_learning_session(user_id: str):
    session_id = str(uuid.uuid4())
    session = {
        "session_id": session_id,
        "user_id": user_id,
        "start_time": datetime.now().isoformat(),
        "time_of_day": _get_time_of_day(),
        "day_of_week": datetime.now().strftime("%A"),
        "completed": False,
    }
    await db.save_learning_session(session)
    return {"message": "Learning session started", "session": session}


@router.put("/session/{session_id}/end")
async def end_learning_session(
    session_id: str,
    concepts_covered: List[str] = [],
    questions_answered: int = 0,
    correct_answers: int = 0,
    mastery_gained: float = 0.0,
    interruptions: int = 0,
):
    session = await db.get_learning_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    end_time = datetime.now()
    start_time = datetime.fromisoformat(session["start_time"])
    duration = int((end_time - start_time).total_seconds() / 60)

    session["end_time"] = end_time.isoformat()
    session["duration_minutes"] = duration
    session["concepts_covered"] = concepts_covered
    session["questions_answered"] = questions_answered
    session["correct_answers"] = correct_answers
    session["mastery_gained"] = mastery_gained
    session["interruptions"] = interruptions
    session["completed"] = True

    if questions_answered > 0:
        accuracy = correct_answers / questions_answered
        session["attention_score"] = min(1.0, accuracy * (1 - interruptions * 0.1))
        session["engagement_level"] = "high" if accuracy > 0.8 else ("medium" if accuracy > 0.5 else "low")

    await db.save_learning_session(session)

    # Update habits
    habit = await db.get_learning_habit(session["user_id"]) or {"user_id": session["user_id"]}
    sessions = await db.list_learning_sessions(session["user_id"])
    completed_sessions = [s for s in sessions if s.get("completed")]
    if completed_sessions:
        habit["average_session_duration"] = int(sum(s.get("duration_minutes", 0) for s in completed_sessions) / len(completed_sessions))
    if session.get("engagement_level") == "high":
        conditions = habit.get("peak_performance_conditions", [])
        key = f"{session.get('day_of_week')}_{session.get('time_of_day')}"
        if key not in conditions:
            conditions.append(key)
        habit["peak_performance_conditions"] = conditions
    habit["last_updated"] = datetime.now().isoformat()
    await db.save_learning_habit(habit)

    return {
        "message": "Learning session completed",
        "session": session,
        "duration": f"{duration} minutes",
    }


@router.get("/sessions/{user_id}")
async def get_user_sessions(user_id: str, days: int = 30):
    sessions = await db.list_learning_sessions(user_id, limit=200)
    cutoff = datetime.now() - timedelta(days=days)
    recent = [s for s in sessions if datetime.fromisoformat(s["start_time"]) >= cutoff]
    total_time = sum(s.get("duration_minutes", 0) for s in recent if s.get("completed"))
    avg = total_time / len(recent) if recent else 0
    concepts = len(set(c for s in recent for c in s.get("concepts_covered", [])))

    return {
        "user_id": user_id,
        "sessions": recent,
        "count": len(recent),
        "stats": {
            "total_time_minutes": total_time,
            "average_session_minutes": int(avg),
            "total_concepts_covered": concepts,
            "sessions_per_week": round(len(recent) / max(days / 7, 1), 1),
        },
    }


@router.get("/profile/{user_id}")
async def get_learning_habit_profile(user_id: str):
    habit = await db.get_learning_habit(user_id)
    if not habit:
        habit = {"user_id": user_id, "preferred_time_of_day": "morning", "average_session_duration": 30}
        await db.save_learning_habit(habit)
    return habit


# ===== Habit Adaptations =====

@router.post("/adaptations/generate")
async def generate_habit_adaptations(request: GetHabitAdaptationsRequest):
    config = await db.get_openai_config(request.user_id)
    if not config:
        raise HTTPException(status_code=404, detail="OpenAI not configured.")

    features = await db.get_feature_toggles(request.user_id)
    if features and not features.get("habit_adaptation", True):
        raise HTTPException(status_code=403, detail="Habit adaptation is disabled.")

    service = get_openai_service(config["api_key"])
    if not service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")

    habits = await db.get_learning_habit(request.user_id) or {"user_id": request.user_id}
    sessions = await db.list_learning_sessions(request.user_id, limit=200)
    cutoff = datetime.now() - timedelta(days=request.days_to_analyze)
    recent = [s for s in sessions if datetime.fromisoformat(s["start_time"]) >= cutoff]

    progress = {
        "sessions_completed": len(recent),
        "total_time": sum(s.get("duration_minutes", 0) for s in recent if s.get("completed")),
        "concepts_mastered": len(set(c for s in recent for c in s.get("concepts_covered", []))),
    }

    try:
        adaptations_data = await service.analyze_habits_and_suggest_adaptations(
            learning_habits=habits,
            recent_sessions=[s for s in recent[-10:]],
            current_progress=progress,
        )

        adaptations = []
        for ad in adaptations_data:
            if request.adaptation_types and ad.get("adaptation_type") not in request.adaptation_types:
                continue
            a = {
                "adaptation_id": str(uuid.uuid4()),
                "user_id": request.user_id,
                "adaptation_type": ad.get("adaptation_type", "general"),
                "current_behavior": ad.get("current_behavior", ""),
                "observed_pattern": ad.get("observed_pattern", ""),
                "suggested_change": ad.get("suggested_change", ""),
                "reasoning": ad.get("reasoning", ""),
                "expected_benefit": ad.get("expected_benefit", ""),
                "confidence": ad.get("confidence", 0.7),
                "implementation_steps": ad.get("implementation_steps", []),
                "trial_period_days": ad.get("trial_period_days", 7),
                "success_metrics": ad.get("success_metrics", []),
                "status": "suggested",
                "created_at": datetime.now().isoformat(),
                "ai_model": config.get("model", "gpt-4"),
            }
            await db.save_habit_adaptation(a)
            adaptations.append(a)

        return {"message": f"Generated {len(adaptations)} habit adaptations", "adaptations": adaptations}
    except Exception as e:
        logger.exception("Failed to generate adaptations")
        raise HTTPException(status_code=500, detail=f"Failed to generate adaptations: {e}")


@router.get("/adaptations/{user_id}")
async def get_user_adaptations(user_id: str, status: str = None):
    adaptations = await db.list_habit_adaptations(user_id, status=status)
    return {"user_id": user_id, "adaptations": adaptations, "count": len(adaptations)}


@router.put("/adaptations/{adaptation_id}/status")
async def update_adaptation_status(adaptation_id: str, status: str, user_feedback: str = None, actual_outcome: str = None):
    a = await db.get_habit_adaptation(adaptation_id)
    if not a:
        raise HTTPException(status_code=404, detail="Adaptation not found")

    valid = ["suggested", "accepted", "rejected", "in_progress", "successful", "unsuccessful"]
    if status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {valid}")

    a["status"] = status
    if user_feedback:
        a["user_feedback"] = user_feedback
    if actual_outcome:
        a["actual_outcome"] = actual_outcome
    await db.save_habit_adaptation(a)
    return {"message": "Adaptation status updated", "adaptation": a}


# ===== AI Insights =====

@router.post("/insights/generate")
async def generate_ai_insights(request: GetAIInsightsRequest):
    config = await db.get_openai_config(request.user_id)
    if not config:
        raise HTTPException(status_code=404, detail="OpenAI not configured.")

    features = await db.get_feature_toggles(request.user_id)
    if features and not features.get("progress_insights", True):
        raise HTTPException(status_code=403, detail="Progress insights are disabled.")

    service = get_openai_service(config["api_key"])
    if not service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")

    sessions = await db.list_learning_sessions(request.user_id, limit=200)
    time_frames = {"past_day": 1, "past_week": 7, "past_month": 30, "overall": 365}
    days = time_frames.get(request.time_frame, 7)
    cutoff = datetime.now() - timedelta(days=days)
    recent = [s for s in sessions if datetime.fromisoformat(s["start_time"]) >= cutoff]

    progress = {
        "sessions_completed": len(recent),
        "total_time": sum(s.get("duration_minutes", 0) for s in recent if s.get("completed")),
        "concepts_mastered": len(set(c for s in recent for c in s.get("concepts_covered", []))),
    }

    try:
        insights_data = await service.generate_progress_insights(
            user_progress=progress,
            learning_history=recent,
            current_goals=["Learn efficiently", "Master concepts"],
        )

        insights = []
        for idata in insights_data:
            if request.insight_types and idata.get("insight_type") not in request.insight_types:
                continue
            i = {
                "insight_id": str(uuid.uuid4()),
                "user_id": request.user_id,
                "insight_type": idata.get("insight_type", "progress"),
                "title": idata.get("title", "Insight"),
                "description": idata.get("description", ""),
                "supporting_data": idata.get("supporting_data", []),
                "actionable": idata.get("actionable", True),
                "suggested_actions": idata.get("suggested_actions", []),
                "priority": idata.get("priority", "medium"),
                "related_concepts": [],
                "time_frame": request.time_frame,
                "generated_at": datetime.now().isoformat(),
                "ai_model": config.get("model", "gpt-4"),
            }
            await db.save_ai_insight(i)
            insights.append(i)

        return {"message": f"Generated {len(insights)} AI insights", "insights": insights, "time_frame": request.time_frame}
    except Exception as e:
        logger.exception("Failed to generate insights")
        raise HTTPException(status_code=500, detail=f"Failed to generate insights: {e}")


@router.get("/insights/{user_id}")
async def get_user_insights(user_id: str, insight_type: str = None):
    insights = await db.list_ai_insights(user_id, insight_type=insight_type)
    return {"user_id": user_id, "insights": insights, "count": len(insights)}
