# AI Roadmap Generation - Debug Guide

## What to Look For in Backend Logs

When you click "Generate Roadmap", you'll see clean, organized output in your backend terminal. Here's what each section means:

### 1. START Section
```
================================================================================
🤖 AI ROADMAP GENERATION - START
================================================================================
Goal: Your learning goal here
Prompt length: XXXX characters

--- PROMPT SENT TO GPT-4 TURBO ---
[Full prompt with instructions for AI]
================================================================================
```

**What it means**: The AI generation process has started. Shows you exactly what we're asking GPT-4 Turbo to create.

### 2. RAW RESPONSE Section
```
--- RAW AI RESPONSE ---
[Huge JSON response from GPT-4]
================================================================================
Response length: XXXX characters
================================================================================
```

**What it means**: This is the raw, unprocessed response from OpenAI's GPT-4 Turbo model. Should be a JSON object with milestones, learning_steps, etc.

### 3. PARSED STRUCTURE Section
```
--- PARSED ROADMAP STRUCTURE ---
{
  "milestones": [...],
  "learning_strategy": "...",
  "success_tips": [...]
}

✅ SUCCESS: Generated X milestones
✅ First milestone has X learning steps
✅ First step: 'Title of first lesson'
   - Videos: X
   - Articles: X
   - Interactive: X
```

**What it means**: AI response was successfully parsed into a structured roadmap. Shows counts of resources per lesson.

### 4. END Section
```
================================================================================
🤖 AI ROADMAP GENERATION - END
================================================================================
```

**What it means**: Process completed successfully!

---

## If You See An Error

### Error Section Format:
```
================================================================================
❌ ERROR GENERATING ROADMAP
================================================================================
Error: [Error message]
Type: [Error type]

Full traceback:
[Python stack trace]
================================================================================
```

**Common Errors:**

1. **"max_tokens is too large"** → We're requesting too many tokens from the model
2. **"Error code: 401"** → API key is invalid
3. **"Error code: 429"** → Rate limit exceeded (too many requests)
4. **"Error code: 500"** → OpenAI's servers are having issues

---

## What "Placeholder Lesson" Means

If you see this in the frontend:
```
"This is a placeholder lesson. When AI is configured, you'll get detailed, personalized content here..."
```

It means **the fallback roadmap was used** instead of AI-generated content. This happens when:
- Service initialization failed
- is_available() returned False
- An exception occurred during AI generation

Check backend logs for ERROR messages to see why.

---

## Expected Success Flow

1. ✅ OpenAI client initializes (on first API call)
2. ✅ START section appears
3. ✅ Prompt is sent to GPT-4 Turbo
4. ✅ RAW RESPONSE section shows JSON with learning_steps
5. ✅ PARSED STRUCTURE shows multiple lessons with resources
6. ✅ END section appears
7. ✅ Frontend displays rich course content

---

## Frontend Logs (Removed)

All frontend console.log statements have been removed for cleaner debugging. The backend logs tell you everything you need.

---

## Quick Debug Checklist

- [ ] Do you see "🤖 AI ROADMAP GENERATION - START"?
  - **NO** → Service not available, check API key
- [ ] Do you see "--- RAW AI RESPONSE ---"?
  - **NO** → API call failed, check ERROR section
- [ ] Does RAW RESPONSE contain "learning_steps"?
  - **NO** → AI didn't follow prompt format
- [ ] Does PARSED STRUCTURE show learning_steps > 0?
  - **NO** → Parsing failed or AI returned empty steps
- [ ] Frontend shows placeholder content?
  - **YES** → Check backend ERROR section for details

---

## Test It Now!

1. Generate a roadmap
2. Watch backend terminal
3. Look for the START → RESPONSE → PARSED → END flow
4. If you see ERROR, read the error message and traceback
