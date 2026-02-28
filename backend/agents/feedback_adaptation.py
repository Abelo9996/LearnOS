"""
Feedback Adaptation Agent - Adjust learning path based on real-time feedback
"""

from agents.base import Agent
from llm_manager import llm_manager
from llm_providers import LLMRequest, ModelCapability
from typing import Dict, Any, List, Optional
from enum import Enum
import json


class AdaptationStrategy(str, Enum):
    """Strategies for adapting to learner feedback"""
    SIMPLIFY = "simplify"
    ELABORATE = "elaborate"
    ANALOGIZE = "analogize"
    CODE_EXAMPLE = "code_example"
    VISUAL = "visual"
    STEP_BACK = "step_back"  # Go back to prerequisites


class FeedbackAdaptationAgent(Agent):
    """
    Analyzes learner feedback and adapts content in real-time.
    Features:
    - Identifies misconceptions from incorrect answers
    - Detects confusion signals
    - Recommends content adjustments
    - Generates targeted remediation
    - Tracks confusion patterns
    """
    
    def __init__(self):
        super().__init__(role="Feedback Adapter")
        self.confusion_patterns: Dict[str, List[str]] = {}
    
    async def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze feedback and recommend adaptations
        
        Inputs:
        - user_id: str
        - concept: str
        - learner_response: str
        - expected_answer: str
        - answer_is_correct: bool
        - confidence: float (learner's confidence 0-1)
        - time_spent_seconds: float
        - previous_interactions: List[Dict]
        
        Outputs:
        - is_mastered: bool
        - misconceptions_detected: List[str]
        - adaptation_strategy: AdaptationStrategy
        - adaptation_content: str
        - next_concept: Optional[str]
        - metadata: Dict
        """
        
        user_id = inputs.get("user_id", "demo_user")
        concept = inputs.get("concept")
        learner_response = inputs.get("learner_response", "")
        expected_answer = inputs.get("expected_answer", "")
        is_correct = inputs.get("answer_is_correct", False)
        confidence = inputs.get("confidence", 0.5)
        time_spent = inputs.get("time_spent_seconds", 0)
        previous_interactions = inputs.get("previous_interactions", [])
        
        if not concept:
            raise ValueError("Concept is required")
        
        # Analyze the response
        misconceptions = await self._detect_misconceptions(
            user_id, concept, learner_response, expected_answer, is_correct
        )
        
        # Determine if concept is mastered
        mastery_confidence = self._calculate_mastery_confidence(
            is_correct, confidence, time_spent, previous_interactions
        )
        is_mastered = mastery_confidence > 0.85
        
        # Select adaptation strategy
        strategy = await self._select_adaptation_strategy(
            user_id, concept, misconceptions, is_correct, learner_response
        )
        
        # Generate adapted content
        adaptation_content = await self._generate_adaptation_content(
            user_id, concept, strategy, misconceptions, learner_response
        )
        
        # Determine next concept or remediation
        next_concept = None
        if is_mastered:
            next_concept = await self._recommend_next_concept(user_id, concept)
        
        # Track this interaction
        self._record_interaction(user_id, concept, misconceptions, strategy)
        
        return {
            "concept": concept,
            "is_mastered": is_mastered,
            "mastery_confidence": mastery_confidence,
            "misconceptions": misconceptions,
            "adaptation_strategy": strategy,
            "adaptation_content": adaptation_content,
            "next_concept": next_concept,
            "should_remediate": len(misconceptions) > 0 and not is_mastered,
            "metadata": {
                "confidence_level": confidence,
                "response_time_seconds": time_spent,
                "feedback_analyzed_by": "llm_manager"
            }
        }
    
    async def _detect_misconceptions(
        self,
        user_id: str,
        concept: str,
        learner_response: str,
        expected_answer: str,
        is_correct: bool
    ) -> List[str]:
        """Detect misconceptions from the learner's response"""
        
        request = LLMRequest(
            system_prompt="""You are an expert in identifying student misconceptions and learning errors.
Analyze the learner's response and identify:
1. Factual errors
2. Conceptual misunderstandings
3. Procedural mistakes
4. Reasoning flaws

Be specific about what the misconception is, not just what's wrong.""",
            user_prompt=f"""Concept being tested: {concept}

Expected/Correct answer: {expected_answer}

Learner's response: {learner_response}

Response is correct: {is_correct}

Identify any misconceptions, errors, or misunderstandings in the learner's response.
Return as a JSON list of misconceptions. Example: ["misconception1", "misconception2"]
If the response is correct and shows good understanding, return: []""",
            task_type="evaluation"
        )
        
        try:
            response = await llm_manager.generate(user_id, request, ModelCapability.EVALUATION)
            misconceptions_str = response.content.strip()
            
            if misconceptions_str.startswith("["):
                return json.loads(misconceptions_str)
            return []
        except:
            return []
    
    def _calculate_mastery_confidence(
        self,
        is_correct: bool,
        confidence: float,
        time_spent: float,
        previous_interactions: List[Dict]
    ) -> float:
        """Calculate confidence that the concept is mastered"""
        
        # Base score from correctness
        base_score = 1.0 if is_correct else 0.0
        
        # Adjust by learner's confidence
        confidence_adjustment = (confidence - 0.5) * 0.2  # ±0.1
        
        # Adjust by response time (faster is better, but too fast is suspicious)
        if time_spent > 0:
            if time_spent < 5:
                time_adjustment = 0.1  # Suspiciously fast
            elif time_spent < 120:
                time_adjustment = 0.1  # Good thinking time
            else:
                time_adjustment = -0.1  # Struggling
        else:
            time_adjustment = 0
        
        # Consider recent history
        if previous_interactions:
            recent_correct = sum(1 for i in previous_interactions[-3:] if i.get("correct"))
            history_adjustment = (recent_correct / 3) * 0.2
        else:
            history_adjustment = 0
        
        mastery_score = base_score + confidence_adjustment + time_adjustment + history_adjustment
        return max(0.0, min(1.0, mastery_score))
    
    async def _select_adaptation_strategy(
        self,
        user_id: str,
        concept: str,
        misconceptions: List[str],
        is_correct: bool,
        learner_response: str
    ) -> AdaptationStrategy:
        """Select the best adaptation strategy"""
        
        if is_correct:
            return AdaptationStrategy.ELABORATE
        
        if len(misconceptions) > 1:
            return AdaptationStrategy.STEP_BACK
        
        # Use LLM to recommend strategy
        request = LLMRequest(
            system_prompt="You are an expert educational designer. Recommend the most effective learning strategy.",
            user_prompt=f"""For this learning scenario:
- Concept: {concept}
- Misconceptions detected: {', '.join(misconceptions) if misconceptions else 'None'}
- Learner response quality: {learner_response[:100]}...

Recommend ONE adaptation strategy from: simplify, elaborate, analogize, code_example, visual, step_back

Return ONLY the strategy name.""",
            task_type="content_generation"
        )
        
        try:
            response = await llm_manager.generate(user_id, request, ModelCapability.EXPLANATION)
            strategy_str = response.content.strip().lower()
            
            for strategy in AdaptationStrategy:
                if strategy.value in strategy_str:
                    return strategy
            
            return AdaptationStrategy.ELABOR if not is_correct else AdaptationStrategy.ELABORATE
        except:
            return AdaptationStrategy.ELABORATE
    
    async def _generate_adaptation_content(
        self,
        user_id: str,
        concept: str,
        strategy: AdaptationStrategy,
        misconceptions: List[str],
        learner_response: str
    ) -> str:
        """Generate adapted content based on strategy"""
        
        misconception_context = f"Misconceptions to address: {', '.join(misconceptions)}" if misconceptions else ""
        
        strategy_prompts = {
            AdaptationStrategy.SIMPLIFY: f"""Simplify the explanation of "{concept}".
{misconception_context}

Focus on the core idea without technical jargon. Use very simple language and one concrete example.""",

            AdaptationStrategy.ELABORATE: f"""Expand on "{concept}" with more depth and nuance.
{misconception_context}

Add advanced insights, edge cases, and extensions that deepen understanding.""",

            AdaptationStrategy.ANALOGIZE: f"""Create a powerful analogy to clarify "{concept}".
{misconception_context}

The learner responded: "{learner_response[:150]}..."
Create an analogy that addresses their confusion and clarifies the concept.""",

            AdaptationStrategy.CODE_EXAMPLE: f"""Provide a code example to clarify "{concept}".
{misconception_context}

The learner's confusion: "{learner_response[:150]}..."
Write clean Python code (under 20 lines) that demonstrates the concept in action.""",

            AdaptationStrategy.VISUAL: f"""Describe a visual or diagram for "{concept}".
{misconception_context}

Describe how to visualize this concept in a way that addresses the misconceptions.""",

            AdaptationStrategy.STEP_BACK: f"""Provide prerequisite context for "{concept}".
{misconception_context}

The learner seems to be missing fundamental understanding. Explain the foundational concepts they might be missing."""
        }
        
        prompt = strategy_prompts.get(strategy, strategy_prompts[AdaptationStrategy.ELABORATE])
        
        request = LLMRequest(
            system_prompt="You are an expert educator skilled at addressing misconceptions.",
            user_prompt=prompt,
            task_type="content_generation"
        )
        
        response = await llm_manager.generate(user_id, request, ModelCapability.EXPLANATION)
        return response.content
    
    async def _recommend_next_concept(self, user_id: str, current_concept: str) -> Optional[str]:
        """Recommend the next concept to learn"""
        
        request = LLMRequest(
            system_prompt="You are a curriculum designer expert in concept sequencing.",
            user_prompt=f"""The learner has just mastered: {current_concept}

What is the most logical and valuable concept to learn next?
Consider:
- Prerequisites that build on {current_concept}
- Natural progression in understanding
- Practical applicability

Return ONLY the next concept name (2-5 words maximum).""",
            task_type="content_generation"
        )
        
        try:
            response = await llm_manager.generate(user_id, request, ModelCapability.EXPLANATION)
            return response.content.strip()
        except:
            return None
    
    def _record_interaction(
        self,
        user_id: str,
        concept: str,
        misconceptions: List[str],
        strategy: AdaptationStrategy
    ) -> None:
        """Record this interaction for pattern analysis"""
        
        if user_id not in self.confusion_patterns:
            self.confusion_patterns[user_id] = []
        
        if misconceptions:
            for misconception in misconceptions:
                pattern = f"{concept}:{misconception}"
                self.confusion_patterns[user_id].append(pattern)
                
                # Only keep last 50 patterns
                if len(self.confusion_patterns[user_id]) > 50:
                    self.confusion_patterns[user_id] = self.confusion_patterns[user_id][-50:]
    
    def get_confusion_patterns(self, user_id: str) -> Dict[str, int]:
        """Get frequency of misconceptions for a user"""
        
        patterns = self.confusion_patterns.get(user_id, [])
        pattern_counts = {}
        
        for pattern in patterns:
            pattern_counts[pattern] = pattern_counts.get(pattern, 0) + 1
        
        # Return sorted by frequency
        return dict(sorted(pattern_counts.items(), key=lambda x: x[1], reverse=True))
