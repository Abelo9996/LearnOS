/**
 * AI layer routes: status, smoke-test ping, run log, usage (PLAT-01..06).
 * Mounted under /api/ai (auth-protected).
 */
import { Router } from 'express';
import db, { awardXP, logActivity, awardBadge } from '../db/database.js';
import { complete, hasManagedKey } from '../ai/llm.js';
import { claudeCodeStatus, CLAUDE_CODE_MODELS } from '../ai/providers/claudeCode.js';
import { generateAssignment, generateQuiz } from '../ai/agents/assessment.js';

const router = Router();

// Is the AI layer usable? An OpenRouter key (env or Settings), or the Claude
// subscription through a signed-in Claude Code CLI.
router.get('/status', async (req, res) => {
  const byok = db.prepare(
    "SELECT COUNT(*) AS c FROM api_keys WHERE user_id = ? AND provider = 'openrouter' AND is_active = 1"
  ).get(req.userId).c;
  const claudeCode = await claudeCodeStatus({ refresh: req.query.refresh === '1' }).catch(() => ({ installed: false, loggedIn: false }));
  const usesClaude = !!db.prepare("SELECT 1 FROM agent_routing WHERE user_id = ? AND model LIKE 'claude-code/%' LIMIT 1").get(req.userId);
  const claudeReady = usesClaude && claudeCode.installed && claudeCode.loggedIn !== false;
  res.json({ managed: hasManagedKey(), byok: byok > 0, claudeCode, usesClaude, ready: hasManagedKey() || byok > 0 || claudeReady });
});

/**
 * The OpenRouter model catalog (cached ~1h). The list endpoint is public, so no
 * key is needed to browse it.
 *
 * There are ~400 entries and LearnOS should offer all of them, including the
 * free ones, which are the whole reason somebody self-hosts this and brings
 * their own key. A learner asking for `inclusionai/ling-3.0-tiny:free` should
 * find it.
 *
 * Two kinds of noise are worth removing:
 *
 *   `:batch` , the same model behind OpenRouter's asynchronous batch endpoint.
 *               60 of the 401 entries. Every one is a second copy of a model
 *               already in the list, and batch semantics do not work for
 *               interactive tutoring, so offering them is offering a broken
 *               duplicate. A custom slug still reaches them if anyone insists.
 *
 *   duplicate ids, defensive; the upstream list has none today.
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

// The Claude subscription, offered as its own provider at the top of the
// picker: no key, no per-token price, runs through the local Claude Code CLI.
const CLAUDE_PLAN_MODELS = CLAUDE_CODE_MODELS.map(m => ({
  id: m.id, name: m.name, provider: 'claude-code', slug: m.slug, alias: false,
  context: 200000, promptPrice: null, completionPrice: null, free: false, subscription: true,
}));

router.get('/models', async (_req, res) => {
  const now = Date.now();
  if (_modelCache.data && (now - _modelCache.at) < 3_600_000) return res.json([...CLAUDE_PLAN_MODELS, ..._modelCache.data]);
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
        // A leading `~` marks a floating alias, `~anthropic/claude-sonnet-latest`
        // always resolves to the newest Sonnet. Grouped under the real vendor,
        // or the picker would show a phantom "~anthropic" next to "anthropic".
        const alias = rawProvider.startsWith('~');
        return {
          id: m.id,
          name: m.name || m.id,
          provider: alias ? rawProvider.slice(1) : rawProvider,
          // The part after the slash, what the model is actually called within
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
      // Free models first, they are the hardest to find and the most asked
      // for, then everything else alphabetically.
      .sort((a, b) => (a.free === b.free ? a.id.localeCompare(b.id) : a.free ? -1 : 1));

    _modelCache = { at: now, data: models };
    res.json([...CLAUDE_PLAN_MODELS, ...models]);
  } catch {
    res.json([...CLAUDE_PLAN_MODELS, ...(_modelCache.data || FALLBACK_MODELS)]);
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

// Learning Coach, the adaptive advisor. Derives a proficiency + pace read from
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
  if (proficiency != null && proficiency >= 82) recs.push({ icon: 'spark', tone: 'good', title: "You're ahead, take a stretch", detail: 'Your recent scores are strong. Try a harder assignment or jump to the next module.', action: { screen: 'assignments' } });
  else if (proficiency != null && proficiency < 55) recs.push({ icon: 'chart', tone: 'warn', title: "Let's slow down and reinforce", detail: 'Recent results suggest reviewing fundamentals before moving on, a quiz will pinpoint gaps.', action: { screen: 'roadmaps', roadmap_id: activeNode?.roadmap_id } });
  for (const w of weak) recs.push({ icon: 'chart', tone: 'warn', title: `Revisit: ${w.title}`, detail: `Mastery is ${Math.round((w.mastery || 0) * 100)}%, a quick review or quiz will lift it.`, action: { screen: 'roadmaps', roadmap_id: w.roadmap_id } });
  if (pending > 0) recs.push({ icon: 'check', tone: 'brand', title: `${pending} assignment${pending === 1 ? '' : 's'} to complete`, detail: 'Submitting graded work is what moves your mastery the most.', action: { screen: 'assignments' } });
  if (avgQuiz == null) recs.push({ icon: 'check', tone: 'accent', title: 'Take a quiz to calibrate', detail: 'A short quiz lets the coach gauge your level and tailor the difficulty of what comes next.', action: { screen: 'roadmaps', roadmap_id: activeNode?.roadmap_id } });

  const paceMsg = pace === 'ahead' ? "You're moving fast, keep the momentum."
    : pace === 'steady' ? 'A steady, consistent pace, nicely done.'
    : 'You\'ve slowed down, even one short session today keeps your streak and momentum.';

  res.json({
    proficiency, pace, paceMsg,
    nextStep: activeNode ? { title: activeNode.title, roadmap: activeNode.roadmap, roadmap_id: activeNode.roadmap_id } : null,
    recommendations: recs.slice(0, 4),
    weakAreas: weak.map(w => w.title),
    signals: { quizzes: quizzes.length, grades: grades.length, activity7d: recent, pending },
  });
});

// Recent agent runs, observability (PLAT-05).
router.get('/runs', (req, res) => {
  const runs = db.prepare(
    `SELECT id, agent_code, model, managed, input_tokens, output_tokens,
            cache_read_tokens, cache_write_tokens, cost_usd, latency_ms, status, error, created_at
     FROM agent_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
  ).all(req.userId);
  res.json(runs);
});

// Managed-tier usage for the current month (feeds caps later, AI-6).
router.get('/usage', (req, res) => {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const row = db.prepare('SELECT * FROM usage_counters WHERE user_id = ? AND period = ?').get(req.userId, period)
    || { user_id: req.userId, period, tokens: 0, cost_usd: 0, requests: 0 };
  res.json(row);
});


// Chat endpoint for the Session frontend (TU agent, with citations §3.7)
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
        const resBlock = resources.map((r, i) => `[${i + 1}] "${r.title}", ${r.source} (${r.url})`).join('\n');
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
// ── Lesson tutor ─────────────────────────────────────────────────────────────
// The tutor a learner talks to WHILE reading a lesson. It is given the lesson
// itself, the module's objectives, the learner's level and what they recently
// got wrong, so it explains *this* material in *this* course's terms instead of
// answering like a generic chatbot that has never seen the page.
const TUTOR_SYSTEM = `You are the tutor inside LearnOS, sitting next to a learner who is reading the lesson below. You know this lesson, its course and this learner.

How you teach:
- Answer the question that was asked, at the learner's level, in the lesson's own notation and examples. Point to the section of the lesson you are drawing on ("in the worked example above...").
- When they are stuck, find the specific step they are missing and explain that, rather than re-explaining everything.
- For the lesson's practice problems: give a hint first, and the full solution only if they ask for it again or show their attempt. Never paste the solution text from the lesson unprompted.
- When they ask you to check their understanding, ask one focused question at a time and react to their answer.
- If the question goes beyond the lesson, answer briefly, then connect it back.
- If the lesson itself looks wrong, say so plainly and explain the correct version.
- Respect length requests exactly. By default keep replies short: a few sentences or a short list, then offer to go deeper.
- Use Markdown; write math in LaTeX ($...$ inline, $$...$$ display).`;

try {
  db.exec(`CREATE TABLE IF NOT EXISTS lesson_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_lesson_chats ON lesson_chats(user_id, lesson_id)');
} catch { /* already there */ }

function lessonContext(userId, lessonId) {
  const l = db.prepare(`SELECT ml.id, ml.title, ml.kind, ml.body_md, ml.module_id, cm.title AS module_title, cm.objectives, cm.course_slug,
                               c.title AS course_title, c.level
                        FROM module_lessons ml JOIN course_modules cm ON cm.id = ml.module_id JOIN courses c ON c.slug = cm.course_slug
                        WHERE ml.id = ?`).get(lessonId);
  if (!l) return null;
  let objectives = [];
  try { objectives = JSON.parse(l.objectives || '[]'); } catch {}
  const profile = db.prepare('SELECT level, background, learning_style FROM user_profiles WHERE user_id = ?').get(userId) || {};
  // What they got wrong in this module's quizzes lately: the best signal of
  // where the explanation should aim.
  const misses = [];
  try {
    const attempts = db.prepare("SELECT questions_json, answers_json FROM quiz_attempts WHERE user_id = ? AND module_id = ? ORDER BY created_at DESC LIMIT 3").all(userId, l.module_id);
    for (const a of attempts) {
      const ids = JSON.parse(a.questions_json || '[]');
      const answers = JSON.parse(a.answers_json || '[]');
      ids.forEach((id, i) => {
        const q = db.prepare('SELECT question, answer_idx FROM quiz_items WHERE id = ?').get(id);
        if (q && answers[i] !== q.answer_idx && !misses.includes(q.question)) misses.push(q.question);
      });
    }
  } catch { /* no attempts yet */ }
  const body = String(l.body_md || '').slice(0, 24000);
  return {
    lesson: l,
    system: [
      TUTOR_SYSTEM,
      '',
      `Course: ${l.course_title}${l.level ? ` (${l.level})` : ''}`,
      `Module: ${l.module_title}${objectives.length ? `. Objectives: ${objectives.join('; ')}` : ''}`,
      `Learner: level ${profile.level || 'unknown'}${profile.background ? `; background: ${String(profile.background).slice(0, 300)}` : ''}${profile.learning_style ? `; prefers: ${String(profile.learning_style).slice(0, 120)}` : ''}`,
      misses.length ? `Recently answered wrong in this module's quizzes: ${misses.slice(0, 5).map(q => `"${q.slice(0, 200)}"`).join('; ')}` : null,
      '',
      `--- THE LESSON THE LEARNER IS READING: "${l.title}" ---`,
      body || '(This lesson has no text; it is an exercise or a resource.)',
      '--- END OF LESSON ---',
    ].filter(x => x != null).join('\n'),
  };
}

router.get('/lesson-tutor/:lessonId', (req, res) => {
  const rows = db.prepare('SELECT role, content, created_at FROM lesson_chats WHERE user_id = ? AND lesson_id = ? ORDER BY id').all(req.userId, req.params.lessonId);
  res.json({ messages: rows });
});

router.delete('/lesson-tutor/:lessonId', (req, res) => {
  db.prepare('DELETE FROM lesson_chats WHERE user_id = ? AND lesson_id = ?').run(req.userId, req.params.lessonId);
  res.json({ ok: true });
});

router.post('/lesson-tutor/:lessonId', async (req, res) => {
  const text = String(req.body?.message || '').trim().slice(0, 4000);
  if (!text) return res.status(400).json({ error: true, message: 'message required' });
  const ctx = lessonContext(req.userId, req.params.lessonId);
  if (!ctx) return res.status(404).json({ error: true, message: 'Lesson not found' });
  const history = db.prepare('SELECT role, content FROM lesson_chats WHERE user_id = ? AND lesson_id = ? ORDER BY id DESC LIMIT 16').all(req.userId, req.params.lessonId).reverse();
  try {
    const out = await complete({
      userId: req.userId,
      agentCode: 'TU',
      system: ctx.system,
      messages: [...history.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: text }],
      maxTokens: 2500,
      // A tutor has to answer while the learner is still looking at the page.
      reasoning: 'off',
    });
    const reply = String(out.text || '').trim();
    if (!reply) throw new Error('The tutor returned an empty reply. Try again.');
    const ins = db.prepare('INSERT INTO lesson_chats (user_id, lesson_id, role, content) VALUES (?, ?, ?, ?)');
    ins.run(req.userId, req.params.lessonId, 'user', text);
    ins.run(req.userId, req.params.lessonId, 'assistant', reply);
    res.json({ ok: true, reply, model: out.model });
  } catch (e) {
    res.status(e.code === 'NO_KEY' ? 400 : 502).json({ error: true, code: e.code || null, message: e.message });
  }
});

// AS agent, quiz generation (P8).
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
    logActivity(req.userId, { kind: 'quiz', text: `Quiz: ${title || 'Module quiz'}, ${score}%`, sub: `${correct}/${total} correct`, xp, agent: 'AS' });
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

// AS agent, real, node-aware assignment generation (G3).
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
