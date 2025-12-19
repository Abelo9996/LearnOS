from typing import Dict, Any, List
from agents.base import Agent
from models import InteractionEvent, MasteryState
from datetime import datetime, timedelta

class AttentionAdaptationAgent(Agent):
    """
    Monitors learner attention and performance signals.
    Triggers adaptations: shorten explanations, switch modality, 
    introduce analogies, force retrieval.
    
    Runs after every learner interaction.
    
    Input: {
        "interactions": List[InteractionEvent],
        "current_concept": str
    }
    Output: {
        "adaptation_needed": bool,
        "adaptation_type": str,
        "signals": dict
    }
    """
    
    def __init__(self):
        super().__init__(role="attention_adaptation")
        
        # Thresholds for triggering adaptations
        self.SLOW_RESPONSE_THRESHOLD = 120  # seconds
        self.FAST_RESPONSE_THRESHOLD = 10   # seconds (might be skipping)
        self.CONFUSION_THRESHOLD = 3        # consecutive incorrect
        self.SKIP_PATTERN_THRESHOLD = 0.3   # 30% skip rate
    
    async def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        interactions: List[InteractionEvent] = inputs.get("interactions", [])
        current_concept: str = inputs["current_concept"]
        
        # Filter interactions for current concept
        concept_interactions = [
            i for i in interactions 
            if i.concept == current_concept
        ]
        
        if not concept_interactions:
            return {
                "adaptation_needed": False,
                "adaptation_type": None,
                "signals": {}
            }
        
        # Analyze signals
        signals = await self._analyze_signals(concept_interactions)
        
        # Determine if adaptation needed
        adaptation_type = await self._determine_adaptation(signals)
        
        # Update memory
        self.update_memory("last_signals", signals)
        self.update_memory("last_adaptation", adaptation_type)
        
        return {
            "adaptation_needed": adaptation_type is not None,
            "adaptation_type": adaptation_type,
            "signals": signals,
            "recommendations": self._get_recommendations(adaptation_type)
        }
    
    async def _analyze_signals(
        self, 
        interactions: List[InteractionEvent]
    ) -> Dict[str, Any]:
        """Extract performance and attention signals."""
        
        if not interactions:
            return {}
        
        # Response time analysis
        response_times = [
            i.time_to_respond_seconds 
            for i in interactions 
            if i.time_to_respond_seconds is not None
        ]
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        
        # Accuracy analysis
        correct_responses = [i.correct for i in interactions if i.correct is not None]
        accuracy = sum(correct_responses) / len(correct_responses) if correct_responses else 0
        
        # Detect patterns
        recent_interactions = interactions[-5:]
        consecutive_incorrect = 0
        for i in reversed(recent_interactions):
            if i.correct is False:
                consecutive_incorrect += 1
            else:
                break
        
        # Skip detection (very fast responses with low accuracy)
        fast_incorrect = sum(
            1 for i in interactions[-10:]
            if i.time_to_respond_seconds and 
            i.time_to_respond_seconds < self.FAST_RESPONSE_THRESHOLD and
            i.correct is False
        )
        skip_rate = fast_incorrect / min(10, len(interactions))
        
        # Engagement trend
        if len(interactions) > 5:
            recent_times = response_times[-5:]
            earlier_times = response_times[-10:-5] if len(response_times) > 5 else response_times
            
            avg_recent = sum(recent_times) / len(recent_times) if recent_times else 0
            avg_earlier = sum(earlier_times) / len(earlier_times) if earlier_times else 0
            
            engagement_trend = "declining" if avg_recent > avg_earlier * 1.5 else "stable"
        else:
            engagement_trend = "stable"
        
        return {
            "avg_response_time": avg_response_time,
            "accuracy": accuracy,
            "consecutive_incorrect": consecutive_incorrect,
            "skip_rate": skip_rate,
            "engagement_trend": engagement_trend,
            "total_attempts": len(interactions),
            "is_slow": avg_response_time > self.SLOW_RESPONSE_THRESHOLD,
            "is_fast_skipping": skip_rate > self.SKIP_PATTERN_THRESHOLD,
            "showing_confusion": consecutive_incorrect >= self.CONFUSION_THRESHOLD
        }
    
    async def _determine_adaptation(self, signals: Dict[str, Any]) -> str:
        """
        Determine which adaptation to apply based on signals.
        
        Returns adaptation type or None.
        """
        if not signals:
            return None
        
        # Priority order for adaptations
        
        # 1. Repeated confusion → switch modality or add analogy
        if signals.get("showing_confusion"):
            return "switch_modality"
        
        # 2. Fast skipping → force retrieval/engagement
        if signals.get("is_fast_skipping"):
            return "force_retrieval"
        
        # 3. Slow responses → shorten content
        if signals.get("is_slow") and signals.get("engagement_trend") == "declining":
            return "shorten_content"
        
        # 4. Low accuracy but engaged → provide analogy
        if signals.get("accuracy", 1.0) < 0.5 and not signals.get("is_slow"):
            return "introduce_analogy"
        
        # 5. Multiple attempts without progress → provide scaffolding
        if signals.get("total_attempts", 0) > 5 and signals.get("accuracy", 1.0) < 0.6:
            return "add_scaffolding"
        
        return None
    
    def _get_recommendations(self, adaptation_type: str) -> List[str]:
        """Get specific recommendations for the adaptation type."""
        recommendations = {
            "switch_modality": [
                "Try visual representation",
                "Provide code example instead of text",
                "Use interactive question"
            ],
            "force_retrieval": [
                "Ask learner to explain without looking",
                "Require working through an example",
                "Use spaced repetition prompt"
            ],
            "shorten_content": [
                "Reduce explanation to core insight",
                "Use bullet points instead of paragraphs",
                "Focus on one aspect at a time"
            ],
            "introduce_analogy": [
                "Connect to familiar domain",
                "Use concrete everyday example",
                "Provide contrasting case"
            ],
            "add_scaffolding": [
                "Break into smaller substeps",
                "Provide partial solution",
                "Add guided hints"
            ]
        }
        
        return recommendations.get(adaptation_type, [])
    
    def calculate_engagement_score(self, signals: Dict[str, Any]) -> float:
        """
        Calculate engagement score from 0 to 1.
        Used for dashboard and analytics.
        """
        if not signals:
            return 0.5
        
        # Factors
        response_time_score = 1.0 if signals.get("avg_response_time", 0) < 60 else 0.5
        accuracy_score = signals.get("accuracy", 0)
        skip_penalty = 1.0 - signals.get("skip_rate", 0)
        confusion_penalty = max(0, 1.0 - signals.get("consecutive_incorrect", 0) * 0.2)
        
        engagement = (
            response_time_score * 0.2 +
            accuracy_score * 0.4 +
            skip_penalty * 0.2 +
            confusion_penalty * 0.2
        )
        
        return max(0.0, min(1.0, engagement))
