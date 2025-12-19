from typing import Dict, Any, List
from agents.base import Agent
import re

class SocraticEvaluationAgent(Agent):
    """
    Evaluates learner understanding through Socratic questioning.
    Instead of quizzes, asks learners to:
    - Explain in their own words
    - Challenge reasoning
    - Answer "why" and "what if"
    - Apply to novel examples
    
    Blocks progression until reasoning quality exceeds threshold.
    
    Input: {
        "concept": str,
        "learner_response": str,
        "context": dict
    }
    Output: {
        "reasoning_quality": float,
        "passed": bool,
        "follow_up_question": str,
        "feedback": str
    }
    """
    
    def __init__(self):
        super().__init__(role="socratic_evaluation")
        self.PASS_THRESHOLD = 0.7
        self.question_types = [
            "explanation",
            "why",
            "what_if",
            "transfer"
        ]
    
    async def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        concept: str = inputs["concept"]
        response: str = inputs["learner_response"]
        context: Dict[str, Any] = inputs.get("context", {})
        question_history = context.get("question_history", [])
        
        # Evaluate response quality
        quality_score = await self._evaluate_response(response, concept, context)
        
        # Determine if passed
        passed = quality_score >= self.PASS_THRESHOLD
        
        # Generate follow-up if needed
        follow_up = None
        if not passed:
            follow_up = await self._generate_follow_up(
                concept, 
                response, 
                quality_score,
                question_history
            )
        
        # Generate feedback
        feedback = await self._generate_feedback(concept, response, quality_score, passed)
        
        return {
            "reasoning_quality": quality_score,
            "passed": passed,
            "follow_up_question": follow_up,
            "feedback": feedback,
            "evaluation_breakdown": self._get_breakdown(response)
        }
    
    async def _evaluate_response(
        self,
        response: str,
        concept: str,
        context: Dict[str, Any]
    ) -> float:
        """
        Evaluate response quality on multiple dimensions.
        In production, this would use LLM-based evaluation.
        For demo, use heuristics.
        """
        if not response or len(response.strip()) < 20:
            return 0.1
        
        response_lower = response.lower()
        
        # Heuristic scoring
        scores = []
        
        # 1. Length and detail (0-1)
        length_score = min(1.0, len(response.split()) / 50)
        scores.append(length_score)
        
        # 2. Uses concept terminology (0-1)
        concept_terms = concept.lower().split()
        terminology_score = sum(1 for term in concept_terms if term in response_lower) / max(1, len(concept_terms))
        scores.append(terminology_score)
        
        # 3. Shows reasoning (contains "because", "therefore", "since", etc.)
        reasoning_indicators = ["because", "therefore", "since", "thus", "which means", "leads to", "results in"]
        reasoning_score = min(1.0, sum(1 for indicator in reasoning_indicators if indicator in response_lower) / 2)
        scores.append(reasoning_score)
        
        # 4. Provides examples or applications
        example_indicators = ["example", "for instance", "such as", "like", "consider"]
        example_score = min(1.0, sum(1 for indicator in example_indicators if indicator in response_lower))
        scores.append(example_score)
        
        # 5. Avoids vague language
        vague_terms = ["thing", "stuff", "just", "basically", "simply"]
        vague_penalty = sum(1 for term in vague_terms if term in response_lower) * 0.1
        clarity_score = max(0.0, 1.0 - vague_penalty)
        scores.append(clarity_score)
        
        # Weighted average
        weights = [0.15, 0.25, 0.25, 0.20, 0.15]
        final_score = sum(s * w for s, w in zip(scores, weights))
        
        return final_score
    
    async def _generate_follow_up(
        self,
        concept: str,
        response: str,
        quality_score: float,
        question_history: List[str]
    ) -> str:
        """
        Generate Socratic follow-up question based on response quality.
        Progressively challenges understanding.
        """
        # Determine question type based on what's been asked
        asked_types = set(question_history)
        
        # Prioritize question types
        if "explanation" not in asked_types:
            return f"Explain {concept} in your own words, as if teaching someone unfamiliar with it."
        
        if quality_score < 0.3:
            # Very weak response - ask for core understanding
            return f"What is the single most important idea behind {concept}?"
        
        if "why" not in asked_types:
            return f"Why is {concept} important? What problem does it solve?"
        
        if quality_score < 0.5:
            # Weak response - ask for concrete example
            return f"Give a concrete example of {concept} in action."
        
        if "what_if" not in asked_types:
            return f"What if we removed a key component from {concept}? What would break?"
        
        if "transfer" not in asked_types:
            return f"How would you apply {concept} to a completely different domain?"
        
        # Deep challenge
        return f"What's a common misconception about {concept}, and why is it wrong?"
    
    async def _generate_feedback(
        self,
        concept: str,
        response: str,
        quality_score: float,
        passed: bool
    ) -> str:
        """Generate constructive feedback."""
        if passed:
            return f"Strong explanation of {concept}. You've demonstrated clear understanding of the core principles and their application."
        
        if quality_score < 0.3:
            return f"Your response is too brief or vague. Try to explain the core mechanism of {concept} in more detail."
        
        if quality_score < 0.5:
            return f"You're on the right track, but need more depth. Explain WHY {concept} works the way it does."
        
        if quality_score < 0.7:
            return f"Good start. To strengthen your answer, provide a concrete example showing {concept} in action."
        
        return "Close! Clarify your reasoning one more time."
    
    def _get_breakdown(self, response: str) -> Dict[str, str]:
        """Get detailed breakdown of evaluation."""
        response_lower = response.lower()
        
        return {
            "has_reasoning": "yes" if any(
                word in response_lower 
                for word in ["because", "therefore", "since"]
            ) else "no",
            "has_examples": "yes" if any(
                word in response_lower 
                for word in ["example", "for instance"]
            ) else "no",
            "depth": "surface" if len(response.split()) < 30 else "detailed",
            "clarity": "clear" if not any(
                word in response_lower 
                for word in ["thing", "stuff"]
            ) else "vague"
        }
    
    def generate_challenge_question(
        self,
        concept: str,
        challenge_type: str = "transfer"
    ) -> str:
        """
        Generate specific challenge questions.
        """
        questions = {
            "explanation": f"Explain {concept} as if teaching a bright 12-year-old.",
            "why": f"Why does {concept} matter? What would be different without it?",
            "what_if": f"What happens if you modify a core assumption in {concept}?",
            "transfer": f"Apply {concept} to design a system you've never built before.",
            "debug": f"I claim {concept} is just [wrong statement]. What's wrong with my reasoning?",
            "contrast": f"How is {concept} fundamentally different from [related concept]?"
        }
        
        return questions.get(challenge_type, questions["explanation"])
