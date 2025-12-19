"""
LearnOS Agents Module

This module contains all agentic components of the LearnOS system.
Each agent has a specific role in the learning process.

Agents:
- GoalDecompositionAgent: Converts goals into concept graphs
- ConceptGraphEngine: Manages concept dependencies and mastery tracking
- LearningOrchestratorAgent: Decides what and how to teach
- AttentionAdaptationAgent: Monitors learner signals and adapts
- SocraticEvaluationAgent: Evaluates understanding through reasoning

All agents extend the base Agent class defined in base.py
"""

from agents.base import Agent
from agents.goal_decomposition import GoalDecompositionAgent
from agents.concept_graph_engine import ConceptGraphEngine
from agents.learning_orchestrator import LearningOrchestratorAgent
from agents.attention_adaptation import AttentionAdaptationAgent
from agents.socratic_evaluation import SocraticEvaluationAgent

__all__ = [
    'Agent',
    'GoalDecompositionAgent',
    'ConceptGraphEngine',
    'LearningOrchestratorAgent',
    'AttentionAdaptationAgent',
    'SocraticEvaluationAgent',
]
