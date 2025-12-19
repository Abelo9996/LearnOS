from fastapi import APIRouter, HTTPException
from models import GoalRequest, LearningGoal, ConceptGraph
from database import db
from agents.goal_decomposition import GoalDecompositionAgent
import uuid

router = APIRouter()

@router.post("/goal")
async def create_goal(request: GoalRequest):
    """
    Create a learning goal and generate concept dependency graph.
    
    Input: {"goal": str, "user_id": str}
    Output: {"goal_id": str, "graph": ConceptGraph}
    """
    # Ensure user exists
    user = db.get_user(request.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create goal
    goal = LearningGoal(
        id=str(uuid.uuid4()),
        user_id=request.user_id,
        goal=request.goal
    )
    
    # Generate concept graph using Goal Decomposition Agent
    agent = GoalDecompositionAgent()
    result = await agent.process({"goal": request.goal})
    
    graph: ConceptGraph = result["graph"]
    
    # Save graph and update goal
    db.save_graph(graph)
    goal.graph_id = graph.id
    db.save_goal(goal)
    
    # Update user
    user.goals.append(goal.id)
    db.save_user(user)
    
    return {
        "goal_id": goal.id,
        "graph_id": graph.id,
        "graph": graph.model_dump(),
        "concepts": result["concepts"]
    }

@router.get("/graph/{goal_id}")
async def get_graph(goal_id: str):
    """
    Retrieve concept graph for a goal.
    
    Output: ConceptGraph with full DAG structure
    """
    goal = db.get_goal(goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    if not goal.graph_id:
        raise HTTPException(status_code=404, detail="Graph not generated yet")
    
    graph = db.get_graph(goal.graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    
    return {
        "graph": graph.model_dump(),
        "goal": goal.goal
    }
