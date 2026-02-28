"""
Adaptive Test Generation Agent - Create personalized assessments using LLMs
"""

from agents.base import Agent
from llm_manager import llm_manager
from llm_providers import LLMRequest, ModelCapability
from typing import Dict, Any, List, Optional
import json


class TestGenerationAgent(Agent):
    """
    Generates adaptive, personalized tests and assessments.
    Features:
    - Multiple question types (multiple choice, short answer, essay)
    - Difficulty adaptation based on learner performance
    - Misconception-targeting questions
    - Rubrics for grading
    - Item analysis
    """
    
    def __init__(self):
        super().__init__(role="Test Generator")
    
    async def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate an adaptive test for a concept
        
        Inputs:
        - user_id: str
        - concept: str
        - difficulty: float (0-1, adjusted based on performance)
        - learner_history: Dict (previous answers, misconceptions)
        - question_count: int (default 5)
        - question_types: List[str] (multiple_choice, short_answer, essay)
        - include_rubric: bool
        
        Outputs:
        - questions: List[Dict]
        - rubric: Optional[Dict]
        - estimated_time_minutes: int
        - metadata: Dict
        """
        
        user_id = inputs.get("user_id", "demo_user")
        concept = inputs.get("concept")
        difficulty = inputs.get("difficulty", 0.5)
        learner_history = inputs.get("learner_history", {})
        question_count = inputs.get("question_count", 5)
        question_types = inputs.get("question_types", ["multiple_choice", "short_answer"])
        include_rubric = inputs.get("include_rubric", True)
        
        if not concept:
            raise ValueError("Concept is required")
        
        # Adapt difficulty based on learner history
        adapted_difficulty = self._adapt_difficulty(difficulty, learner_history)
        
        # Generate questions
        questions = await self._generate_questions(
            user_id, concept, adapted_difficulty, question_count, question_types, learner_history
        )
        
        # Generate rubric if needed
        rubric = None
        if include_rubric:
            rubric = await self._generate_rubric(user_id, concept, questions)
        
        # Estimate time
        time_estimate = len(questions) * 2 + (5 if any(q["type"] == "essay" for q in questions) else 0)
        
        return {
            "concept": concept,
            "questions": questions,
            "rubric": rubric,
            "estimated_time_minutes": time_estimate,
            "difficulty": adapted_difficulty,
            "metadata": {
                "total_questions": len(questions),
                "question_types": [q["type"] for q in questions],
                "generated_by": "llm_manager"
            }
        }
    
    def _adapt_difficulty(self, base_difficulty: float, learner_history: Dict) -> float:
        """Adjust difficulty based on learner performance"""
        
        if not learner_history:
            return base_difficulty
        
        recent_performance = learner_history.get("recent_performance", 0.5)
        misconceptions_count = len(learner_history.get("misconceptions", []))
        
        # If learner is doing well, increase difficulty
        if recent_performance > 0.8:
            adjusted = min(base_difficulty + 0.2, 1.0)
        # If learner is struggling, decrease difficulty
        elif recent_performance < 0.5:
            adjusted = max(base_difficulty - 0.2, 0.0)
        else:
            adjusted = base_difficulty
        
        # Target misconceptions more aggressively
        if misconceptions_count > 2:
            adjusted = max(adjusted - 0.1, 0.0)
        
        return adjusted
    
    async def _generate_questions(
        self,
        user_id: str,
        concept: str,
        difficulty: float,
        question_count: int,
        question_types: List[str],
        learner_history: Dict
    ) -> List[Dict]:
        """Generate test questions"""
        
        misconceptions = learner_history.get("misconceptions", [])
        misconception_context = ""
        if misconceptions:
            misconception_context = f"\nAddress these common misconceptions: {', '.join(misconceptions)}"
        
        system_prompt = f"""You are an expert test designer creating assessment questions for {difficulty*100:.0f}% difficulty.
Questions should:
- Test deep understanding, not memorization
- Be clear and unambiguous
- Have a clear, defensible answer key
- Include distractors that reveal misconceptions{misconception_context}"""
        
        # Distribute questions across types
        type_distribution = self._distribute_question_types(question_types, question_count)
        
        all_questions = []
        
        for q_type, count in type_distribution.items():
            request = LLMRequest(
                system_prompt=system_prompt,
                user_prompt=self._build_question_prompt(concept, q_type, count, difficulty, learner_history),
                task_type="test_generation"
            )
            
            response = await llm_manager.generate(user_id, request, ModelCapability.TEST_GENERATION)
            questions = self._parse_questions(response.content, q_type)
            all_questions.extend(questions)
        
        return all_questions[:question_count]
    
    def _distribute_question_types(self, types: List[str], total: int) -> Dict[str, int]:
        """Distribute questions across types"""
        
        if not types:
            types = ["multiple_choice", "short_answer"]
        
        distribution = {}
        per_type = total // len(types)
        
        for i, q_type in enumerate(types):
            if i == len(types) - 1:
                # Last type gets remainder
                distribution[q_type] = total - (per_type * (len(types) - 1))
            else:
                distribution[q_type] = per_type
        
        return distribution
    
    def _build_question_prompt(
        self,
        concept: str,
        question_type: str,
        count: int,
        difficulty: float,
        learner_history: Dict
    ) -> str:
        """Build prompt for generating questions of a specific type"""
        
        misconceptions = learner_history.get("misconceptions", [])
        misconception_instruction = ""
        if misconceptions:
            misconception_instruction = f"\nSpecific misconceptions to target: {', '.join(misconceptions)}"
        
        templates = {
            "multiple_choice": f"""Generate {count} high-quality multiple-choice questions about "{concept}".
For each question:
- State the question clearly
- Provide 4 plausible options (A, B, C, D)
- Mark the correct answer with [CORRECT]
- Make distractors based on common misconceptions

Format each question as:
Q: [question text]
A) [option]
B) [option]
C) [option] [CORRECT]
D) [option]
---
{misconception_instruction}""",

            "short_answer": f"""Generate {count} short-answer questions about "{concept}".
For each question:
- Ask for a specific, concise answer (1-3 sentences)
- Provide key points for the answer key
- Difficulty: {difficulty*100:.0f}%

Format each question as:
Q: [question text]
ANSWER_KEY: [2-3 key points or facts]
---
{misconception_instruction}""",

            "essay": f"""Generate {count} essay questions about "{concept}".
For each question:
- Require application or analysis, not just recall
- Provide a grading rubric with 3-4 criteria
- Difficulty: {difficulty*100:.0f}%

Format each question as:
Q: [question text]
RUBRIC:
- Criterion 1: [description]
- Criterion 2: [description]
- Criterion 3: [description]
---
{misconception_instruction}"""
        }
        
        return templates.get(question_type, templates["multiple_choice"])
    
    def _parse_questions(self, response_text: str, question_type: str) -> List[Dict]:
        """Parse LLM response into structured questions"""
        
        questions = []
        
        if question_type == "multiple_choice":
            questions = self._parse_multiple_choice(response_text)
        elif question_type == "short_answer":
            questions = self._parse_short_answer(response_text)
        elif question_type == "essay":
            questions = self._parse_essay(response_text)
        
        return questions
    
    def _parse_multiple_choice(self, text: str) -> List[Dict]:
        """Parse multiple choice questions"""
        
        questions = []
        blocks = text.split("---")
        
        for block in blocks:
            lines = block.strip().split("\n")
            if len(lines) < 5:
                continue
            
            question_text = lines[0].replace("Q:", "").strip()
            options = {}
            answer_key = None
            
            for line in lines[1:]:
                line = line.strip()
                if line.startswith(("A)", "B)", "C)", "D)")):
                    letter = line[0]
                    option_text = line[3:]
                    
                    if "[CORRECT]" in option_text:
                        option_text = option_text.replace("[CORRECT]", "").strip()
                        answer_key = letter
                    
                    options[letter] = option_text
            
            if question_text and len(options) == 4 and answer_key:
                questions.append({
                    "type": "multiple_choice",
                    "text": question_text,
                    "options": options,
                    "answer_key": answer_key
                })
        
        return questions
    
    def _parse_short_answer(self, text: str) -> List[Dict]:
        """Parse short answer questions"""
        
        questions = []
        blocks = text.split("---")
        
        for block in blocks:
            lines = [l.strip() for l in block.strip().split("\n") if l.strip()]
            if len(lines) < 2:
                continue
            
            question_text = lines[0].replace("Q:", "").strip()
            
            # Find ANSWER_KEY line
            answer_key_line = None
            for line in lines[1:]:
                if line.startswith("ANSWER_KEY:"):
                    answer_key_line = line.replace("ANSWER_KEY:", "").strip()
                    break
            
            if question_text and answer_key_line:
                questions.append({
                    "type": "short_answer",
                    "text": question_text,
                    "answer_key": answer_key_line,
                    "rubric": ["Addresses the main point", "Uses clear language", "Shows understanding"]
                })
        
        return questions
    
    def _parse_essay(self, text: str) -> List[Dict]:
        """Parse essay questions"""
        
        questions = []
        blocks = text.split("---")
        
        for block in blocks:
            lines = [l.strip() for l in block.strip().split("\n") if l.strip()]
            if len(lines) < 2:
                continue
            
            question_text = lines[0].replace("Q:", "").strip()
            
            # Find RUBRIC section
            rubric = []
            rubric_start = False
            for line in lines[1:]:
                if line.startswith("RUBRIC:"):
                    rubric_start = True
                    continue
                if rubric_start:
                    if line.startswith("-"):
                        rubric.append(line[1:].strip())
            
            if question_text:
                questions.append({
                    "type": "essay",
                    "text": question_text,
                    "rubric": rubric or ["Understanding of concept", "Application of knowledge", "Quality of analysis", "Clarity of explanation"]
                })
        
        return questions
    
    async def _generate_rubric(self, user_id: str, concept: str, questions: List[Dict]) -> Dict:
        """Generate a comprehensive grading rubric"""
        
        question_summary = "\n".join([f"- {q['text'][:80]}..." for q in questions[:3]])
        
        request = LLMRequest(
            system_prompt="You are an expert in educational assessment and rubric design.",
            user_prompt=f"""Create a comprehensive grading rubric for assessing {concept} understanding.

Sample questions to be graded:
{question_summary}

Provide a rubric with:
1. Clear scoring levels (Exemplary, Proficient, Developing, Beginning)
2. Criteria (typically 3-5)
3. Point values for each level

Return as JSON:
{{"criteria": [{{"name": "...", "description": "...", "exemplary": 4, "proficient": 3, "developing": 2, "beginning": 1}}]}}""",
            task_type="evaluation"
        )
        
        try:
            response = await llm_manager.generate(user_id, request, ModelCapability.EVALUATION)
            rubric_str = response.content
            # Try to extract JSON
            if "{" in rubric_str:
                start = rubric_str.index("{")
                end = rubric_str.rindex("}") + 1
                return json.loads(rubric_str[start:end])
            return {"criteria": []}
        except:
            return {"criteria": []}
