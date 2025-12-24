"""
LearnOS Routers Module

FastAPI routers for all API endpoints.
"""

from routers import (
    goals, sessions, progress,
    onboarding, assignments, resources,
    ai_config, ai_roadmap, ai_content, ai_habits, ai_assignments, courses
)

__all__ = [
    'goals', 'sessions', 'progress',
    'onboarding', 'assignments', 'resources',
    'ai_config', 'ai_roadmap', 'ai_content', 'ai_habits', 'ai_assignments', 'courses'
]
