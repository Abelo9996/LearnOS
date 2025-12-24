"""
AI-Enhanced Models for OpenAI Integration
Includes API key management, habit tracking, roadmaps, and AI-generated content
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

# ===== OpenAI Configuration =====

class OpenAIConfig(BaseModel):
    """User's OpenAI API configuration"""
    user_id: str
    api_key: str  # Will be encrypted in production
    model: str = "gpt-4"
    max_tokens: int = 2000
    temperature: float = 0.7
    enabled: bool = True
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

class AIFeatureToggle(BaseModel):
    """Toggle individual AI features on/off"""
    user_id: str
    ai_assignments: bool = True
    ai_roadmaps: bool = True
    habit_adaptation: bool = True
    content_retrieval: bool = True
    socratic_enhancement: bool = True
    progress_insights: bool = True

# ===== Habit Tracking =====

class LearningHabit(BaseModel):
    """Track user's learning patterns and behaviors"""
    user_id: str
    habit_id: str = Field(default_factory=lambda: f"habit_{datetime.now().timestamp()}")
    
    # Time patterns
    preferred_time_of_day: str = "morning"  # morning, afternoon, evening, night
    average_session_duration: int = 30  # minutes
    sessions_per_week: int = 5
    most_productive_days: List[str] = Field(default_factory=list)  # ["Monday", "Wednesday"]
    
    # Learning patterns
    concepts_mastered_per_week: float = 2.0
    average_assignment_completion_time: float = 3.5  # hours
    preferred_break_frequency: int = 25  # Pomodoro-style (minutes)
    
    # Engagement patterns
    drop_off_signals: List[str] = Field(default_factory=list)  # ["long_response_time", "skipped_questions"]
    peak_performance_conditions: List[str] = Field(default_factory=list)  # ["morning", "after_exercise"]
    
    # Adaptation history
    successful_adaptations: List[str] = Field(default_factory=list)
    unsuccessful_adaptations: List[str] = Field(default_factory=list)
    
    last_updated: datetime = Field(default_factory=datetime.now)

class LearningSession(BaseModel):
    """Individual learning session data for habit analysis"""
    session_id: str
    user_id: str
    course_id: Optional[str] = None  # Link to course
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    
    # Session metrics
    concepts_covered: List[str] = Field(default_factory=list)
    questions_answered: int = 0
    correct_answers: int = 0
    attention_score: float = 0.8  # 0-1
    engagement_level: str = "medium"  # low, medium, high
    
    # Context
    time_of_day: str = "morning"
    day_of_week: str = "Monday"
    device_type: str = "desktop"
    interruptions: int = 0
    
    # Outcomes
    mastery_gained: float = 0.0  # Total mastery increase
    completed: bool = False
    notes: Optional[str] = None

# ===== AI-Generated Roadmaps =====

class WebResource(BaseModel):
    """A web resource for learning"""
    url: str
    title: str
    resource_type: str  # "article", "video", "tutorial", "documentation", "course", "book", "interactive"
    description: str = ""
    author: Optional[str] = None
    platform: Optional[str] = None  # e.g., "YouTube", "Medium", "MDN", "freeCodeCamp"
    estimated_time_minutes: Optional[int] = None
    difficulty: Optional[str] = None  # "beginner", "intermediate", "advanced"
    is_free: bool = True
    rating: Optional[float] = None  # 0-5
    why_recommended: str = ""  # AI explanation of why this resource is good

class LearningStep(BaseModel):
    """A detailed learning step within a milestone - like a lesson in a course"""
    step_id: str = Field(default_factory=lambda: f"step_{datetime.now().timestamp()}")
    order: int  # Step number within milestone (1, 2, 3, ...)
    title: str
    description: str  # Detailed explanation of what to learn
    
    # Detailed content for this step
    learning_objectives: List[str]  # What you'll be able to do after this step
    key_concepts: List[str]  # Main concepts covered in this step
    content: str  # Rich text content explaining the topic (like a lesson)
    
    # Resources specifically for this step
    video_resources: List[WebResource] = Field(default_factory=list)  # Videos to watch
    reading_resources: List[WebResource] = Field(default_factory=list)  # Articles/docs to read
    interactive_resources: List[WebResource] = Field(default_factory=list)  # Interactive tutorials
    
    # Practice and assessment
    action_items: List[str] = Field(default_factory=list)  # Things to do/try
    practice_exercises: List[str] = Field(default_factory=list)  # Practice problems
    quiz_questions: List[Dict[str, Any]] = Field(default_factory=list)  # Self-assessment questions
    
    # Metadata
    estimated_minutes: int = 30  # Time to complete this step
    difficulty: str = "beginner"  # beginner, intermediate, advanced
    
    # Progress
    completed: bool = False
    completion_date: Optional[datetime] = None
    notes: str = ""  # User's personal notes

class RoadmapMilestone(BaseModel):
    """A milestone in a learning roadmap - like a module in a course"""
    milestone_id: str = Field(default_factory=lambda: f"milestone_{datetime.now().timestamp()}")
    title: str
    description: str
    overview: str = ""  # Detailed overview of what this milestone covers
    
    # Structured learning path within this milestone
    learning_steps: List[LearningStep] = Field(default_factory=list)  # Ordered steps to complete
    
    # Legacy fields (keeping for backward compatibility)
    concepts: List[str] = Field(default_factory=list)  # List of concept IDs to master
    estimated_hours: float = 0
    prerequisites: List[str] = Field(default_factory=list)  # Other milestone IDs
    
    # General resources for the entire milestone
    web_resources: List[WebResource] = Field(default_factory=list)
    
    # AI-generated insights
    why_important: str = ""
    real_world_applications: List[str] = Field(default_factory=list)
    recommended_projects: List[str] = Field(default_factory=list)
    
    # Progress tracking
    started: bool = False
    completed: bool = False
    completion_date: Optional[datetime] = None
    actual_hours: Optional[float] = None

class LearningRoadmap(BaseModel):
    """AI-generated personalized learning roadmap"""
    roadmap_id: str = Field(default_factory=lambda: f"roadmap_{datetime.now().timestamp()}")
    user_id: str
    course_id: Optional[str] = None  # Link to course
    goal: str
    
    # Roadmap structure
    milestones: List[RoadmapMilestone]
    total_estimated_hours: float
    estimated_completion_weeks: int
    
    # Personalization
    adapted_to_profile: bool = True
    adapted_to_habits: bool = True
    difficulty_level: str = "intermediate"
    
    # AI insights
    learning_strategy: str = ""  # AI-generated overall strategy
    success_tips: List[str] = Field(default_factory=list)
    potential_challenges: List[str] = Field(default_factory=list)
    mitigation_strategies: List[str] = Field(default_factory=list)
    
    # Metadata
    generated_at: datetime = Field(default_factory=datetime.now)
    last_updated: datetime = Field(default_factory=datetime.now)
    ai_model: str = "gpt-4"

# ===== AI-Generated Content =====

class AIGeneratedAssignment(BaseModel):
    """Assignment generated by GPT-4"""
    assignment_id: str = Field(default_factory=lambda: f"ai_assign_{datetime.now().timestamp()}")
    concept: str
    user_id: str
    course_id: Optional[str] = None  # Link to course
    
    # Assignment content (AI-generated)
    title: str
    description: str
    learning_objectives: List[str]
    instructions: List[str]
    starter_code: Optional[str] = None
    test_cases: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Evaluation criteria (AI-generated)
    rubric: List[Dict[str, Any]]
    hints: List[str] = Field(default_factory=list)
    solution_approach: str = ""
    common_mistakes: List[str] = Field(default_factory=list)
    
    # Personalization
    difficulty: float = 0.5  # 0-1
    estimated_hours: float = 3.0
    requires_libraries: List[str] = Field(default_factory=list)
    
    # AI metadata
    generated_by: str = "gpt-4"
    generation_prompt: str = ""
    generated_at: datetime = Field(default_factory=datetime.now)

class RetrievedContent(BaseModel):
    """External content retrieved and analyzed by AI"""
    content_id: str = Field(default_factory=lambda: f"content_{datetime.now().timestamp()}")
    concept: str
    user_id: str
    
    # Content metadata
    title: str
    url: str
    content_type: str = "article"  # article, video, paper, tutorial, documentation
    author: Optional[str] = None
    published_date: Optional[datetime] = None
    
    # AI analysis
    relevance_score: float = 0.8  # 0-1, AI-assessed relevance
    difficulty_level: str = "intermediate"
    estimated_reading_time: int = 15  # minutes
    key_topics: List[str] = Field(default_factory=list)
    summary: str = ""  # AI-generated summary
    key_takeaways: List[str] = Field(default_factory=list)
    
    # Recommendations
    recommended_for_expertise: List[str] = Field(default_factory=list)  # ["beginner", "intermediate"]
    complements_concepts: List[str] = Field(default_factory=list)
    best_consumed_at: str = "beginning"  # beginning, during, after concept learning
    
    # User interaction
    viewed: bool = False
    rating: Optional[int] = None  # 1-5
    helpful: Optional[bool] = None
    
    # Metadata
    retrieved_at: datetime = Field(default_factory=datetime.now)
    ai_model: str = "gpt-4"

class HabitAdaptation(BaseModel):
    """AI-suggested adaptation based on learning habits"""
    adaptation_id: str = Field(default_factory=lambda: f"adapt_{datetime.now().timestamp()}")
    user_id: str
    
    # Adaptation type
    adaptation_type: str = "schedule"  # schedule, content, difficulty, pace, breaks
    
    # Current state
    current_behavior: str
    observed_pattern: str
    
    # Suggestion (AI-generated)
    suggested_change: str
    reasoning: str
    expected_benefit: str
    confidence: float = 0.8  # 0-1, AI's confidence in suggestion
    
    # Implementation
    implementation_steps: List[str] = Field(default_factory=list)
    trial_period_days: int = 7
    success_metrics: List[str] = Field(default_factory=list)
    
    # Tracking
    status: str = "suggested"  # suggested, accepted, rejected, in_progress, successful, unsuccessful
    user_feedback: Optional[str] = None
    actual_outcome: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    ai_model: str = "gpt-4"

class AIInsight(BaseModel):
    """AI-generated insight about user's learning progress"""
    insight_id: str = Field(default_factory=lambda: f"insight_{datetime.now().timestamp()}")
    user_id: str
    
    # Insight content
    insight_type: str = "progress"  # progress, strength, weakness, opportunity, warning
    title: str
    description: str
    supporting_data: List[str] = Field(default_factory=list)
    
    # Actionability
    actionable: bool = True
    suggested_actions: List[str] = Field(default_factory=list)
    priority: str = "medium"  # low, medium, high
    
    # Context
    related_concepts: List[str] = Field(default_factory=list)
    time_frame: str = "past_week"  # past_day, past_week, past_month, overall
    
    # Metadata
    generated_at: datetime = Field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None  # Some insights are time-sensitive
    ai_model: str = "gpt-4"

# ===== Request/Response Models =====

class ConfigureOpenAIRequest(BaseModel):
    """Request to configure OpenAI integration"""
    user_id: str
    api_key: str
    model: str = "gpt-4"
    max_tokens: int = 2000
    temperature: float = 0.7

class GenerateRoadmapRequest(BaseModel):
    """Request to generate AI roadmap"""
    user_id: str
    goal: str
    use_profile: bool = True
    use_habits: bool = True
    target_weeks: Optional[int] = None

class GenerateAIAssignmentRequest(BaseModel):
    """Request to generate AI assignment"""
    concept: str
    user_id: str
    difficulty_override: Optional[float] = None
    focus_areas: List[str] = Field(default_factory=list)
    include_test_cases: bool = True

class RetrieveContentRequest(BaseModel):
    """Request to retrieve and analyze content"""
    concept: str
    user_id: str
    content_types: List[str] = Field(default_factory=lambda: ["article", "video"])
    max_results: int = 5
    min_relevance: float = 0.7

class GetHabitAdaptationsRequest(BaseModel):
    """Request habit-based adaptations"""
    user_id: str
    adaptation_types: List[str] = Field(default_factory=list)  # Empty means all types
    days_to_analyze: int = 30

class GetAIInsightsRequest(BaseModel):
    """Request AI insights about progress"""
    user_id: str
    insight_types: List[str] = Field(default_factory=list)  # Empty means all types
    time_frame: str = "past_week"

# ===== Course Models =====

class CourseStatus(str, Enum):
    """Course enrollment status"""
    PLANNING = "planning"  # User is creating/planning the course
    ACTIVE = "active"  # User is actively taking the course
    PAUSED = "paused"  # User paused the course
    COMPLETED = "completed"  # User finished the course
    ARCHIVED = "archived"  # User archived the course

class Course(BaseModel):
    """A learning course with roadmap, assignments, and tracking"""
    model_config = {"validate_assignment": True}
    
    course_id: str = Field(default_factory=lambda: f"course_{datetime.now().timestamp()}")
    user_id: str
    
    # Basic info
    title: str
    description: str
    goal: str  # What the user wants to achieve
    difficulty_level: str = "intermediate"  # beginner, intermediate, advanced
    
    # Timeline
    target_weeks: int = 12
    start_date: Optional[datetime] = None
    target_completion_date: Optional[datetime] = None
    actual_completion_date: Optional[datetime] = None
    
    # Status
    status: CourseStatus = CourseStatus.PLANNING
    progress_percentage: float = 0.0
    
    # Associated content (IDs)
    roadmap_id: Optional[str] = None  # Links to Roadmap
    assignment_ids: List[str] = Field(default_factory=list)  # Links to AIAssignments
    
    # Onboarding (course-specific setup)
    onboarding_completed: bool = False
    custom_preferences: Dict[str, Any] = Field(default_factory=dict)
    
    # Tracking
    total_time_spent_minutes: int = 0
    sessions_count: int = 0
    concepts_mastered: List[str] = Field(default_factory=list)
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    last_accessed: datetime = Field(default_factory=datetime.now)
    
    # AI generation context
    generated_by_ai: bool = False
    ai_model_used: Optional[str] = None

class CreateCourseRequest(BaseModel):
    """Request to create a new course"""
    user_id: str
    title: str
    description: str
    goal: str
    difficulty_level: str = "intermediate"
    target_weeks: int = 12
    generate_roadmap: bool = True  # Auto-generate roadmap with AI

class UpdateCourseRequest(BaseModel):
    """Request to update course details"""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[CourseStatus] = None
    progress_percentage: Optional[float] = None
    roadmap_id: Optional[str] = None
    custom_preferences: Optional[Dict[str, Any]] = None

class EnrollCourseRequest(BaseModel):
    """Request to officially enroll/start a course"""
    course_id: str
    onboarding_preferences: Dict[str, Any] = Field(default_factory=dict)
    start_date: Optional[datetime] = None

# ===== AI-Generated Assignments =====

class AssignmentType(str, Enum):
    """Types of assignments based on subject matter"""
    CODING_PROJECT = "coding_project"
    ESSAY = "essay"
    QUIZ = "quiz"
    PROBLEM_SET = "problem_set"
    CREATIVE_PROJECT = "creative_project"
    READING_ANALYSIS = "reading_analysis"
    LAB_REPORT = "lab_report"
    PRESENTATION = "presentation"
    DISCUSSION = "discussion"

class AssignmentStatus(str, Enum):
    """Status of assignment completion"""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SUBMITTED = "submitted"
    GRADED = "graded"

class AIGeneratedAssignment(BaseModel):
    """AI-generated assignment for a milestone"""
    assignment_id: str = Field(default_factory=lambda: f"assignment_{datetime.now().timestamp()}")
    user_id: str
    course_id: str
    milestone_id: str
    roadmap_id: str
    
    # Assignment details
    assignment_type: str = "essay"  # coding_project, essay, quiz, etc.
    title: str
    description: str
    learning_objectives: List[str] = Field(default_factory=list)
    
    # Content
    instructions: List[str] = Field(default_factory=list)
    requirements: List[str] = Field(default_factory=list)
    questions: List[str] = Field(default_factory=list)
    starter_materials: Optional[str] = None
    
    # Evaluation
    test_cases: List[Dict[str, Any]] = Field(default_factory=list)
    rubric: List[Dict[str, Any]] = Field(default_factory=list)  # [{criterion, points, description}]
    hints: List[str] = Field(default_factory=list)
    resources: List[str] = Field(default_factory=list)
    
    # Metadata
    estimated_time_hours: float = 2.0
    difficulty: str = "intermediate"
    status: AssignmentStatus = AssignmentStatus.NOT_STARTED
    
    # Submission
    submission: Optional[str] = None
    submission_date: Optional[datetime] = None
    score: Optional[float] = None
    feedback: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    
    # AI model used
    ai_model: str = "gpt-4-turbo-preview"
