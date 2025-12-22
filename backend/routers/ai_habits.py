"""
Habit Tracking & AI Insights Router
Track learning habits and generate AI-powered adaptations and insights
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List
from models_ai import (
    LearningHabit, LearningSession, HabitAdaptation, AIInsight,
    GetHabitAdaptationsRequest, GetAIInsightsRequest
)
from services.openai_service import get_openai_service
from routers.ai_config import openai_configs, feature_toggles
from datetime import datetime, timedelta
import uuid

router = APIRouter(prefix="/ai/habits", tags=["ai-habits"])

# In-memory storage
learning_habits: Dict[str, LearningHabit] = {}
learning_sessions: Dict[str, List[LearningSession]] = {}  # user_id -> sessions
habit_adaptations: Dict[str, List[HabitAdaptation]] = {}  # user_id -> adaptations
ai_insights: Dict[str, List[AIInsight]] = {}  # user_id -> insights

# ===== Session Tracking =====

@router.post("/session/start")
async def start_learning_session(user_id: str):
    """
    Start tracking a new learning session
    """
    session = LearningSession(
        session_id=str(uuid.uuid4()),
        user_id=user_id,
        start_time=datetime.now(),
        time_of_day=_get_time_of_day(),
        day_of_week=datetime.now().strftime("%A")
    )
    
    if user_id not in learning_sessions:
        learning_sessions[user_id] = []
    
    learning_sessions[user_id].append(session)
    
    return {
        "message": "Learning session started",
        "session": session
    }

@router.put("/session/{session_id}/end")
async def end_learning_session(
    session_id: str,
    concepts_covered: List[str] = [],
    questions_answered: int = 0,
    correct_answers: int = 0,
    mastery_gained: float = 0.0,
    interruptions: int = 0
):
    """
    End and record learning session data
    """
    # Find session
    session = None
    user_id = None
    
    for uid, sessions in learning_sessions.items():
        for s in sessions:
            if s.session_id == session_id:
                session = s
                user_id = uid
                break
        if session:
            break
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update session
    session.end_time = datetime.now()
    session.duration_minutes = int((session.end_time - session.start_time).total_seconds() / 60)
    session.concepts_covered = concepts_covered
    session.questions_answered = questions_answered
    session.correct_answers = correct_answers
    session.mastery_gained = mastery_gained
    session.interruptions = interruptions
    session.completed = True
    
    # Calculate engagement metrics
    if questions_answered > 0:
        accuracy = correct_answers / questions_answered
        session.attention_score = min(1.0, accuracy * (1 - interruptions * 0.1))
        
        if accuracy > 0.8:
            session.engagement_level = "high"
        elif accuracy > 0.5:
            session.engagement_level = "medium"
        else:
            session.engagement_level = "low"
    
    # Update learning habits
    await _update_learning_habits(user_id, session)
    
    return {
        "message": "Learning session completed",
        "session": session,
        "duration": f"{session.duration_minutes} minutes",
        "accuracy": f"{session.correct_answers}/{session.questions_answered}" if session.questions_answered > 0 else "N/A"
    }

@router.get("/sessions/{user_id}")
async def get_user_sessions(user_id: str, days: int = 30):
    """
    Get user's learning sessions
    """
    if user_id not in learning_sessions:
        return {
            "user_id": user_id,
            "sessions": [],
            "count": 0
        }
    
    # Filter by date range
    cutoff = datetime.now() - timedelta(days=days)
    recent_sessions = [
        s for s in learning_sessions[user_id]
        if s.start_time >= cutoff
    ]
    
    # Calculate stats
    total_time = sum(s.duration_minutes or 0 for s in recent_sessions if s.completed)
    avg_duration = total_time / len(recent_sessions) if recent_sessions else 0
    total_concepts = len(set(c for s in recent_sessions for c in s.concepts_covered))
    
    return {
        "user_id": user_id,
        "sessions": recent_sessions,
        "count": len(recent_sessions),
        "stats": {
            "total_time_minutes": total_time,
            "average_session_minutes": int(avg_duration),
            "total_concepts_covered": total_concepts,
            "sessions_per_week": len(recent_sessions) / (days / 7)
        }
    }

# ===== Habit Analysis =====

@router.get("/profile/{user_id}")
async def get_learning_habit_profile(user_id: str):
    """
    Get user's learning habit profile
    """
    if user_id not in learning_habits:
        # Create default habit profile
        learning_habits[user_id] = LearningHabit(user_id=user_id)
    
    return learning_habits[user_id]

@router.post("/adaptations/generate")
async def generate_habit_adaptations(request: GetHabitAdaptationsRequest):
    """
    Generate AI-powered habit adaptations
    """
    # Check if AI is configured
    if request.user_id not in openai_configs:
        raise HTTPException(
            status_code=404,
            detail="OpenAI not configured. Please set up your API key first."
        )
    
    # Check if feature is enabled
    features = feature_toggles.get(request.user_id)
    if features and not features.habit_adaptation:
        raise HTTPException(
            status_code=403,
            detail="Habit adaptation is disabled. Enable it in settings."
        )
    
    config = openai_configs[request.user_id]
    service = get_openai_service(config.api_key)
    
    if not service.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI service not available"
        )
    
    # Get user's habits and sessions
    habits = learning_habits.get(request.user_id, LearningHabit(user_id=request.user_id))
    sessions = learning_sessions.get(request.user_id, [])
    
    # Filter recent sessions
    cutoff = datetime.now() - timedelta(days=request.days_to_analyze)
    recent_sessions = [s for s in sessions if s.start_time >= cutoff]
    
    # Get current progress (simplified)
    progress = {
        "sessions_completed": len(recent_sessions),
        "total_time": sum(s.duration_minutes or 0 for s in recent_sessions if s.completed),
        "concepts_mastered": len(set(c for s in recent_sessions for c in s.concepts_covered))
    }
    
    try:
        # Generate adaptations with AI
        adaptations_data = await service.analyze_habits_and_suggest_adaptations(
            learning_habits=habits.dict(),
            recent_sessions=[s.dict() for s in recent_sessions[-10:]],
            current_progress=progress
        )
        
        # Create adaptation objects
        adaptations = []
        for adapt_data in adaptations_data:
            # Filter by type if specified
            if request.adaptation_types and adapt_data.get("adaptation_type") not in request.adaptation_types:
                continue
            
            adaptation = HabitAdaptation(
                adaptation_id=str(uuid.uuid4()),
                user_id=request.user_id,
                adaptation_type=adapt_data.get("adaptation_type", "general"),
                current_behavior=adapt_data.get("current_behavior", ""),
                observed_pattern=adapt_data.get("observed_pattern", ""),
                suggested_change=adapt_data.get("suggested_change", ""),
                reasoning=adapt_data.get("reasoning", ""),
                expected_benefit=adapt_data.get("expected_benefit", ""),
                confidence=adapt_data.get("confidence", 0.7),
                implementation_steps=adapt_data.get("implementation_steps", []),
                trial_period_days=adapt_data.get("trial_period_days", 7),
                success_metrics=adapt_data.get("success_metrics", []),
                status="suggested",
                created_at=datetime.now(),
                ai_model=config.model
            )
            adaptations.append(adaptation)
        
        # Store adaptations
        if request.user_id not in habit_adaptations:
            habit_adaptations[request.user_id] = []
        habit_adaptations[request.user_id].extend(adaptations)
        
        return {
            "message": f"Generated {len(adaptations)} habit adaptations",
            "adaptations": adaptations
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate adaptations: {str(e)}"
        )

@router.get("/adaptations/{user_id}")
async def get_user_adaptations(user_id: str, status: str = None):
    """
    Get user's habit adaptations, optionally filtered by status
    """
    if user_id not in habit_adaptations:
        return {
            "user_id": user_id,
            "adaptations": [],
            "count": 0
        }
    
    adaptations = habit_adaptations[user_id]
    
    if status:
        adaptations = [a for a in adaptations if a.status == status]
    
    return {
        "user_id": user_id,
        "adaptations": adaptations,
        "count": len(adaptations)
    }

@router.put("/adaptations/{adaptation_id}/status")
async def update_adaptation_status(
    adaptation_id: str,
    status: str,
    user_feedback: str = None,
    actual_outcome: str = None
):
    """
    Update adaptation status (accepted, rejected, in_progress, successful, unsuccessful)
    """
    # Find adaptation
    adaptation = None
    for adaptations in habit_adaptations.values():
        for a in adaptations:
            if a.adaptation_id == adaptation_id:
                adaptation = a
                break
        if adaptation:
            break
    
    if not adaptation:
        raise HTTPException(status_code=404, detail="Adaptation not found")
    
    valid_statuses = ["suggested", "accepted", "rejected", "in_progress", "successful", "unsuccessful"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {valid_statuses}")
    
    adaptation.status = status
    if user_feedback:
        adaptation.user_feedback = user_feedback
    if actual_outcome:
        adaptation.actual_outcome = actual_outcome
    
    return {
        "message": "Adaptation status updated",
        "adaptation": adaptation
    }

# ===== AI Insights =====

@router.post("/insights/generate")
async def generate_ai_insights(request: GetAIInsightsRequest):
    """
    Generate AI-powered insights about learning progress
    """
    # Check if AI is configured
    if request.user_id not in openai_configs:
        raise HTTPException(
            status_code=404,
            detail="OpenAI not configured. Please set up your API key first."
        )
    
    # Check if feature is enabled
    features = feature_toggles.get(request.user_id)
    if features and not features.progress_insights:
        raise HTTPException(
            status_code=403,
            detail="Progress insights are disabled. Enable it in settings."
        )
    
    config = openai_configs[request.user_id]
    service = get_openai_service(config.api_key)
    
    if not service.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI service not available"
        )
    
    # Get user data
    sessions = learning_sessions.get(request.user_id, [])
    habits = learning_habits.get(request.user_id, LearningHabit(user_id=request.user_id))
    
    # Calculate time range
    time_frames = {
        "past_day": 1,
        "past_week": 7,
        "past_month": 30,
        "overall": 365
    }
    days = time_frames.get(request.time_frame, 7)
    cutoff = datetime.now() - timedelta(days=days)
    recent_sessions = [s for s in sessions if s.start_time >= cutoff]
    
    # Prepare progress data
    progress = {
        "sessions_completed": len(recent_sessions),
        "total_time": sum(s.duration_minutes or 0 for s in recent_sessions if s.completed),
        "concepts_mastered": len(set(c for s in recent_sessions for c in s.concepts_covered)),
        "average_accuracy": sum(s.correct_answers / s.questions_answered if s.questions_answered > 0 else 0 for s in recent_sessions) / len(recent_sessions) if recent_sessions else 0
    }
    
    # Get current goals (simplified)
    current_goals = ["Learn efficiently", "Master concepts"]
    
    try:
        # Generate insights with AI
        insights_data = await service.generate_progress_insights(
            user_progress=progress,
            learning_history=[s.dict() for s in recent_sessions],
            current_goals=current_goals
        )
        
        # Create insight objects
        insights = []
        for insight_data in insights_data:
            # Filter by type if specified
            if request.insight_types and insight_data.get("insight_type") not in request.insight_types:
                continue
            
            insight = AIInsight(
                insight_id=str(uuid.uuid4()),
                user_id=request.user_id,
                insight_type=insight_data.get("insight_type", "progress"),
                title=insight_data.get("title", "Insight"),
                description=insight_data.get("description", ""),
                supporting_data=insight_data.get("supporting_data", []),
                actionable=insight_data.get("actionable", True),
                suggested_actions=insight_data.get("suggested_actions", []),
                priority=insight_data.get("priority", "medium"),
                related_concepts=[],
                time_frame=request.time_frame,
                generated_at=datetime.now(),
                ai_model=config.model
            )
            insights.append(insight)
        
        # Store insights
        if request.user_id not in ai_insights:
            ai_insights[request.user_id] = []
        ai_insights[request.user_id].extend(insights)
        
        return {
            "message": f"Generated {len(insights)} AI insights",
            "insights": insights,
            "time_frame": request.time_frame
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate insights: {str(e)}"
        )

@router.get("/insights/{user_id}")
async def get_user_insights(user_id: str, insight_type: str = None):
    """
    Get user's AI-generated insights
    """
    if user_id not in ai_insights:
        return {
            "user_id": user_id,
            "insights": [],
            "count": 0
        }
    
    insights = ai_insights[user_id]
    
    if insight_type:
        insights = [i for i in insights if i.insight_type == insight_type]
    
    # Sort by priority and date
    priority_order = {"high": 0, "medium": 1, "low": 2}
    insights.sort(key=lambda x: (priority_order.get(x.priority, 1), x.generated_at), reverse=True)
    
    return {
        "user_id": user_id,
        "insights": insights,
        "count": len(insights)
    }

# ===== Helper Functions =====

def _get_time_of_day() -> str:
    """Determine time of day based on current hour"""
    hour = datetime.now().hour
    if 5 <= hour < 12:
        return "morning"
    elif 12 <= hour < 17:
        return "afternoon"
    elif 17 <= hour < 21:
        return "evening"
    else:
        return "night"

async def _update_learning_habits(user_id: str, session: LearningSession):
    """Update learning habits based on completed session"""
    if user_id not in learning_habits:
        learning_habits[user_id] = LearningHabit(user_id=user_id)
    
    habits = learning_habits[user_id]
    
    # Update session stats
    completed_sessions = [s for s in learning_sessions.get(user_id, []) if s.completed]
    if completed_sessions:
        habits.average_session_duration = int(
            sum(s.duration_minutes or 0 for s in completed_sessions) / len(completed_sessions)
        )
    
    # Update most productive times
    if session.engagement_level == "high":
        time_key = f"{session.day_of_week}_{session.time_of_day}"
        if time_key not in habits.peak_performance_conditions:
            habits.peak_performance_conditions.append(time_key)
    
    habits.last_updated = datetime.now()
