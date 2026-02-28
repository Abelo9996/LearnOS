"""
Content Generation Agent - Generate educational content using LLMs
"""

from agents.base import Agent
from llm_manager import llm_manager
from llm_providers import LLMRequest, LLMResponse, ModelCapability
from typing import Dict, Any, List
import json


class ContentGenerationAgent(Agent):
    """
    Generates high-quality educational content tailored to learning goals.
    Uses LLM to create:
    - Explanations with analogies
    - Code examples
    - Diagrams in Mermaid format
    - Interactive questions
    - Real-world applications
    """
    
    def __init__(self):
        super().__init__(role="Content Generator")
    
    async def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate educational content for a concept
        
        Inputs:
        - user_id: str
        - concept: str
        - difficulty: float (0-1)
        - style: str (visual, textual, interactive, code-focused)
        - prerequisites: List[str]
        - context: Dict
        
        Outputs:
        - explanation: str
        - analogies: List[str]
        - examples: List[str]
        - code_sample: Optional[str]
        - diagram: Optional[str]
        - interactive_question: str
        - real_world_applications: List[str]
        """
        
        user_id = inputs.get("user_id", "demo_user")
        concept = inputs.get("concept")
        difficulty = inputs.get("difficulty", 0.5)
        style = inputs.get("style", "balanced")
        prerequisites = inputs.get("prerequisites", [])
        
        if not concept:
            raise ValueError("Concept is required")
        
        # Build context-aware system prompt
        system_prompt = self._build_system_prompt(difficulty, style, prerequisites)
        
        # Generate main explanation
        explanation_response = await self._generate_explanation(
            user_id, concept, system_prompt, difficulty, prerequisites
        )
        
        # Generate supplementary content in parallel
        analogies = await self._generate_analogies(user_id, concept, explanation_response, difficulty)
        examples = await self._generate_examples(user_id, concept, explanation_response, difficulty)
        code_sample = await self._generate_code_sample(user_id, concept, explanation_response)
        diagram = await self._generate_diagram(user_id, concept, explanation_response)
        interactive_q = await self._generate_interactive_question(user_id, concept, explanation_response, difficulty)
        applications = await self._generate_applications(user_id, concept, explanation_response)
        
        return {
            "concept": concept,
            "explanation": explanation_response.content,
            "analogies": analogies,
            "examples": examples,
            "code_sample": code_sample,
            "diagram": diagram,
            "interactive_question": interactive_q,
            "real_world_applications": applications,
            "metadata": {
                "generated_by": "llm_manager",
                "model_used": explanation_response.model,
                "tokens_used": explanation_response.total_tokens,
                "cost": explanation_response.cost_dollars
            }
        }
    
    def _build_system_prompt(self, difficulty: float, style: str, prerequisites: List[str]) -> str:
        """Build a context-aware system prompt"""
        
        difficulty_level = "beginner" if difficulty < 0.3 else "intermediate" if difficulty < 0.7 else "advanced"
        
        prerequisite_context = ""
        if prerequisites:
            prerequisite_context = f"\nAssume the learner understands: {', '.join(prerequisites)}"
        
        style_instruction = {
            "visual": "Focus on visual descriptions and spatial reasoning. Use ASCII diagrams when helpful.",
            "textual": "Use clear, narrative explanations with proper examples.",
            "interactive": "Make the explanation interactive with questions and moments for learner reflection.",
            "code-focused": "Emphasize code examples and implementation details.",
            "balanced": "Balance conceptual understanding with practical examples."
        }.get(style, "Provide a balanced explanation.")
        
        return f"""You are an expert educator creating learning materials for {difficulty_level} learners.
{prerequisite_context}

Teaching style: {style_instruction}

Your content should:
1. Be clear, engaging, and accurate
2. Use metaphors and analogies to clarify complex concepts
3. Include practical examples
4. Build on existing knowledge
5. Anticipate common misconceptions and address them
6. Be concise but comprehensive"""
    
    async def _generate_explanation(self, user_id: str, concept: str, system_prompt: str, difficulty: float, prerequisites: List[str]) -> LLMResponse:
        """Generate the main explanation"""
        
        user_context = f"Prerequisites: {', '.join(prerequisites)}" if prerequisites else ""
        
        request = LLMRequest(
            system_prompt=system_prompt,
            user_prompt=f"""Generate a comprehensive but concise explanation of "{concept}" for {difficulty*100:.0f}% difficulty level.

{user_context}

The explanation should:
- Start with a clear definition
- Build conceptual understanding gradually
- Include 2-3 key insights
- Address common misconceptions
- Be 3-5 paragraphs maximum

Focus on conceptual understanding, not just definitions.""",
            task_type="content_generation"
        )
        
        return await llm_manager.generate(user_id, request, ModelCapability.CONTENT_GENERATION)
    
    async def _generate_analogies(self, user_id: str, concept: str, explanation: LLMResponse, difficulty: float) -> List[str]:
        """Generate helpful analogies"""
        
        request = LLMRequest(
            system_prompt="You are an expert at creating memorable analogies and metaphors for complex concepts.",
            user_prompt=f"""Given this explanation of "{concept}":

{explanation.content}

Generate 3 clear, memorable analogies that help understand this concept.
Each analogy should:
- Relate to everyday experiences
- Clarify a specific aspect of the concept
- Be easy to remember

Return as a JSON list of strings. Example: ["analogy1", "analogy2", "analogy3"]""",
            task_type="content_generation",
            extra_params={"temperature": 0.8}  # More creative
        )
        
        try:
            response = await llm_manager.generate(user_id, request, ModelCapability.EXPLANATION)
            # Parse JSON response
            analogies_str = response.content.strip()
            if analogies_str.startswith("["):
                return json.loads(analogies_str)
            return [response.content]
        except:
            return []
    
    async def _generate_examples(self, user_id: str, concept: str, explanation: LLMResponse, difficulty: float) -> List[str]:
        """Generate concrete examples"""
        
        request = LLMRequest(
            system_prompt="You are an expert at creating concrete, relatable examples that illustrate concepts.",
            user_prompt=f"""Given this explanation of "{concept}":

{explanation.content}

Generate 3 concrete examples that illustrate this concept in practice.
Each example should:
- Be realistic and relatable
- Highlight a different aspect of the concept
- Be at {difficulty*100:.0f}% difficulty level

Return as a JSON list of strings.""",
            task_type="content_generation"
        )
        
        try:
            response = await llm_manager.generate(user_id, request, ModelCapability.EXPLANATION)
            examples_str = response.content.strip()
            if examples_str.startswith("["):
                return json.loads(examples_str)
            return [response.content]
        except:
            return []
    
    async def _generate_code_sample(self, user_id: str, concept: str, explanation: LLMResponse) -> str:
        """Generate code sample if applicable"""
        
        request = LLMRequest(
            system_prompt="You are an expert programmer. Write clean, well-commented code examples.",
            user_prompt=f"""Given this concept:

{explanation.content}

If this concept has a code implementation, write a concise, well-commented Python code example (under 30 lines).
If the concept is not programming-related, respond with "N/A".""",
            task_type="content_generation"
        )
        
        try:
            response = await llm_manager.generate(user_id, request, ModelCapability.CODE_REVIEW)
            return response.content if "N/A" not in response.content else None
        except:
            return None
    
    async def _generate_diagram(self, user_id: str, concept: str, explanation: LLMResponse) -> str:
        """Generate a Mermaid diagram"""
        
        request = LLMRequest(
            system_prompt="You are an expert at creating Mermaid diagrams to visualize concepts. Return only valid Mermaid syntax.",
            user_prompt=f"""Create a Mermaid diagram that visualizes this concept:

{explanation.content}

The diagram should help learners understand the key relationships and components.
Use graph, flowchart, or sequence diagram format as appropriate.""",
            task_type="content_generation"
        )
        
        try:
            response = await llm_manager.generate(user_id, request, ModelCapability.CONTENT_GENERATION)
            return response.content if "graph" in response.content.lower() or "flowchart" in response.content.lower() else None
        except:
            return None
    
    async def _generate_interactive_question(self, user_id: str, concept: str, explanation: LLMResponse, difficulty: float) -> str:
        """Generate an interactive question to test understanding"""
        
        request = LLMRequest(
            system_prompt="You are an expert at creating thought-provoking questions that test deep understanding, not memorization.",
            user_prompt=f"""Based on this concept:

{explanation.content}

Create a single question that tests if a learner truly understands this concept at {difficulty*100:.0f}% difficulty.
The question should:
- Require application or analysis, not just recall
- Be answerable with the given information
- Reveal common misconceptions if the answer is wrong""",
            task_type="content_generation"
        )
        
        try:
            response = await llm_manager.generate(user_id, request, ModelCapability.EVALUATION)
            return response.content
        except:
            return f"What is an important application of {concept}?"
    
    async def _generate_applications(self, user_id: str, concept: str, explanation: LLMResponse) -> List[str]:
        """Generate real-world applications"""
        
        request = LLMRequest(
            system_prompt="You are an expert at identifying real-world applications of concepts.",
            user_prompt=f"""For this concept:

{explanation.content}

Generate 3 concrete real-world applications or use cases.
Each application should be:
- Realistic and verifiable
- Interesting to learners
- Demonstrating practical value

Return as a JSON list of strings.""",
            task_type="content_generation"
        )
        
        try:
            response = await llm_manager.generate(user_id, request, ModelCapability.CONTENT_GENERATION)
            apps_str = response.content.strip()
            if apps_str.startswith("["):
                return json.loads(apps_str)
            return [response.content]
        except:
            return []
