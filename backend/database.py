from typing import Dict, List, Optional
from models import (
    User, LearningGoal, ConceptGraph, ConceptNode,
    LearningSession, InteractionEvent, MasteryState
)
import json
from pathlib import Path

class Database:
    def __init__(self):
        self.data_dir = Path("data")
        self.data_dir.mkdir(exist_ok=True)
        
        self.users: Dict[str, User] = {}
        self.goals: Dict[str, LearningGoal] = {}
        self.graphs: Dict[str, ConceptGraph] = {}
        self.sessions: Dict[str, LearningSession] = {}
        self.mastery: Dict[str, List[MasteryState]] = {}
    
    def save_user(self, user: User) -> User:
        self.users[user.id] = user
        return user
    
    def get_user(self, user_id: str) -> Optional[User]:
        return self.users.get(user_id)
    
    def save_goal(self, goal: LearningGoal) -> LearningGoal:
        self.goals[goal.id] = goal
        return goal
    
    def get_goal(self, goal_id: str) -> Optional[LearningGoal]:
        return self.goals.get(goal_id)
    
    def save_graph(self, graph: ConceptGraph) -> ConceptGraph:
        self.graphs[graph.id] = graph
        graph_file = self.data_dir / f"graph_{graph.id}.json"
        with open(graph_file, "w") as f:
            json.dump(graph.model_dump(), f, indent=2, default=str)
        return graph
    
    def get_graph(self, graph_id: str) -> Optional[ConceptGraph]:
        return self.graphs.get(graph_id)
    
    def save_session(self, session: LearningSession) -> LearningSession:
        self.sessions[session.id] = session
        return session
    
    def get_session(self, session_id: str) -> Optional[LearningSession]:
        return self.sessions.get(session_id)
    
    def save_mastery_state(self, mastery: MasteryState) -> MasteryState:
        key = f"{mastery.user_id}:{mastery.goal_id}"
        if key not in self.mastery:
            self.mastery[key] = []
        
        existing = next(
            (m for m in self.mastery[key] if m.concept == mastery.concept),
            None
        )
        if existing:
            self.mastery[key].remove(existing)
        self.mastery[key].append(mastery)
        return mastery
    
    def get_mastery_states(self, user_id: str, goal_id: str) -> List[MasteryState]:
        key = f"{user_id}:{goal_id}"
        return self.mastery.get(key, [])
    
    def get_mastery_state(self, user_id: str, goal_id: str, concept: str) -> Optional[MasteryState]:
        states = self.get_mastery_states(user_id, goal_id)
        return next((m for m in states if m.concept == concept), None)

db = Database()

async def init_db():
    demo_user = User(id="demo_user")
    db.save_user(demo_user)
