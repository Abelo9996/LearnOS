from fastapi import APIRouter, HTTPException
from models import (
    SessionStartRequest, InteractionRequest, LearningSession,
    InteractionEvent, MasteryState, SessionState, LearningContent
)
from database import db
from agents.concept_graph_engine import ConceptGraphEngine
from agents.learning_orchestrator import LearningOrchestratorAgent
from agents.attention_adaptation import AttentionAdaptationAgent
from agents.socratic_evaluation import SocraticEvaluationAgent
import uuid
from datetime import datetime

router = APIRouter()

@router.post("/session/start")
async def start_session(request: SessionStartRequest):
    """
    Start a new learning session for a goal.
    
    Input: {"goal_id": str, "user_id": str}
    Output: {"session_id": str, "first_concept": str, "content": LearningContent}
    """
    goal = db.get_goal(request.goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    if not goal.graph_id:
        raise HTTPException(status_code=404, detail="No concept graph for this goal")
    
    graph = db.get_graph(goal.graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    
    # Get mastery states
    mastery_states = db.get_mastery_states(request.user_id, request.goal_id)
    
    # Use Concept Graph Engine to find next concept
    engine = ConceptGraphEngine()
    result = await engine.process({
        "graph": graph,
        "mastery_states": mastery_states
    })
    
    next_concept = result["next_concept"]
    if not next_concept:
        return {
            "session_id": None,
            "message": "All concepts mastered! Goal complete.",
            "completed": True
        }
    
    # Create session
    session = LearningSession(
        id=str(uuid.uuid4()),
        user_id=request.user_id,
        goal_id=request.goal_id,
        graph_id=goal.graph_id,
        current_concept=next_concept
    )
    db.save_session(session)
    
    # Get or create mastery state for concept
    mastery = db.get_mastery_state(request.user_id, request.goal_id, next_concept)
    if not mastery:
        mastery = MasteryState(
            user_id=request.user_id,
            goal_id=request.goal_id,
            concept=next_concept
        )
        db.save_mastery_state(mastery)
    
    # Generate initial content using Learning Orchestrator
    orchestrator = LearningOrchestratorAgent()
    content_result = await orchestrator.process({
        "concept": next_concept,
        "concept_node": graph.nodes[next_concept],
        "mastery_state": mastery,
        "performance_signals": {}
    })
    
    learning_content: LearningContent = content_result["learning_content"]
    
    return {
        "session_id": session.id,
        "first_concept": next_concept,
        "content": learning_content.model_dump(),
        "progress": result["progress_percentage"]
    }

@router.post("/session/interact")
async def interact(request: InteractionRequest):
    """
    Process learner interaction and return next content.
    Runs full learning loop with adaptation and evaluation.
    
    Input: {"session_id": str, "response": str}
    Output: SessionState with next content or evaluation feedback
    """
    session = db.get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.completed:
        raise HTTPException(status_code=400, detail="Session already completed")
    
    # Get graph and current concept
    graph = db.get_graph(session.graph_id)
    current_concept = session.current_concept
    concept_node = graph.nodes[current_concept]
    
    # Record interaction
    interaction = InteractionEvent(
        session_id=session.id,
        concept=current_concept,
        event_type="response",
        response=request.response,
        time_to_respond_seconds=(datetime.utcnow() - session.last_interaction).total_seconds()
    )
    session.interactions.append(interaction)
    session.last_interaction = datetime.utcnow()
    
    # Evaluate response using Socratic Evaluation Agent
    evaluator = SocraticEvaluationAgent()
    eval_result = await evaluator.process({
        "concept": current_concept,
        "learner_response": request.response,
        "context": {
            "question_history": [],
            "concept_node": concept_node.model_dump()
        }
    })
    
    # Update interaction with evaluation
    interaction.correct = eval_result["passed"]
    interaction.metadata = {
        "reasoning_quality": eval_result["reasoning_quality"],
        "evaluation_breakdown": eval_result["evaluation_breakdown"]
    }
    
    # Get mastery state
    mastery = db.get_mastery_state(session.user_id, session.goal_id, current_concept)
    mastery.attempts += 1
    mastery.confidence = eval_result["reasoning_quality"]
    mastery.last_attempted = datetime.utcnow()
    
    # Check if mastered
    if eval_result["passed"]:
        mastery.mastered = True
        mastery.mastered_at = datetime.utcnow()
        db.save_mastery_state(mastery)
        db.save_session(session)
        
        # Move to next concept
        return await _progress_to_next_concept(session, graph)
    else:
        db.save_mastery_state(mastery)
        
        # Check if adaptation needed using Attention & Adaptation Agent
        adapter = AttentionAdaptationAgent()
        adaptation_result = await adapter.process({
            "interactions": session.interactions,
            "current_concept": current_concept
        })
        
        # Generate next attempt content
        orchestrator = LearningOrchestratorAgent()
        content_result = await orchestrator.process({
            "concept": current_concept,
            "concept_node": concept_node,
            "mastery_state": mastery,
            "performance_signals": adaptation_result["signals"]
        })
        
        db.save_session(session)
        
        return {
            "session_id": session.id,
            "current_concept": current_concept,
            "passed": False,
            "feedback": eval_result["feedback"],
            "follow_up_question": eval_result["follow_up_question"],
            "adaptation_applied": adaptation_result["adaptation_type"],
            "next_content": content_result["learning_content"].model_dump(),
            "reasoning_quality": eval_result["reasoning_quality"],
            "blocked": False
        }

@router.get("/session/state")
async def get_session_state(session_id: str):
    """
    Get current session state including progress and next content.
    
    Output: SessionState
    """
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    graph = db.get_graph(session.graph_id)
    mastery_states = db.get_mastery_states(session.user_id, session.goal_id)
    
    # Get progress
    engine = ConceptGraphEngine()
    result = await engine.process({
        "graph": graph,
        "mastery_states": mastery_states
    })
    
    # Get current mastery
    current_mastery = db.get_mastery_state(
        session.user_id,
        session.goal_id,
        session.current_concept
    )
    
    # Generate content
    orchestrator = LearningOrchestratorAgent()
    content_result = await orchestrator.process({
        "concept": session.current_concept,
        "concept_node": graph.nodes[session.current_concept],
        "mastery_state": current_mastery,
        "performance_signals": {}
    })
    
    return {
        "session_id": session.id,
        "current_concept": session.current_concept,
        "progress_percentage": result["progress_percentage"],
        "mastered_concepts": result["mastered_concepts"],
        "next_content": content_result["learning_content"].model_dump(),
        "blocked": False
    }

async def _progress_to_next_concept(session: LearningSession, graph):
    """Helper to move session to next concept."""
    mastery_states = db.get_mastery_states(session.user_id, session.goal_id)
    
    engine = ConceptGraphEngine()
    result = await engine.process({
        "graph": graph,
        "mastery_states": mastery_states
    })
    
    next_concept = result["next_concept"]
    
    if not next_concept:
        session.completed = True
        db.save_session(session)
        return {
            "session_id": session.id,
            "completed": True,
            "message": "Congratulations! You've mastered all concepts.",
            "progress_percentage": 100
        }
    
    # Update session
    session.current_concept = next_concept
    db.save_session(session)
    
    # Create mastery state if needed
    mastery = db.get_mastery_state(session.user_id, session.goal_id, next_concept)
    if not mastery:
        mastery = MasteryState(
            user_id=session.user_id,
            goal_id=session.goal_id,
            concept=next_concept
        )
        db.save_mastery_state(mastery)
    
    # Generate content for new concept
    orchestrator = LearningOrchestratorAgent()
    content_result = await orchestrator.process({
        "concept": next_concept,
        "concept_node": graph.nodes[next_concept],
        "mastery_state": mastery,
        "performance_signals": {}
    })
    
    return {
        "session_id": session.id,
        "concept_mastered": True,
        "new_concept": next_concept,
        "next_content": content_result["learning_content"].model_dump(),
        "progress_percentage": result["progress_percentage"]
    }
