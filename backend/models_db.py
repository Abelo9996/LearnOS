"""
SQLAlchemy Models — Unified schema for LearnOS.
Supports both SQLite (dev/offline) and PostgreSQL (production/online).
"""

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey,
    create_engine, event
)
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from datetime import datetime
import os
import json


class Base(DeclarativeBase):
    pass


# ═══════════════════════════════════════════════════════════════
# USER & AUTH
# ═══════════════════════════════════════════════════════════════

class UserModel(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=True)  # null for OAuth users
    role = Column(String, default="learner")
    tier = Column(String, default="free")
    avatar_url = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)

    # Preferences
    preferred_language = Column(String, default="en")
    dark_mode = Column(Boolean, default=False)
    notifications_enabled = Column(Boolean, default=True)
    preferred_learning_style = Column(String, default="balanced")
    daily_learning_goal_minutes = Column(Integer, default=30)
    preferred_llm_model = Column(String, nullable=True)

    # OAuth
    oauth_provider = Column(String, nullable=True)  # google, github
    oauth_provider_id = Column(String, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Metadata
    metadata_json = Column(Text, default="{}")


# ═══════════════════════════════════════════════════════════════
# COURSES
# ═══════════════════════════════════════════════════════════════

class CourseModel(Base):
    __tablename__ = "courses"

    course_id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    goal = Column(Text)
    difficulty_level = Column(String, default="intermediate")
    target_weeks = Column(Integer, default=12)
    start_date = Column(String, nullable=True)
    target_completion_date = Column(String, nullable=True)
    actual_completion_date = Column(String, nullable=True)
    status = Column(String, default="planning")
    progress_percentage = Column(Float, default=0.0)
    roadmap_id = Column(String, nullable=True)
    assignment_ids = Column(Text, default="[]")
    onboarding_completed = Column(Boolean, default=False)
    custom_preferences = Column(Text, default="{}")
    total_time_spent_minutes = Column(Integer, default=0)
    sessions_count = Column(Integer, default=0)
    concepts_mastered = Column(Text, default="[]")
    created_at = Column(String)
    updated_at = Column(String)
    last_accessed = Column(String, nullable=True)
    generated_by_ai = Column(Boolean, default=False)
    ai_model_used = Column(String, nullable=True)


# ═══════════════════════════════════════════════════════════════
# ROADMAPS
# ═══════════════════════════════════════════════════════════════

class RoadmapModel(Base):
    __tablename__ = "roadmaps"

    roadmap_id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    course_id = Column(String, nullable=True)
    goal = Column(Text)
    milestones = Column(Text, default="[]")
    total_estimated_hours = Column(Float, default=0)
    estimated_completion_weeks = Column(Integer, default=0)
    adapted_to_profile = Column(Boolean, default=True)
    adapted_to_habits = Column(Boolean, default=True)
    difficulty_level = Column(String, default="intermediate")
    learning_strategy = Column(Text, default="")
    key_concepts = Column(Text, default="[]")
    prerequisites = Column(Text, default="[]")
    resources = Column(Text, default="[]")
    success_tips = Column(Text, default="[]")
    potential_challenges = Column(Text, default="[]")
    mitigation_strategies = Column(Text, default="[]")
    generated_at = Column(String, nullable=True)
    last_updated = Column(String, nullable=True)
    ai_model = Column(String, default="gpt-4")


# ═══════════════════════════════════════════════════════════════
# ASSIGNMENTS
# ═══════════════════════════════════════════════════════════════

class AssignmentModel(Base):
    __tablename__ = "assignments"

    assignment_id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    course_id = Column(String, nullable=True)
    milestone_id = Column(String, nullable=True)
    roadmap_id = Column(String, nullable=True)
    concept = Column(String, nullable=True)
    assignment_type = Column(String, default="essay")
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    learning_objectives = Column(Text, default="[]")
    instructions = Column(Text, default="[]")
    requirements = Column(Text, default="[]")
    questions = Column(Text, default="[]")
    starter_materials = Column(Text, nullable=True)
    starter_code = Column(Text, nullable=True)
    test_cases = Column(Text, default="[]")
    rubric = Column(Text, default="[]")
    hints = Column(Text, default="[]")
    resources = Column(Text, default="[]")
    solution_approach = Column(Text, default="")
    common_mistakes = Column(Text, default="[]")
    estimated_time_hours = Column(Float, default=2.0)
    difficulty = Column(String, default="intermediate")
    requires_libraries = Column(Text, default="[]")
    status = Column(String, default="not_started")
    submission = Column(Text, nullable=True)
    submission_date = Column(String, nullable=True)
    score = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    created_at = Column(String, nullable=True)
    completed_at = Column(String, nullable=True)
    generated_by = Column(String, default="gpt-4")
    generation_prompt = Column(Text, default="")


# ═══════════════════════════════════════════════════════════════
# LEARNING SESSIONS
# ═══════════════════════════════════════════════════════════════

class LearningSessionModel(Base):
    __tablename__ = "learning_sessions"

    session_id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    course_id = Column(String, nullable=True)
    start_time = Column(String, nullable=True)
    end_time = Column(String, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    concepts_covered = Column(Text, default="[]")
    questions_answered = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    attention_score = Column(Float, default=0.8)
    engagement_level = Column(String, default="medium")
    time_of_day = Column(String, default="morning")
    day_of_week = Column(String, default="Monday")
    device_type = Column(String, default="desktop")
    notes = Column(Text, default="")


# ═══════════════════════════════════════════════════════════════
# CONFIG & FEATURE TOGGLES
# ═══════════════════════════════════════════════════════════════

class OpenAIConfigModel(Base):
    __tablename__ = "openai_configs"

    user_id = Column(String, primary_key=True)
    api_key = Column(String, nullable=False)
    model = Column(String, default="gpt-4o-mini")
    max_tokens = Column(Integer, default=4000)
    temperature = Column(Float, default=0.7)
    enabled = Column(Boolean, default=True)
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)


class FeatureToggleModel(Base):
    __tablename__ = "feature_toggles"

    user_id = Column(String, primary_key=True)
    ai_assignments = Column(Boolean, default=True)
    ai_roadmaps = Column(Boolean, default=True)
    habit_adaptation = Column(Boolean, default=True)
    content_retrieval = Column(Boolean, default=True)
    socratic_enhancement = Column(Boolean, default=True)
    progress_insights = Column(Boolean, default=True)


# ═══════════════════════════════════════════════════════════════
# LEARNING ANALYTICS
# ═══════════════════════════════════════════════════════════════

class LearningHabitModel(Base):
    __tablename__ = "learning_habits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    course_id = Column(String, nullable=True)
    habit_data = Column(Text, default="{}")
    created_at = Column(String, nullable=True)


class LearnerProfileModel(Base):
    __tablename__ = "learner_profiles"

    user_id = Column(String, primary_key=True)
    profile_data = Column(Text, default="{}")
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)


class HabitAdaptationModel(Base):
    __tablename__ = "habit_adaptations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    adaptation_data = Column(Text, default="{}")
    created_at = Column(String, nullable=True)


class AIInsightModel(Base):
    __tablename__ = "ai_insights"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    course_id = Column(String, nullable=True)
    insight_type = Column(String, nullable=True)
    insight_data = Column(Text, default="{}")
    created_at = Column(String, nullable=True)


class RetrievedContentModel(Base):
    __tablename__ = "retrieved_content"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    course_id = Column(String, nullable=True)
    content_data = Column(Text, default="{}")
    created_at = Column(String, nullable=True)


# ═══════════════════════════════════════════════════════════════
# LLM CONFIGS (migrated from in-memory database.py)
# ═══════════════════════════════════════════════════════════════

class LLMConfigModel(Base):
    __tablename__ = "llm_configs"

    id = Column(String, primary_key=True)  # provider:model_id
    provider = Column(String, nullable=False)
    model_id = Column(String, nullable=False)
    config_data = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)


class LLMUserConfigModel(Base):
    __tablename__ = "llm_user_configs"

    user_id = Column(String, primary_key=True)
    config_data = Column(Text, default="{}")
    updated_at = Column(DateTime, default=datetime.utcnow)


class LLMUsageLogModel(Base):
    __tablename__ = "llm_usage_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    usage_data = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════
# ENGINE FACTORY
# ═══════════════════════════════════════════════════════════════

def get_database_url() -> str:
    """Get database URL from environment. Supports SQLite and PostgreSQL."""
    url = os.getenv("DATABASE_URL")
    if url:
        # PostgreSQL — convert postgres:// to postgresql+asyncpg://
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    # Default: SQLite
    db_path = os.getenv("DATABASE_PATH", "learnos.db")
    return f"sqlite+aiosqlite:///{db_path}"


def get_sync_database_url() -> str:
    """Get sync database URL (for Alembic migrations)."""
    url = os.getenv("DATABASE_URL")
    if url:
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url
    db_path = os.getenv("DATABASE_PATH", "learnos.db")
    return f"sqlite:///{db_path}"


# Async engine and session factory
engine = create_async_engine(get_database_url(), echo=False)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_models():
    """Create all tables. Called on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db_session() -> AsyncSession:
    """Get a database session for dependency injection."""
    async with async_session_factory() as session:
        yield session
