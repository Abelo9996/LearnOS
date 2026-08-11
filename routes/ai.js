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

/**
 * The OpenRouter model catalog (cached ~1h). The list endpoint is public, so no
 * key is needed to browse it.
 *
 * There are ~400 entries and LearnOS should offer all of them — including the
 * free ones, which are the whole reason somebody self-hosts this and brings
 * their own key. A learner asking for `inclusionai/ling-3.0-tiny:free` should
 * find it.
 *
 * Two kinds of noise are worth removing:
 *
 *   `:batch`  — the same model behind OpenRouter's asynchronous batch endpoint.
 *               60 of the 401 entries. Every one is a second copy of a model
 *               already in the list, and batch semantics do not work for
 *               interactive tutoring, so offering them is offering a broken
 *               duplicate. A custom slug still reaches them if anyone insists.
 *
 *   duplicate ids — defensive; the upstream list has none today.
 *
 * `:free` and `:thinking` are NOT duplicates. They are genuinely different
 * offerings of the model and both stay.
 */
let _modelCache = { at: 0, data: null };
const FALLBACK_MODELS = [
  { id: 'inclusionai/ling-3.0-tiny:free', name: 'Ling 3.0 Tiny (free)', free: true, promptPrice: 0, completionPrice: 0, context: null },
  { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', free: false, promptPrice: null, completionPrice: null, context: null },
  { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', free: false, promptPrice: null, completionPrice: null, context: null },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', free: false, promptPrice: null, completionPrice: null, context: null },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', free: false, promptPrice: null, completionPrice: null, context: null },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', free: false, promptPrice: null, completionPrice: null, context: null },
];

router.get('/models', async (_req, res) => {
  const now = Date.now();
  if (_modelCache.data && (now - _modelCache.at) < 3_600_000) return res.json(_modelCache.data);
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('openrouter ' + r.status);
    const j = await r.json();

    const seen = new Set();
    const models = (j.data || [])
      .filter(m => m?.id && !/:batch$/.test(m.id))
      .filter(m => (seen.has(m.id) ? false : seen.add(m.id)))
      .map(m => {
        const prompt = m.pricing?.prompt != null ? Number(m.pricing.prompt) : null;
        const completion = m.pricing?.completion != null ? Number(m.pricing.completion) : null;
        const rawProvider = m.id.split('/')[0];
        // A leading `~` marks a floating alias — `~anthropic/claude-sonnet-latest`
        // always resolves to the newest Sonnet. Grouped under the real vendor,
        // or the picker would show a phantom "~anthropic" next to "anthropic".
        const alias = rawProvider.startsWith('~');
        return {
          id: m.id,
          name: m.name || m.id,
          provider: alias ? rawProvider.slice(1) : rawProvider,
          // The part after the slash — what the model is actually called within
          // its vendor, and all the second dropdown needs to show.
          slug: m.id.slice(m.id.indexOf('/') + 1),
          alias,
          context: m.context_length || m.top_provider?.context_length || null,
          promptPrice: prompt,
          completionPrice: completion,
          // "Free" means it costs nothing to send AND nothing to receive.
          free: prompt === 0 && completion === 0,
        };
      })
      // Free models first — they are the hardest to find and the most asked
      // for — then everything else alphabetically.
      .sort((a, b) => (a.free === b.free ? a.id.localeCompare(b.id) : a.free ? -1 : 1));

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

// Learning Coach — the adaptive advisor. Derives a proficiency + pace read from
// REAL signals (recent quiz scores, assignment grades, node mastery, activity)
// and returns concrete, actionable recommendations that guide and adjust the
// learner's path. Heuristic (works without a key); the numbers are all real.
router.get('/coach', (req, res) => {
  const uid = req.userId;
  const quizzes = db.prepare('SELECT score FROM quiz_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(uid);
  const grades = db.prepare("SELECT grade FROM assignments WHERE user_id = ? AND status = 'graded' AND grade IS NOT NULL ORDER BY updated_at DESC LIMIT 5").all(uid);
  const nodes = db.prepare('SELECT rn.title, rn.mastery, rn.status, r.id AS roadmap_id, r.title AS roadmap FROM roadmap_nodes rn JOIN roadmaps r ON r.id = rn.roadmap_id WHERE r.user_id = ?').all(uid);
  const recent = db.prepare("SELECT COUNT(*) AS c FROM activity_log WHERE user_id = ? AND created_at >= date('now','-7 days')").get(uid).c;
  const pending = db.prepare("SELECT COUNT(*) AS c FROM assignments WHERE user_id = ? AND status != 'graded'").get(uid).c;

  const activeNode = nodes.find(n => n.status === 'active') || nodes.find(n => n.status === 'next');
  const weak = nodes.filter(n => n.status === 'done' && (n.mastery || 0) < 0.55)
    .sort((a, b) => (a.mastery || 0) - (b.mastery || 0)).slice(0, 3);

  const avg = (arr, f) => arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : null;
  const avgQuiz = avg(quizzes, q => q.score);
  const avgGrade = avg(grades, g => g.grade);
  const avgMastery = nodes.length ? avg(nodes, n => (n.mastery || 0) * 100) : null;
  const signals = [avgQuiz, avgGrade, avgMastery].filter(v => v != null);
  const proficiency = signals.length ? Math.round(signals.reduce((a, b) => a + b, 0) / signals.length) : null;
  const pace = recent >= 8 ? 'ahead' : recent >= 3 ? 'steady' : 'behind';

  const recs = [];
  if (activeNode) recs.push({ icon: 'play', tone: 'brand', title: `Continue: ${activeNode.title}`, detail: `Pick up your ${activeNode.roadmap} path where you left off.`, action: { screen: 'roadmaps', roadmap_id: activeNode.roadmap_id } });
  if (proficiency != null && proficiency >= 82) recs.push({ icon: 'spark', tone: 'good', title: "You're ahead — take a stretch", detail: 'Your recent scores are strong. Try a harder assignment or jump to the next module.', action: { screen: 'assignments' } });
  else if (proficiency != null && proficiency < 55) recs.push({ icon: 'chart', tone: 'warn', title: "Let's slow down and reinforce", detail: 'Recent results suggest reviewing fundamentals before moving on — a quiz will pinpoint gaps.', action: { screen: 'roadmaps', roadmap_id: activeNode?.roadmap_id } });
  for (const w of weak) recs.push({ icon: 'chart', tone: 'warn', title: `Revisit: ${w.title}`, detail: `Mastery is ${Math.round((w.mastery || 0) * 100)}% — a quick review or quiz will lift it.`, action: { screen: 'roadmaps', roadmap_id: w.roadmap_id } });
  if (pending > 0) recs.push({ icon: 'check', tone: 'brand', title: `${pending} assignment${pending === 1 ? '' : 's'} to complete`, detail: 'Submitting graded work is what moves your mastery the most.', action: { screen: 'assignments' } });
  if (avgQuiz == null) recs.push({ icon: 'check', tone: 'accent', title: 'Take a quiz to calibrate', detail: 'A short quiz lets the coach gauge your level and tailor the difficulty of what comes next.', action: { screen: 'roadmaps', roadmap_id: activeNode?.roadmap_id } });

  const paceMsg = pace === 'ahead' ? "You're moving fast — keep the momentum."
    : pace === 'steady' ? 'A steady, consistent pace — nicely done.'
    : 'You\'ve slowed down — even one short session today keeps your streak and momentum.';

  res.json({
    proficiency, pace, paceMsg,
    nextStep: activeNode ? { title: activeNode.title, roadmap: activeNode.roadmap, roadmap_id: activeNode.roadmap_id } : null,
    recommendations: recs.slice(0, 4),
    weakAreas: weak.map(w => w.title),
    signals: { quizzes: quizzes.length, grades: grades.length, activity7d: recent, pending },
  });
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
