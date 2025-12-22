# LearnOS

**A production-grade, agentic learning operating system.**

LearnOS is an AI-native learning platform that converts high-level learning goals into structured concept dependency graphs, actively adapts to learner understanding, and forces mastery through explanation and application—not passive consumption.

This is not a chatbot or tutorial system. It's an extensible platform designed for startup-scale production use.

---

## Architecture Overview

LearnOS implements a **modular, agent-based architecture** with strict separation of concerns.

### Backend
- **Framework**: FastAPI (async-first)
- **Language**: Python 3.10+
- **Models**: Pydantic (typed)
- **Storage**: In-memory (extensible to PostgreSQL/MongoDB)

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **UI Philosophy**: Minimal, professional, calm

### Agent System
Each agent has a clearly defined:
- **Role**: Specific responsibility in the learning system
- **Inputs**: Typed input schema
- **Outputs**: Typed output schema
- **Memory**: Short-term and long-term state
- **Decision Logic**: Domain-specific processing

---

## Core Agents

### 1. **Goal Decomposition Agent**
**Purpose**: Converts high-level goals into structured concept dependency graphs (DAG)

**Input**:
```python
{"goal": "Learn reinforcement learning well enough to build agents"}
```

**Output**:
- Concept dependency graph with prerequisites
- Difficulty scores (0-1)
- Estimated time per concept
- Common misconceptions
- Transfer tests

**Location**: `backend/agents/goal_decomposition.py`

---

### 2. **Concept Graph Engine**
**Purpose**: Manages concept metadata, validates prerequisites, tracks mastery

**Responsibilities**:
- Determine available vs. blocked concepts
- Select next optimal concept
- Validate prerequisite completion
- Track progress metrics

**Location**: `backend/agents/concept_graph_engine.py`

---

### 3. **Learning Orchestrator Agent**
**Purpose**: Decides what to teach, how deep to go, and which modality to use

**Modalities**:
- Text explanation
- Code example
- Interactive question
- Diagram (extensible)

**Adaptation**: Adjusts based on attempts, confidence, and performance signals

**Location**: `backend/agents/learning_orchestrator.py`

---

### 4. **Attention & Adaptation Agent**
**Purpose**: Monitors learner signals and triggers interventions

**Monitors**:
- Response times (slow/fast)
- Accuracy trends
- Skip patterns
- Confusion signals

**Adaptations**:
- Switch modality
- Shorten content
- Force retrieval
- Introduce analogy
- Add scaffolding

**Runs**: After every learner interaction

**Location**: `backend/agents/attention_adaptation.py`

---

### 5. **Socratic Evaluation Agent**
**Purpose**: Evaluates understanding through reasoning, not multiple choice

**Evaluation Criteria**:
- Depth of explanation
- Use of reasoning indicators ("because", "therefore")
- Concrete examples
- Avoidance of vague language

**Progression**: Blocked until reasoning quality exceeds threshold (default: 0.7)

**Location**: `backend/agents/socratic_evaluation.py`

---

## Learning Loop

Every concept follows this mandatory loop:

```
1. Micro-explanation (≤3 minutes)
   ↓
2. Concrete example
   ↓
3. Active recall question
   ↓
4. Transfer challenge
   ↓
5. Socratic evaluation
   ↓
   ├─ Passed → Next concept
   └─ Failed → Adapt and retry
```

**No passive consumption. No fake progress.**

---

## API Endpoints

### POST `/api/goal`
Create a learning goal and generate concept graph

**Request**:
```json
{
  "goal": "Learn reinforcement learning",
  "user_id": "demo_user"
}
```

**Response**:
```json
{
  "goal_id": "uuid",
  "graph_id": "uuid",
  "graph": { "ConceptGraph": "..." },
  "concepts": ["MDP", "Value Functions", "..."]
}
```

---

### GET `/api/graph/{goal_id}`
Retrieve concept graph for a goal

**Response**:
```json
{
  "graph": {
    "nodes": { "concept_name": "ConceptNode" },
    "edges": [["prereq", "concept"]]
  },
  "goal": "Learn reinforcement learning"
}
```

---

### POST `/api/session/start`
Start a new learning session

**Request**:
```json
{
  "goal_id": "uuid",
  "user_id": "demo_user"
}
```

**Response**:
```json
{
  "session_id": "uuid",
  "first_concept": "Markov Decision Process",
  "content": "LearningContent",
  "progress": 0
}
```

---

### POST `/api/session/interact`
Submit learner response and get next content

**Request**:
```json
{
  "session_id": "uuid",
  "response": "MDP is a framework for modeling sequential decision making..."
}
```

**Response** (if not passed):
```json
{
  "passed": false,
  "feedback": "Good start. To strengthen your answer...",
  "follow_up_question": "Why is MDP important?",
  "adaptation_applied": "introduce_analogy",
  "next_content": "LearningContent",
  "reasoning_quality": 0.62
}
```

**Response** (if mastered):
```json
{
  "concept_mastered": true,
  "new_concept": "Value Functions",
  "next_content": "LearningContent",
  "progress_percentage": 14.3
}
```

---

### GET `/api/session/state`
Get current session state

**Query Params**: `session_id`

**Response**:
```json
{
  "session_id": "uuid",
  "current_concept": "Value Functions",
  "progress_percentage": 14.3,
  "mastered_concepts": ["Markov Decision Process"],
  "next_content": "LearningContent"
}
```

---

### GET `/api/progress`
Get detailed progress for a goal

**Query Params**: `user_id`, `goal_id`

**Response**:
```json
{
  "goal": "Learn reinforcement learning",
  "progress_percentage": 42.8,
  "mastered_concepts": ["MDP", "Value Functions", "Bellman Equations"],
  "available_concepts": ["Q-Learning"],
  "blocked_concepts": { "DQN": ["Neural Networks"] },
  "engagement_score": 0.83,
  "concept_details": ["ConceptDetail"]
}
```

---

## Data Models

All models are in `backend/models.py`:

- **User**: User profile and goals
- **LearningGoal**: User's learning objective
- **ConceptNode**: Single concept with metadata
- **ConceptGraph**: Full dependency graph (DAG)
- **LearningSession**: Active learning session
- **InteractionEvent**: Single learner interaction
- **MasteryState**: Mastery tracking per concept
- **LearningContent**: Content delivered to learner
- **SessionState**: Current session snapshot

---

## Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server
python main.py
```

Backend runs on `http://localhost:8000`

API docs: `http://localhost:8000/docs`

---

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend runs on `http://localhost:3000`

---

## Demo Mode (Out-of-the-Box)

1. Start backend: `cd backend && python main.py`
2. Start frontend: `cd frontend && npm run dev`
3. Navigate to `http://localhost:3000`
4. Enter a learning goal (e.g., "Learn reinforcement learning well enough to build agents")
5. System generates concept graph automatically
6. Click "Begin Learning"
7. First learning loop begins immediately

**No authentication required for demo.**

---

## Project Structure

```
LearnOS/
├── backend/
│   ├── main.py                 # FastAPI app entry point
│   ├── models.py               # Pydantic data models
│   ├── database.py             # In-memory database
│   ├── agents/
│   │   ├── base.py             # Base agent class
│   │   ├── goal_decomposition.py
│   │   ├── concept_graph_engine.py
│   │   ├── learning_orchestrator.py
│   │   ├── attention_adaptation.py
│   │   └── socratic_evaluation.py
│   ├── routers/
│   │   ├── goals.py            # /goal, /graph endpoints
│   │   ├── sessions.py         # /session/* endpoints
│   │   └── progress.py         # /progress endpoint
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Goal input page
│   │   ├── graph/[goalId]/
│   │   │   └── page.tsx        # Concept graph view
│   │   ├── learn/[sessionId]/
│   │   │   └── page.tsx        # Learning session
│   │   ├── progress/
│   │   │   └── page.tsx        # Progress dashboard
│   │   └── globals.css
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── next.config.js
│
└── README.md
```

---

## Extension Points

### Adding New Agents
1. Extend `agents/base.py::Agent`
2. Implement `async def process(inputs) -> outputs`
3. Define clear input/output schemas
4. Integrate into appropriate router

### Adding New Domains
1. Extend `goal_decomposition.py` with domain-specific concept trees
2. Add domain-specific examples and misconceptions
3. Update transfer tests

### Switching to LLM-based Generation
Replace hardcoded concept decomposition with LLM calls:
```python
# In goal_decomposition.py
async def _decompose_goal(self, goal: str):
    response = await llm_client.generate(
        prompt=f"Decompose learning goal into concept DAG: {goal}",
        schema=ConceptGraphSchema
    )
    return response.nodes
```

### Persistent Storage
Replace `database.py` with PostgreSQL/MongoDB:
- Models are already Pydantic (easy serialization)
- Add SQLAlchemy or Motor adapter
- Update `db.save_*` and `db.get_*` methods

---

## Design Principles

### ✅ What This Is
- Production-grade architecture
- Extensible agent system
- Mastery-focused learning
- Startup-ready codebase

### ❌ What This Is Not
- A chatbot wrapper
- A static course platform
- A gamified XP system
- A toy project

---

## Non-Goals (Explicitly Excluded)

- ❌ Generic chat UI
- ❌ Static pre-made courses
- ❌ Fake progress indicators
- ❌ Hardcoded learning paths
- ❌ Multiple-choice quizzes

---

## Code Quality Standards

This codebase is written to be:
- **Read by YC partners**: Clear, professional, no hacks
- **Forked by senior engineers**: Modular, well-documented
- **Extended into a company**: Scalable architecture

---

## Future Enhancements

Contributors can extend:
- **LLM Integration**: Replace hardcoded logic with GPT-4/Claude
- **Spaced Repetition**: Add forgetting curve tracking
- **Multi-User**: Add authentication and user isolation
- **Analytics**: Track learning patterns across users
- **Mobile**: React Native app using same API
- **Video Modality**: Add video explanations as content type
- **Collaborative Learning**: Peer explanation challenges

---

## Contributing

This is an open-source project designed for extensibility.

**Where to contribute**:
- New domain-specific concept trees
- Additional learning modalities
- Better evaluation heuristics
- LLM integration for concept generation
- Persistent storage adapters
- Test coverage

**Code style**:
- Type everything (Pydantic, TypeScript)
- Clear naming
- One responsibility per agent/component
- Document complex logic

---

## License

MIT License - See LICENSE file for details

---

## Contact

Built as a demonstration of production-grade agentic systems.

**This is LearnOS. A learning operating system, not a chatbot.**
