from typing import Dict, Any, List
from agents.base import Agent
from models_extended import (
    ExternalResource, ResourceType, ResourceDifficulty,
    LearnerProfile, ExpertiseLevel
)
import uuid
from datetime import datetime

class ResourceCurationAgent(Agent):
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
