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
                print(f"❌ Failed to initialize OpenAI client: {e}")
                self.available = False
        else:
            self.available = False
    
    def is_available(self) -> bool:
        """Check if OpenAI service is available"""
        result = self.available and self.client is not None
        print(f"🤔 is_available() called - returning: {result}")
        return result
    
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
            print(f"\n{'='*80}")
            print(f"🤖 AI ROADMAP GENERATION - START")
            print(f"{'='*80}")
            print(f"Goal: {goal}")
            print(f"Prompt length: {len(prompt)} characters")
            print(f"\n--- PROMPT SENT TO GPT-4 TURBO ---")
            print(prompt)
            print(f"{'='*80}\n")
            
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",  # Has 128k context window!
                messages=[
                    {"role": "system", "content": "You are an expert learning architect creating comprehensive educational roadmaps with detailed lessons and resources."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=4096  # gpt-4-turbo-preview max completion tokens
            )
            
            content = response.choices[0].message.content
            
            print(f"\n--- RAW AI RESPONSE ---")
            print(content)
            print(f"{'='*80}")
            print(f"Response length: {len(content)} characters")
            print(f"{'='*80}\n")
            
            roadmap = self._parse_roadmap_response(content)
            
            print(f"--- PARSED ROADMAP STRUCTURE ---")
            print(json.dumps(roadmap, indent=2, default=str))
            
            if roadmap and "milestones" in roadmap and roadmap["milestones"]:
                first_ms = roadmap["milestones"][0]
                steps_count = len(first_ms.get('learning_steps', []))
                print(f"\n✅ SUCCESS: Generated {len(roadmap['milestones'])} milestones")
                print(f"✅ First milestone has {steps_count} learning steps")
                if steps_count > 0:
                    first_step = first_ms['learning_steps'][0]
                    print(f"✅ First step: '{first_step.get('title', 'No title')}'")
                    print(f"   - Videos: {len(first_step.get('video_resources', []))}")
                    print(f"   - Articles: {len(first_step.get('reading_resources', []))}")
                    print(f"   - Interactive: {len(first_step.get('interactive_resources', []))}")
                else:
                    print(f"❌ WARNING: No learning steps in first milestone!")
            else:
                print(f"❌ ERROR: Roadmap is empty or has no milestones!")
            
            print(f"{'='*80}")
            print(f"🤖 AI ROADMAP GENERATION - END")
            print(f"{'='*80}\n")
            
            return roadmap
            
        except Exception as e:
            print(f"\n{'='*80}")
            print(f"❌ ERROR GENERATING ROADMAP")
            print(f"{'='*80}")
            print(f"Error: {e}")
            print(f"Type: {type(e)}")
            import traceback
            print(f"\nFull traceback:")
            traceback.print_exc()
            print(f"{'='*80}\n")
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
    
    async def generate_milestone_assignment(
        self,
        milestone_title: str,
        milestone_description: str,
        concepts: List[str],
        learning_steps: List[Dict[str, Any]],
        difficulty: str = "intermediate"
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive assignment for a milestone/module
        
        Args:
            milestone_title: Title of the milestone
            milestone_description: Description of what the milestone covers
            concepts: Key concepts covered in this milestone
            learning_steps: The learning steps/lessons in this milestone
            difficulty: Difficulty level (beginner, intermediate, advanced)
            
        Returns:
            Dictionary with assignment details
        """
        if not self.is_available():
            return self._get_fallback_milestone_assignment(milestone_title, concepts)
        
        # Detect subject type from title and description
        subject_text = f"{milestone_title} {milestone_description}".lower()
        
        # Keywords for different subject areas
        philosophy_keywords = ["philosophy", "stoicism", "ethics", "metaphysics", "epistemology", "logic", "marcus aurelius", "plato", "aristotle", "kant", "nietzsche", "existentialism"]
        tech_keywords = ["programming", "coding", "javascript", "python", "algorithm", "data structure", "software", "api", "database", "web development"]
        science_keywords = ["physics", "chemistry", "biology", "experiment", "lab", "scientific method", "hypothesis", "molecule"]
        arts_keywords = ["art", "music", "design", "creative", "painting", "composition", "visual", "aesthetic"]
        
        # Determine subject type
        is_philosophy = any(kw in subject_text for kw in philosophy_keywords)
        is_tech = any(kw in subject_text for kw in tech_keywords)
        is_science = any(kw in subject_text for kw in science_keywords)
        is_arts = any(kw in subject_text for kw in arts_keywords)
        
        # Build subject-specific instructions
        if is_philosophy:
            subject_instruction = """
THIS IS A PHILOSOPHY MODULE. DO NOT create coding projects or technical assignments.

Instead, create ONE of these:
1. **Essay Assignment**: Philosophical argument with thesis, supporting evidence, and conclusion
2. **Reading Analysis**: Close reading of philosophical text with interpretation questions
3. **Reflection Paper**: Personal reflection applying philosophical concepts to life
4. **Discussion Questions**: Deep analytical questions for philosophical exploration

The assignment MUST include "questions" field with essay prompts or analysis questions."""
        elif is_tech:
            subject_instruction = """
THIS IS A TECHNICAL/PROGRAMMING MODULE. Create coding projects with starter code and test cases."""
        elif is_science:
            subject_instruction = """
THIS IS A SCIENCE MODULE. Create lab reports, problem sets, or experiments with calculations."""
        elif is_arts:
            subject_instruction = """
THIS IS AN ARTS/CREATIVE MODULE. Create creative projects with portfolios or compositions."""
        else:
            subject_instruction = """
THIS IS A GENERAL KNOWLEDGE MODULE. Create quizzes or comprehension tests."""
        
        prompt = f"""Create a comprehensive assessment assignment for this learning module:

**Module**: {milestone_title}
**Description**: {milestone_description}
**Key Concepts**: {', '.join(concepts)}
**Difficulty Level**: {difficulty}

**Learning Steps Covered**:
{chr(10).join([f"- {step.get('title', 'Lesson')}: {step.get('description', '')}" for step in learning_steps[:5]])}

{subject_instruction}

ASSIGNMENT TYPE GUIDELINES:
- **Philosophy/Humanities**: essay, reading_analysis, discussion (with questions field)
- **Programming/Tech**: coding_project (with starter_materials and test_cases)
- **Science**: problem_set, lab_report (with calculations)
- **Arts**: creative_project (with creative brief)
- **General**: quiz (with multiple choice questions)

ASSIGNMENT TYPE GUIDELINES:
- **Philosophy/Humanities**: essay, reading_analysis, discussion (with questions field)
- **Programming/Tech**: coding_project (with starter_materials and test_cases)
- **Science**: problem_set, lab_report (with calculations)
- **Arts**: creative_project (with creative brief)
- **General**: quiz (with multiple choice questions)

The assignment should:
1. TEST understanding of ALL key concepts from this module
2. Be AUTHENTIC to how this subject is actually practiced/studied
3. Have clear success criteria appropriate to the subject
4. Include helpful guidance and examples
5. Be completable by someone who studied the module materials

**CRITICAL**: For philosophy/humanities modules, you MUST use assignment_type "essay" or "reading_analysis" 
and provide thoughtful questions in the "questions" field. DO NOT create coding projects for non-technical subjects.

Format as JSON:
{{
    "assignment_type": "coding_project|essay|quiz|problem_set|creative_project|reading_analysis|lab_report",
    "title": "Assignment title (clear and specific)",
    "description": "What the learner will create/complete",
    "learning_objectives": [
        "Specific skills or understanding they'll demonstrate"
    ],
    "instructions": [
        "Step-by-step instructions for completing the assignment"
    ],
    "requirements": [
        "Specific requirements the submission must meet"
    ],
    "starter_materials": "Any starter code, templates, or reading materials (optional)",
    "questions": [
        "Specific questions to answer (for essays, quizzes, reading analysis)"
    ],
    "test_cases": [
        {{
            "input": "Sample input or scenario",
            "expected_output": "Expected result or answer",
            "description": "What this tests"
        }}
    ],
    "rubric": [
        {{
            "criterion": "Aspect being evaluated",
            "points": 25,
            "description": "What earns full points"
        }}
    ],
    "hints": [
        "Helpful hints if they get stuck"
    ],
    "estimated_time_hours": 2,
    "difficulty": "{difficulty}",
    "resources": [
        "Additional resources that might help"
    ]
}}

Make it engaging, authentic to the subject matter, and appropriately challenging!
    "requirements": [
        "Specific requirements the solution must meet"
    ],
    "starter_code": "Starter code or template (if applicable)",
    "test_cases": [
        {{
            "input": "Sample input",
            "expected_output": "Expected result",
            "description": "What this tests"
        }}
    ],
    "rubric": [
        {{
            "criterion": "Aspect being evaluated",
            "points": 25,
            "description": "What earns full points"
        }}
    ],
    "hints": [
        "Helpful hints if they get stuck"
    ],
    "estimated_time_hours": 2,
    "difficulty": "{difficulty}"
}}

Make it engaging and practical! Think of real-world applications."""

        try:
            print(f"\n{'='*80}")
            print(f"🎯 GENERATING ASSIGNMENT FOR: {milestone_title}")
            print(f"{'='*80}\n")
            
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": "You are an expert educator creating practical, engaging assignments that test real understanding."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content
            
            print(f"--- RAW ASSIGNMENT RESPONSE ---")
            print(content)
            print(f"{'='*80}\n")
            
            assignment = self._parse_assignment_response(content)
            
            print(f"✅ Assignment generated: {assignment.get('title', 'Untitled')}")
            print(f"   - Objectives: {len(assignment.get('learning_objectives', []))}")
            print(f"   - Test cases: {len(assignment.get('test_cases', []))}")
            print(f"   - Estimated time: {assignment.get('estimated_time_hours', 0)} hours")
            print(f"{'='*80}\n")
            
            return assignment
            
        except Exception as e:
            print(f"❌ Error generating milestone assignment: {e}")
            return self._get_fallback_milestone_assignment(milestone_title, concepts)
    
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
        
        prompt += """Create a COMPREHENSIVE, COURSE-LIKE roadmap similar to Coursera, but using FREE, publicly available resources.

STRUCTURE: Think of this as a full online course with:
- Milestones = Course Modules
- Learning Steps = Individual Lessons within each module
- Each step should have rich content + multiple resources

CRITICAL REQUIREMENTS FOR EACH MILESTONE:

1. LEARNING STEPS: Break down each milestone into 4-8 detailed learning steps (lessons)
   - Each step is ONE focused topic/skill
   - Include learning objectives (what learner will be able to do)
   - Provide detailed content explaining the topic (like a lesson transcript)
   - Add specific action items and practice exercises
   
2. RESOURCES FOR EACH STEP: Include REAL web resources:
   - 2-3 YouTube videos (actual URLs from real channels)
   - 1-2 articles or documentation (MDN, official docs, quality blogs)
   - 1 interactive tutorial or practice site (freeCodeCamp, Codecademy, etc.)
   - Ensure all URLs are REAL and currently accessible
   - Prioritize FREE resources

3. CONTENT QUALITY:
   - Write detailed explanations (2-3 paragraphs per step)
   - Include concrete examples
   - Provide practice exercises learners can do
   - Add self-assessment questions

Format as JSON:
{
    "milestones": [
        {
            "title": "Module 1: Fundamentals",
            "description": "Brief module description",
            "overview": "Detailed 2-3 paragraph overview of what this module covers",
            "estimated_hours": 10,
            "why_important": "Why this module matters",
            "real_world_applications": ["Real use case 1", "Real use case 2"],
            "learning_steps": [
                {
                    "order": 1,
                    "title": "Lesson 1: Introduction to X",
                    "description": "What this lesson covers",
                    "learning_objectives": [
                        "Understand the core concept of X",
                        "Be able to implement basic X patterns"
                    ],
                    "key_concepts": ["concept1", "concept2"],
                    "content": "DETAILED 2-3 paragraph explanation of the topic. Include examples, analogies, and clear explanations. Make it educational and engaging.",
                    "video_resources": [
                        {
                            "url": "https://www.youtube.com/watch?v=REAL_VIDEO_ID",
                            "title": "Actual YouTube video title",
                            "resource_type": "video",
                            "description": "What this video teaches",
                            "author": "Channel name",
                            "platform": "YouTube",
                            "estimated_time_minutes": 15,
                            "difficulty": "beginner",
                            "is_free": true,
                            "why_recommended": "Clear explanations with visual demonstrations"
                        }
                    ],
                    "reading_resources": [
                        {
                            "url": "https://developer.mozilla.org/actual-path",
                            "title": "MDN Guide Title",
                            "resource_type": "documentation",
                            "description": "Official documentation coverage",
                            "platform": "MDN",
                            "estimated_time_minutes": 20,
                            "difficulty": "beginner",
                            "is_free": true,
                            "why_recommended": "Authoritative and comprehensive"
                        }
                    ],
                    "interactive_resources": [
                        {
                            "url": "https://www.freecodecamp.org/learn/actual-path",
                            "title": "Interactive Exercise Title",
                            "resource_type": "interactive",
                            "platform": "freeCodeCamp",
                            "estimated_time_minutes": 30,
                            "difficulty": "beginner",
                            "is_free": true,
                            "why_recommended": "Hands-on practice with immediate feedback"
                        }
                    ],
                    "action_items": [
                        "Watch the intro video and take notes on key concepts",
                        "Read the MDN documentation section on X",
                        "Complete the freeCodeCamp exercises"
                    ],
                    "practice_exercises": [
                        "Exercise 1: Create a simple X that does Y",
                        "Exercise 2: Modify the example to add Z feature"
                    ],
                    "estimated_minutes": 90,
                    "difficulty": "beginner"
                }
            ],
            "recommended_projects": ["Build a simple X application"]
        }
    ],
    "learning_strategy": "Overall approach and recommendations for this learning path",
    "success_tips": ["Specific actionable tip 1", "Specific actionable tip 2"],
    "potential_challenges": ["Common challenge learners face"],
    "mitigation_strategies": ["How to overcome the challenge"]
}

REMEMBER: 
- Use REAL URLs from YouTube, MDN, freeCodeCamp, official documentation, reputable blogs
- Each milestone should have 4-8 learning steps (lessons)
- Each step should have rich content + 3-6 resources
- Make content detailed and educational (like Coursera lessons)
- Focus on FREE, publicly available resources
- Think of this as creating a complete online course!"""
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
            # Try to find JSON in the response
            start = content.find('{')
            end = content.rfind('}') + 1
            if start != -1 and end > start:
                json_str = content[start:end]
                parsed = json.loads(json_str)
                print(f"✅ Successfully parsed JSON response")
                return parsed
            else:
                print(f"⚠️ No JSON found in response")
        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing error: {e}")
            print(f"📄 Content that failed: {content[:500]}...")
        except Exception as e:
            print(f"❌ Unexpected error parsing response: {e}")
        
        print(f"⚠️ Using fallback roadmap")
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
    
    def _get_fallback_milestone_assignment(self, milestone_title: str, concepts: List[str]) -> Dict[str, Any]:
        """Fallback milestone assignment when AI unavailable"""
        concepts_str = ', '.join(concepts[:3]) if concepts else "key concepts"
        return {
            "title": f"Module Project: {milestone_title}",
            "description": f"Complete a hands-on project covering {concepts_str}",
            "learning_objectives": [
                f"Apply concepts from {milestone_title}",
                "Build a practical implementation",
                "Demonstrate understanding through code"
            ],
            "instructions": [
                "Review all learning materials from this module",
                "Plan your implementation approach",
                "Implement the solution step by step",
                "Test thoroughly with different inputs",
                "Refactor and improve code quality"
            ],
            "requirements": [
                "Implement all core functionality",
                "Include error handling",
                "Write clear documentation",
                "Add test cases"
            ],
            "starter_code": f"# {milestone_title} Project\n# Implement your solution here\n\npass",
            "test_cases": [
                {
                    "input": "Sample input 1",
                    "expected_output": "Expected result 1",
                    "description": "Basic functionality test"
                }
            ],
            "rubric": [
                {"criterion": "Functionality", "points": 40, "description": "All requirements implemented correctly"},
                {"criterion": "Code Quality", "points": 30, "description": "Clean, well-organized code"},
                {"criterion": "Testing", "points": 20, "description": "Thorough test coverage"},
                {"criterion": "Documentation", "points": 10, "description": "Clear documentation"}
            ],
            "hints": [
                "Start with the simplest case first",
                "Test each component separately",
                "Review the learning materials if stuck"
            ],
            "estimated_time_hours": 3,
            "difficulty": "intermediate"
        }
    
    def _get_fallback_roadmap(self, goal: str) -> Dict[str, Any]:
        """Fallback roadmap when AI unavailable - includes full structure"""
        return {
            "milestones": [
                {
                    "title": "Fundamentals",
                    "description": f"Learn the basics of {goal}",
                    "overview": f"This module covers the fundamental concepts you need to understand {goal}. Start here to build a solid foundation.",
                    "concepts": ["basics", "foundations"],
                    "estimated_hours": 10,
                    "why_important": "Foundation for everything else",
                    "real_world_applications": ["Various applications"],
                    "recommended_projects": ["Basic projects"],
                    "learning_steps": [
                        {
                            "order": 1,
                            "title": "Introduction and Setup",
                            "description": "Get started with the basics",
                            "learning_objectives": [
                                "Understand what this topic is about",
                                "Set up your learning environment"
                            ],
                            "key_concepts": ["introduction", "setup"],
                            "content": "This is a placeholder lesson. When AI is configured, you'll get detailed, personalized content here with explanations, examples, and clear instructions.",
                            "video_resources": [],
                            "reading_resources": [],
                            "interactive_resources": [],
                            "action_items": [
                                "Configure AI settings to generate detailed content",
                                "Start exploring the topic"
                            ],
                            "practice_exercises": [],
                            "estimated_minutes": 30,
                            "difficulty": "beginner"
                        }
                    ],
                    "web_resources": []
                }
            ],
            "learning_strategy": "Start with fundamentals, build gradually. Configure AI to get detailed roadmaps.",
            "success_tips": ["Practice regularly", "Build projects", "Configure AI for personalized content"],
            "potential_challenges": ["AI not configured - limited content available"],
            "mitigation_strategies": ["Set up OpenAI API key in settings for full experience"]
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
