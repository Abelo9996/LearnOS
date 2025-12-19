from typing import Dict, Any, List
from agents.base import Agent
from models_extended import (
    LearnerProfile, OnboardingQuestion, OnboardingResponse,
    LearningStyle, ExpertiseLevel, AssessmentStyle, PacePreference,
    ContentDepthPreference
)

class LearnerProfilingAgent(Agent):
    """
    Conducts onboarding to understand learner psychology:
    - Learning style (visual/auditory/kinesthetic/reading)
    - Expertise level
    - Assessment preferences
    - Attention span baseline
    - Content depth preferences
    - Pace preferences
    
    Generates a comprehensive LearnerProfile used by all other agents.
    """
    
    def __init__(self):
        super().__init__(role="learner_profiling")
        self.onboarding_questions = self._generate_questions()
    
    async def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Input: {"responses": List[OnboardingResponse]} or {"generate_questions": True}
        Output: {"profile": LearnerProfile} or {"questions": List[OnboardingQuestion]}
        """
        if inputs.get("generate_questions"):
            return {"questions": self.onboarding_questions}
        
        responses = inputs.get("responses", [])
        profile = await self._analyze_responses(responses)
        
        return {
            "profile": profile,
            "insights": self._generate_insights(profile)
        }
    
    def _generate_questions(self) -> List[OnboardingQuestion]:
        """Generate comprehensive onboarding questions."""
        return [
            # Learning Style
            OnboardingQuestion(
                id="ls_1",
                question="When learning a new concept, what helps you most?",
                question_type="multiple_choice",
                options=[
                    "Diagrams and visual representations",
                    "Listening to explanations or lectures",
                    "Hands-on practice and experimentation",
                    "Reading detailed text and documentation"
                ],
                category="learning_style"
            ),
            OnboardingQuestion(
                id="ls_2",
                question="How do you prefer to remember information?",
                question_type="multiple_choice",
                options=[
                    "I visualize it in my mind",
                    "I repeat it verbally or in my head",
                    "I practice it until it becomes automatic",
                    "I write notes and summaries"
                ],
                category="learning_style"
            ),
            
            # Expertise Level
            OnboardingQuestion(
                id="exp_1",
                question="What's your current experience level with this topic?",
                question_type="multiple_choice",
                options=[
                    "Complete beginner - never encountered it",
                    "Beginner - heard of it, know basics",
                    "Intermediate - can work with it, want depth",
                    "Advanced - deep knowledge, want mastery",
                    "Expert - teaching level understanding"
                ],
                category="expertise"
            ),
            OnboardingQuestion(
                id="exp_2",
                question="How comfortable are you with technical concepts?",
                question_type="scale",
                options=["1", "2", "3", "4", "5"],  # 1=not comfortable, 5=very comfortable
                category="expertise"
            ),
            
            # Assessment Preferences
            OnboardingQuestion(
                id="assess_1",
                question="How do you prefer to demonstrate understanding?",
                question_type="multiple_choice",
                options=[
                    "Explain concepts in my own words (Socratic dialogue)",
                    "Complete written assessments and quizzes",
                    "Build projects and solve coding challenges",
                    "Create presentations or teach others",
                    "Self-assess without formal tests"
                ],
                category="preferences"
            ),
            OnboardingQuestion(
                id="assess_2",
                question="How often do you want to be assessed?",
                question_type="multiple_choice",
                options=[
                    "After every concept",
                    "After major milestones",
                    "Let me decide when I'm ready",
                    "Minimal assessment, trust-based"
                ],
                category="preferences"
            ),
            
            # Attention Span
            OnboardingQuestion(
                id="attn_1",
                question="How long can you typically focus on learning without a break?",
                question_type="multiple_choice",
                options=[
                    "10-15 minutes",
                    "20-30 minutes",
                    "45-60 minutes",
                    "90+ minutes"
                ],
                category="preferences"
            ),
            OnboardingQuestion(
                id="attn_2",
                question="Do you want help building longer focus periods?",
                question_type="multiple_choice",
                options=[
                    "Yes, gradually increase content length",
                    "No, keep sessions short",
                    "Adapt based on my performance"
                ],
                category="preferences"
            ),
            
            # Content Preferences
            OnboardingQuestion(
                id="content_1",
                question="What depth of content do you prefer?",
                question_type="multiple_choice",
                options=[
                    "High-level overview and key concepts",
                    "Practical application focused",
                    "Deep theoretical understanding",
                    "Balanced mix of theory and practice"
                ],
                category="preferences"
            ),
            OnboardingQuestion(
                id="content_2",
                question="Do you prefer theory or practice first?",
                question_type="multiple_choice",
                options=[
                    "Teach me the theory, then apply it",
                    "Let me try first, explain theory after",
                    "Mix both simultaneously"
                ],
                category="preferences"
            ),
            
            # Resources
            OnboardingQuestion(
                id="resource_1",
                question="What external resources do you find most helpful?",
                question_type="multi_select",
                options=[
                    "Research papers and academic articles",
                    "Video tutorials and lectures",
                    "Interactive coding environments",
                    "Online courses (Coursera, edX, etc.)",
                    "Documentation and technical writing",
                    "Podcasts and audio content",
                    "Books and textbooks"
                ],
                category="preferences"
            ),
            
            # Pace
            OnboardingQuestion(
                id="pace_1",
                question="What learning pace works best for you?",
                question_type="multiple_choice",
                options=[
                    "Slow and thorough - I want to master each piece",
                    "Moderate - steady progress with some challenge",
                    "Fast - I learn quickly and want rapid progression",
                    "Adaptive - adjust based on my performance"
                ],
                category="preferences"
            ),
            
            # Goals
            OnboardingQuestion(
                id="goal_1",
                question="How much time can you dedicate to learning daily?",
                question_type="multiple_choice",
                options=[
                    "15-30 minutes",
                    "30-60 minutes",
                    "1-2 hours",
                    "2+ hours"
                ],
                category="goals"
            ),
            OnboardingQuestion(
                id="goal_2",
                question="What's your primary learning goal?",
                question_type="open_ended",
                options=None,
                category="goals"
            )
        ]
    
    async def _analyze_responses(
        self, 
        responses: List[OnboardingResponse]
    ) -> LearnerProfile:
        """Analyze onboarding responses to generate learner profile."""
        
        # Extract responses by ID
        response_map = {r.question_id: r.response for r in responses}
        
        # Determine learning style
        learning_style = self._determine_learning_style(response_map)
        
        # Determine expertise level
        expertise = self._determine_expertise(response_map)
        
        # Determine assessment preferences
        assessment_style = self._determine_assessment_style(response_map)
        assessment_frequency = self._determine_assessment_frequency(response_map)
        
        # Determine attention span
        baseline_attention = self._determine_attention_span(response_map)
        
        # Determine content preferences
        content_depth = self._determine_content_depth(response_map)
        theory_first = response_map.get("content_2", "").startswith("Teach")
        
        # Determine pace
        pace = self._determine_pace(response_map)
        
        # Determine daily time
        daily_minutes = self._determine_daily_time(response_map)
        
        # Resource preferences
        resource_prefs = self._determine_resource_preferences(response_map)
        
        profile = LearnerProfile(
            user_id=responses[0].user_id if responses else "unknown",
            primary_learning_style=learning_style,
            expertise_level=expertise,
            preferred_assessment_style=assessment_style,
            assessment_frequency=assessment_frequency,
            content_depth=content_depth,
            prefers_theory_first=theory_first,
            baseline_attention_minutes=baseline_attention,
            current_attention_minutes=baseline_attention,
            target_attention_minutes=min(baseline_attention * 3, 90),
            pace_preference=pace,
            daily_learning_minutes=daily_minutes,
            preferred_session_length=baseline_attention,
            wants_external_resources=True,
            prefers_video_resources=resource_prefs.get("video", False),
            prefers_reading_resources=resource_prefs.get("reading", True),
            prefers_interactive_tools=resource_prefs.get("interactive", True),
            completed_onboarding=True
        )
        
        return profile
    
    def _determine_learning_style(self, responses: Dict) -> LearningStyle:
        """Determine primary learning style from responses."""
        ls_1 = responses.get("ls_1", "")
        ls_2 = responses.get("ls_2", "")
        
        if "Diagrams" in ls_1 or "visualize" in ls_2:
            return LearningStyle.VISUAL
        elif "Listening" in ls_1 or "repeat" in ls_2:
            return LearningStyle.AUDITORY
        elif "Hands-on" in ls_1 or "practice" in ls_2:
            return LearningStyle.KINESTHETIC
        elif "Reading" in ls_1 or "write" in ls_2:
            return LearningStyle.READING_WRITING
        else:
            return LearningStyle.MULTIMODAL
    
    def _determine_expertise(self, responses: Dict) -> ExpertiseLevel:
        """Determine expertise level."""
        exp_1 = responses.get("exp_1", "")
        
        if "Complete beginner" in exp_1:
            return ExpertiseLevel.ABSOLUTE_BEGINNER
        elif "Beginner" in exp_1:
            return ExpertiseLevel.BEGINNER
        elif "Intermediate" in exp_1:
            return ExpertiseLevel.INTERMEDIATE
        elif "Advanced" in exp_1:
            return ExpertiseLevel.ADVANCED
        else:
            return ExpertiseLevel.EXPERT
    
    def _determine_assessment_style(self, responses: Dict) -> AssessmentStyle:
        """Determine preferred assessment style."""
        assess_1 = responses.get("assess_1", "")
        
        if "Explain concepts" in assess_1:
            return AssessmentStyle.SOCRATIC
        elif "written" in assess_1:
            return AssessmentStyle.WRITTEN
        elif "projects" in assess_1 or "coding" in assess_1:
            return AssessmentStyle.CODING
        elif "presentations" in assess_1:
            return AssessmentStyle.PRESENTATION
        elif "Self-assess" in assess_1:
            return AssessmentStyle.MINIMAL
        else:
            return AssessmentStyle.SOCRATIC
    
    def _determine_assessment_frequency(self, responses: Dict) -> str:
        """Determine how often to assess."""
        assess_2 = responses.get("assess_2", "")
        
        if "every concept" in assess_2:
            return "after_each_concept"
        elif "milestones" in assess_2:
            return "after_milestone"
        elif "decide" in assess_2:
            return "self_directed"
        else:
            return "minimal"
    
    def _determine_attention_span(self, responses: Dict) -> int:
        """Determine baseline attention span in minutes."""
        attn_1 = responses.get("attn_1", "")
        
        if "10-15" in attn_1:
            return 15
        elif "20-30" in attn_1:
            return 25
        elif "45-60" in attn_1:
            return 50
        elif "90+" in attn_1:
            return 90
        else:
            return 20
    
    def _determine_content_depth(self, responses: Dict) -> ContentDepthPreference:
        """Determine content depth preference."""
        content_1 = responses.get("content_1", "")
        
        if "overview" in content_1:
            return ContentDepthPreference.OVERVIEW
        elif "Practical" in content_1:
            return ContentDepthPreference.PRACTICAL
        elif "Deep theoretical" in content_1:
            return ContentDepthPreference.DEEP_THEORY
        else:
            return ContentDepthPreference.BALANCED
    
    def _determine_pace(self, responses: Dict) -> PacePreference:
        """Determine learning pace preference."""
        pace_1 = responses.get("pace_1", "")
        
        if "Slow" in pace_1:
            return PacePreference.SLOW
        elif "Moderate" in pace_1:
            return PacePreference.MODERATE
        elif "Fast" in pace_1:
            return PacePreference.FAST
        else:
            return PacePreference.ADAPTIVE
    
    def _determine_daily_time(self, responses: Dict) -> int:
        """Determine daily learning time in minutes."""
        goal_1 = responses.get("goal_1", "")
        
        if "15-30" in goal_1:
            return 25
        elif "30-60" in goal_1:
            return 45
        elif "1-2 hours" in goal_1:
            return 90
        elif "2+" in goal_1:
            return 120
        else:
            return 60
    
    def _determine_resource_preferences(self, responses: Dict) -> Dict[str, bool]:
        """Determine resource type preferences."""
        resource_1 = responses.get("resource_1", [])
        if isinstance(resource_1, str):
            resource_1 = [resource_1]
        
        return {
            "video": any("Video" in r for r in resource_1),
            "reading": any("papers" in r or "Documentation" in r or "Books" in r for r in resource_1),
            "interactive": any("Interactive" in r for r in resource_1)
        }
    
    def _generate_insights(self, profile: LearnerProfile) -> List[str]:
        """Generate human-readable insights about the learner."""
        insights = []
        
        # Learning style insight
        style_map = {
            LearningStyle.VISUAL: "visual learner who benefits from diagrams and visual representations",
            LearningStyle.AUDITORY: "auditory learner who prefers listening and verbal explanations",
            LearningStyle.KINESTHETIC: "hands-on learner who learns best through practice",
            LearningStyle.READING_WRITING: "reading/writing learner who prefers text-based content"
        }
        insights.append(f"You're a {style_map.get(profile.primary_learning_style, 'multimodal learner')}")
        
        # Expertise insight
        insights.append(f"Starting at {profile.expertise_level.value.replace('_', ' ')} level")
        
        # Assessment insight
        if profile.preferred_assessment_style == AssessmentStyle.NONE:
            insights.append("You prefer trust-based learning without frequent assessments")
        else:
            insights.append(f"You'll be evaluated through {profile.preferred_assessment_style.value} methods")
        
        # Attention span insight
        if profile.baseline_attention_minutes < 20:
            insights.append("We'll start with short sessions and gradually build your focus stamina")
        elif profile.baseline_attention_minutes > 60:
            insights.append("You have strong focus - we'll provide deep-dive sessions")
        
        # Content depth insight
        if profile.content_depth == ContentDepthPreference.DEEP_THEORY:
            insights.append("Content will emphasize theoretical depth and rigorous understanding")
        elif profile.content_depth == ContentDepthPreference.PRACTICAL:
            insights.append("Content will focus on practical application and real-world use cases")
        
        return insights
