/**
 * Assessment routes — M3 of docs/MASTERY_SPEC_V2.md.
 *
 * Practice is safe and unlimited; graded costs an attempt, has a pass bar, and
 * is what actually moves mastery and unlocks the next module. Questions are
 * drawn from the per-module item bank built during course generation, so a
 * retake isn't the identical paper and grading is deterministic.
 */
import { Router } from 'express';
import db, { logActivity, awardXP, awardBadge } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { gradeQuiz, runCodeTests, DEFAULT_PASS_THRESHOLD, DEFAULT_MAX_ATTEMPTS } from '../ai/assessment/grader.js';

const router = Router();
router.use(requireAuth);

const parse = (s, fb) => { try { return s ? JSON.parse(s) : fb; } catch { return fb; } };

function bankItems(moduleId) {
  return db.prepare('SELECT id, question, choices_json, answer_idx, explanation, difficulty, skill FROM quiz_items WHERE module_id = ?')
    .all(moduleId)
    .map(r => ({ id: r.id, question: r.question, choices: parse(r.choices_json, []), answer_idx: r.answer_idx, explanation: r.explanation, difficulty: r.difficulty, skill: r.skill }));
}

// Deterministic per-attempt shuffle so a retake draws a different subset without
// needing randomness we can't reproduce when re-grading.
function pick(items, n, seed) {
  const scored = items.map((it, i) => ({ it, k: hash(`${seed}:${it.id}:${i}`) }));
  scored.sort((a, b) => a.k - b.k);
  return scored.slice(0, Math.min(n, items.length)).map(s => s.it);
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }

function attemptsFor(userId, moduleId, mode) {
  return db.prepare('SELECT COUNT(*) c FROM quiz_attempts WHERE user_id = ? AND module_id = ? AND mode = ?').get(userId, moduleId, mode).c;
}

/**
 * GET /api/assessments/module/:moduleId/quiz?mode=practice|graded&count=10
 * Draws a paper from the item bank. Never returns answer keys.
 */
router.get('/module/:moduleId/quiz', (req, res) => {
  const moduleId = req.params.moduleId;
  const mode = req.query.mode === 'graded' ? 'graded' : 'practice';
  const items = bankItems(moduleId);
  if (!items.length) return res.status(404).json({ error: true, message: 'No question bank for this module yet' });

  const mod = db.prepare('SELECT id, title, course_slug FROM course_modules WHERE id = ?').get(moduleId);
  const used = attemptsFor(req.userId, moduleId, mode);

  if (mode === 'graded') {
    const lesson = db.prepare("SELECT max_attempts, pass_threshold FROM module_lessons WHERE module_id = ? AND is_graded = 1 LIMIT 1").get(moduleId);
    const max = lesson?.max_attempts ?? DEFAULT_MAX_ATTEMPTS;
    if (used >= max) {
      return res.status(409).json({ error: true, code: 'NO_ATTEMPTS_LEFT', message: `You have used all ${max} attempts for this graded assessment.`, attemptsUsed: used, maxAttempts: max });
    }
  }

  const count = Math.min(Math.max(parseInt(req.query.count, 10) || 10, 1), items.length);
  const paper = pick(items, count, `${req.userId}:${moduleId}:${mode}:${used}`);

  res.json({
    ok: true, mode,
    module: { id: moduleId, title: mod?.title || 'Module', course_slug: mod?.course_slug || null },
    attemptsUsed: used,
    maxAttempts: mode === 'graded' ? (db.prepare("SELECT max_attempts FROM module_lessons WHERE module_id = ? AND is_graded = 1 LIMIT 1").get(moduleId)?.max_attempts ?? DEFAULT_MAX_ATTEMPTS) : null,
    passThreshold: mode === 'graded' ? DEFAULT_PASS_THRESHOLD : null,
    questions: paper.map(q => ({ id: q.id, question: q.question, choices: q.choices, difficulty: q.difficulty, skill: q.skill })),
  });
});

/**
 * POST /api/assessments/module/:moduleId/submit  { mode, item_ids[], answers[] }
 * Grades deterministically from the bank. Practice never costs an attempt and
 * never changes a grade; graded enforces the limit, records pass/fail, moves
 * mastery, and unlocks the next node on a pass.
 */
router.post('/module/:moduleId/submit', (req, res) => {
  const moduleId = req.params.moduleId;
  const { mode: rawMode, item_ids, answers } = req.body || {};
  const mode = rawMode === 'graded' ? 'graded' : 'practice';
  if (!Array.isArray(item_ids) || !Array.isArray(answers) || !item_ids.length) {
    return res.status(400).json({ error: true, message: 'item_ids and answers required' });
  }

  const all = bankItems(moduleId);
  const byId = new Map(all.map(i => [i.id, i]));
  const items = item_ids.map(id => byId.get(id)).filter(Boolean);
  if (items.length !== item_ids.length) return res.status(400).json({ error: true, message: 'Unknown question in submission' });

  const gradedLesson = db.prepare("SELECT max_attempts, pass_threshold FROM module_lessons WHERE module_id = ? AND is_graded = 1 LIMIT 1").get(moduleId);
  const maxAttempts = gradedLesson?.max_attempts ?? DEFAULT_MAX_ATTEMPTS;
  const passThreshold = gradedLesson?.pass_threshold ?? DEFAULT_PASS_THRESHOLD;

  const used = attemptsFor(req.userId, moduleId, mode);
  if (mode === 'graded' && used >= maxAttempts) {
    return res.status(409).json({ error: true, code: 'NO_ATTEMPTS_LEFT', message: `You have used all ${maxAttempts} attempts.`, attemptsUsed: used, maxAttempts });
  }

  const g = gradeQuiz(items, answers, mode, passThreshold);
  const attemptNo = used + 1;
  const mod = db.prepare('SELECT id, title, course_slug FROM course_modules WHERE id = ?').get(moduleId);
  const exhausted = mode === 'graded' && attemptNo >= maxAttempts;

  try {
    db.prepare(`INSERT INTO quiz_attempts (id, user_id, node_id, title, total, correct, score, questions_json, answers_json, module_id, course_slug, mode, attempt_no, passed)
                VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(`qa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, req.userId,
        `${mode === 'graded' ? 'Graded' : 'Practice'} · ${mod?.title || 'Module'}`,
        g.total, g.correct, g.score, JSON.stringify(item_ids), JSON.stringify(answers),
        moduleId, mod?.course_slug || null, mode, attemptNo, g.passed ? 1 : 0);
  } catch { /* best effort */ }

  let unlocked = null;
  try {
    if (mode === 'practice') {
      // Practice earns a little XP but must never move a grade or mastery.
      awardXP(req.userId, Math.round(g.correct * 2));
      logActivity(req.userId, { kind: 'quiz', text: `Practice: ${mod?.title || 'Module'} — ${g.score}%`, sub: `${g.correct}/${g.total} correct · not graded`, xp: Math.round(g.correct * 2), agent: 'AS' });
    } else {
      const xp = g.passed ? g.correct * 5 + 20 : g.correct * 2;
      awardXP(req.userId, xp);
      logActivity(req.userId, { kind: 'quiz', text: `Graded: ${mod?.title || 'Module'} — ${g.score}%`, sub: `${g.passed ? 'PASSED' : 'not passed'} · attempt ${attemptNo}/${maxAttempts}`, xp, agent: 'AS' });
      if (g.passed) unlocked = applyMasteryForModule(req.userId, moduleId, g.ratio);
      if (g.passed && g.score === 100 && awardBadge(req.userId, 'Perfect graded assessment', 'check')) {
        logActivity(req.userId, { kind: 'cert', text: 'Earned badge: Perfect graded assessment', sub: mod?.title || '', xp: 0, agent: 'CE' });
      }
    }
  } catch { /* never fail the response on side-effects */ }

  // Once the attempt is passed or attempts are exhausted, release the
  // explanations so a graded assessment still teaches.
  const reveal = mode === 'practice' || g.passed || exhausted;
  const results = g.results.map((r, i) => reveal ? { ...r, explanation: items[i].explanation || '' } : r);

  res.json({
    ok: true, mode, score: g.score, correct: g.correct, total: g.total,
    passed: g.passed, passThreshold: mode === 'graded' ? passThreshold : null,
    attemptNo: mode === 'graded' ? attemptNo : null,
    maxAttempts: mode === 'graded' ? maxAttempts : null,
    attemptsLeft: mode === 'graded' ? Math.max(0, maxAttempts - attemptNo) : null,
    explanationsRevealed: reveal,
    unlocked, results,
  });
});

/**
 * POST /api/assessments/assignment/:id/run  { source }
 * Auto-grades a programming assignment: score == % of declared tests passed.
 */
router.post('/assignment/:id/run', (req, res) => {
  const a = db.prepare('SELECT id, user_id, title, tests_json, pass_threshold FROM assignments WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!a) return res.status(404).json({ error: true, message: 'Assignment not found' });
  const tests = parse(a.tests_json, []);
  if (!Array.isArray(tests) || !tests.length) {
    return res.status(400).json({ error: true, code: 'NO_TESTS', message: 'This assignment has no automated tests — submit it for rubric review instead.' });
  }

  const out = runCodeTests(req.body?.source, tests, { passThreshold: a.pass_threshold ?? DEFAULT_PASS_THRESHOLD });
  if (out.ok) {
    try {
      db.prepare('UPDATE assignments SET grade = ?, progress = ?, status = ? WHERE id = ?')
        .run(out.score, out.passed ? 100 : Math.round(out.ratio * 100), out.passed ? 'done' : 'doing', a.id);
      logActivity(req.userId, { kind: 'assignment', text: `Autograded: ${a.title} — ${out.score}%`, sub: `${out.passedCount}/${out.total} tests passed`, xp: out.passed ? 30 : 5, agent: 'AS' });
      awardXP(req.userId, out.passed ? 30 : 5);
    } catch { /* best effort */ }
  }
  res.json({ ok: true, ...out });
});

/** GET /api/assessments/module/:moduleId/attempts — history + remaining attempts. */
router.get('/module/:moduleId/attempts', (req, res) => {
  const rows = db.prepare('SELECT id, mode, attempt_no, score, correct, total, passed, created_at FROM quiz_attempts WHERE user_id = ? AND module_id = ? ORDER BY created_at DESC')
    .all(req.userId, req.params.moduleId);
  const max = db.prepare("SELECT max_attempts FROM module_lessons WHERE module_id = ? AND is_graded = 1 LIMIT 1").get(req.params.moduleId)?.max_attempts ?? DEFAULT_MAX_ATTEMPTS;
  const gradedUsed = rows.filter(r => r.mode === 'graded').length;
  res.json({
    ok: true, attempts: rows,
    graded: { used: gradedUsed, max, left: Math.max(0, max - gradedUsed), passed: rows.some(r => r.mode === 'graded' && r.passed) },
  });
});

// Passing a graded assessment is what moves mastery and opens the next module —
// progression is earned, not clicked.
function applyMasteryForModule(userId, moduleId, ratio) {
  const mod = db.prepare('SELECT title, course_slug FROM course_modules WHERE id = ?').get(moduleId);
  if (!mod) return null;
  const node = db.prepare('SELECT id, roadmap_id, mastery FROM roadmap_nodes WHERE course_slug = ? AND title = ? LIMIT 1').get(mod.course_slug, mod.title);
  if (!node) return null;

  const next = Math.max(node.mastery || 0, Math.round(ratio * 100) / 100);
  db.prepare("UPDATE roadmap_nodes SET mastery = ?, status = CASE WHEN ? >= 0.8 THEN 'done' ELSE status END WHERE id = ?").run(next, next, node.id);
  try {
    db.prepare(`INSERT INTO mastery_events (id, user_id, node_id, roadmap_id, event_type, mastery_before, mastery_after, delta, source)
                VALUES (?, ?, ?, ?, 'graded_assessment', ?, ?, ?, 'assessment')`)
      .run(`me-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, userId, node.id, node.roadmap_id, node.mastery || 0, next, next - (node.mastery || 0));
  } catch {}

  // Unlock only the direct successors whose prerequisites are now all done.
  const successors = db.prepare('SELECT to_node FROM roadmap_edges WHERE roadmap_id = ? AND from_node = ?').all(node.roadmap_id, node.id).map(r => r.to_node);
  const opened = [];
  for (const s of successors) {
    const prereqs = db.prepare('SELECT from_node FROM roadmap_edges WHERE roadmap_id = ? AND to_node = ?').all(node.roadmap_id, s).map(r => r.from_node);
    const allDone = prereqs.every(p => (db.prepare('SELECT status FROM roadmap_nodes WHERE id = ?').get(p)?.status) === 'done');
    if (allDone) {
      db.prepare("UPDATE roadmap_nodes SET status = 'active' WHERE id = ? AND status = 'locked'").run(s);
      const t = db.prepare('SELECT title FROM roadmap_nodes WHERE id = ?').get(s)?.title;
      if (t) opened.push(t);
    }
  }
  return opened.length ? { nextModules: opened } : null;
}

export default router;
