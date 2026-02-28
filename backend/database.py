from typing import Dict, List, Optional, Any
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
        
        self.users: Dict[str, Any] = {}  # Stores both User and UserProfile objects
        self.goals: Dict[str, LearningGoal] = {}
        self.graphs: Dict[str, ConceptGraph] = {}
        self.sessions: Dict[str, LearningSession] = {}
        self.mastery: Dict[str, List[MasteryState]] = {}
        
        # User credentials (email -> {user_id, password_hash})
        self.user_credentials: Dict[str, Dict] = {}  # email -> {user_id, password_hash}
        
        # LLM Configuration
        self.llm_configs: Dict[str, Dict] = {}  # provider:model_id -> config
        self.llm_user_configs: Dict[str, Dict] = {}  # user_id -> config
        self.llm_usage_logs: List[Dict] = []
        
        # Load credentials from file
        self._load_user_credentials()
    
    def _load_user_credentials(self):
        """Load user credentials from file"""
        creds_file = self.data_dir / "user_credentials.json"
        if creds_file.exists():
            with open(creds_file, "r") as f:
                self.user_credentials = json.load(f)
    
    def save_user_credential(self, email: str, user_id: str, password_hash: str):
        """Save user credential"""
        self.user_credentials[email] = {
            "user_id": user_id,
            "password_hash": password_hash
        }
        # Persist to file
        creds_file = self.data_dir / "user_credentials.json"
        with open(creds_file, "w") as f:
            json.dump(self.user_credentials, f, indent=2)
    
    def get_user_credential(self, email: str) -> Optional[Dict]:
        """Get user credential by email"""
        return self.user_credentials.get(email)
    
    def save_user(self, user: User) -> User:
        self.users[user.id] = user
        return user
    
    def get_user(self, user_id: str) -> Optional[User]:
        return self.users.get(user_id)
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        cred = self.user_credentials.get(email)
        if cred:
            return self.get_user(cred["user_id"])
        return None
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username - check all users"""
        for user in self.users.values():
            if hasattr(user, 'username') and user.username == username:
                return user
        return None
    
    def save_password_hash(self, user_id: str, password_hash: str):
        """Save password hash for user"""
        user = self.get_user(user_id)
        if user and hasattr(user, 'email'):
            self.save_user_credential(user.email, user_id, password_hash)
    
    def get_password_hash(self, user_id: str) -> Optional[str]:
        """Get password hash for user"""
        user = self.get_user(user_id)
        if user and hasattr(user, 'email'):
            cred = self.user_credentials.get(user.email)
            if cred:
                return cred.get("password_hash")
        return None
    
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
    
    # ========================================================================
    # LLM CONFIGURATION
    # ========================================================================
    
    def save_llm_config(self, config) -> None:
        """Save LLM provider configuration"""
        key = f"{config.provider.value}:{config.model_id}"
        self.llm_configs[key] = config.model_dump()
        
        # Persist to file
        config_file = self.data_dir / "llm_configs.json"
        with open(config_file, "w") as f:
            json.dump(self.llm_configs, f, indent=2, default=str)
    
    def get_llm_config(self, provider: str, model_id: str) -> Optional[Dict]:
        """Get LLM provider configuration"""
        key = f"{provider}:{model_id}"
        return self.llm_configs.get(key)
    
    def delete_llm_config(self, provider, model_id: str) -> None:
        """Delete LLM provider configuration"""
        key = f"{provider.value}:{model_id}"
        if key in self.llm_configs:
            del self.llm_configs[key]
            
            config_file = self.data_dir / "llm_configs.json"
            with open(config_file, "w") as f:
                json.dump(self.llm_configs, f, indent=2, default=str)
    
    def list_llm_configs(self) -> List[Dict]:
        """List all LLM configurations"""
        return list(self.llm_configs.values())
    
    def save_llm_user_config(self, config) -> None:
        """Save user LLM configuration"""
        self.llm_user_configs[config.user_id] = config.model_dump()
        
        config_file = self.data_dir / "llm_user_configs.json"
        with open(config_file, "w") as f:
            json.dump(self.llm_user_configs, f, indent=2, default=str)
    
    def get_llm_user_config(self, user_id: str) -> Optional[Dict]:
        """Get user LLM configuration"""
        return self.llm_user_configs.get(user_id)
    
    def log_llm_usage(self, usage_entry: Dict) -> None:
        """Log LLM usage for analytics and billing"""
        self.llm_usage_logs.append(usage_entry)
        
        # Persist to file (append mode)
        usage_file = self.data_dir / "llm_usage.jsonl"
        with open(usage_file, "a") as f:
            f.write(json.dumps(usage_entry) + "\n")
    
    def get_llm_usage_logs(self, user_id: Optional[str] = None) -> List[Dict]:
        """Get LLM usage logs"""
        if user_id:
            return [log for log in self.llm_usage_logs if log["user_id"] == user_id]
        return self.llm_usage_logs

db = Database()

async def init_db():
    demo_user = User(id="demo_user")
    db.save_user(demo_user)
