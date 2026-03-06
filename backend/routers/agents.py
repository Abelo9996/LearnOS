"""
Agents Router — Research, Community, Certification agents + memory + metrics.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.agent_framework import (
    ResearchAgent, CommunityAgent, CertificationAgent,
    AgentMemory, AgentMetrics, call_llm,
)

logger = logging.getLogger("learnos.agents_router")
router = APIRouter(prefix="/agents", tags=["agents"])


class ResearchRequest(BaseModel):
    topic: str
    course_id: str = ""
    user_id: str = ""
    resource_types: list = None

class RateRequest(BaseModel):
    interaction_id: str
    quality_score: float
    led_to_mastery: bool = False

class MemorySetRequest(BaseModel):
    user_id: str
    agent_type: str
    key: str
    value: dict | str | list

class LLMPreferenceRequest(BaseModel):
    user_id: str
    provider: str  # openai, anthropic, groq, local
    model: str


# ═══════════════ RESEARCH ═══════════════

@router.post("/research")
async def research_resources(req: ResearchRequest):
    """Find learning resources for a topic."""
    result = await ResearchAgent.find_resources(
        req.topic, req.course_id, req.user_id, req.resource_types
    )
    return result


# ═══════════════ COMMUNITY ═══════════════

@router.get("/community/partners/{course_id}")
async def find_study_partners(course_id: str, user_id: str = Query(...), limit: int = Query(5)):
    """Find compatible study partners."""
    result = await CommunityAgent.find_study_partners(user_id, course_id, limit)
    return result


# ═══════════════ CERTIFICATION ═══════════════

@router.get("/certification/evaluate/{course_id}")
async def evaluate_mastery(course_id: str, user_id: str = Query(...)):
    """Evaluate mastery for certificate eligibility."""
    result = await CertificationAgent.evaluate_mastery(user_id, course_id)
    return result

@router.post("/certification/auto-issue/{course_id}")
async def auto_issue_certificate(course_id: str, user_id: str = Query(...)):
    """Evaluate and auto-issue certificate if eligible."""
    result = await CertificationAgent.auto_issue_certificate(user_id, course_id)
    return result


# ═══════════════ MEMORY ═══════════════

@router.get("/memory/{user_id}")
async def get_learner_profile(user_id: str):
    """Get unified learner profile across all agents."""
    profile = await AgentMemory.build_learner_profile(user_id)
    return {"profile": profile}

@router.get("/memory/{user_id}/{agent_type}")
async def get_agent_memory(user_id: str, agent_type: str):
    """Get all memory for a specific agent."""
    memory = await AgentMemory.get_all(user_id, agent_type)
    return {"memory": memory}

@router.post("/memory")
async def set_agent_memory(req: MemorySetRequest):
    """Set a memory entry."""
    await AgentMemory.save(req.user_id, req.agent_type, req.key, req.value)
    return {"message": "Saved"}


# ═══════════════ METRICS ═══════════════

@router.post("/metrics/rate")
async def rate_interaction(req: RateRequest):
    """Rate an agent interaction quality."""
    await AgentMetrics.rate_interaction(req.interaction_id, req.quality_score, req.led_to_mastery)
    return {"message": "Rated"}

@router.get("/metrics/stats/{agent_type}")
async def get_agent_stats(agent_type: str):
    """Get quality stats for an agent."""
    stats = await AgentMetrics.get_agent_stats(agent_type)
    return {"stats": stats}

@router.get("/metrics/stats")
async def get_all_agent_stats():
    """Get quality stats for all agents."""
    result = {}
    for agent in ["tutor", "research", "community", "certification"]:
        result[agent] = await AgentMetrics.get_agent_stats(agent)
    return {"stats": result}


# ═══════════════ LLM PREFERENCE ═══════════════

@router.post("/llm/preference")
async def set_llm_preference(req: LLMPreferenceRequest):
    """Set user's preferred LLM provider/model."""
    await AgentMemory.save(req.user_id, "system", "preferred_model", req.model)
    await AgentMemory.save(req.user_id, "system", "preferred_provider", req.provider)
    return {"message": f"LLM preference set to {req.provider}/{req.model}"}

@router.get("/llm/preference/{user_id}")
async def get_llm_preference(user_id: str):
    """Get user's LLM preference."""
    model = await AgentMemory.get(user_id, "system", "preferred_model")
    provider = await AgentMemory.get(user_id, "system", "preferred_provider")
    return {"provider": provider or "openai", "model": model or "gpt-4o-mini"}
