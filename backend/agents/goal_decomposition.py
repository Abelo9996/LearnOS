from typing import Dict, Any, List
from agents.base import Agent
from models import ConceptNode, ConceptGraph
import uuid
from datetime import datetime

class GoalDecompositionAgent(Agent):
    """
    Converts high-level learning goals into structured concept dependency graphs.
    
    Input: {"goal": str}
    Output: ConceptGraph with DAG structure
    """
    
    def __init__(self):
        super().__init__(role="goal_decomposition")
    
    async def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        goal = inputs["goal"]
        
        # Generate concept graph based on goal
        nodes = await self._decompose_goal(goal)
        edges = await self._build_dependencies(nodes)
        
        graph = ConceptGraph(
            id=str(uuid.uuid4()),
            goal=goal,
            nodes={node.concept: node for node in nodes},
            edges=edges,
            created_at=datetime.utcnow()
        )
        
        self.update_memory("last_graph", graph.model_dump())
        
        return {
            "graph": graph,
            "concepts": [node.concept for node in nodes]
        }
    
    async def _decompose_goal(self, goal: str) -> List[ConceptNode]:
        """
        Decompose goal into fundamental concepts.
        In production, this would use an LLM with structured output.
        For demo, we provide domain-specific decomposition.
        """
        goal_lower = goal.lower()
        
        # Domain-specific concept trees
        if "reinforcement learning" in goal_lower or "rl agent" in goal_lower:
            return self._rl_concepts()
        elif "neural network" in goal_lower or "deep learning" in goal_lower:
            return self._deep_learning_concepts()
        elif "machine learning" in goal_lower or "ml" in goal_lower:
            return self._ml_concepts()
        else:
            return self._generic_learning_concepts(goal)
    
    def _rl_concepts(self) -> List[ConceptNode]:
        return [
            ConceptNode(
                concept="Markov Decision Process",
                prerequisites=[],
                difficulty_score=0.3,
                estimated_time_minutes=20,
                confidence_threshold=0.8,
                misconceptions=[
                    "MDP assumes full observability",
                    "States must be discrete",
                    "Reward always comes from environment"
                ],
                examples=[
                    "Grid world navigation",
                    "Robot arm control",
                    "Chess game states"
                ],
                transfer_tests=[
                    "Design MDP for elevator scheduling",
                    "Identify states for autonomous driving"
                ]
            ),
            ConceptNode(
                concept="Value Functions",
                prerequisites=["Markov Decision Process"],
                difficulty_score=0.4,
                estimated_time_minutes=25,
                confidence_threshold=0.8,
                misconceptions=[
                    "Value is immediate reward",
                    "Q-value and V-value are the same",
                    "Values don't depend on policy"
                ],
                examples=[
                    "V(s) in grid world",
                    "Q(s,a) for action selection",
                    "Optimal vs. arbitrary policy values"
                ],
                transfer_tests=[
                    "Calculate V* for simple MDP",
                    "Explain why Q* enables optimal action selection"
                ]
            ),
            ConceptNode(
                concept="Bellman Equations",
                prerequisites=["Value Functions"],
                difficulty_score=0.5,
                estimated_time_minutes=30,
                confidence_threshold=0.85,
                misconceptions=[
                    "Bellman equation is only for deterministic transitions",
                    "Expectation is over states, not actions",
                    "Discount factor is optional"
                ],
                examples=[
                    "Bellman expectation equation derivation",
                    "Bellman optimality equation",
                    "Iterative value calculation"
                ],
                transfer_tests=[
                    "Derive Bellman for custom MDP",
                    "Explain role of discount factor with examples"
                ]
            ),
            ConceptNode(
                concept="Q-Learning",
                prerequisites=["Bellman Equations"],
                difficulty_score=0.6,
                estimated_time_minutes=35,
                confidence_threshold=0.85,
                misconceptions=[
                    "Q-learning requires model of environment",
                    "Learning rate should be constant",
                    "Q-learning converges without exploration"
                ],
                examples=[
                    "Q-table update rule",
                    "Epsilon-greedy exploration",
                    "Simple grid world implementation"
                ],
                transfer_tests=[
                    "Implement Q-learning for cliff walking",
                    "Explain exploration-exploitation tradeoff"
                ]
            ),
            ConceptNode(
                concept="Deep Q-Networks",
                prerequisites=["Q-Learning", "Neural Networks"],
                difficulty_score=0.7,
                estimated_time_minutes=40,
                confidence_threshold=0.8,
                misconceptions=[
                    "DQN just replaces Q-table with neural net",
                    "Experience replay slows learning",
                    "Target network is for stability, not accuracy"
                ],
                examples=[
                    "Atari game playing",
                    "Experience replay buffer",
                    "Target network updates"
                ],
                transfer_tests=[
                    "Design DQN architecture for CartPole",
                    "Explain why vanilla Q-learning fails with function approximation"
                ]
            ),
            ConceptNode(
                concept="Policy Gradients",
                prerequisites=["Value Functions"],
                difficulty_score=0.7,
                estimated_time_minutes=45,
                confidence_threshold=0.85,
                misconceptions=[
                    "Policy gradient methods don't use value functions",
                    "REINFORCE has low variance",
                    "Baseline must be value function"
                ],
                examples=[
                    "REINFORCE algorithm",
                    "Actor-critic methods",
                    "Advantage estimation"
                ],
                transfer_tests=[
                    "Derive policy gradient theorem",
                    "Implement REINFORCE for simple task"
                ]
            ),
            ConceptNode(
                concept="Neural Networks",
                prerequisites=[],
                difficulty_score=0.4,
                estimated_time_minutes=30,
                confidence_threshold=0.8,
                misconceptions=[
                    "More layers always better",
                    "Activation functions are optional",
                    "Backpropagation requires calculus knowledge"
                ],
                examples=[
                    "Multi-layer perceptron",
                    "Forward and backward pass",
                    "Common activation functions"
                ],
                transfer_tests=[
                    "Design network for binary classification",
                    "Explain vanishing gradient problem"
                ]
            )
        ]
    
    def _deep_learning_concepts(self) -> List[ConceptNode]:
        return [
            ConceptNode(
                concept="Neural Network Fundamentals",
                prerequisites=[],
                difficulty_score=0.3,
                estimated_time_minutes=25,
                confidence_threshold=0.8,
                examples=["Perceptron", "Activation functions", "Forward pass"],
                misconceptions=["Networks memorize, not generalize", "Deeper is always better"],
                transfer_tests=["Build 2-layer network from scratch"]
            ),
            ConceptNode(
                concept="Backpropagation",
                prerequisites=["Neural Network Fundamentals"],
                difficulty_score=0.5,
                estimated_time_minutes=35,
                confidence_threshold=0.85,
                examples=["Chain rule", "Gradient computation", "Weight updates"],
                misconceptions=["Backprop requires symbolic differentiation", "All gradients same magnitude"],
                transfer_tests=["Compute gradients for simple network manually"]
            )
        ]
    
    def _ml_concepts(self) -> List[ConceptNode]:
        return [
            ConceptNode(
                concept="Supervised Learning",
                prerequisites=[],
                difficulty_score=0.2,
                estimated_time_minutes=20,
                confidence_threshold=0.75,
                examples=["Classification", "Regression", "Training data"],
                misconceptions=["More data always better", "Complex models always overfit"],
                transfer_tests=["Identify supervised tasks in real scenarios"]
            )
        ]
    
    def _generic_learning_concepts(self, goal: str) -> List[ConceptNode]:
        return [
            ConceptNode(
                concept=f"Fundamentals of {goal}",
                prerequisites=[],
                difficulty_score=0.3,
                estimated_time_minutes=20,
                confidence_threshold=0.8,
                examples=["Core definitions", "Basic principles"],
                misconceptions=["Common beginner mistakes"],
                transfer_tests=["Apply concepts to new scenario"]
            )
        ]
    
    async def _build_dependencies(self, nodes: List[ConceptNode]) -> List[tuple[str, str]]:
        """Build directed edges from prerequisites."""
        edges = []
        for node in nodes:
            for prereq in node.prerequisites:
                edges.append((prereq, node.concept))
        return edges
