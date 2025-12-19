from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class User(BaseModel):
    id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    goals: List[str] = []

class ConceptNode(BaseModel):
    concept: str
    prerequisites: List[str] = []
    difficulty_score: float = Field(ge=0.0, le=1.0)
    estimated_time_minutes: int
    confidence_threshold: float = Field(ge=0.0, le=1.0, default=0.8)
    misconceptions: List[str] = []
    examples: List[str] = []
    transfer_tests: List[str] = []

class ConceptGraph(BaseModel):
    id: str
    goal: str
    nodes: Dict[str, ConceptNode]
    edges: List[tuple[str, str]]
    created_at: datetime = Field(default_factory=datetime.utcnow)

class LearningGoal(BaseModel):
    id: str
    user_id: str
    goal: str
    graph_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "active"

class ModalityType(str, Enum):
    TEXT = "text"
    DIAGRAM = "diagram"
    CODE = "code"
    INTERACTIVE_QUESTION = "interactive_question"

class InteractionEvent(BaseModel):
    session_id: str
    concept: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    event_type: str
    response: Optional[str] = None
    time_to_respond_seconds: Optional[float] = None
    correct: Optional[bool] = None
    metadata: Dict[str, Any] = {}

class MasteryState(BaseModel):
    user_id: str
    goal_id: str
    concept: str
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    attempts: int = 0
    last_attempted: Optional[datetime] = None
    mastered: bool = False
    mastered_at: Optional[datetime] = None

class LearningSession(BaseModel):
    id: str
    user_id: str
    goal_id: str
    graph_id: str
    current_concept: Optional[str] = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    last_interaction: datetime = Field(default_factory=datetime.utcnow)
    completed: bool = False
    interactions: List[InteractionEvent] = []

class GoalRequest(BaseModel):
    goal: str
    user_id: Optional[str] = "demo_user"

class SessionStartRequest(BaseModel):
    goal_id: str
    user_id: Optional[str] = "demo_user"

class InteractionRequest(BaseModel):
    session_id: str
    response: str

class LearningContent(BaseModel):
    concept: str
    modality: ModalityType
    content: str
    question: Optional[str] = None
    context: Dict[str, Any] = {}

class SessionState(BaseModel):
    session_id: str
    current_concept: str
    progress_percentage: float
    mastered_concepts: List[str]
    next_content: LearningContent
    blocked: bool = False
    blocking_reason: Optional[str] = None
