from typing import Dict, Any, List, Optional
from agents.base import Agent
from models import ConceptGraph, ConceptNode, MasteryState

class ConceptGraphEngine(Agent):
    """
    Manages concept metadata, tracks mastery state, validates prerequisites,
    and surfaces common misconceptions.
    
    Input: {"graph": ConceptGraph, "mastery_states": List[MasteryState]}
    Output: Available concepts, blocked concepts, progress metrics
    """
    
    def __init__(self):
        super().__init__(role="concept_graph_engine")
    
    async def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        graph: ConceptGraph = inputs["graph"]
        mastery_states: List[MasteryState] = inputs.get("mastery_states", [])
        
        mastered_concepts = {m.concept for m in mastery_states if m.mastered}
        
        available = await self._get_available_concepts(graph, mastered_concepts)
        blocked = await self._get_blocked_concepts(graph, mastered_concepts)
        next_concept = await self._select_next_concept(graph, available, mastery_states)
        
        progress = len(mastered_concepts) / len(graph.nodes) if graph.nodes else 0
        
        return {
            "available_concepts": available,
            "blocked_concepts": blocked,
            "next_concept": next_concept,
            "progress_percentage": progress * 100,
            "mastered_concepts": list(mastered_concepts)
        }
    
    async def _get_available_concepts(
        self, 
        graph: ConceptGraph, 
        mastered: set
    ) -> List[str]:
        """Get concepts whose prerequisites are satisfied."""
        available = []
        
        for concept_name, node in graph.nodes.items():
            if concept_name in mastered:
                continue
            
            prerequisites_met = all(
                prereq in mastered for prereq in node.prerequisites
            )
            
            if prerequisites_met:
                available.append(concept_name)
        
        return available
    
    async def _get_blocked_concepts(
        self, 
        graph: ConceptGraph, 
        mastered: set
    ) -> Dict[str, List[str]]:
        """Get concepts blocked by unmet prerequisites."""
        blocked = {}
        
        for concept_name, node in graph.nodes.items():
            if concept_name in mastered:
                continue
            
            unmet_prereqs = [
                prereq for prereq in node.prerequisites 
                if prereq not in mastered
            ]
            
            if unmet_prereqs:
                blocked[concept_name] = unmet_prereqs
        
        return blocked
    
    async def _select_next_concept(
        self,
        graph: ConceptGraph,
        available: List[str],
        mastery_states: List[MasteryState]
    ) -> Optional[str]:
        """
        Select next concept to teach from available concepts.
        Prioritizes by:
        1. Lowest difficulty among available
        2. Fewest attempts (prefer fresh concepts)
        3. Prerequisite for most other concepts
        """
        if not available:
            return None
        
        attempts_map = {m.concept: m.attempts for m in mastery_states}
        
        # Sort by difficulty, then attempts
        scored = []
        for concept in available:
            node = graph.nodes[concept]
            attempts = attempts_map.get(concept, 0)
            
            # Count how many concepts depend on this one
            dependency_count = sum(
                1 for other_node in graph.nodes.values()
                if concept in other_node.prerequisites
            )
            
            # Lower score is better
            score = (node.difficulty_score * 100) + (attempts * 10) - (dependency_count * 5)
            scored.append((concept, score))
        
        scored.sort(key=lambda x: x[1])
        return scored[0][0]
    
    def get_concept_metadata(
        self, 
        graph: ConceptGraph, 
        concept: str
    ) -> Optional[ConceptNode]:
        """Retrieve full metadata for a concept."""
        return graph.nodes.get(concept)
    
    def validate_prerequisite_completion(
        self,
        graph: ConceptGraph,
        concept: str,
        mastered: set
    ) -> tuple[bool, List[str]]:
        """
        Validate if all prerequisites for a concept are completed.
        Returns (is_valid, missing_prerequisites)
        """
        node = graph.nodes.get(concept)
        if not node:
            return False, []
        
        missing = [prereq for prereq in node.prerequisites if prereq not in mastered]
        return len(missing) == 0, missing
