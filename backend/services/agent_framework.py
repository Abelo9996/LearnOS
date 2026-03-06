"""
Agent Framework — The brain of LearnOS.
Specialized AI agents that collaborate to teach, research, and certify.
Each agent has: identity, memory, tools, and quality tracking.
"""

import json
import logging
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import db

logger = logging.getLogger("learnos.agents")

# ═══════════════ AGENT MEMORY ═══════════════

class AgentMemory:
    """Persistent memory for agents — stores learner context across sessions."""

    @staticmethod
    async def save(user_id: str, agent_type: str, key: str, value: Any):
        """Save a memory entry for a user-agent pair."""
        await db.save_agent_memory(user_id, agent_type, key, json.dumps(value))

    @staticmethod
    async def get(user_id: str, agent_type: str, key: str) -> Optional[Any]:
        """Retrieve a memory entry."""
        raw = await db.get_agent_memory(user_id, agent_type, key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return raw

    @staticmethod
    async def get_all(user_id: str, agent_type: str) -> Dict[str, Any]:
        """Get all memory for a user-agent pair."""
        entries = await db.list_agent_memory(user_id, agent_type)
        result = {}
        for k, v in entries.items():
            try:
                result[k] = json.loads(v)
            except Exception:
                result[k] = v
        return result

    @staticmethod
    async def build_learner_profile(user_id: str) -> dict:
        """Build a unified learner profile from all agents' memory."""
        profile = {"user_id": user_id, "agents": {}}
        for agent_type in ["tutor", "research", "community", "certification"]:
            memory = await AgentMemory.get_all(user_id, agent_type)
            if memory:
                profile["agents"][agent_type] = memory
        # Add streak + enrollment data
        profile["streak"] = await db.get_streak(user_id)
        return profile


# ═══════════════ QUALITY METRICS ═══════════════

class AgentMetrics:
    """Track agent interaction quality."""

    @staticmethod
    async def log_interaction(
        user_id: str, agent_type: str, interaction_type: str,
        input_text: str, output_text: str, metadata: dict = None
    ) -> str:
        interaction_id = str(uuid.uuid4())
        await db.save_agent_interaction({
            "interaction_id": interaction_id,
            "user_id": user_id,
            "agent_type": agent_type,
            "interaction_type": interaction_type,
            "input_text": input_text[:500],
            "output_text": output_text[:1000],
            "quality_score": None,
            "led_to_mastery": False,
            "metadata": metadata or {},
            "created_at": datetime.now().isoformat(),
        })
        return interaction_id

    @staticmethod
    async def rate_interaction(interaction_id: str, quality_score: float, led_to_mastery: bool = False):
        await db.rate_agent_interaction(interaction_id, quality_score, led_to_mastery)

    @staticmethod
    async def get_agent_stats(agent_type: str) -> dict:
        return await db.get_agent_quality_stats(agent_type)


# ═══════════════ LLM ABSTRACTION ═══════════════

async def call_llm(
    messages: List[dict],
    user_id: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> str:
    """Pluggable LLM call — supports OpenAI, Anthropic, Groq, or local."""

    # Check user preference
    if user_id and not model:
        pref = await db.get_agent_memory(user_id, "system", "preferred_model")
        if pref:
            model = pref

    provider = os.getenv("LEARNOS_LLM_PROVIDER", "openai")
    model = model or os.getenv("LEARNOS_LLM_MODEL", "gpt-4o-mini")

    if provider == "anthropic":
        return await _call_anthropic(messages, model, temperature, max_tokens)
    elif provider == "groq":
        return await _call_groq(messages, model, temperature, max_tokens)
    elif provider == "local":
        return await _call_local(messages, model, temperature, max_tokens)
    else:
        return await _call_openai(messages, model, temperature, max_tokens)


async def _call_openai(messages, model, temperature, max_tokens) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = await client.chat.completions.create(
        model=model, messages=messages,
        temperature=temperature, max_tokens=max_tokens,
    )
    return response.choices[0].message.content


async def _call_anthropic(messages, model, temperature, max_tokens) -> str:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    # Extract system message
    system = ""
    chat_messages = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        else:
            chat_messages.append(m)
    response = await client.messages.create(
        model=model or "claude-sonnet-4-20250514",
        system=system, messages=chat_messages,
        temperature=temperature, max_tokens=max_tokens,
    )
    return response.content[0].text


async def _call_groq(messages, model, temperature, max_tokens) -> str:
    from groq import AsyncGroq
    client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
    response = await client.chat.completions.create(
        model=model or "llama-3.1-70b-versatile",
        messages=messages, temperature=temperature, max_tokens=max_tokens,
    )
    return response.choices[0].message.content


async def _call_local(messages, model, temperature, max_tokens) -> str:
    """Call a local LLM via OpenAI-compatible API (Ollama, LM Studio, etc.)."""
    from openai import AsyncOpenAI
    base_url = os.getenv("LEARNOS_LOCAL_LLM_URL", "http://localhost:11434/v1")
    client = AsyncOpenAI(base_url=base_url, api_key="local")
    response = await client.chat.completions.create(
        model=model or "llama3.1",
        messages=messages, temperature=temperature, max_tokens=max_tokens,
    )
    return response.choices[0].message.content


# ═══════════════ RESEARCH AGENT ═══════════════

class ResearchAgent:
    """Finds real-world resources: articles, videos, papers, docs."""

    AGENT_TYPE = "research"

    @staticmethod
    async def find_resources(
        topic: str, course_id: str = "", user_id: str = "",
        resource_types: List[str] = None
    ) -> dict:
        """Find relevant learning resources for a topic."""
        if resource_types is None:
            resource_types = ["articles", "videos", "documentation", "papers"]

        # Get learner context
        learner_context = ""
        if user_id:
            profile = await AgentMemory.build_learner_profile(user_id)
            tutor_mem = profile.get("agents", {}).get("tutor", {})
            if tutor_mem:
                learner_context = f"\nLearner context: {json.dumps(tutor_mem)[:300]}"

        messages = [
            {"role": "system", "content": f"""You are a Research Agent for LearnOS, an AI university.
Your job is to find and recommend the best learning resources for a topic.

Return a JSON object with this structure:
{{
  "resources": [
    {{
      "title": "Resource title",
      "url": "https://...",
      "type": "article|video|paper|documentation|tutorial|course",
      "difficulty": "beginner|intermediate|advanced",
      "description": "Why this is useful (1-2 sentences)",
      "estimated_time": "15 min"
    }}
  ],
  "study_plan": "A brief suggested order to consume these resources"
}}

Find 5-8 resources. Prioritize free, high-quality, and recent content.
Include a mix of types: {', '.join(resource_types)}.{learner_context}"""},
            {"role": "user", "content": f"Find the best learning resources for: {topic}"}
        ]

        try:
            response = await call_llm(messages, user_id=user_id, temperature=0.5)

            # Log interaction
            interaction_id = await AgentMetrics.log_interaction(
                user_id or "anonymous", "research", "find_resources",
                topic, response[:500]
            )

            # Save to memory
            if user_id:
                topics = await AgentMemory.get(user_id, "research", "searched_topics") or []
                topics.append({"topic": topic, "date": datetime.now().isoformat()})
                await AgentMemory.save(user_id, "research", "searched_topics", topics[-20:])

            # Parse JSON
            try:
                # Try to extract JSON from response
                start = response.find("{")
                end = response.rfind("}") + 1
                if start >= 0 and end > start:
                    parsed = json.loads(response[start:end])
                    parsed["interaction_id"] = interaction_id
                    return parsed
            except json.JSONDecodeError:
                pass

            return {"resources": [], "study_plan": response, "interaction_id": interaction_id}

        except Exception as e:
            logger.error(f"Research agent error: {e}")
            return {"resources": [], "study_plan": f"Error: {str(e)}", "error": True}


# ═══════════════ COMMUNITY AGENT ═══════════════

class CommunityAgent:
    """Recommends study partners and forms groups based on learning patterns."""

    AGENT_TYPE = "community"

    @staticmethod
    async def find_study_partners(user_id: str, course_id: str, limit: int = 5) -> dict:
        """Find compatible study partners for a user in a course."""
        # Get user's learning profile
        user_streak = await db.get_streak(user_id)
        user_enrollments = await db.list_user_enrollments(user_id) if hasattr(db, 'list_user_enrollments') else []

        # Get other learners in the course
        leaderboard = await db.get_course_leaderboard(course_id, limit=50)

        # Filter out self
        candidates = [l for l in leaderboard if l.get("user_id") != user_id]

        if not candidates:
            return {"partners": [], "message": "No other learners in this course yet."}

        # Use LLM to rank compatibility
        messages = [
            {"role": "system", "content": """You are a Community Agent for LearnOS.
Match study partners based on:
1. Similar progress level (within 20%)
2. Complementary strengths
3. Active learning streaks

Return JSON:
{
  "partners": [
    {
      "user_id": "...",
      "compatibility_score": 85,
      "reason": "Similar progress, active learner"
    }
  ],
  "group_suggestion": "Form a study group of 3-4 focused on..."
}"""},
            {"role": "user", "content": f"""Current user:
- Streak: {user_streak.get('current_streak', 0)} days
- Active days: {user_streak.get('total_active_days', 0)}

Candidates in course:
{json.dumps(candidates[:10], default=str)}

Find the best {limit} study partners."""}
        ]

        try:
            response = await call_llm(messages, user_id=user_id, temperature=0.3)

            await AgentMetrics.log_interaction(
                user_id, "community", "find_partners",
                f"course:{course_id}", response[:500]
            )

            # Parse
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response[start:end])
            return {"partners": candidates[:limit], "group_suggestion": response}

        except Exception as e:
            logger.error(f"Community agent error: {e}")
            return {"partners": candidates[:limit], "error": str(e)}


# ═══════════════ CERTIFICATION AGENT ═══════════════

class CertificationAgent:
    """Evaluates mastery and determines certificate eligibility."""

    AGENT_TYPE = "certification"

    @staticmethod
    async def evaluate_mastery(user_id: str, course_id: str) -> dict:
        """Comprehensive mastery evaluation for a user in a course."""
        # Gather evidence
        streak = await db.get_streak(user_id)
        course = await db.get_course(course_id)
        roadmap = await db.get_roadmap(course_id) if hasattr(db, 'get_roadmap') else None

        # Get agent interactions
        tutor_memory = await AgentMemory.get_all(user_id, "tutor")

        messages = [
            {"role": "system", "content": """You are a Certification Agent for LearnOS.
Evaluate if a learner has mastered a course based on:
1. Milestone completion
2. Assignment performance
3. Tutor interaction quality
4. Learning consistency (streaks)
5. Time invested

Return JSON:
{
  "mastery_score": 0-100,
  "eligible_for_certificate": true/false,
  "strengths": ["..."],
  "areas_for_improvement": ["..."],
  "recommendation": "Issue certificate / Need more practice on X",
  "confidence": 0-100
}

Be rigorous but fair. A mastery score of 70+ with strong completion earns a certificate."""},
            {"role": "user", "content": f"""Evaluate mastery for user in course:
Course: {json.dumps(course, default=str)[:500] if course else 'Unknown'}
Streak: {json.dumps(streak, default=str)}
Tutor interactions: {json.dumps(tutor_memory, default=str)[:500]}
Roadmap milestones: {json.dumps(roadmap, default=str)[:500] if roadmap else 'N/A'}"""}
        ]

        try:
            response = await call_llm(messages, user_id=user_id, temperature=0.2)

            interaction_id = await AgentMetrics.log_interaction(
                user_id, "certification", "evaluate_mastery",
                f"course:{course_id}", response[:500]
            )

            # Save evaluation to memory
            await AgentMemory.save(user_id, "certification", f"eval_{course_id}", {
                "date": datetime.now().isoformat(),
                "response": response[:1000],
            })

            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                result = json.loads(response[start:end])
                result["interaction_id"] = interaction_id
                return result

            return {"mastery_score": 0, "eligible_for_certificate": False,
                    "recommendation": response, "interaction_id": interaction_id}

        except Exception as e:
            logger.error(f"Certification agent error: {e}")
            return {"mastery_score": 0, "eligible_for_certificate": False, "error": str(e)}

    @staticmethod
    async def auto_issue_certificate(user_id: str, course_id: str) -> Optional[dict]:
        """Evaluate and automatically issue certificate if eligible."""
        evaluation = await CertificationAgent.evaluate_mastery(user_id, course_id)

        if not evaluation.get("eligible_for_certificate"):
            return {"issued": False, "evaluation": evaluation}

        # Get course details for certificate
        course = await db.get_course(course_id)
        if not course:
            return {"issued": False, "error": "Course not found"}

        # Import here to avoid circular
        from routers.certificates import _make_verification_hash

        now = datetime.now().isoformat()
        cert = {
            "certificate_id": str(uuid.uuid4()),
            "user_id": user_id,
            "course_id": course_id,
            "course_title": course.get("title", "Unknown Course"),
            "user_display_name": course.get("user_id", user_id)[:20],
            "completion_date": datetime.now().strftime("%Y-%m-%d"),
            "mastery_score": evaluation.get("mastery_score", 0),
            "verification_hash": _make_verification_hash(user_id, course_id, now),
            "issued_at": now,
            "metadata": {"auto_issued": True, "evaluation": evaluation},
        }
        await db.save_certificate(cert)

        return {"issued": True, "certificate": cert, "evaluation": evaluation}
