"""
Resource Curation Agent - Find, evaluate, and recommend learning resources using LLMs
"""

from agents.base import Agent
from llm_manager import llm_manager
from llm_providers import LLMRequest, ModelCapability
from typing import Dict, Any, List, Optional
import json


class ResourceCurationAgent(Agent):
    """
    Curates and recommends high-quality learning resources using LLMs.
    Features:
    - Evaluates resource relevance and quality
    - Difficulty assessment
    - Personalized recommendations
    - Resource sequencing
    - Quality checks
    """
    
    def __init__(self):
        super().__init__(role="Resource Curator")
        self.resource_cache: Dict[str, List[Dict]] = {}
    
    async def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Find and curate resources for a concept
        
        Inputs:
        - user_id: str
        - concept: str
        - difficulty: float (0-1)
        - preferred_types: List[str]
        - max_results: int
        - learner_preferences: Dict (language, format preferences)
        
        Outputs:
        - resources: List[Resource]
        - ranked_resources: List[Resource]
        - recommended_sequence: List[Resource]
        - supplementary_resources: List[Resource]
        """
        
        user_id = inputs.get("user_id", "demo_user")
        concept = inputs.get("concept")
        difficulty = inputs.get("difficulty", 0.5)
        preferred_types = inputs.get("preferred_types", ["article", "video", "tutorial"])
        max_results = inputs.get("max_results", 10)
        learner_preferences = inputs.get("learner_preferences", {})
        
        if not concept:
            raise ValueError("Concept is required")
        
        # Find resources
        resources = await self._find_resources(
            user_id, concept, preferred_types, max_results, learner_preferences
        )
        
        # Rank by relevance and quality
        ranked_resources = await self._rank_resources(user_id, concept, resources, difficulty)
        
        # Create learning sequence
        recommended_sequence = await self._sequence_resources(user_id, ranked_resources[:5])
        
        # Find supplementary resources
        supplementary = await self._find_supplementary_resources(
            user_id, concept, ranked_resources
        )
        
        return {
            "concept": concept,
            "resources_found": len(resources),
            "resources": resources[:max_results],
            "ranked_resources": ranked_resources[:10],
            "recommended_sequence": recommended_sequence,
            "supplementary_resources": supplementary[:5],
            "metadata": {
                "difficulty_level": difficulty,
                "preferred_types": preferred_types,
                "curated_by": "llm_manager"
            }
        }
    
    async def _find_resources(
        self,
        user_id: str,
        concept: str,
        resource_types: List[str],
        max_results: int,
        preferences: Dict
    ) -> List[Dict]:
        """Find relevant resources using LLM"""
        
        cache_key = f"{concept}:{','.join(resource_types)}"
        if cache_key in self.resource_cache:
            return self.resource_cache[cache_key]
        
        types_str = ", ".join(resource_types)
        
        request = LLMRequest(
            system_prompt="""You are an expert resource curator. Identify high-quality learning resources.
For each resource, provide: title, type, url (if known), brief description, difficulty (0-1), estimated duration in minutes.""",
            user_prompt=f"""Find {max_results} high-quality resources to learn "{concept}".

Preferred resource types: {types_str}
Language: {preferences.get('language', 'English')}

For each resource, return a JSON object with:
{{"title": "...", "type": "...", "url": "...", "description": "...", "difficulty": 0.5, "duration_minutes": 30}}

Return as a JSON array of resources.""",
            task_type="content_generation"
        )
        
        try:
            response = await llm_manager.generate(user_id, request, ModelCapability.CONTENT_GENERATION)
            
            # Extract JSON array
            json_str = response.content
            if "[" in json_str:
                start = json_str.index("[")
                end = json_str.rindex("]") + 1
                resources = json.loads(json_str[start:end])
                self.resource_cache[cache_key] = resources
                return resources
            
            return []
        except Exception as e:
            print(f"Error finding resources: {e}")
            return []
    
    async def _rank_resources(
        self,
        user_id: str,
        concept: str,
        resources: List[Dict],
        target_difficulty: float
    ) -> List[Dict]:
        """Rank resources by relevance and quality"""
        
        if not resources:
            return []
        
        # Format resources for LLM
        resources_text = json.dumps(resources, indent=2)
        
        request = LLMRequest(
            system_prompt="""You are an expert educational content evaluator.
Rank learning resources by:
1. Relevance to the learning goal
2. Quality and accuracy
3. Clarity and pedagogy
4. Appropriate difficulty level (target: {})
5. Estimated effectiveness for learning""".format(target_difficulty),
            user_prompt=f"""Rank these resources for learning "{concept}":

{resources_text}

Return ONLY a JSON array of the same resources, sorted by ranking (best first).
Add a "ranking_score" (0-100) and "ranking_reason" to each resource.""",
            task_type="evaluation"
        )
        
        try:
            response = await llm_manager.generate(user_id, request, ModelCapability.EVALUATION)
            
            json_str = response.content
            if "[" in json_str:
                start = json_str.index("[")
                end = json_str.rindex("]") + 1
                ranked = json.loads(json_str[start:end])
                
                # Sort by ranking_score if available
                if ranked and "ranking_score" in ranked[0]:
                    ranked.sort(key=lambda x: x.get("ranking_score", 0), reverse=True)
                
                return ranked
            
            return resources
        except:
            return resources
    
    async def _sequence_resources(self, user_id: str, resources: List[Dict]) -> List[Dict]:
        """Create an optimal learning sequence from resources"""
        
        if not resources:
            return []
        
        resources_text = json.dumps(resources, indent=2)
        
        request = LLMRequest(
            system_prompt="You are a curriculum designer expert in sequencing learning resources optimally.",
            user_prompt=f"""Create an optimal learning sequence from these resources:

{resources_text}

Consider:
1. Start with foundational concepts
2. Progress from simple to complex
3. Mix different resource types for engagement
4. Allow time for concepts to solidify

Return a JSON array with the same resources, reordered for optimal learning.""",
            task_type="content_generation"
        )
        
        try:
            response = await llm_manager.generate(user_id, request, ModelCapability.CONTENT_GENERATION)
            
            json_str = response.content
            if "[" in json_str:
                start = json_str.index("[")
                end = json_str.rindex("]") + 1
                return json.loads(json_str[start:end])
            
            return resources
        except:
            return resources
    
    async def _find_supplementary_resources(
        self,
        user_id: str,
        concept: str,
        main_resources: List[Dict]
    ) -> List[Dict]:
        """Find complementary resources for deeper learning"""
        
        main_types = set(r.get("type", "") for r in main_resources)
        
        # Find alternative types
        all_types = [
            "article", "video", "tutorial", "book", 
            "research_paper", "interactive", "code_example", "podcast"
        ]
        alternative_types = [t for t in all_types if t not in main_types][:3]
        
        types_str = ", ".join(alternative_types)
        
        request = LLMRequest(
            system_prompt="You are a resource curator finding complementary learning materials.",
            user_prompt=f"""Find 3-5 supplementary resources to complement learning "{concept}".

Already recommended resource types: {', '.join(main_types)}
Preferred alternative types: {types_str}

These should provide different perspectives or deeper dives.

Return as a JSON array of resources with: title, type, url, description, difficulty, duration_minutes""",
            task_type="content_generation"
        )
        
        try:
            response = await llm_manager.generate(user_id, request, ModelCapability.CONTENT_GENERATION)
            
            json_str = response.content
            if "[" in json_str:
                start = json_str.index("[")
                end = json_str.rindex("]") + 1
                return json.loads(json_str[start:end])
            
            return []
        except:
            return []
    
    async def evaluate_resource_quality(self, user_id: str, resource: Dict) -> Dict[str, Any]:
        """Evaluate a specific resource's quality and relevance"""
        
        request = LLMRequest(
            system_prompt="You are an expert educational content evaluator.",
            user_prompt=f"""Evaluate the quality of this learning resource:

Title: {resource.get('title')}
Type: {resource.get('type')}
Description: {resource.get('description')}
URL: {resource.get('url')}

Provide a JSON evaluation with:
- quality_score (0-100)
- accuracy (0-100)
- clarity (0-100)
- engagement (0-100)
- recommended_for (beginner/intermediate/advanced)
- strengths (list)
- weaknesses (list)
- overall_recommendation (strongly_recommend/recommend/neutral/avoid)""",
            task_type="evaluation"
        )
        
        try:
            response = await llm_manager.generate(user_id, request, ModelCapability.EVALUATION)
            
            json_str = response.content
            if "{" in json_str:
                start = json_str.index("{")
                end = json_str.rindex("}") + 1
                return json.loads(json_str[start:end])
            
            return {}
        except:
            return {}

    """
    Curates external resources based on:
    - Current concept being learned
    - Learner's expertise level
    - Resource type preferences (video, reading, interactive)
    - Quality and relevance scores
    
    Sources include:
    - Academic papers (arXiv, Google Scholar)
    - Video tutorials (YouTube, Coursera, edX)
    - Documentation (official docs, tutorials)
    - Interactive tools (Jupyter notebooks, visualizations)
    - Books and textbooks
    """
    
    def __init__(self):
        super().__init__(role="resource_curation")
        # In production, this would connect to APIs
        self.resource_database = self._build_resource_database()
    
    async def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Input: {
            "concept": str,
            "learner_profile": LearnerProfile,
            "max_resources": int (default: 5)
        }
        Output: {
            "resources": List[ExternalResource],
            "primary_resource": ExternalResource,
            "supplementary_resources": List[ExternalResource]
        }
        """
        concept = inputs["concept"]
        profile: LearnerProfile = inputs["learner_profile"]
        max_resources = inputs.get("max_resources", 5)
        
        # Get all relevant resources for concept
        candidate_resources = self._get_concept_resources(concept)
        
        # Filter by expertise level
        filtered_resources = self._filter_by_expertise(
            candidate_resources,
            profile.expertise_level
        )
        
        # Score and rank by learner preferences
        scored_resources = self._score_resources(
            filtered_resources,
            profile
        )
        
        # Select top resources
        top_resources = scored_resources[:max_resources]
        
        # Designate primary resource (best match)
        primary = top_resources[0] if top_resources else None
        supplementary = top_resources[1:] if len(top_resources) > 1 else []
        
        return {
            "resources": top_resources,
            "primary_resource": primary,
            "supplementary_resources": supplementary,
            "resource_summary": self._generate_summary(top_resources, profile)
        }
    
    def _build_resource_database(self) -> Dict[str, List[Dict]]:
        """
        Build a database of curated resources.
        In production, this would query external APIs (arXiv, YouTube, etc.)
        """
        return {
            "Markov Decision Process": [
                {
                    "type": ResourceType.VIDEO,
                    "title": "Introduction to Markov Decision Processes",
                    "url": "https://www.youtube.com/watch?v=lfHX2hHRMVQ",
                    "author": "Stanford CS234",
                    "difficulty": ResourceDifficulty.BEGINNER,
                    "estimated_time_minutes": 75,
                    "description": "Comprehensive introduction to MDPs from Stanford's RL course",
                    "key_takeaways": [
                        "MDP formulation and components",
                        "Bellman equations",
                        "Policy and value functions"
                    ],
                    "quality_score": 0.95,
                    "tags": ["video", "lecture", "stanford", "foundational"]
                },
                {
                    "type": ResourceType.PAPER,
                    "title": "A Tutorial on Markov Decision Processes",
                    "url": "https://arxiv.org/abs/1502.02259",
                    "author": "Puterman",
                    "difficulty": ResourceDifficulty.INTERMEDIATE,
                    "estimated_time_minutes": 120,
                    "description": "Detailed mathematical treatment of MDPs",
                    "key_takeaways": [
                        "Formal MDP theory",
                        "Optimality conditions",
                        "Solution methods"
                    ],
                    "quality_score": 0.9,
                    "tags": ["paper", "theoretical", "comprehensive"]
                },
                {
                    "type": ResourceType.INTERACTIVE_TOOL,
                    "title": "Interactive MDP Visualizer",
                    "url": "https://cs.stanford.edu/people/karpathy/reinforcejs/gridworld_dp.html",
                    "author": "Andrej Karpathy",
                    "difficulty": ResourceDifficulty.BEGINNER,
                    "estimated_time_minutes": 30,
                    "description": "Interactive grid world for understanding MDP concepts",
                    "key_takeaways": [
                        "Visual understanding of value iteration",
                        "Policy visualization",
                        "Reward shaping effects"
                    ],
                    "quality_score": 0.9,
                    "tags": ["interactive", "visualization", "hands-on"]
                },
                {
                    "type": ResourceType.DOCUMENTATION,
                    "title": "OpenAI Gym MDP Environments",
                    "url": "https://www.gymlibrary.dev/",
                    "author": "OpenAI",
                    "difficulty": ResourceDifficulty.BEGINNER,
                    "estimated_time_minutes": 45,
                    "description": "Official documentation for MDP-based environments",
                    "key_takeaways": [
                        "Environment API",
                        "State and action spaces",
                        "Reward structures"
                    ],
                    "quality_score": 0.85,
                    "tags": ["documentation", "practical", "reference"]
                }
            ],
            
            "Q-Learning": [
                {
                    "type": ResourceType.VIDEO,
                    "title": "Deep Q-Learning explained",
                    "url": "https://www.youtube.com/watch?v=wrBUkpiRvCA",
                    "author": "DeepMind",
                    "difficulty": ResourceDifficulty.INTERMEDIATE,
                    "estimated_time_minutes": 45,
                    "description": "DeepMind's explanation of Q-Learning and DQN",
                    "key_takeaways": [
                        "Q-learning algorithm",
                        "Experience replay",
                        "Target networks"
                    ],
                    "quality_score": 0.95,
                    "tags": ["video", "deepmind", "practical"]
                },
                {
                    "type": ResourceType.PAPER,
                    "title": "Playing Atari with Deep Reinforcement Learning",
                    "url": "https://arxiv.org/abs/1312.5602",
                    "author": "Mnih et al.",
                    "difficulty": ResourceDifficulty.ADVANCED,
                    "estimated_time_minutes": 90,
                    "description": "Original DQN paper from DeepMind",
                    "key_takeaways": [
                        "DQN architecture",
                        "Training methodology",
                        "Atari benchmark results"
                    ],
                    "quality_score": 1.0,
                    "tags": ["paper", "landmark", "deep-learning"]
                },
                {
                    "type": ResourceType.TUTORIAL,
                    "title": "Q-Learning Tutorial with Python",
                    "url": "https://www.learndatasci.com/tutorials/reinforcement-q-learning-scratch-python-openai-gym/",
                    "author": "LearnDataSci",
                    "difficulty": ResourceDifficulty.BEGINNER,
                    "estimated_time_minutes": 60,
                    "description": "Step-by-step Q-learning implementation guide",
                    "key_takeaways": [
                        "Implementation details",
                        "OpenAI Gym integration",
                        "Hyperparameter tuning"
                    ],
                    "quality_score": 0.85,
                    "tags": ["tutorial", "code", "practical"]
                },
                {
                    "type": ResourceType.COURSE,
                    "title": "Reinforcement Learning Specialization",
                    "url": "https://www.coursera.org/specializations/reinforcement-learning",
                    "author": "University of Alberta",
                    "difficulty": ResourceDifficulty.INTERMEDIATE,
                    "estimated_time_minutes": 2400,
                    "description": "Complete course covering Q-learning and beyond",
                    "key_takeaways": [
                        "Comprehensive RL coverage",
                        "Programming assignments",
                        "Theoretical foundations"
                    ],
                    "quality_score": 0.95,
                    "tags": ["course", "certificate", "comprehensive"]
                }
            ],
            
            "Neural Networks": [
                {
                    "type": ResourceType.VIDEO,
                    "title": "Neural Networks and Deep Learning",
                    "url": "https://www.youtube.com/playlist?list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi",
                    "author": "3Blue1Brown",
                    "difficulty": ResourceDifficulty.BEGINNER,
                    "estimated_time_minutes": 60,
                    "description": "Visual intuition for neural networks",
                    "key_takeaways": [
                        "Geometric intuition",
                        "Backpropagation visualization",
                        "Gradient descent"
                    ],
                    "quality_score": 1.0,
                    "tags": ["video", "visualization", "intuition"]
                },
                {
                    "type": ResourceType.BOOK,
                    "title": "Deep Learning Book",
                    "url": "https://www.deeplearningbook.org/",
                    "author": "Goodfellow, Bengio, Courville",
                    "difficulty": ResourceDifficulty.ADVANCED,
                    "estimated_time_minutes": 3600,
                    "description": "Comprehensive deep learning textbook",
                    "key_takeaways": [
                        "Mathematical foundations",
                        "Modern architectures",
                        "Optimization methods"
                    ],
                    "quality_score": 1.0,
                    "tags": ["book", "comprehensive", "theoretical"]
                },
                {
                    "type": ResourceType.INTERACTIVE_TOOL,
                    "title": "TensorFlow Playground",
                    "url": "https://playground.tensorflow.org/",
                    "author": "TensorFlow",
                    "difficulty": ResourceDifficulty.BEGINNER,
                    "estimated_time_minutes": 30,
                    "description": "Interactive neural network visualization",
                    "key_takeaways": [
                        "Layer effects",
                        "Activation functions",
                        "Decision boundaries"
                    ],
                    "quality_score": 0.9,
                    "tags": ["interactive", "visualization", "beginner-friendly"]
                },
                {
                    "type": ResourceType.COURSE,
                    "title": "CS231n: CNNs for Visual Recognition",
                    "url": "http://cs231n.stanford.edu/",
                    "author": "Stanford",
                    "difficulty": ResourceDifficulty.ADVANCED,
                    "estimated_time_minutes": 1800,
                    "description": "Stanford's computer vision and neural networks course",
                    "key_takeaways": [
                        "CNN architectures",
                        "Training techniques",
                        "Modern vision models"
                    ],
                    "quality_score": 0.95,
                    "tags": ["course", "stanford", "computer-vision"]
                }
            ],
            
            "Bellman Equations": [
                {
                    "type": ResourceType.ARTICLE,
                    "title": "Understanding Bellman Equations",
                    "url": "https://towardsdatascience.com/bellman-equations-in-reinforcement-learning",
                    "author": "Towards Data Science",
                    "difficulty": ResourceDifficulty.INTERMEDIATE,
                    "estimated_time_minutes": 20,
                    "description": "Clear explanation of Bellman equations",
                    "key_takeaways": [
                        "Expectation and optimality equations",
                        "Value iteration algorithm",
                        "Policy iteration"
                    ],
                    "quality_score": 0.8,
                    "tags": ["article", "tutorial", "accessible"]
                },
                {
                    "type": ResourceType.PAPER,
                    "title": "Dynamic Programming",
                    "url": "https://web.mit.edu/dimitrib/www/dpchapter.pdf",
                    "author": "Dimitri Bertsekas",
                    "difficulty": ResourceDifficulty.ADVANCED,
                    "estimated_time_minutes": 180,
                    "description": "Rigorous treatment of dynamic programming and Bellman equations",
                    "key_takeaways": [
                        "Theoretical foundations",
                        "Optimality principles",
                        "Convergence proofs"
                    ],
                    "quality_score": 0.95,
                    "tags": ["paper", "theoretical", "rigorous"]
                }
            ]
        }
    
    def _get_concept_resources(self, concept: str) -> List[Dict]:
        """Get all resources for a concept."""
        return self.resource_database.get(concept, [])
    
    def _filter_by_expertise(
        self,
        resources: List[Dict],
        expertise: ExpertiseLevel
    ) -> List[Dict]:
        """Filter resources appropriate for expertise level."""
        
        # Map expertise to acceptable resource difficulties
        expertise_map = {
            ExpertiseLevel.ABSOLUTE_BEGINNER: [ResourceDifficulty.BEGINNER],
            ExpertiseLevel.BEGINNER: [ResourceDifficulty.BEGINNER, ResourceDifficulty.INTERMEDIATE],
            ExpertiseLevel.INTERMEDIATE: [ResourceDifficulty.BEGINNER, ResourceDifficulty.INTERMEDIATE, ResourceDifficulty.ADVANCED],
            ExpertiseLevel.ADVANCED: [ResourceDifficulty.INTERMEDIATE, ResourceDifficulty.ADVANCED, ResourceDifficulty.RESEARCH],
            ExpertiseLevel.EXPERT: [ResourceDifficulty.ADVANCED, ResourceDifficulty.RESEARCH]
        }
        
        acceptable_difficulties = expertise_map.get(
            expertise,
            [ResourceDifficulty.BEGINNER, ResourceDifficulty.INTERMEDIATE]
        )
        
        return [
            r for r in resources
            if r["difficulty"] in acceptable_difficulties
        ]
    
    def _score_resources(
        self,
        resources: List[Dict],
        profile: LearnerProfile
    ) -> List[ExternalResource]:
        """Score and rank resources based on learner profile."""
        
        scored_resources = []
        
        for resource_dict in resources:
            # Base score from quality
            score = resource_dict["quality_score"]
            
            # Adjust score based on preferences
            resource_type = resource_dict["type"]
            
            if resource_type == ResourceType.VIDEO and profile.prefers_video_resources:
                score *= 1.3
            elif resource_type in [ResourceType.PAPER, ResourceType.ARTICLE, ResourceType.BOOK] and profile.prefers_reading_resources:
                score *= 1.3
            elif resource_type == ResourceType.INTERACTIVE_TOOL and profile.prefers_interactive_tools:
                score *= 1.4
            
            # Adjust for time availability
            if resource_dict["estimated_time_minutes"] > profile.current_attention_minutes * 2:
                score *= 0.8  # Penalize overly long resources
            
            # Create ExternalResource object
            resource = ExternalResource(
                id=str(uuid.uuid4()),
                concept=resource_dict.get("concept", ""),
                resource_type=resource_dict["type"],
                title=resource_dict["title"],
                url=resource_dict["url"],
                author=resource_dict.get("author"),
                difficulty=resource_dict["difficulty"],
                estimated_time_minutes=resource_dict["estimated_time_minutes"],
                quality_score=resource_dict["quality_score"],
                description=resource_dict["description"],
                key_takeaways=resource_dict.get("key_takeaways", []),
                relevance_score=min(score, 1.0),
                tags=resource_dict.get("tags", [])
            )
            
            scored_resources.append((score, resource))
        
        # Sort by score (descending)
        scored_resources.sort(key=lambda x: x[0], reverse=True)
        
        return [r for _, r in scored_resources]
    
    def _generate_summary(
        self,
        resources: List[ExternalResource],
        profile: LearnerProfile
    ) -> str:
        """Generate human-readable summary of recommended resources."""
        if not resources:
            return "No resources found for this concept."
        
        summary_parts = [
            f"We've curated {len(resources)} resources based on your profile:"
        ]
        
        # Group by type
        by_type = {}
        for resource in resources:
            resource_type = resource.resource_type.value
            if resource_type not in by_type:
                by_type[resource_type] = []
            by_type[resource_type].append(resource)
        
        for resource_type, type_resources in by_type.items():
            count = len(type_resources)
            summary_parts.append(f"- {count} {resource_type}{'s' if count > 1 else ''}")
        
        # Add time estimate
        total_time = sum(r.estimated_time_minutes for r in resources)
        hours = total_time // 60
        minutes = total_time % 60
        summary_parts.append(f"\nEstimated total time: {hours}h {minutes}m")
        
        return "\n".join(summary_parts)
