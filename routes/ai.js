/**
 * AI layer routes: status, smoke-test ping, run log, usage (PLAT-01..06).
 * Mounted under /api/ai (auth-protected).
 */
import { Router } from 'express';
import db, { awardXP, logActivity, awardBadge } from '../db/database.js';
import { complete, hasManagedKey } from '../ai/llm.js';
import { generateAssignment, generateQuiz } from '../ai/agents/assessment.js';

const router = Router();

// Is the AI layer usable? (an env OpenRouter key and/or a key added in Settings)
router.get('/status', (req, res) => {
  const byok = db.prepare(
    "SELECT COUNT(*) AS c FROM api_keys WHERE user_id = ? AND provider = 'openrouter' AND is_active = 1"
  ).get(req.userId).c;
  res.json({ managed: hasManagedKey(), byok: byok > 0, ready: hasManagedKey() || byok > 0 });
});

// Full OpenRouter model catalog (cached ~1h) so the user can route any agent to
// any available model. The list endpoint is public — no key required.
let _modelCache = { at: 0, data: null };
const FALLBACK_MODELS = [
  { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5' },
  { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
];
router.get('/models', async (_req, res) => {
  const now = Date.now();
  if (_modelCache.data && (now - _modelCache.at) < 3_600_000) return res.json(_modelCache.data);
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('openrouter ' + r.status);
    const j = await r.json();
    const models = (j.data || [])
      .map(m => ({
        id: m.id,
        name: m.name || m.id,
        context: m.context_length || m.top_provider?.context_length || null,
        promptPrice: m.pricing?.prompt != null ? Number(m.pricing.prompt) : null,
        completionPrice: m.pricing?.completion != null ? Number(m.pricing.completion) : null,
      }))
      .filter(m => m.id)
      .sort((a, b) => a.id.localeCompare(b.id));
    _modelCache = { at: now, data: models };
    res.json(models);
  } catch {
    res.json(_modelCache.data || FALLBACK_MODELS);
  }
});

// Smoke-test the full provider chain end to end.
router.post('/ping', async (req, res) => {
  try {
    const out = await complete({
      userId: req.userId,
      agentCode: 'TU',
      system: 'You are LearnOS, a focused study assistant. Answer in one short sentence.',
      messages: 'Say hello and give one concise study tip.',
      maxTokens: 128,
    });
    res.json({ ok: true, model: out.model, managed: out.managed, text: out.text, usage: out.usage, cost: out.cost });
  } catch (e) {
    res.status(e.code === 'NO_KEY' ? 400 : 502).json({ error: true, code: e.code || null, message: e.message });
  }
});

// Recent agent runs — observability (PLAT-05).
router.get('/runs', (req, res) => {
  const runs = db.prepare(
    `SELECT id, agent_code, model, managed, input_tokens, output_tokens,
            cache_read_tokens, cache_write_tokens, cost_usd, latency_ms, status, error, created_at
     FROM agent_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
  ).all(req.userId);
  res.json(runs);
});

// Managed-tier usage for the current month (feeds caps later — AI-6).
router.get('/usage', (req, res) => {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const row = db.prepare('SELECT * FROM usage_counters WHERE user_id = ? AND period = ?').get(req.userId, period)
    || { user_id: req.userId, period, tokens: 0, cost_usd: 0, requests: 0 };
  res.json(row);
});


// Chat endpoint for the Session frontend (TU agent — with citations §3.7)
router.post('/chat', async (req, res) => {
  const { messages, sessionContext } = req.body;
  if (!messages) return res.status(400).json({ error: true, message: 'messages required' });
  try {
    const sessText = typeof sessionContext === 'string' ? sessionContext : (sessionContext?.text || 'General tutoring session');
    const nodeId = sessionContext?.nodeId || null;
    let system = `You are the Tutor Agent in LearnOS, an AI-powered learning platform. You teach concepts clearly, ask follow-up questions, and adapt to the learner's level. ${sessText}. Keep responses focused and educational. Use markdown formatting for clarity.`;
    // §3.7: Augment with verified node resources for citation support
    if (nodeId) {
      const resources = db.prepare("SELECT id, title, url, source FROM node_resources WHERE node_id = ? AND status = 'verified' LIMIT 8").all(nodeId);
      if (resources.length > 0) {
        const resBlock = resources.map((r, i) => `[${i + 1}] "${r.title}" — ${r.source} (${r.url})`).join('\n');
        system += `\n\nAvailable verified sources for this module:\n${resBlock}\nWhen you reference a claim, cite by [N] using these source numbers. Prefer citing the provided sources over making claims from memory. If the sources don't cover something, say so explicitly.`;
      }
    }
    const out = await complete({
      userId: req.userId,
      agentCode: 'TU',
      system,
      messages: Array.isArray(messages) ? messages.join('\n') : String(messages),
      maxTokens: 2048,
    });
    res.json({ ok: true, text: out.text, model: out.model, usage: out.usage, cost: out.cost });
  } catch (e) {
    res.status(e.code === 'NO_KEY' ? 400 : 502).json({ error: true, code: e.code || null, message: e.message });
  }
});
// AS agent — quiz generation (P8).
router.post('/quiz/generate', async (req, res) => {
  const { node_id } = req.body || {};
  try {
    const q = await generateQuiz({ userId: req.userId, nodeId: node_id || null });
    res.json({ ok: true, quiz: q });
  } catch (e) {
    res.status(e.code === 'NO_KEY' ? 400 : 502).json({ error: true, code: e.code || null, message: e.message });
  }
});

// Score + persist a completed quiz attempt. This is what makes a quiz a real,
// graded exercise instead of a throwaway toast: it computes the score, awards
// XP, logs the activity feed, records the attempt, and nudges node mastery.
router.post('/quiz/submit', (req, res) => {
  const { node_id, title, questions, answers } = req.body || {};
  if (!Array.isArray(questions) || questions.length === 0 || !Array.isArray(answers)) {
    return res.status(400).json({ error: true, message: 'questions and answers required' });
  }
  const total = questions.length;
  let correct = 0;
  const results = questions.map((q, i) => {
    const chosen = answers[i];
    const isCorrect = chosen === q.correct;
    if (isCorrect) correct++;
    return { chosen: chosen ?? null, correct: q.correct, isCorrect, why: q.why || '' };
  });
  const score = Math.round((correct / total) * 100);
  const xp = correct * 5 + (correct === total ? 10 : 0);

  const id = `qa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    db.prepare(`INSERT INTO quiz_attempts (id, user_id, node_id, title, total, correct, score, questions_json, answers_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, req.userId, node_id || null, title || 'Quiz', total, correct, score,
        JSON.stringify(questions), JSON.stringify(answers));
  } catch (e) { /* persistence is best-effort; still return the score */ }

  try {
    awardXP(req.userId, xp);
    logActivity(req.userId, { kind: 'quiz', text: `Quiz: ${title || 'Module quiz'} — ${score}%`, sub: `${correct}/${total} correct`, xp, agent: 'AS' });
    // Real badge for a perfect score (was seeded-only, never earned).
    if (correct === total && total >= 3 && awardBadge(req.userId, 'First quiz 100%', 'check')) {
      logActivity(req.userId, { kind: 'cert', text: 'Earned badge: First quiz 100%', sub: 'Perfect quiz', xp: 0, agent: 'CE' });
    }
    // Blend the quiz score into node mastery (never lowers an existing higher score).
    if (node_id) {
      const node = db.prepare('SELECT mastery FROM roadmap_nodes WHERE id = ?').get(node_id);
      if (node) {
        const blended = Math.max(node.mastery || 0, Math.round(((node.mastery || 0) * 0.5 + (score / 100) * 0.5) * 100) / 100);
        db.prepare('UPDATE roadmap_nodes SET mastery = ? WHERE id = ?').run(blended, node_id);
      }
    }
  } catch (e) { /* never fail the response on side-effects */ }

  res.json({ ok: true, score, correct, total, xp, results });
});

// AS agent — real, node-aware assignment generation (G3).
router.post('/assignments/generate', async (req, res) => {
  const { node_id, kind, difficulty } = req.body || {};
  try {
    const a = await generateAssignment({ userId: req.userId, nodeId: node_id || null, kind, difficulty });
    res.json({ ok: true, assignment: a });
  } catch (e) {
    res.status(e.code === 'NO_KEY' ? 400 : 502).json({ error: true, code: e.code || null, message: e.message });
  }
});

export default router;
