# LearnOS 3.0 - Multi-LLM Implementation Guide

## Overview

LearnOS 3.0 is a production-grade learning platform with **multi-LLM support**, enabling users to connect to various AI models (OpenAI, Anthropic, Groq, local Ollama) to power personalized learning experiences.

## Key Features Added

### 1. **Multi-LLM Provider Architecture**
- **OpenAI**: GPT-4, GPT-3.5-turbo
- **Anthropic**: Claude 3.5 Sonnet
- **Groq**: Ultra-fast inference
- **Ollama**: Local model deployment
- **Extensible**: Add custom providers easily

### 2. **LLM Manager**
Intelligent routing and orchestration:
- Automatic provider selection based on task type and cost
- Failover mechanisms for reliability
- Usage tracking and analytics
- Cost optimization

### 3. **Enhanced Agents**

#### Content Generation Agent
Generates educational content using LLMs:
- Explanations with analogies
- Code examples
- Mermaid diagrams
- Interactive questions
- Real-world applications

#### Test Generation Agent
Creates adaptive assessments:
- Multiple question types (multiple choice, short answer, essay)
- Difficulty adaptation
- Misconception-targeting
- Automatic rubric generation
- Item analysis

#### Feedback Adaptation Agent
Real-time learning path adjustment:
- Misconception detection
- Confusion pattern tracking
- Strategy selection (simplify, elaborate, analogize, etc.)
- Targeted remediation
- Next concept recommendation

#### Resource Curation Agent
Intelligent resource discovery:
- Multi-source resource finding
- Quality evaluation
- Personalized ranking
- Learning sequencing
- Supplementary resource discovery

## Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- API keys for LLM providers (optional - local Ollama works offline)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cat > .env << EOF
# OpenAI (optional)
OPENAI_API_KEY=your_openai_key

# Anthropic (optional)
ANTHROPIC_API_KEY=your_anthropic_key

# Groq (optional)
GROQ_API_KEY=your_groq_key

# Ollama (local, default: http://localhost:11434)
OLLAMA_BASE_URL=http://localhost:11434
EOF

# Start backend
python main.py
```

Backend runs on `http://localhost:8000`
API docs: `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs on `http://localhost:3000`

### Local Model Setup (Optional)

To run LLMs locally without API keys:

```bash
# Install Ollama: https://ollama.ai

# Pull a model
ollama pull mistral

# Run Ollama (default port 11434)
ollama serve
```

## API Usage Examples

### Register an LLM Provider

```bash
curl -X POST http://localhost:8000/api/llm/providers/register \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model_id": "gpt-4",
    "api_key": "your_api_key",
    "temperature": 0.7,
    "max_tokens": 2048,
    "capabilities": ["content_generation", "evaluation", "test_generation"]
  }'
```

### Set User LLM Preference

```bash
curl -X POST http://localhost:8000/api/llm/users/user123/config \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "primary_provider": "openai",
    "primary_model": "gpt-4",
    "preferences": {}
  }'
```

### Generate Content

```bash
curl -X POST http://localhost:8000/api/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "concept": "Markov Decision Processes",
    "difficulty": 0.6,
    "style": "balanced"
  }'
```

### Generate Adaptive Test

```bash
curl -X POST http://localhost:8000/api/tests/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "concept": "Q-Learning",
    "difficulty": 0.7,
    "question_count": 5,
    "question_types": ["multiple_choice", "short_answer"]
  }'
```

### Process Learner Feedback

```bash
curl -X POST http://localhost:8000/api/feedback/process \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "concept": "Neural Networks",
    "learner_response": "A neural network is a type of machine learning model...",
    "expected_answer": "Neural networks are computational models inspired by biological neurons...",
    "answer_is_correct": false,
    "confidence": 0.4,
    "time_spent_seconds": 45
  }'
```

### Get Usage Analytics

```bash
curl http://localhost:8000/api/llm/usage?user_id=user123
curl http://localhost:8000/api/llm/analytics/cost?user_id=user123
```

## Configuration Guide

### Environment Variables

```bash
# LLM API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk-...

# LLM Endpoints
OLLAMA_BASE_URL=http://localhost:11434

# Database
DATABASE_URL=postgresql://user:pass@localhost/learnos

# Authentication
JWT_SECRET=your-secret-key
```

### LLM Model Configuration

Each provider can be configured with:

```python
{
    "provider": "openai",  # openai, anthropic, groq, ollama
    "model_id": "gpt-4",
    "api_key": "...",
    "temperature": 0.7,  # 0-2, higher = more creative
    "max_tokens": 2048,
    "top_p": 1.0,  # 0-1, nucleus sampling
    "timeout_seconds": 60,
    "capabilities": [
        "content_generation",
        "evaluation",
        "test_generation",
        "explanation",
        "summarization",
        "code_review"
    ],
    "cost_per_1k_input_tokens": 0.01,
    "cost_per_1k_output_tokens": 0.03
}
```

## Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (Next.js)              │
│   - Goal input                          │
│   - Learning interface                  │
│   - Progress dashboard                  │
└──────────────┬──────────────────────────┘
               │ HTTP/REST API
┌──────────────┴──────────────────────────┐
│         API Layer (FastAPI)             │
├──────────────────────────────────────────┤
│ /api/llm/*          - LLM configuration  │
│ /api/content/*      - Content generation │
│ /api/tests/*        - Test generation    │
│ /api/feedback/*     - Feedback handling  │
│ /api/resources/*    - Resource curation  │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│    LLM Manager & Agents                 │
├──────────────────────────────────────────┤
│ - Provider routing                      │
│ - Failover & optimization               │
│ - Content generation agent              │
│ - Test generation agent                 │
│ - Feedback adaptation agent             │
│ - Resource curation agent               │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│    LLM Provider Integrations            │
├──────────────────────────────────────────┤
│ - OpenAI API                            │
│ - Anthropic API                         │
│ - Groq API                              │
│ - Local Ollama                          │
└──────────────────────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│    Database & Storage                   │
├──────────────────────────────────────────┤
│ - User profiles                         │
│ - Learning progress                     │
│ - Generated content cache               │
│ - Usage logs & analytics                │
└──────────────────────────────────────────┘
```

## Workflow Examples

### Example 1: Complete Learning Journey

1. **User Input**
   ```
   Goal: "Learn neural networks for computer vision"
   ```

2. **Content Generation**
   - ContentGenerationAgent creates explanations with analogies
   - LLM generates code examples, diagrams, applications

3. **Personalized Assessment**
   - TestGenerationAgent creates adaptive tests
   - Difficulty adjusts based on learner performance
   - Tests target detected misconceptions

4. **Feedback Processing**
   - FeedbackAdaptationAgent analyzes responses
   - Identifies misconceptions automatically
   - Selects optimal teaching strategy

5. **Resource Curation**
   - ResourceCurationAgent finds supplementary materials
   - Ranks resources by quality and relevance
   - Creates optimal learning sequence

### Example 2: Multi-Provider Optimization

```python
# Fast path for interactive learning
response = await llm_manager.get_fastest_response(
    user_id, request
)

# Cost-optimized path for batch processing
response = await llm_manager.get_cheapest_response(
    user_id, request
)

# Compare responses from top 3 providers
responses = await llm_manager.compare_responses(
    user_id, request, num_providers=3
)
```

## Performance Optimization

### Caching
- Generated content cached by concept + difficulty
- Resource recommendations cached and updated periodically
- Embeddings cached for semantic search

### Rate Limiting
- Per-provider rate limits configured
- User quotas with monthly reset
- Priority queuing for premium users

### Cost Control
- Budget limits per user/org
- Cheap provider preference when quality similar
- Token estimation before generation

## Monitoring & Analytics

Access via `/api/llm/analytics/`:

```json
{
  "total_cost_dollars": 125.50,
  "total_tokens": 1250000,
  "request_count": 2500,
  "average_latency_ms": 450,
  "by_provider": {
    "openai:gpt-4": {
      "tokens": 600000,
      "cost": 75.00,
      "requests": 1200
    },
    "anthropic:claude-3.5": {
      "tokens": 450000,
      "cost": 40.00,
      "requests": 950
    }
  }
}
```

## Best Practices

### 1. Provider Selection
- Use fast providers (Groq) for interactive features
- Use high-quality providers (GPT-4) for critical content
- Use local Ollama for offline mode

### 2. Cost Management
- Set monthly budgets per user
- Cache generated content
- Batch process non-interactive tasks

### 3. Quality Assurance
- Review generated tests before deployment
- Validate resource rankings
- Monitor misconception detection accuracy

### 4. User Experience
- Stream responses for better UX
- Show provider information (latency, cost)
- Allow user choice of providers

## Troubleshooting

### "No suitable provider found"
- Check provider registration: `GET /api/llm/providers`
- Verify API keys in environment
- Test provider connection: `POST /api/llm/providers/{type}/{id}/test`

### High latency
- Use faster provider (Groq)
- Check network connectivity
- Monitor provider performance metrics

### Cost overruns
- Review usage logs: `GET /api/llm/usage/logs`
- Switch to cheaper provider for non-critical tasks
- Implement caching for common requests

### Quality issues
- Compare multiple providers
- Adjust temperature and max_tokens
- Review agent prompts and configurations

## Future Roadmap

- [ ] Function calling / tool use integration
- [ ] Vision model support (GPT-4V, Claude Vision)
- [ ] Multi-modal content generation
- [ ] Real-time collaborative learning
- [ ] Advanced RAG (Retrieval-Augmented Generation)
- [ ] Fine-tuned models per domain
- [ ] Autonomous curriculum design
- [ ] Student peer matching
- [ ] Advanced gamification
- [ ] Mobile apps with offline support

## Contributing

To add a new LLM provider:

1. Create a new class in `llm_providers.py` extending `BaseLLMProvider`
2. Implement `_initialize_client()`, `generate()`, `stream()`
3. Register in `LLMProviderFactory`
4. Add tests and documentation

## Support

For issues and questions:
- GitHub Issues: https://github.com/Abelo9996/LearnOS/issues
- Documentation: https://learnos.docs/
- Community Discord: https://discord.gg/learnos

## License

MIT License - see LICENSE file for details
