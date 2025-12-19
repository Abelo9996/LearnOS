from fastapi import APIRouter, HTTPException
from database import db
from agents.concept_graph_engine import ConceptGraphEngine
from agents.attention_adaptation import AttentionAdaptationAgent

router = APIRouter()

@router.get("/progress")
async def get_progress(user_id: str, goal_id: str):
    """
    Get detailed progress for a learning goal.
    
    Output: {
        "goal": str,
        "progress_percentage": float,
        "mastered_concepts": list,
        "current_concepts": list,
        "blocked_concepts": dict,
        "engagement_score": float
    }
    """
    goal = db.get_goal(goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    if not goal.graph_id:
        raise HTTPException(status_code=404, detail="No graph for this goal")
    
    graph = db.get_graph(goal.graph_id)
    mastery_states = db.get_mastery_states(user_id, goal_id)
    
    # Get concept status using engine
    engine = ConceptGraphEngine()
    result = await engine.process({
        "graph": graph,
        "mastery_states": mastery_states
    })
    
    # Get latest session for engagement metrics
    sessions = [s for s in db.sessions.values() if s.goal_id == goal_id]
    latest_session = max(sessions, key=lambda s: s.last_interaction) if sessions else None
    
    engagement_score = 0.5
    if latest_session and latest_session.interactions:
        adapter = AttentionAdaptationAgent()
        adaptation = await adapter.process({
            "interactions": latest_session.interactions,
            "current_concept": latest_session.current_concept
        })
        engagement_score = adapter.calculate_engagement_score(adaptation["signals"])
    
    # Concept details
    concept_details = []
    for concept_name, node in graph.nodes.items():
        mastery = next(
            (m for m in mastery_states if m.concept == concept_name),
            None
        )
        
        concept_details.append({
            "concept": concept_name,
            "status": "mastered" if mastery and mastery.mastered else "available" if concept_name in result["available_concepts"] else "blocked",
            "confidence": mastery.confidence if mastery else 0.0,
            "attempts": mastery.attempts if mastery else 0,
            "difficulty": node.difficulty_score,
            "estimated_time": node.estimated_time_minutes
        })
    
    return {
        "goal": goal.goal,
        "progress_percentage": result["progress_percentage"],
        "mastered_concepts": result["mastered_concepts"],
        "available_concepts": result["available_concepts"],
        "blocked_concepts": result["blocked_concepts"],
        "engagement_score": engagement_score,
        "concept_details": concept_details,
        "total_concepts": len(graph.nodes),
        "next_concept": result["next_concept"]
    }
