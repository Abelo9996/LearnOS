from typing import Dict, Any
from agents.base import Agent
from models import ConceptNode, ModalityType, LearningContent, MasteryState
import random

class LearningOrchestratorAgent(Agent):
    """
    Decides what concept to teach next, how deep to go, and which modality to use.
    Adapts based on learner performance signals.
    
    Input: {
        "concept": str,
        "concept_node": ConceptNode,
        "mastery_state": MasteryState,
        "performance_signals": dict
    }
    Output: LearningContent with modality and content
    """
    
    def __init__(self):
        super().__init__(role="learning_orchestrator")
        self.modality_order = [
            ModalityType.TEXT,
            ModalityType.CODE,
            ModalityType.INTERACTIVE_QUESTION,
        ]
    
    async def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        concept = inputs["concept"]
        node: ConceptNode = inputs["concept_node"]
        mastery: MasteryState = inputs.get("mastery_state")
        performance = inputs.get("performance_signals", {})
        
        # Decide modality based on attempts and performance
        modality = await self._select_modality(mastery, performance)
        
        # Generate content based on modality
        content = await self._generate_content(node, modality, mastery)
        
        return {
            "learning_content": content,
            "modality": modality,
            "depth_level": self._calculate_depth(mastery)
        }
    
    async def _select_modality(
        self,
        mastery: MasteryState,
        performance: Dict[str, Any]
    ) -> ModalityType:
        """
        Select appropriate modality based on:
        - Number of attempts
        - Previous confusion signals
        - Response times
        """
        if not mastery or mastery.attempts == 0:
            return ModalityType.TEXT
        
        # If struggling (low confidence, multiple attempts), switch modality
        if mastery.attempts > 2 and mastery.confidence < 0.5:
            if performance.get("prefers_visual"):
                return ModalityType.DIAGRAM
            elif performance.get("prefers_code"):
                return ModalityType.CODE
            else:
                return ModalityType.TEXT
        
        # Cycle through modalities
        modality_idx = mastery.attempts % len(self.modality_order)
        return self.modality_order[modality_idx]
    
    async def _generate_content(
        self,
        node: ConceptNode,
        modality: ModalityType,
        mastery: MasteryState
    ) -> LearningContent:
        """
        Generate learning content for the concept.
        In production, this would use LLM with concept metadata.
        """
        concept = node.concept
        
        if modality == ModalityType.TEXT:
            return self._generate_text_explanation(node, mastery)
        elif modality == ModalityType.CODE:
            return self._generate_code_example(node)
        elif modality == ModalityType.INTERACTIVE_QUESTION:
            return self._generate_interactive_question(node)
        elif modality == ModalityType.DIAGRAM:
            return self._generate_diagram_content(node)
        
        return self._generate_text_explanation(node, mastery)
    
    def _generate_text_explanation(
        self, 
        node: ConceptNode, 
        mastery: MasteryState
    ) -> LearningContent:
        """Generate concise text explanation (≤3 minutes to read)."""
        
        # Build explanation from concept metadata
        explanation_parts = [
            f"# {node.concept}\n",
            f"\n**Core Idea:**"
        ]
        
        # Add context based on prerequisites
        if node.prerequisites:
            explanation_parts.append(
                f"\nBuilds on: {', '.join(node.prerequisites)}\n"
            )
        
        # Surface common misconception if retrying
        if mastery and mastery.attempts > 0 and node.misconceptions:
            misconception = node.misconceptions[min(mastery.attempts - 1, len(node.misconceptions) - 1)]
            explanation_parts.append(
                f"\n**Common Misconception:** {misconception}\n"
            )
        
        # Add concrete example
        if node.examples:
            example = node.examples[0]
            explanation_parts.append(
                f"\n**Example:** {example}\n"
            )
        
        content = "\n".join(explanation_parts)
        
        # Generate recall question
        question = f"Explain {node.concept} in your own words. Why does it matter?"
        
        return LearningContent(
            concept=node.concept,
            modality=ModalityType.TEXT,
            content=content,
            question=question,
            context={
                "estimated_time": 3,
                "difficulty": node.difficulty_score
            }
        )
    
    def _generate_code_example(self, node: ConceptNode) -> LearningContent:
        """Generate code-based learning content."""
        code_examples = {
            "Q-Learning": """
# Q-Learning Update Rule
def update_q_value(Q, state, action, reward, next_state, alpha=0.1, gamma=0.99):
    \"\"\"
    Update Q-value using Bellman equation.
    Q(s,a) ← Q(s,a) + α[r + γ max_a' Q(s',a') - Q(s,a)]
    \"\"\"
    best_next_q = max(Q[next_state].values())
    current_q = Q[state][action]
    
    # Temporal difference error
    td_error = reward + gamma * best_next_q - current_q
    
    # Update
    Q[state][action] = current_q + alpha * td_error
    
    return Q
""",
            "Bellman Equations": """
# Value Iteration using Bellman Optimality Equation
def value_iteration(mdp, gamma=0.99, theta=0.01):
    V = {s: 0 for s in mdp.states}
    
    while True:
        delta = 0
        for s in mdp.states:
            v = V[s]
            # Bellman optimality: V(s) = max_a Σ P(s'|s,a)[r + γV(s')]
            V[s] = max(
                sum(
                    mdp.P(s_prime, s, a) * (mdp.R(s, a) + gamma * V[s_prime])
                    for s_prime in mdp.states
                )
                for a in mdp.actions
            )
            delta = max(delta, abs(v - V[s]))
        
        if delta < theta:
            break
    
    return V
"""
        }
        
        code = code_examples.get(node.concept, f"# {node.concept} implementation example")
        
        return LearningContent(
            concept=node.concept,
            modality=ModalityType.CODE,
            content=code,
            question=f"Trace through this code. What happens at each step? Modify it for a different scenario.",
            context={"language": "python"}
        )
    
    def _generate_interactive_question(self, node: ConceptNode) -> LearningContent:
        """Generate interactive challenge."""
        if node.transfer_tests:
            challenge = random.choice(node.transfer_tests)
        else:
            challenge = f"Apply {node.concept} to solve a novel problem."
        
        return LearningContent(
            concept=node.concept,
            modality=ModalityType.INTERACTIVE_QUESTION,
            content=f"**Challenge:** {challenge}",
            question="Solve this step-by-step. Explain your reasoning.",
            context={"requires_application": True}
        )
    
    def _generate_diagram_content(self, node: ConceptNode) -> LearningContent:
        """Generate diagram-based content (placeholder for visual learners)."""
        return LearningContent(
            concept=node.concept,
            modality=ModalityType.DIAGRAM,
            content=f"[Visual representation of {node.concept}]",
            question="Explain what each component represents.",
            context={"visual": True}
        )
    
    def _calculate_depth(self, mastery: MasteryState) -> str:
        """Determine depth level: surface, medium, deep."""
        if not mastery or mastery.attempts == 0:
            return "surface"
        elif mastery.attempts < 3:
            return "medium"
        else:
            return "deep"
