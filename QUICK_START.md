# LearnOS 3.0 - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Backend Setup (2 min)

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (skip if using Ollama locally)
cat > .env << EOF
# Optional: Add LLM API keys
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GROQ_API_KEY=gsk-...
EOF

# Start backend
python main.py
```

✅ Backend ready at `http://localhost:8000`

### Step 2: Frontend Setup (1 min)

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

✅ Frontend ready at `http://localhost:3000`

### Step 3: Local LLM (Optional - Offline Mode)

```bash
# Download Ollama: https://ollama.ai
ollama pull mistral  # or any model: llama2, neural-chat, etc.
ollama serve
```

✅ Ollama running at `http://localhost:11434`

---

## 📝 First Steps

### 1. Register & Login

```bash
# Register
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "learner123",
    "password": "SecurePass123!",
    "display_name": "John Learner",
    "accept_terms": true
  }'

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'

# Response:
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expires_in": 3600,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com"
}
```

### 2. Register an LLM Provider

```bash
# Option A: Use OpenAI (requires API key)
curl -X POST http://localhost:8000/api/llm/providers/register \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model_id": "gpt-4",
    "api_key": "sk-YOUR-KEY-HERE",
    "temperature": 0.7,
    "max_tokens": 2048,
    "capabilities": [
      "content_generation",
      "evaluation",
      "test_generation"
    ]
  }'

# Option B: Use Local Ollama (Free - No API key needed)
curl -X POST http://localhost:8000/api/llm/providers/register \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "ollama",
    "model_id": "mistral",
    "base_url": "http://localhost:11434",
    "temperature": 0.7,
    "max_tokens": 2048,
    "capabilities": [
      "content_generation",
      "explanation"
    ]
  }'

# Option C: Use Groq (Fast - Requires API key)
curl -X POST http://localhost:8000/api/llm/providers/register \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "groq",
    "model_id": "mixtral-8x7b-32768",
    "api_key": "gsk-YOUR-KEY-HERE",
    "temperature": 0.5,
    "capabilities": ["content_generation", "explanation"]
  }'
```

### 3. Set User LLM Preference

```bash
curl -X POST http://localhost:8000/api/llm/users/USER_ID/config \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "primary_provider": "openai",
    "primary_model": "gpt-4",
    "secondary_models": ["gpt-3.5-turbo"],
    "preferences": {}
  }'
```

### 4. Generate Learning Content

```bash
curl -X POST http://localhost:8000/api/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "concept": "Neural Networks",
    "difficulty": 0.6,
    "style": "balanced",
    "prerequisites": ["Linear Algebra", "Calculus"]
  }'

# Response includes:
{
  "explanation": "Neural networks are...",
  "analogies": ["A neural network is like...", "..."],
  "examples": ["In practice...", "..."],
  "code_sample": "python code...",
  "diagram": "mermaid diagram...",
  "interactive_question": "What is...",
  "real_world_applications": ["Computer vision", "NLP", "..."],
  "metadata": {
    "tokens_used": 1250,
    "cost": 0.025,
    "model_used": "gpt-4"
  }
}
```

### 5. Create Adaptive Test

```bash
curl -X POST http://localhost:8000/api/tests/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "concept": "Neural Networks",
    "difficulty": 0.7,
    "question_count": 5,
    "question_types": ["multiple_choice", "short_answer"],
    "include_rubric": true
  }'

# Response includes adaptive questions with grading rubric
```

### 6. Process Student Feedback

```bash
curl -X POST http://localhost:8000/api/feedback/process \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "concept": "Neural Networks",
    "learner_response": "A neural network uses multiple layers of neurons...",
    "expected_answer": "Neural networks are computational models with interconnected nodes...",
    "answer_is_correct": false,
    "confidence": 0.5,
    "time_spent_seconds": 60
  }'

# Response suggests remediation strategy:
{
  "is_mastered": false,
  "misconceptions": ["Confusing neurons with layers", "..."],
  "adaptation_strategy": "elaborate",
  "adaptation_content": "Let me explain more deeply...",
  "next_concept": "Backpropagation",
  "should_remediate": true
}
```

### 7. Curate Learning Resources

```bash
curl -X POST http://localhost:8000/api/resources/curate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "concept": "Neural Networks",
    "difficulty": 0.6,
    "preferred_types": ["article", "video", "interactive"],
    "max_results": 10
  }'

# Response includes ranked, sequenced resources
```

---

## 🔑 API Keys Setup

### Get Free/Affordable API Keys

#### OpenAI
1. Go to https://platform.openai.com/api-keys
2. Create new API key
3. Use `gpt-4` or `gpt-3.5-turbo`
4. Cost: ~$0.03 per 1K tokens (varies by model)

#### Anthropic (Claude)
1. Go to https://console.anthropic.com/
2. Create new API key
3. Use `claude-3-5-sonnet`
4. Cost: ~$0.01 per 1K input tokens

#### Groq (FAST & CHEAP)
1. Go to https://console.groq.com/
2. Create new API key
3. Use `mixtral-8x7b-32768` or `llama2-70b-4096`
4. Cost: FREE during preview! 🎉

#### Local Models (FREE, Offline)
1. Download Ollama: https://ollama.ai
2. `ollama pull mistral` (best balance)
3. Or: `llama2`, `neural-chat`, `orca`
4. Cost: $0 (runs locally)

---

## 💡 Common Use Cases

### Case 1: Student Learning Reinforcement Learning
```bash
# 1. Create learning goal
curl -X POST http://localhost:8000/api/goals \
  -d '{"goal": "Learn reinforcement learning well enough to build agents"}'

# 2. Generate course content
# (auto-generates concept DAG with LLM)

# 3. For each concept:
#    - Generate explanations
#    - Create tests
#    - Curate resources
#    - Process feedback

# 4. Adapt in real-time based on performance
```

### Case 2: Teacher Creating Personalized Assignments
```bash
# 1. Teacher configures LLM (GPT-4 for quality)
# 2. Uploads class roster
# 3. Creates assignment from learning goal
# 4. System auto-generates personalized versions
# 5. Receives adaptive rubric for grading
```

### Case 3: Corporate Training
```bash
# 1. Company deploys on-premise (Ollama)
# 2. Creates training curriculum
# 3. Tracks employee progress
# 4. Generates certificates on mastery
# 5. No external API calls needed
```

---

## 🎯 Usage Analytics

```bash
# Check usage and costs
curl http://localhost:8000/api/llm/usage?user_id=USER_ID

# Check cost analytics
curl http://localhost:8000/api/llm/analytics/cost?user_id=USER_ID

# Response:
{
  "total_cost_dollars": 25.50,
  "total_tokens": 125000,
  "request_count": 250,
  "average_latency_ms": 450,
  "by_provider": {
    "openai:gpt-4": {
      "tokens": 80000,
      "cost": 20.00,
      "requests": 150
    }
  }
}
```

---

## 🔧 Troubleshooting

### "No suitable provider found"
```bash
# Check registered providers
curl http://localhost:8000/api/llm/providers

# Test provider connection
curl -X POST http://localhost:8000/api/llm/providers/openai/gpt-4/test
```

### "Module not found" errors
```bash
# Reinstall dependencies
pip install -r requirements.txt

# Check specific packages
pip list | grep -i openai
pip list | grep -i anthropic
```

### "API key invalid"
```bash
# Verify .env file is loaded
cat .env

# Test API key directly (OpenAI example)
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### High latency
```bash
# Use faster provider (Groq)
# Or check network latency
ping api.openai.com

# Monitor performance
curl http://localhost:8000/api/llm/analytics/performance
```

---

## 📚 Next Steps

1. **Read Full Guide**: See `LLM_IMPLEMENTATION_GUIDE.md`
2. **Explore API Docs**: http://localhost:8000/docs
3. **Check Examples**: See `/examples` folder
4. **Deploy**: See `DEPLOYMENT.md`

---

## 🆘 Need Help?

- **Issues**: https://github.com/Abelo9996/LearnOS/issues
- **Docs**: https://learnos.docs/
- **Discord**: https://discord.gg/learnos

---

## ✨ What's Next?

- [ ] Deploy to production
- [ ] Connect more LLM providers
- [ ] Build mobile apps
- [ ] Add collaborative features
- [ ] Implement advanced RAG
- [ ] Create LMS integrations

**Happy learning! 🎓**
