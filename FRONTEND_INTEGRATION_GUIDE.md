# LearnOS Frontend-Backend Integration Guide

Complete guide for integrating the enhanced frontend with LearnOS 3.0 backend.

## Overview

The frontend is fully integrated with all new backend features:
- ✅ User authentication (JWT tokens)
- ✅ Multi-LLM provider management
- ✅ Content generation
- ✅ Usage analytics
- ✅ Learning sessions and progress tracking

## Setup Instructions

### Step 1: Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run backend on port 8000
python main.py
```

Backend will be available at: `http://localhost:8000`
API docs: `http://localhost:8000/docs`

### Step 2: Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will be available at: `http://localhost:3000`

### Step 3: Optional - Local LLM Setup (Ollama)

```bash
# Download and install Ollama from https://ollama.ai

# Download a model
ollama pull mistral

# Start Ollama server (runs on port 11434)
ollama serve
```

## Frontend Pages & Integration

### 1. Home Page (`/`)

**Features**:
- Overview of platform capabilities
- Quick action cards for authenticated users
- Learning goal input with example prompts

**Backend Integration**:
```
POST /api/goal
{
  "goal": "Learn reinforcement learning",
  "user_id": "demo_user"
}
```

**User Flow**:
1. User enters learning goal
2. System creates concept graph via `POST /api/goal`
3. Redirect to `/graph/{goal_id}`

---

### 2. Registration Page (`/register`)

**Features**:
- Email, username, password fields
- Password confirmation
- Validation (min 8 chars, matching passwords)

**Backend Integration**:
```
POST /auth/register
{
  "email": "user@example.com",
  "username": "johnsmith",
  "password": "SecurePass123!"
}

Response:
{
  "access_token": "eyJ0eXAi...",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "username": "johnsmith",
    "display_name": "John Smith",
    "role": "learner",
    "tier": "free"
  }
}
```

**Token Storage**:
- Access token stored in localStorage
- Used in all subsequent API calls
- Auto-cleared on logout

---

### 3. Login Page (`/login`)

**Features**:
- Email and password form
- Error handling
- Redirect to home on success

**Backend Integration**:
```
POST /auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response:
{
  "access_token": "eyJ0eXAi...",
  "user": { ... }
}
```

---

### 4. Profile Page (`/profile`)

**Features**:
- View account information
- Edit display name
- View plan tier and role

**Backend Integration**:
```
GET /auth/users/me
Headers: { Authorization: "Bearer {token}" }

Response:
{
  "id": "user-123",
  "email": "user@example.com",
  "username": "johnsmith",
  "display_name": "John Smith",
  "role": "learner",
  "tier": "free",
  "created_at": "2025-12-19T10:00:00"
}
```

**Update Profile**:
```
PUT /auth/users/me
Headers: { Authorization: "Bearer {token}" }
Body: { "display_name": "New Name" }
```

---

### 5. LLM Configuration Page (`/llm-config`)

**Features**:
- View available LLM providers
- See provider capabilities and costs
- Set primary model
- View usage statistics
- Cost breakdown by provider

**Backend Integration**:

**Get Providers**:
```
GET /api/llm/providers
Headers: { Authorization: "Bearer {token}" }

Response:
{
  "providers": [
    {
      "provider": "openai",
      "model_id": "gpt-4",
      "capabilities": ["text", "complex_reasoning"],
      "cost_per_1k_tokens": 0.03,
      "status": "available"
    },
    ...
  ]
}
```

**Set Primary Model**:
```
POST /api/llm/users/{user_id}/primary-model
Headers: { Authorization: "Bearer {token}" }
Body: { "provider": "groq", "model_id": "mixtral" }
```

**Get Usage Statistics**:
```
GET /api/llm/usage
Headers: { Authorization: "Bearer {token}" }

Response:
{
  "total_tokens": 50000,
  "total_cost": 1.25,
  "requests_count": 150,
  "by_provider": {
    "openai": { "tokens": 20000, "cost": 0.60 },
    "groq": { "tokens": 30000, "cost": 0.00 }
  }
}
```

---

### 6. Content Generation Page (`/content-generation`)

**Features**:
- Enter concept to learn
- Select difficulty level
- Display rich, multi-modal content

**Backend Integration**:
```
POST /api/content/generate
Headers: { Authorization: "Bearer {token}" }
Body:
{
  "concept": "Neural Networks",
  "difficulty_level": "intermediate",
  "user_id": "demo_user"
}

Response:
{
  "explanation": "Neural networks are...",
  "analogies": ["Like neurons in brain...", "Similar to..."],
  "examples": ["Example 1: ...", "Example 2: ..."],
  "code_sample": "import tensorflow as tf\n...",
  "diagram": "graph LR\n  A[Input] --> B[Hidden]\n  B --> C[Output]",
  "interactive_question": "Why do we use activation functions?",
  "real_world_applications": ["Recommendation systems", "Image recognition"],
  "metadata": { "generated_at": "2025-12-19T...", "provider": "gpt-4" }
}
```

**Display Logic**:
- Explanation: Paragraph text
- Analogies: Bullet list
- Examples: Numbered list
- Code: Pre-formatted with syntax highlight
- Diagram: Mermaid diagram viewer
- Question: Interactive question box
- Applications: Bullet list

---

### 7. Graph Visualization Page (`/graph/[goalId]`)

**Features**:
- Display concept dependency graph
- Show prerequisites and blocked concepts
- Click concepts to start learning

**Backend Integration**:
```
GET /api/graph/{goal_id}

Response:
{
  "graph": {
    "nodes": {
      "MDP": { "title": "Markov Decision Process", "difficulty": 0.4, ... },
      "ValueFunctions": { "title": "Value Functions", "difficulty": 0.6, ... }
    },
    "edges": [
      ["MDP", "ValueFunctions"],
      ["MDP", "BellmanEquation"]
    ]
  },
  "goal": "Learn reinforcement learning"
}
```

---

### 8. Learning Session Page (`/learn/[sessionId]`)

**Features**:
- Display learning content
- Submit answers to questions
- Get adaptive feedback
- Track progress through concepts

**Backend Integration**:

**Start Session**:
```
POST /api/session/start
Body: { "goal_id": "uuid", "user_id": "demo_user" }

Response:
{
  "session_id": "uuid",
  "current_concept": "Markov Decision Process",
  "content": { "type": "explanation", "text": "..." }
}
```

**Submit Response**:
```
POST /api/session/interact
Body:
{
  "session_id": "uuid",
  "response": "User's answer text"
}

Response (if passed):
{
  "passed": true,
  "concept_mastered": true,
  "new_concept": "Value Functions",
  "progress_percentage": 14.3
}

Response (if not passed):
{
  "passed": false,
  "feedback": "Good attempt, but...",
  "adaptation_applied": "introduce_analogy",
  "reasoning_quality": 0.62
}
```

---

### 9. Progress Page (`/progress`)

**Features**:
- Overall learning statistics
- Progress per goal
- Mastered vs. available concepts
- Engagement metrics

**Backend Integration**:
```
GET /api/progress?user_id={user_id}&goal_id={goal_id}

Response:
{
  "goal": "Learn reinforcement learning",
  "progress_percentage": 42.8,
  "mastered_concepts": ["MDP", "Value Functions"],
  "available_concepts": ["Q-Learning"],
  "blocked_concepts": { "DQN": ["Neural Networks"] },
  "engagement_score": 0.83,
  "concept_details": [
    {
      "concept": "MDP",
      "status": "mastered",
      "attempts": 3,
      "time_spent": 1200
    }
  ]
}
```

---

## Authentication Flow

```
User Registration
    ↓
POST /auth/register
    ↓
Backend validates & creates user
    ↓
Returns access_token
    ↓
Frontend stores token in localStorage
    ↓
All subsequent requests include:
    Headers: { Authorization: "Bearer {token}" }
    ↓
User can access protected routes
```

## Error Handling

### Common Errors

**401 Unauthorized**
```
Cause: Missing or expired token
Solution: Redirect to /login

Frontend code:
if (err.response?.status === 401) {
  localStorage.removeItem('access_token')
  router.push('/login')
}
```

**422 Unprocessable Entity**
```
Cause: Invalid input data
Example: Password too short, invalid email
Frontend displays error message from response.data.detail
```

**500 Internal Server Error**
```
Cause: Backend server error
Solution: Show user-friendly message, check backend logs
```

## Data Flow Diagram

```
┌─────────────────┐
│   User Browser  │
│  (Next.js App)  │
└────────┬────────┘
         │
    HTTP │ Request
         ├─ POST /auth/register
         ├─ POST /auth/login
         ├─ GET  /api/llm/providers
         ├─ POST /api/content/generate
         ├─ POST /api/goal
         └─ GET  /api/progress
         │
         ↓ (with JWT token)
┌──────────────────────────┐
│   FastAPI Backend        │
│   (Python, port 8000)    │
├──────────────────────────┤
│ • Auth Service           │
│ • LLM Manager            │
│ • Agents                 │
│ • Database               │
└──────────────────────────┘
         │
         ↓
┌──────────────────────────┐
│   External LLM APIs      │
│ • OpenAI (GPT-4)         │
│ • Anthropic (Claude)     │
│ • Groq (Mixtral)         │
│ • Ollama (local)         │
└──────────────────────────┘
```

## Environment Configuration

### Frontend `.env.local`

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Optional: Backend URL for auth endpoints
# NEXT_PUBLIC_AUTH_URL=http://localhost:8000/auth
```

### Backend `.env`

```env
# Database (optional, defaults to in-memory)
DATABASE_URL=sqlite:///./learnos.db

# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk-...

# JWT Secret for tokens
JWT_SECRET=your-super-secret-key-min-32-chars

# CORS
CORS_ORIGINS=["http://localhost:3000", "http://localhost:3001"]

# Optional: Ollama
OLLAMA_BASE_URL=http://localhost:11434
```

## Testing the Integration

### Step 1: Register New User
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "TestPass123!"
  }'
```

### Step 2: Login
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

Save the `access_token` from response.

### Step 3: Register LLM Provider
```bash
curl -X POST http://localhost:8000/api/llm/providers/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {access_token}" \
  -d '{
    "provider": "ollama",
    "model_id": "mistral",
    "base_url": "http://localhost:11434"
  }'
```

### Step 4: Generate Content
```bash
curl -X POST http://localhost:8000/api/content/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {access_token}" \
  -d '{
    "concept": "Neural Networks",
    "difficulty_level": "intermediate"
  }'
```

### Step 5: Check Usage
```bash
curl -X GET http://localhost:8000/api/llm/usage \
  -H "Authorization: Bearer {access_token}"
```

## Performance Tips

### Frontend
- Use React DevTools to check re-renders
- Monitor Network tab for API latency
- Bundle analysis: `npm run build && npm run analyze`

### Backend
- Check database queries performance
- Monitor LLM API response times
- Use FastAPI's built-in logging

### Deployment
- Use caching for frequently accessed content
- Implement request queuing for high load
- Monitor API rate limits
- Set up CDN for static assets

## Troubleshooting

### Issue: "Failed to connect to backend"
**Solution**: 
- Ensure backend is running on port 8000
- Check firewall settings
- Verify `NEXT_PUBLIC_API_URL` in frontend `.env.local`

### Issue: "Token expired"
**Solution**:
- Backend auto-clears invalid tokens
- User redirected to login page
- Log in again to get new token

### Issue: "LLM provider not responding"
**Solution**:
- Check provider API keys
- Verify provider service is running
- For Ollama: `ollama serve` must be running
- Check internet connection for cloud providers

### Issue: "Content generation timeout"
**Solution**:
- Try simpler concept
- Increase timeout in axios config
- Use faster provider (e.g., Groq)

## Next Steps

1. ✅ Frontend & backend running locally
2. ✅ Users can register and login
3. ✅ Configure LLM providers
4. ✅ Generate AI content
5. Next: Deploy to staging
6. Next: User acceptance testing
7. Next: Deploy to production

## Support & Resources

- **Frontend Docs**: See `frontend/README.md`
- **Backend Docs**: See `backend/README.md`
- **API Reference**: `http://localhost:8000/docs`
- **Project Overview**: See `00_START_HERE.md`

---

**LearnOS 3.0 - Production-Grade AI-Powered Learning Platform**
