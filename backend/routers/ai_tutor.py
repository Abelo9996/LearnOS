"""
AI Tutor Router — Conversational AI tutor for courses.
Provides a chat-based learning experience with context from the course roadmap.
"""

import logging
import uuid
import json
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import db
from services.openai_service import get_openai_service

logger = logging.getLogger("learnos.ai_tutor")
router = APIRouter(prefix="/ai/tutor", tags=["ai-tutor"])


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: Optional[str] = None


class StartChatRequest(BaseModel):
    user_id: str
    course_id: str
    milestone_id: Optional[str] = None
    topic: Optional[str] = None


class SendMessageRequest(BaseModel):
    user_id: str
    chat_id: str
    message: str


class QuizRequest(BaseModel):
    user_id: str
    chat_id: str
    milestone_id: Optional[str] = None
    num_questions: int = 5


# In-memory chat sessions (short-lived, like onboarding)
_chat_sessions: dict = {}


def _build_system_prompt(course: dict, roadmap: dict | None, milestone: dict | None, topic: str | None) -> str:
    """Build a rich system prompt with course context."""
    prompt = f"""You are an expert AI tutor for the course "{course['title']}".

Course Goal: {course.get('goal', 'Learn the subject thoroughly')}
Course Description: {course.get('description', '')}

Your role:
- Teach concepts clearly with examples and analogies
- Use the Socratic method — ask probing questions to deepen understanding
- Adapt your explanations to the learner's level
- Provide real-world applications and practical examples
- When the student seems to understand, challenge them with harder questions
- Be encouraging but honest about gaps in understanding
- Use markdown formatting for clarity (headers, bold, lists, code blocks)
- Keep responses focused and not too long (aim for 2-4 paragraphs unless explaining something complex)
"""

    if roadmap and roadmap.get("milestones"):
        milestones = roadmap["milestones"]
        completed = [m for m in milestones if m.get("completed")]
        remaining = [m for m in milestones if not m.get("completed")]
        prompt += f"\n\nCourse Progress: {len(completed)}/{len(milestones)} milestones completed."
        if remaining:
            prompt += f"\nCurrent focus areas: {', '.join(m['title'] for m in remaining[:3])}"

    if milestone:
        prompt += f"""

Currently studying: **{milestone.get('title', 'Unknown')}**
Description: {milestone.get('description', '')}
Key concepts: {', '.join(milestone.get('concepts', []))}
"""
        if milestone.get("learning_steps"):
            steps = milestone["learning_steps"]
            prompt += f"\nThis module has {len(steps)} lessons covering: "
            prompt += ", ".join(s.get("title", "") for s in steps[:5])

    if topic:
        prompt += f"\n\nThe student wants to focus on: **{topic}**"

    prompt += """

Guidelines:
- If the student asks to be quizzed, generate questions and evaluate their answers
- If they seem stuck, break concepts down into simpler parts
- Celebrate progress and correct understanding
- Gently correct misconceptions with explanations
- Suggest what to study next based on the conversation
"""
    return prompt


@router.post("/start")
async def start_chat(request: StartChatRequest):
    """Start a new tutoring chat session."""
    config = await db.get_openai_config(request.user_id)
    if not config:
        raise HTTPException(status_code=404, detail="OpenAI not configured. Set up your API key in Settings first.")

    # Load course data
    course_data = await db.get_course(request.course_id)
    if not course_data:
        raise HTTPException(status_code=404, detail="Course not found")

    course = course_data.get("course", course_data)

    # Load roadmap if exists
    roadmap = None
    if course.get("roadmap_id"):
        roadmap = await db.get_roadmap(course["roadmap_id"])

    # Find specific milestone if requested
    milestone = None
    if request.milestone_id and roadmap:
        for m in roadmap.get("milestones", []):
            if m.get("milestone_id") == request.milestone_id:
                milestone = m
                break

    system_prompt = _build_system_prompt(course, roadmap, milestone, request.topic)

    chat_id = str(uuid.uuid4())
    now = datetime.now().isoformat()

    # Create initial greeting
    service = get_openai_service(config["api_key"], model=config.get("model", "gpt-4o-mini"))
    if not service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")

    # Generate greeting
    topic_text = request.topic or (milestone["title"] if milestone else course.get("title", "your course"))
    greeting_prompt = f"The student just opened a tutoring session about '{topic_text}'. Greet them warmly, briefly summarize what you'll cover, and ask an opening question to gauge their current understanding. Keep it to 2-3 short paragraphs."

    try:
        response = service.client.chat.completions.create(
            model=service.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": greeting_prompt}
            ],
            temperature=0.7,
            max_tokens=500
        )
        greeting = response.choices[0].message.content
    except Exception as e:
        logger.error("Failed to generate greeting: %s", e)
        greeting = f"👋 Welcome! Let's dive into **{topic_text}**. What do you already know about this topic, or would you like me to start from the beginning?"

    _chat_sessions[chat_id] = {
        "chat_id": chat_id,
        "user_id": request.user_id,
        "course_id": request.course_id,
        "milestone_id": request.milestone_id,
        "topic": request.topic,
        "system_prompt": system_prompt,
        "messages": [
            {"role": "assistant", "content": greeting, "timestamp": now}
        ],
        "created_at": now,
        "model": config.get("model", "gpt-4o-mini"),
        "api_key": config["api_key"],
    }

    return {
        "chat_id": chat_id,
        "greeting": greeting,
        "course_title": course.get("title", ""),
        "topic": topic_text,
    }


@router.post("/message")
async def send_message(request: SendMessageRequest):
    """Send a message to the AI tutor and get a response."""
    session = _chat_sessions.get(request.chat_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found. Please start a new session.")

    now = datetime.now().isoformat()

    # Add user message
    session["messages"].append({
        "role": "user",
        "content": request.message,
        "timestamp": now,
    })

    # Build messages for API call (keep last 20 messages for context window)
    api_messages = [{"role": "system", "content": session["system_prompt"]}]
    recent = session["messages"][-20:]
    for msg in recent:
        api_messages.append({"role": msg["role"], "content": msg["content"]})

    service = get_openai_service(session["api_key"], model=session.get("model", "gpt-4o-mini"))
    if not service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")

    try:
        response = service.client.chat.completions.create(
            model=service.model,
            messages=api_messages,
            temperature=0.7,
            max_tokens=2000
        )
        assistant_reply = response.choices[0].message.content
    except Exception as e:
        logger.error("Failed to generate response: %s", e)
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

    reply_time = datetime.now().isoformat()
    session["messages"].append({
        "role": "assistant",
        "content": assistant_reply,
        "timestamp": reply_time,
    })

    return {
        "reply": assistant_reply,
        "chat_id": request.chat_id,
        "message_count": len(session["messages"]),
    }


@router.get("/history/{chat_id}")
async def get_chat_history(chat_id: str):
    """Get the full chat history for a session."""
    session = _chat_sessions.get(chat_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    return {
        "chat_id": chat_id,
        "messages": session["messages"],
        "course_id": session["course_id"],
        "topic": session.get("topic"),
        "message_count": len(session["messages"]),
    }


@router.post("/quiz")
async def generate_quiz(request: QuizRequest):
    """Generate a quiz based on the current chat context."""
    session = _chat_sessions.get(request.chat_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    service = get_openai_service(session["api_key"], model=session.get("model", "gpt-4o-mini"))
    if not service.is_available():
        raise HTTPException(status_code=503, detail="AI service not available")

    # Build quiz prompt from conversation context
    topics_discussed = []
    for msg in session["messages"]:
        if msg["role"] == "assistant":
            topics_discussed.append(msg["content"][:200])

    quiz_prompt = f"""Based on our conversation so far, generate a quiz with {request.num_questions} questions.

Topics we've covered:
{chr(10).join(topics_discussed[-5:])}

Return a JSON array with this structure:
[
  {{
    "question": "The question text",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct_answer": "A",
    "explanation": "Why this is correct"
  }}
]

Make questions that test understanding, not just memorization. Include a mix of difficulties.
Return ONLY the JSON array, no other text."""

    api_messages = [
        {"role": "system", "content": session["system_prompt"]},
        {"role": "user", "content": quiz_prompt}
    ]

    try:
        response = service.client.chat.completions.create(
            model=service.model,
            messages=api_messages,
            temperature=0.5,
            max_tokens=3000
        )
        content = response.choices[0].message.content.strip()

        # Parse JSON from response
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]

        questions = json.loads(content)

        # Add to chat as context
        now = datetime.now().isoformat()
        session["messages"].append({
            "role": "assistant",
            "content": f"📝 I've generated a {len(questions)}-question quiz for you! Test your knowledge below.",
            "timestamp": now,
        })

        return {
            "quiz": questions,
            "num_questions": len(questions),
            "chat_id": request.chat_id,
        }
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse quiz. Please try again.")
    except Exception as e:
        logger.error("Failed to generate quiz: %s", e)
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")


@router.delete("/{chat_id}")
async def end_chat(chat_id: str):
    """End and clean up a chat session."""
    if chat_id in _chat_sessions:
        del _chat_sessions[chat_id]
    return {"message": "Chat session ended"}
