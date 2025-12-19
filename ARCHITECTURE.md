# LearnOS Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Goal Input   │  │ Graph View   │  │ Learn View   │         │
│  │ Page         │  │              │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐                                               │
│  │ Progress     │                                               │
│  │ Dashboard    │                                               │
│  └──────────────┘                                               │
│                                                                  │
└─────────────────┬────────────────────────────────────────────────┘
                  │ HTTP/REST API
                  │
┌─────────────────┴────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     API ROUTERS                          │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  /goal  │  /graph  │  /session/*  │  /progress         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    AGENT LAYER                           │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────┐    │   │
│  │  │  Goal Decomposition Agent                      │    │   │
│  │  │  ┌──────────────────────────────────────────┐ │    │   │
│  │  │  │ Input: Learning goal (text)              │ │    │   │
│  │  │  │ Output: Concept DAG with prerequisites   │ │    │   │
│  │  │  └──────────────────────────────────────────┘ │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────┐    │   │
│  │  │  Concept Graph Engine                          │    │   │
│  │  │  ┌──────────────────────────────────────────┐ │    │   │
│  │  │  │ Manages: Prerequisites, mastery state    │ │    │   │
│  │  │  │ Selects: Next optimal concept            │ │    │   │
│  │  │  └──────────────────────────────────────────┘ │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────┐    │   │
│  │  │  Learning Orchestrator Agent                   │    │   │
│  │  │  ┌──────────────────────────────────────────┐ │    │   │
│  │  │  │ Decides: Content depth, modality         │ │    │   │
│  │  │  │ Adapts: Based on performance signals     │ │    │   │
│  │  │  └──────────────────────────────────────────┘ │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────┐    │   │
│  │  │  Attention & Adaptation Agent                  │    │   │
│  │  │  ┌──────────────────────────────────────────┐ │    │   │
│  │  │  │ Monitors: Response time, accuracy        │ │    │   │
│  │  │  │ Triggers: Modality switch, scaffolding   │ │    │   │
│  │  │  └──────────────────────────────────────────┘ │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────┐    │   │
│  │  │  Socratic Evaluation Agent                     │    │   │
│  │  │  ┌──────────────────────────────────────────┐ │    │   │
│  │  │  │ Evaluates: Reasoning quality (not facts) │ │    │   │
│  │  │  │ Blocks: Until threshold (0.7) reached    │ │    │   │
│  │  │  └──────────────────────────────────────────┘ │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    DATA LAYER                            │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  Models:                                                 │   │
│  │  • User          • LearningGoal    • ConceptGraph       │   │
│  │  • ConceptNode   • LearningSession • InteractionEvent   │   │
│  │  • MasteryState                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘


                    LEARNING LOOP FLOW
                    ==================

                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                           ▼
               ┌───────────────────────┐
               │  Goal Decomposition   │
               │  Agent generates DAG  │
               └──────────┬────────────┘
                          │
                          ▼
               ┌───────────────────────┐
               │  Concept Graph Engine │
               │  selects next concept │
               └──────────┬────────────┘
                          │
           ┌──────────────┴──────────────┐
           │                             │
           ▼                             ▼
    ┌─────────────┐            ┌──────────────────┐
    │ New Concept │            │ Retry Concept    │
    └──────┬──────┘            │ (with adaptation)│
           │                   └────────┬─────────┘
           │                            │
           └────────────┬───────────────┘
                        │
                        ▼
           ┌────────────────────────┐
           │ Learning Orchestrator  │
           │ generates content      │
           └────────┬───────────────┘
                    │
                    ▼
           ┌────────────────────┐
           │ Learner Interacts  │
           │ (explains concept) │
           └────────┬───────────┘
                    │
                    ▼
           ┌────────────────────────┐
           │ Attention & Adaptation │
           │ analyzes signals       │
           └────────┬───────────────┘
                    │
                    ▼
           ┌────────────────────────┐
           │ Socratic Evaluation    │
           │ scores reasoning       │
           └────────┬───────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
    ┌─────────┐          ┌──────────┐
    │ PASSED  │          │ FAILED   │
    │ ≥ 0.7   │          │ < 0.7    │
    └────┬────┘          └─────┬────┘
         │                     │
         │                     └─────┐
         ▼                           │
    ┌─────────┐                      │
    │ Mark as │                      │
    │ Mastered│                      │
    └────┬────┘                      │
         │                           │
         └────────┬──────────────────┘
                  │
                  ▼
           ┌──────────────┐
           │ All concepts │
           │ mastered?    │
           └──────┬───────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
    ┌─────────┐      ┌──────────┐
    │   YES   │      │    NO    │
    │  DONE!  │      │ CONTINUE │
    └─────────┘      └────┬─────┘
                          │
                          └──────────┐
                                     │
                    ┌────────────────┘
                    │
                    ▼
         (Return to Concept Selection)
```

## Key Characteristics

### 1. Stateless Agents
Each agent can be called independently. No shared global state.

### 2. Clear Data Flow
Frontend → API → Agent Layer → Data Layer

### 3. Extensibility Points
- Add agents: Inherit from `Agent` base class
- Add domains: Extend goal decomposition logic
- Add storage: Replace in-memory DB
- Add LLMs: Inject into agent `process()` methods

### 4. Separation of Concerns
- **Routers**: HTTP interface, validation
- **Agents**: Business logic, decisions
- **Models**: Data structure, serialization
- **Database**: Persistence layer

### 5. Type Safety
- Pydantic models (backend)
- TypeScript interfaces (frontend)
- Clear input/output contracts

This architecture supports:
- ✅ Testing (mock agents independently)
- ✅ Scaling (agents are async, stateless)
- ✅ Extension (clear plugin points)
- ✅ Debugging (trace through agent calls)
- ✅ Migration (swap storage, add LLMs)
