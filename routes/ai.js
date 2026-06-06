/**
 * AI layer routes: status, smoke-test ping, run log, usage (PLAT-01..06).
 * Mounted under /api/ai (auth-protected).
 */
import { Router } from 'express';
import db from '../db/database.js';
import { complete, hasManagedKey } from '../ai/llm.js';
import { generateAssignment, generateQuiz } from '../ai/agents/assessment.js';

const router = Router();

// Is the AI layer usable for this user? (managed default and/or their BYOK)
router.get('/status', (req, res) => {
  const byok = db.prepare(
    "SELECT COUNT(*) AS c FROM api_keys WHERE user_id = ? AND provider = 'anthropic' AND is_active = 1"
  ).get(req.userId).c;
  res.json({ managed: hasManagedKey(), byok: byok > 0, ready: hasManagedKey() || byok > 0 });
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
