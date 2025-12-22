"""
OpenAI Service - Handles all GPT-4 interactions
Provides methods for assignment generation, roadmap planning, content analysis, etc.
"""

import os
from typing import List, Dict, Any, Optional
import json
from datetime import datetime

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None
    print("Warning: openai package not installed. AI features will be disabled.")

class OpenAIService:
    """Service for interacting with OpenAI GPT-4"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize OpenAI service
        
        Args:
            api_key: OpenAI API key. If None, will try to get from environment
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.client = None
        
        if OPENAI_AVAILABLE and self.api_key:
            try:
                self.client = OpenAI(api_key=self.api_key)
                self.available = True
            except Exception as e:
                print(f"Failed to initialize OpenAI client: {e}")
                self.available = False
        else:
            self.available = False
    
    def is_available(self) -> bool:
        """Check if OpenAI service is available"""
        return self.available and self.client is not None
    
    async def generate_assignment(
        self,
        concept: str,
        difficulty: float,
        learner_profile: Dict[str, Any],
        include_test_cases: bool = True
    ) -> Dict[str, Any]:
        """
        Generate a custom coding assignment using GPT-4
        
        Args:
            concept: The concept to create assignment for
            difficulty: Difficulty level 0-1
            learner_profile: User's learning profile
            include_test_cases: Whether to include test cases
            
        Returns:
            Dictionary with assignment details
        """
        if not self.is_available():
            return self._get_fallback_assignment(concept)
        
        prompt = self._build_assignment_prompt(
            concept, difficulty, learner_profile, include_test_cases
        )
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert programming instructor creating personalized coding assignments."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content
            assignment = self._parse_assignment_response(content)
            return assignment
            
        except Exception as e:
            print(f"Error generating assignment with AI: {e}")
            return self._get_fallback_assignment(concept)
    
    async def generate_roadmap(
        self,
        goal: str,
        learner_profile: Dict[str, Any],
        learning_habits: Optional[Dict[str, Any]] = None,
        target_weeks: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generate a personalized learning roadmap using GPT-4
        
        Args:
            goal: Learning goal
            learner_profile: User's learning profile
            learning_habits: User's learning habits
            target_weeks: Target completion time in weeks
            
        Returns:
            Dictionary with roadmap structure
        """
        if not self.is_available():
            return self._get_fallback_roadmap(goal)
        
        prompt = self._build_roadmap_prompt(
            goal, learner_profile, learning_habits, target_weeks
        )
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert learning architect creating personalized educational roadmaps."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2500
            )
            
            content = response.choices[0].message.content
            roadmap = self._parse_roadmap_response(content)
            return roadmap
            
        except Exception as e:
            print(f"Error generating roadmap with AI: {e}")
            return self._get_fallback_roadmap(goal)
    
    async def analyze_habits_and_suggest_adaptations(
        self,
        learning_habits: Dict[str, Any],
        recent_sessions: List[Dict[str, Any]],
        current_progress: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Analyze learning habits and suggest adaptations
        
        Args:
            learning_habits: User's learning habit patterns
            recent_sessions: Recent learning session data
            current_progress: Current learning progress
            
        Returns:
            List of suggested adaptations
        """
        if not self.is_available():
            return self._get_fallback_adaptations()
        
        prompt = self._build_habit_analysis_prompt(
            learning_habits, recent_sessions, current_progress
        )
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert learning psychologist analyzing study habits and suggesting improvements."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1500
            )
            
            content = response.choices[0].message.content
            adaptations = self._parse_adaptations_response(content)
            return adaptations
            
        except Exception as e:
            print(f"Error analyzing habits with AI: {e}")
            return self._get_fallback_adaptations()
    
    async def retrieve_and_analyze_content(
        self,
        concept: str,
        content_types: List[str],
        learner_profile: Dict[str, Any],
        max_results: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search for and analyze relevant content
        
        Args:
            concept: Concept to find content for
            content_types: Types of content to find
            learner_profile: User's learning profile
            max_results: Maximum number of results
            
        Returns:
            List of retrieved and analyzed content
        """
        if not self.is_available():
            return self._get_fallback_content(concept)
        
        prompt = self._build_content_retrieval_prompt(
            concept, content_types, learner_profile
        )
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert at finding and evaluating educational resources. Provide real, existing URLs."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content
            resources = self._parse_content_response(content, max_results)
            return resources
            
        except Exception as e:
            print(f"Error retrieving content with AI: {e}")
            return self._get_fallback_content(concept)
    
    async def generate_progress_insights(
        self,
        user_progress: Dict[str, Any],
        learning_history: List[Dict[str, Any]],
        current_goals: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Generate AI insights about learning progress
        
        Args:
            user_progress: Current progress data
            learning_history: Historical learning data
            current_goals: User's current goals
            
        Returns:
            List of insights
        """
        if not self.is_available():
            return self._get_fallback_insights()
        
        prompt = self._build_insights_prompt(
            user_progress, learning_history, current_goals
        )
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert learning analytics specialist providing actionable insights."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1500
            )
            
            content = response.choices[0].message.content
            insights = self._parse_insights_response(content)
            return insights
            
        except Exception as e:
            print(f"Error generating insights with AI: {e}")
            return self._get_fallback_insights()
    
    # ===== Prompt Building Methods =====
    
    def _build_assignment_prompt(
        self,
        concept: str,
        difficulty: float,
        learner_profile: Dict[str, Any],
        include_test_cases: bool
    ) -> str:
        """Build prompt for assignment generation"""
        difficulty_text = "beginner" if difficulty < 0.3 else "intermediate" if difficulty < 0.7 else "advanced"
        
        prompt = f"""Create a coding assignment for the concept: {concept}

Learner Profile:
- Expertise Level: {learner_profile.get('expertise_level', 'intermediate')}
- Learning Style: {learner_profile.get('learning_style', 'hands_on')}
- Preferred Pace: {learner_profile.get('pace_preference', 'moderate')}

Assignment Requirements:
- Difficulty: {difficulty_text} (scale: {difficulty})
- Include practical, hands-on coding tasks
- Provide clear learning objectives
- Include starter code to help them begin
- Create a detailed rubric for evaluation
{"- Include test cases for validation" if include_test_cases else ""}

Please format your response as JSON with the following structure:
{{
    "title": "Assignment title",
    "description": "Detailed description",
    "learning_objectives": ["objective1", "objective2"],
    "instructions": ["step1", "step2"],
    "starter_code": "# Python starter code",
    "rubric": [
        {{"criterion": "Feature Implementation", "points": 30, "description": "..."}}
    ],
    "hints": ["hint1", "hint2"],
    "common_mistakes": ["mistake1", "mistake2"],
    "estimated_hours": 3.0,
    "required_libraries": ["numpy", "matplotlib"]
}}"""
        return prompt
    
    def _build_roadmap_prompt(
        self,
        goal: str,
        learner_profile: Dict[str, Any],
        learning_habits: Optional[Dict[str, Any]],
        target_weeks: Optional[int]
    ) -> str:
        """Build prompt for roadmap generation"""
        prompt = f"""Create a personalized learning roadmap for: {goal}

Learner Profile:
- Expertise Level: {learner_profile.get('expertise_level', 'intermediate')}
- Current Attention Span: {learner_profile.get('current_attention_minutes', 30)} minutes
- Preferred Pace: {learner_profile.get('pace_preference', 'moderate')}
- Learning Style: {learner_profile.get('learning_style', 'mixed')}

"""
        if learning_habits:
            prompt += f"""Learning Habits:
- Sessions per week: {learning_habits.get('sessions_per_week', 5)}
- Average session duration: {learning_habits.get('average_session_duration', 30)} minutes
- Most productive time: {learning_habits.get('preferred_time_of_day', 'morning')}

"""
        if target_weeks:
            prompt += f"Target completion: {target_weeks} weeks\n\n"
        
        prompt += """Create a structured roadmap with milestones. Format as JSON:
{
    "milestones": [
        {
            "title": "Milestone 1",
            "description": "What to achieve",
            "concepts": ["concept1", "concept2"],
            "estimated_hours": 10,
            "why_important": "Explanation",
            "real_world_applications": ["application1"],
            "recommended_projects": ["project1"]
        }
    ],
    "learning_strategy": "Overall strategy description",
    "success_tips": ["tip1", "tip2"],
    "potential_challenges": ["challenge1"],
    "mitigation_strategies": ["strategy1"]
}"""
        return prompt
    
    def _build_habit_analysis_prompt(
        self,
        learning_habits: Dict[str, Any],
        recent_sessions: List[Dict[str, Any]],
        current_progress: Dict[str, Any]
    ) -> str:
        """Build prompt for habit analysis"""
        prompt = f"""Analyze learning habits and suggest improvements.

Current Habits:
{json.dumps(learning_habits, indent=2)}

Recent Sessions (last {len(recent_sessions)}):
{json.dumps(recent_sessions[-10:], indent=2, default=str)}

Current Progress:
{json.dumps(current_progress, indent=2)}

Provide 3-5 specific, actionable adaptations. Format as JSON:
[
    {{
        "adaptation_type": "schedule|content|difficulty|pace|breaks",
        "current_behavior": "What user currently does",
        "observed_pattern": "Pattern you noticed",
        "suggested_change": "Specific change to make",
        "reasoning": "Why this will help",
        "expected_benefit": "Expected outcome",
        "implementation_steps": ["step1", "step2"],
        "confidence": 0.85
    }}
]"""
        return prompt
    
    def _build_content_retrieval_prompt(
        self,
        concept: str,
        content_types: List[str],
        learner_profile: Dict[str, Any]
    ) -> str:
        """Build prompt for content retrieval"""
        prompt = f"""Find and recommend high-quality learning resources for: {concept}

Learner Profile:
- Expertise: {learner_profile.get('expertise_level', 'intermediate')}
- Prefers videos: {learner_profile.get('prefers_video_resources', True)}
- Prefers reading: {learner_profile.get('prefers_reading_resources', True)}

Content Types to Find: {', '.join(content_types)}

Provide REAL, EXISTING resources with actual URLs. Format as JSON:
[
    {{
        "title": "Resource title",
        "url": "https://actual-url.com",
        "content_type": "article|video|paper|tutorial",
        "author": "Author name",
        "difficulty_level": "beginner|intermediate|advanced",
        "estimated_reading_time": 15,
        "summary": "Brief summary",
        "key_takeaways": ["takeaway1", "takeaway2"],
        "relevance_score": 0.9
    }}
]

Focus on high-quality, well-known resources (MIT OpenCourseWare, Stanford CS, YouTube channels like 3Blue1Brown, Arxiv papers, etc.)"""
        return prompt
    
    def _build_insights_prompt(
        self,
        user_progress: Dict[str, Any],
        learning_history: List[Dict[str, Any]],
        current_goals: List[str]
    ) -> str:
        """Build prompt for insights generation"""
        prompt = f"""Analyze learning progress and provide insights.

Current Progress:
{json.dumps(user_progress, indent=2)}

Recent History:
{json.dumps(learning_history[-20:], indent=2, default=str)}

Current Goals:
{json.dumps(current_goals, indent=2)}

Generate 3-5 actionable insights. Format as JSON:
[
    {{
        "insight_type": "progress|strength|weakness|opportunity|warning",
        "title": "Short insight title",
        "description": "Detailed explanation",
        "supporting_data": ["data point 1", "data point 2"],
        "actionable": true,
        "suggested_actions": ["action1", "action2"],
        "priority": "low|medium|high"
    }}
]"""
        return prompt
    
    # ===== Response Parsing Methods =====
    
    def _parse_assignment_response(self, content: str) -> Dict[str, Any]:
        """Parse AI assignment response"""
        try:
            # Try to extract JSON from response
            start = content.find('{')
            end = content.rfind('}') + 1
            if start != -1 and end > start:
                json_str = content[start:end]
                return json.loads(json_str)
        except:
            pass
        return self._get_fallback_assignment("Unknown Concept")
    
    def _parse_roadmap_response(self, content: str) -> Dict[str, Any]:
        """Parse AI roadmap response"""
        try:
            start = content.find('{')
            end = content.rfind('}') + 1
            if start != -1 and end > start:
                json_str = content[start:end]
                return json.loads(json_str)
        except:
            pass
        return self._get_fallback_roadmap("Unknown Goal")
    
    def _parse_adaptations_response(self, content: str) -> List[Dict[str, Any]]:
        """Parse AI adaptations response"""
        try:
            start = content.find('[')
            end = content.rfind(']') + 1
            if start != -1 and end > start:
                json_str = content[start:end]
                return json.loads(json_str)
        except:
            pass
        return self._get_fallback_adaptations()
    
    def _parse_content_response(self, content: str, max_results: int) -> List[Dict[str, Any]]:
        """Parse AI content retrieval response"""
        try:
            start = content.find('[')
            end = content.rfind(']') + 1
            if start != -1 and end > start:
                json_str = content[start:end]
                resources = json.loads(json_str)
                return resources[:max_results]
        except:
            pass
        return self._get_fallback_content("Unknown Concept")
    
    def _parse_insights_response(self, content: str) -> List[Dict[str, Any]]:
        """Parse AI insights response"""
        try:
            start = content.find('[')
            end = content.rfind(']') + 1
            if start != -1 and end > start:
                json_str = content[start:end]
                return json.loads(json_str)
        except:
            pass
        return self._get_fallback_insights()
    
    # ===== Fallback Methods (when AI is unavailable) =====
    
    def _get_fallback_assignment(self, concept: str) -> Dict[str, Any]:
        """Fallback assignment when AI unavailable"""
        return {
            "title": f"Practice {concept}",
            "description": f"Implement a practical example of {concept}",
            "learning_objectives": [
                f"Understand the fundamentals of {concept}",
                "Apply the concept to real problems"
            ],
            "instructions": [
                "Read about the concept",
                "Implement the basic algorithm",
                "Test with sample data"
            ],
            "starter_code": f"# Implement {concept} here\npass",
            "rubric": [
                {"criterion": "Correctness", "points": 40, "description": "Implementation works correctly"},
                {"criterion": "Code Quality", "points": 30, "description": "Clean, readable code"},
                {"criterion": "Testing", "points": 30, "description": "Adequate test coverage"}
            ],
            "hints": ["Start simple", "Test incrementally"],
            "common_mistakes": ["Not handling edge cases"],
            "estimated_hours": 3.0,
            "required_libraries": []
        }
    
    def _get_fallback_roadmap(self, goal: str) -> Dict[str, Any]:
        """Fallback roadmap when AI unavailable"""
        return {
            "milestones": [
                {
                    "title": "Fundamentals",
                    "description": f"Learn the basics of {goal}",
                    "concepts": ["basics", "foundations"],
                    "estimated_hours": 10,
                    "why_important": "Foundation for everything else",
                    "real_world_applications": ["Various applications"],
                    "recommended_projects": ["Basic projects"]
                }
            ],
            "learning_strategy": "Start with fundamentals, build gradually",
            "success_tips": ["Practice regularly", "Build projects"],
            "potential_challenges": ["Complexity can be overwhelming"],
            "mitigation_strategies": ["Take it step by step"]
        }
    
    def _get_fallback_adaptations(self) -> List[Dict[str, Any]]:
        """Fallback adaptations when AI unavailable"""
        return [
            {
                "adaptation_type": "schedule",
                "current_behavior": "Learning at various times",
                "observed_pattern": "Inconsistent schedule",
                "suggested_change": "Set a consistent daily learning time",
                "reasoning": "Consistency builds habits",
                "expected_benefit": "Better retention and progress",
                "implementation_steps": ["Choose a time", "Set reminders"],
                "confidence": 0.7
            }
        ]
    
    def _get_fallback_content(self, concept: str) -> List[Dict[str, Any]]:
        """Fallback content when AI unavailable"""
        return [
            {
                "title": f"Introduction to {concept}",
                "url": f"https://en.wikipedia.org/wiki/{concept.replace(' ', '_')}",
                "content_type": "article",
                "author": "Wikipedia Contributors",
                "difficulty_level": "beginner",
                "estimated_reading_time": 10,
                "summary": f"Learn about {concept}",
                "key_takeaways": [f"Basics of {concept}"],
                "relevance_score": 0.7
            }
        ]
    
    def _get_fallback_insights(self) -> List[Dict[str, Any]]:
        """Fallback insights when AI unavailable"""
        return [
            {
                "insight_type": "progress",
                "title": "Keep Going!",
                "description": "You're making steady progress",
                "supporting_data": ["Consistent learning sessions"],
                "actionable": True,
                "suggested_actions": ["Continue your current pace"],
                "priority": "medium"
            }
        ]

# Global service instance
_openai_service: Optional[OpenAIService] = None

def get_openai_service(api_key: Optional[str] = None) -> OpenAIService:
    """Get or create OpenAI service instance"""
    global _openai_service
    if _openai_service is None or (api_key and api_key != _openai_service.api_key):
        _openai_service = OpenAIService(api_key)
    return _openai_service
