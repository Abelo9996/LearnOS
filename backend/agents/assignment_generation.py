from typing import Dict, Any, List
from agents.base import Agent
from models_extended import (
    Assignment, AssignmentType, ExpertiseLevel, LearnerProfile
)
import uuid
from datetime import datetime

class AssignmentGenerationAgent(Agent):
    """
    Generates hands-on assignments, projects, and exercises based on:
    - Concept being learned
    - Learner's expertise level
    - Learning style preferences
    - Assignment type preferences
    
    Creates assignments with:
    - Clear objectives and rubrics
    - Starter code/scaffolding
    - Hints and resources
    - Difficulty-appropriate challenges
    """
    
    def __init__(self):
        super().__init__(role="assignment_generation")
    
    async def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Input: {
            "concept": str,
            "concept_node": ConceptNode,
            "learner_profile": LearnerProfile,
            "goal_id": str
        }
        Output: {
            "assignment": Assignment,
            "estimated_hours": int
        }
        """
        concept = inputs["concept"]
        concept_node = inputs["concept_node"]
        profile: LearnerProfile = inputs["learner_profile"]
        goal_id = inputs["goal_id"]
        
        # Select assignment type based on learning style and preferences
        assignment_type = self._select_assignment_type(profile, concept)
        
        # Generate assignment
        assignment = await self._generate_assignment(
            concept,
            concept_node,
            assignment_type,
            profile,
            goal_id
        )
        
        return {
            "assignment": assignment,
            "estimated_hours": assignment.estimated_hours,
            "assignment_type": assignment_type
        }
    
    def _select_assignment_type(
        self, 
        profile: LearnerProfile, 
        concept: str
    ) -> AssignmentType:
        """Select appropriate assignment type based on learner profile."""
        
        # Kinesthetic learners prefer hands-on coding
        if profile.primary_learning_style.value == "kinesthetic":
            return AssignmentType.CODING if "algorithm" in concept.lower() else AssignmentType.PROJECT
        
        # Visual learners prefer projects with visual outputs
        elif profile.primary_learning_style.value == "visual":
            return AssignmentType.PROJECT
        
        # Reading/writing learners prefer written assignments
        elif profile.primary_learning_style.value == "reading_writing":
            return AssignmentType.WRITTEN
        
        # Default to coding or project
        else:
            return AssignmentType.CODING
    
    async def _generate_assignment(
        self,
        concept: str,
        concept_node: Any,
        assignment_type: AssignmentType,
        profile: LearnerProfile,
        goal_id: str
    ) -> Assignment:
        """Generate specific assignment based on concept and type."""
        
        # Assignment templates by concept (in production, this would use LLM)
        assignment_templates = self._get_assignment_templates()
        
        template = assignment_templates.get(
            concept,
            self._generate_generic_assignment(concept, assignment_type)
        )
        
        # Adapt difficulty to expertise level
        difficulty = self._calculate_difficulty(profile.expertise_level)
        
        # Adjust estimated hours based on pace
        estimated_hours = template["base_hours"]
        if profile.pace_preference.value == "slow":
            estimated_hours = int(estimated_hours * 1.5)
        elif profile.pace_preference.value == "fast":
            estimated_hours = int(estimated_hours * 0.7)
        
        assignment = Assignment(
            id=str(uuid.uuid4()),
            concept=concept,
            goal_id=goal_id,
            assignment_type=assignment_type,
            title=template["title"],
            description=template["description"],
            objectives=template["objectives"],
            instructions=template["instructions"],
            starter_code=template.get("starter_code"),
            rubric=template["rubric"],
            hints=template["hints"],
            difficulty=difficulty,
            estimated_hours=estimated_hours,
            expertise_level=profile.expertise_level,
            required_resources=template.get("required_resources", []),
            optional_resources=template.get("optional_resources", [])
        )
        
        return assignment
    
    def _get_assignment_templates(self) -> Dict[str, Dict]:
        """Get assignment templates for specific concepts."""
        return {
            "Markov Decision Process": {
                "title": "Build a Grid World MDP Solver",
                "description": "Implement a Markov Decision Process for a grid world navigation problem. Model states, actions, transitions, and rewards.",
                "objectives": [
                    "Define MDP components (S, A, T, R, γ)",
                    "Implement state transition function",
                    "Calculate expected rewards",
                    "Validate Markov property"
                ],
                "instructions": """
# Grid World MDP Assignment

## Setup
Create a 5x5 grid world where an agent must navigate from start to goal.

## Requirements
1. Define the state space (25 states)
2. Define action space (up, down, left, right)
3. Implement transition function P(s'|s,a)
4. Design reward function (+10 goal, -1 per step, -10 obstacles)
5. Set discount factor γ = 0.9

## Deliverables
- Complete Python implementation
- Visualization of grid world
- Documentation explaining MDP components
- Test cases validating transitions

## Bonus
- Add stochastic transitions (slippery floor)
- Implement policy visualization
""",
                "starter_code": """
import numpy as np

class GridWorldMDP:
    def __init__(self, size=5):
        self.size = size
        self.states = [(i, j) for i in range(size) for j in range(size)]
        self.actions = ['up', 'down', 'left', 'right']
        self.gamma = 0.9
        
        # TODO: Define start, goal, obstacles
        self.start = (0, 0)
        self.goal = (4, 4)
        self.obstacles = [(2, 2), (3, 2)]
    
    def transition(self, state, action):
        \"\"\"Return next state given current state and action.\"\"\"
        # TODO: Implement transition function
        pass
    
    def reward(self, state, action, next_state):
        \"\"\"Return reward for transition.\"\"\"
        # TODO: Implement reward function
        pass
    
    def is_terminal(self, state):
        \"\"\"Check if state is terminal.\"\"\"
        return state == self.goal

# TODO: Complete implementation
""",
                "rubric": {
                    "MDP Definition (20%)": "All components (S, A, T, R, γ) clearly defined",
                    "Transition Function (20%)": "Correct state transitions for all actions",
                    "Reward Function (20%)": "Appropriate rewards that encourage goal-reaching",
                    "Code Quality (15%)": "Clean, documented, tested code",
                    "Markov Property (15%)": "Demonstrates understanding of memorylessness",
                    "Visualization (10%)": "Clear visualization of grid world and policy"
                },
                "hints": [
                    "Start by drawing the grid world on paper",
                    "Test your transition function with edge cases (walls, corners)",
                    "Verify that rewards sum to reasonable values",
                    "Use numpy for efficient state representation"
                ],
                "base_hours": 3,
                "required_resources": ["Python 3.8+", "numpy", "matplotlib"],
                "optional_resources": ["gym library for reference"]
            },
            
            "Q-Learning": {
                "title": "Implement Q-Learning for CartPole",
                "description": "Build a Q-Learning agent that learns to balance a pole on a cart using the OpenAI Gym environment.",
                "objectives": [
                    "Implement Q-table or Q-function approximation",
                    "Use epsilon-greedy exploration",
                    "Tune hyperparameters (α, γ, ε)",
                    "Evaluate learning progress"
                ],
                "instructions": """
# Q-Learning CartPole Assignment

## Objective
Train an agent to balance a pole using Q-Learning.

## Tasks
1. Set up OpenAI Gym CartPole-v1 environment
2. Implement Q-learning algorithm
3. Use epsilon-greedy exploration
4. Track learning curves (episode rewards vs time)
5. Achieve average reward > 195 over 100 episodes

## Hyperparameters to Tune
- Learning rate α: [0.001, 0.01, 0.1]
- Discount factor γ: [0.9, 0.95, 0.99]
- Exploration rate ε: start=1.0, decay=0.995, min=0.01

## Deliverables
- Q-learning implementation
- Training script with logging
- Learning curves plot
- Analysis of hyperparameter effects
- Video of trained agent

## Evaluation Criteria
- Does agent learn to balance pole?
- How quickly does it converge?
- How stable is the learned policy?
""",
                "starter_code": """
import gym
import numpy as np
import matplotlib.pyplot as plt

class QLearningAgent:
    def __init__(self, state_dim, action_dim, alpha=0.1, gamma=0.99, epsilon=1.0):
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon
        self.q_table = {}  # or use function approximation
        
    def get_action(self, state):
        \"\"\"Epsilon-greedy action selection.\"\"\"
        # TODO: Implement
        pass
    
    def update(self, state, action, reward, next_state):
        \"\"\"Q-learning update rule.\"\"\"
        # TODO: Implement Q(s,a) = Q(s,a) + α[r + γ max Q(s',a') - Q(s,a)]
        pass
    
    def train(self, env, num_episodes=1000):
        \"\"\"Training loop.\"\"\"
        # TODO: Implement
        pass

# TODO: Complete implementation and run experiments
""",
                "rubric": {
                    "Q-Learning Implementation (30%)": "Correct update rule and exploration",
                    "Convergence (25%)": "Agent achieves target performance",
                    "Hyperparameter Tuning (15%)": "Systematic exploration of parameters",
                    "Analysis (20%)": "Clear plots and interpretation",
                    "Code Quality (10%)": "Clean, modular, documented"
                },
                "hints": [
                    "Start with discrete state space (bin continuous values)",
                    "Monitor Q-value changes to verify learning",
                    "Plot epsilon decay to ensure proper exploration-exploitation balance",
                    "Save checkpoints during training"
                ],
                "base_hours": 4,
                "required_resources": ["Python 3.8+", "gym", "numpy", "matplotlib"],
                "optional_resources": ["stable-baselines3 for comparison"]
            },
            
            "Neural Networks": {
                "title": "Build a Neural Network from Scratch",
                "description": "Implement a multi-layer perceptron with backpropagation without using deep learning libraries.",
                "objectives": [
                    "Implement forward propagation",
                    "Implement backpropagation",
                    "Train on MNIST digits",
                    "Achieve >90% accuracy"
                ],
                "instructions": """
# Neural Network from Scratch

## Goal
Build a 2-layer neural network using only NumPy.

## Architecture
- Input: 784 (28x28 images)
- Hidden: 128 neurons with ReLU
- Output: 10 neurons with Softmax

## Requirements
1. Implement forward pass
2. Implement backward pass (gradients)
3. Implement SGD optimizer
4. Train on MNIST
5. Visualize learning curves
6. Test on validation set

## Deliverables
- Neural network class
- Training script
- Accuracy curves (train + validation)
- Confusion matrix
- Analysis of learned representations

## Bonus
- Add momentum or Adam optimizer
- Implement dropout for regularization
- Visualize hidden layer activations
""",
                "starter_code": """
import numpy as np

class NeuralNetwork:
    def __init__(self, input_size, hidden_size, output_size):
        # Initialize weights with He initialization
        self.W1 = np.random.randn(input_size, hidden_size) * np.sqrt(2/input_size)
        self.b1 = np.zeros((1, hidden_size))
        self.W2 = np.random.randn(hidden_size, output_size) * np.sqrt(2/hidden_size)
        self.b2 = np.zeros((1, output_size))
    
    def relu(self, x):
        return np.maximum(0, x)
    
    def relu_derivative(self, x):
        return (x > 0).astype(float)
    
    def softmax(self, x):
        exp_x = np.exp(x - np.max(x, axis=1, keepdims=True))
        return exp_x / np.sum(exp_x, axis=1, keepdims=True)
    
    def forward(self, X):
        \"\"\"Forward propagation.\"\"\"
        # TODO: Implement
        pass
    
    def backward(self, X, y, learning_rate):
        \"\"\"Backpropagation and weight update.\"\"\"
        # TODO: Implement
        pass
    
    def train(self, X_train, y_train, X_val, y_val, epochs, batch_size):
        \"\"\"Training loop with mini-batch SGD.\"\"\"
        # TODO: Implement
        pass

# TODO: Load MNIST, train network, evaluate
""",
                "rubric": {
                    "Forward Pass (20%)": "Correct matrix operations and activations",
                    "Backward Pass (30%)": "Correct gradient computation",
                    "Training (20%)": "Proper mini-batch SGD implementation",
                    "Performance (15%)": "Achieves >90% validation accuracy",
                    "Analysis (15%)": "Learning curves and insights"
                },
                "hints": [
                    "Verify gradients using numerical gradient checking",
                    "Start with small network to debug faster",
                    "Monitor loss - should decrease smoothly",
                    "Use vectorized operations for speed"
                ],
                "base_hours": 5,
                "required_resources": ["Python 3.8+", "numpy", "mnist dataset"],
                "optional_resources": ["scikit-learn for data loading"]
            }
        }
    
    def _generate_generic_assignment(
        self, 
        concept: str, 
        assignment_type: AssignmentType
    ) -> Dict:
        """Generate a generic assignment for concepts without templates."""
        if assignment_type == AssignmentType.CODING:
            return {
                "title": f"Implement {concept}",
                "description": f"Build a working implementation of {concept} demonstrating your understanding.",
                "objectives": [
                    f"Understand core principles of {concept}",
                    "Implement from scratch or using libraries",
                    "Test with real examples",
                    "Document your approach"
                ],
                "instructions": f"Create a complete implementation of {concept}. Include tests, documentation, and examples.",
                "starter_code": f"# TODO: Implement {concept}\n\nclass {concept.replace(' ', '')}:\n    pass\n",
                "rubric": {
                    "Implementation": "Working code",
                    "Testing": "Comprehensive tests",
                    "Documentation": "Clear explanations"
                },
                "hints": [f"Review the {concept} theory", "Start simple, then add complexity"],
                "base_hours": 3
            }
        else:
            return {
                "title": f"Explore {concept}",
                "description": f"Research and analyze {concept} in depth.",
                "objectives": [f"Master {concept}", "Apply to real scenarios"],
                "instructions": f"Complete a project demonstrating {concept}.",
                "rubric": {"Understanding": "Depth of knowledge"},
                "hints": ["Be thorough"],
                "base_hours": 2
            }
    
    def _calculate_difficulty(self, expertise: ExpertiseLevel) -> float:
        """Calculate assignment difficulty based on expertise level."""
        difficulty_map = {
            ExpertiseLevel.ABSOLUTE_BEGINNER: 0.2,
            ExpertiseLevel.BEGINNER: 0.4,
            ExpertiseLevel.INTERMEDIATE: 0.6,
            ExpertiseLevel.ADVANCED: 0.8,
            ExpertiseLevel.EXPERT: 0.95
        }
        return difficulty_map.get(expertise, 0.5)
