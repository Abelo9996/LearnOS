from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

# ============= LEARNER PROFILE MODELS =============

class LearningStyle(str, Enum):
    VISUAL = "visual"
    AUDITORY = "auditory"
    KINESTHETIC = "kinesthetic"
    READING_WRITING = "reading_writing"
    MULTIMODAL = "multimodal"

class ExpertiseLevel(str, Enum):
    ABSOLUTE_BEGINNER = "absolute_beginner"
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"

class PacePreference(str, Enum):
    SLOW = "slow"
    MODERATE = "moderate"
    FAST = "fast"
    ADAPTIVE = "adaptive"

class AssessmentStyle(str, Enum):
    SOCRATIC = "socratic"
    WRITTEN = "written"
    CODING = "coding"
    PROJECT = "project"
    PRESENTATION = "presentation"
    MINIMAL = "minimal"
    NONE = "none"

class ContentDepthPreference(str, Enum):
    OVERVIEW = "overview"
    PRACTICAL = "practical"
    DEEP_THEORY = "deep_theory"
    BALANCED = "balanced"

class LearnerProfile(BaseModel):
    user_id: str
    
    # Learning style
    primary_learning_style: LearningStyle = LearningStyle.MULTIMODAL
    secondary_learning_style: Optional[LearningStyle] = None
    
    # Expertise and pace
    expertise_level: ExpertiseLevel = ExpertiseLevel.BEGINNER
    pace_preference: PacePreference = PacePreference.ADAPTIVE
    
    # Assessment preferences
    preferred_assessment_style: AssessmentStyle = AssessmentStyle.SOCRATIC
    assessment_frequency: str = "after_each_concept"  # "after_each_concept", "after_milestone", "self_directed"
    
    # Content preferences
    content_depth: ContentDepthPreference = ContentDepthPreference.BALANCED
    prefers_examples: bool = True
    prefers_analogies: bool = True
    prefers_theory_first: bool = False
    
    # Attention span
    baseline_attention_minutes: int = 15
    target_attention_minutes: int = 45
    current_attention_minutes: int = 15
    attention_growth_rate: float = 1.1  # Multiply by this each week
    
    # Resource preferences
    wants_external_resources: bool = True
    prefers_video_resources: bool = False
    prefers_reading_resources: bool = True
    prefers_interactive_tools: bool = True
    
    # Scheduling
    daily_learning_minutes: int = 60
    preferred_session_length: int = 30
    
    # Progress tracking
    completed_onboarding: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# ============= ASSIGNMENT MODELS =============

class AssignmentType(str, Enum):
    CODING = "coding"
    WRITTEN = "written"
    RESEARCH = "research"
    PROJECT = "project"
    EXPERIMENT = "experiment"
    PRESENTATION = "presentation"

class AssignmentStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    COMPLETED = "completed"
    NEEDS_REVISION = "needs_revision"

class Assignment(BaseModel):
    id: str
    concept: str
    goal_id: str
    
    assignment_type: AssignmentType
    title: str
    description: str
    objectives: List[str]
    
    # Content
    instructions: str
    starter_code: Optional[str] = None
    rubric: Dict[str, Any] = {}
    hints: List[str] = []
    
    # Difficulty
    difficulty: float = Field(ge=0.0, le=1.0)
    estimated_hours: int = 1
    expertise_level: ExpertiseLevel
    
    # Resources
    required_resources: List[str] = []
    optional_resources: List[str] = []
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AssignmentSubmission(BaseModel):
    id: str
    assignment_id: str
    user_id: str
    
    status: AssignmentStatus = AssignmentStatus.NOT_STARTED
    
    # Submission content
    submission_text: Optional[str] = None
    submission_code: Optional[str] = None
    submission_files: List[str] = []
    
    # Evaluation
    score: Optional[float] = None
    feedback: Optional[str] = None
    strengths: List[str] = []
    improvements: List[str] = []
    
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    
    attempts: int = 0
    time_spent_minutes: int = 0

# ============= EXTERNAL RESOURCE MODELS =============

class ResourceType(str, Enum):
    PAPER = "paper"
    ARTICLE = "article"
    VIDEO = "video"
    COURSE = "course"
    DOCUMENTATION = "documentation"
    BOOK = "book"
    INTERACTIVE_TOOL = "interactive_tool"
    TUTORIAL = "tutorial"
    PODCAST = "podcast"

class ResourceDifficulty(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    RESEARCH = "research"

class ExternalResource(BaseModel):
    id: str
    concept: str
    
    resource_type: ResourceType
    title: str
    url: str
    author: Optional[str] = None
    
    # Metadata
    difficulty: ResourceDifficulty
    estimated_time_minutes: int
    quality_score: float = Field(ge=0.0, le=1.0, default=0.8)
    
    # Content
    description: str
    key_takeaways: List[str] = []
    prerequisites: List[str] = []
    
    # Relevance
    relevance_score: float = Field(ge=0.0, le=1.0, default=0.8)
    tags: List[str] = []
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ============= ATTENTION TRACKING MODELS =============

class AttentionSession(BaseModel):
    id: str
    user_id: str
    session_id: str
    
    start_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    
    # Metrics
    planned_duration_minutes: int
    actual_duration_minutes: Optional[int] = None
    
    focus_score: float = Field(ge=0.0, le=1.0, default=0.5)
    completion_rate: float = Field(ge=0.0, le=1.0, default=0.0)
    
    # Signals
    pauses_taken: int = 0
    content_revisits: int = 0
    time_to_first_response_seconds: Optional[float] = None
    
    # Recommendations
    suggested_break: bool = False
    difficulty_adjusted: bool = False

class AttentionMetrics(BaseModel):
    user_id: str
    
    # Current state
    current_focus_score: float = Field(ge=0.0, le=1.0, default=0.5)
    current_session_length: int = 15
    
    # Trends
    average_session_length: int = 15
    max_sustained_attention: int = 15
    focus_score_trend: str = "stable"  # "improving", "stable", "declining"
    
    # Goals
    attention_goal_minutes: int = 45
    progress_to_goal: float = Field(ge=0.0, le=1.0, default=0.0)
    
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# ============= ONBOARDING MODELS =============

class OnboardingQuestion(BaseModel):
    id: str
    question: str
    question_type: str  # "multiple_choice", "scale", "open_ended", "multi_select"
    options: Optional[List[str]] = None
    category: str  # "learning_style", "expertise", "preferences", "goals"

class OnboardingResponse(BaseModel):
    question_id: str
    response: Any
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class OnboardingSession(BaseModel):
    id: str
    user_id: str
    
    questions: List[OnboardingQuestion] = []  # Store the questions asked
    responses: List[OnboardingResponse] = []
    completed: bool = False
    
    # Generated profile
    generated_profile: Optional[LearnerProfile] = None
    
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
