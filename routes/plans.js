/**
 * Study plans & honest credentials — M11 of docs/MASTERY_SPEC_V2.md §3.8.
 *
 * Pacing: a 115-hour course with no weekly plan is where most online learners
 * quietly stop. A plan converts a vague intention into a target date and an
 * hours-per-week budget, then keeps score honestly — including telling you the
 * date is no longer reachable at your current rate, rather than letting you
 * drift into it.
 *
 * Credentials: Coursera's real moat is employer recognition. We have none of it
 * and must never imply otherwise. What we can offer instead is EVIDENCE —
 * exactly what was assessed, the scores, the dates, and whether the questions
 * were independently checked.
 */
import { Router } from 'express';
import db, { logActivity } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const DAY = 86400000;
const parse = (s, fb) => { try { return s ? JSON.parse(s) : fb; } catch { return fb; } };
const iso = (d) => new Date(d).toISOString().split('T')[0];

/** Hours of content remaining in a scope, and how much is already done. */
function scopeProgress(userId, scopeType, scopeId) {
  if (scopeType === 'course') {
    const course = db.prepare('SELECT slug, title, hours FROM courses WHERE slug = ?').get(scopeId);
    if (!course) return null;
    const total = db.prepare(`SELECT COALESCE(SUM(l.estimated_minutes),0) m, COUNT(*) c
                              FROM module_lessons l JOIN course_modules mo ON mo.id = l.module_id
                              WHERE mo.course_slug = ?`).get(scopeId);
    const done = db.prepare(`SELECT COALESCE(SUM(l.estimated_minutes),0) m, COUNT(*) c
                             FROM enrollment_progress p
                             JOIN module_lessons l ON l.id = p.lesson_id
                             WHERE p.user_id = ? AND p.course_slug = ?`).get(userId, scopeId);
    const totalMinutes = total.m || (course.hours || 0) * 60;
    return {
      title: course.title,
      totalMinutes, doneMinutes: done.m || 0,
      totalLessons: total.c, doneLessons: done.c,
    };
  }
  const rm = db.prepare('SELECT id, title FROM roadmaps WHERE id = ? AND user_id = ?').get(scopeId, userId);
  if (!rm) return null;
  const nodes = db.prepare('SELECT status FROM roadmap_nodes WHERE roadmap_id = ?').all(scopeId);
  const doneCount = nodes.filter(n => n.status === 'done').length;
  // Roadmap nodes have no intrinsic minutes, so estimate from a nominal module.
  const PER_NODE_MIN = 300;
  return {
    title: rm.title,
    totalMinutes: nodes.length * PER_NODE_MIN, doneMinutes: doneCount * PER_NODE_MIN,
    totalLessons: nodes.length, doneLessons: doneCount,
  };
}

/** Actual study minutes per week, from the activity log. */
function recentWeeklyMinutes(userId, weeks = 3) {
  const rows = db.prepare(`SELECT COUNT(*) c FROM activity_log
                           WHERE user_id = ? AND created_at >= date('now', ?)`).get(userId, `-${weeks * 7} days`);
  // Each logged learning event stands in for roughly one item of work.
  return Math.round(((rows.c || 0) * 15) / weeks);
}

function planStatus(userId, plan) {
  const prog = scopeProgress(userId, plan.scope_type, plan.scope_id);
  if (!prog) return null;
  const remainingMinutes = Math.max(0, prog.totalMinutes - prog.doneMinutes);
  const actualWeekly = recentWeeklyMinutes(userId);
  const plannedWeekly = (plan.weekly_hours || 5) * 60;

  const weeksAtPlan = plannedWeekly > 0 ? remainingMinutes / plannedWeekly : Infinity;
  const weeksAtActual = actualWeekly > 0 ? remainingMinutes / actualWeekly : Infinity;
  const projectedFinish = Number.isFinite(weeksAtActual) ? iso(Date.now() + weeksAtActual * 7 * DAY) : null;

  let requiredWeekly = null, verdict = 'no_target', message;
  if (plan.target_date) {
    const daysLeft = Math.max(0, (new Date(plan.target_date).getTime() - Date.now()) / DAY);
    const weeksLeft = daysLeft / 7;
    requiredWeekly = weeksLeft > 0 ? remainingMinutes / weeksLeft : Infinity;

    if (remainingMinutes === 0) { verdict = 'complete'; message = 'You have finished this.'; }
    else if (!Number.isFinite(requiredWeekly)) { verdict = 'missed'; message = 'The target date has passed — pick a new one.'; }
    else if (requiredWeekly <= plannedWeekly * 1.05) {
      verdict = actualWeekly >= requiredWeekly ? 'on_track' : 'behind';
      message = verdict === 'on_track'
        ? `On track — about ${Math.round(requiredWeekly / 60)}h/week gets you there.`
        : `You're studying ~${Math.round(actualWeekly / 60)}h/week but need ~${Math.round(requiredWeekly / 60)}h/week to hit ${plan.target_date}.`;
    } else {
      // Honesty over encouragement: say the date is unreachable at the agreed budget.
      verdict = 'unrealistic';
      message = `Hitting ${plan.target_date} needs ~${Math.round(requiredWeekly / 60)}h/week, well above the ${plan.weekly_hours}h/week you planned. Either move the date to ${projectedFinish || 'later'} or raise your weekly hours.`;
    }
  } else {
    message = actualWeekly > 0
      ? `At ~${Math.round(actualWeekly / 60)}h/week you'd finish around ${projectedFinish}.`
      : 'No study activity recorded yet this month.';
  }

  return {
    ...plan,
    title: prog.title,
    totalHours: Math.round(prog.totalMinutes / 60),
    doneHours: Math.round(prog.doneMinutes / 60),
    remainingHours: Math.round(remainingMinutes / 60),
    percentComplete: prog.totalMinutes ? Math.round((prog.doneMinutes / prog.totalMinutes) * 100) : 0,
    actualWeeklyHours: Math.round((actualWeekly / 60) * 10) / 10,
    requiredWeeklyHours: requiredWeekly != null && Number.isFinite(requiredWeekly) ? Math.round((requiredWeekly / 60) * 10) / 10 : null,
    projectedFinish, verdict, message,
  };
}

/** POST /api/plans — commit to a target date and a weekly budget. */
router.post('/', (req, res) => {
  const { scope_type, scope_id, target_date, weekly_hours } = req.body || {};
  if (!['course', 'roadmap'].includes(scope_type)) return res.status(400).json({ error: true, message: "scope_type must be 'course' or 'roadmap'" });
  if (!scope_id) return res.status(400).json({ error: true, message: 'scope_id required' });
  if (!scopeProgress(req.userId, scope_type, scope_id)) return res.status(404).json({ error: true, message: 'That course or roadmap does not exist' });
  if (target_date && Number.isNaN(new Date(target_date).getTime())) return res.status(400).json({ error: true, message: 'target_date must be a date' });

  const hours = Math.max(0.5, Math.min(60, Number(weekly_hours) || 5));
  db.prepare("UPDATE learning_plans SET status = 'superseded' WHERE user_id = ? AND scope_type = ? AND scope_id = ? AND status = 'active'")
    .run(req.userId, scope_type, scope_id);

  const id = `lp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  db.prepare('INSERT INTO learning_plans (id, user_id, scope_type, scope_id, target_date, weekly_hours) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, scope_type, scope_id, target_date || null, hours);

  const plan = db.prepare('SELECT * FROM learning_plans WHERE id = ?').get(id);
  try { logActivity(req.userId, { kind: 'session', text: `Study plan set: ${hours}h/week`, sub: target_date ? `target ${target_date}` : 'no target date', agent: 'AN' }); } catch {}
  res.json({ ok: true, plan: planStatus(req.userId, plan) });
});

/** GET /api/plans — active plans with an honest verdict on each. */
router.get('/', (req, res) => {
  const plans = db.prepare("SELECT * FROM learning_plans WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC").all(req.userId);
  res.json({ ok: true, plans: plans.map(p => planStatus(req.userId, p)).filter(Boolean) });
});

/** DELETE /api/plans/:id */
router.delete('/:id', (req, res) => {
  const r = db.prepare("UPDATE learning_plans SET status = 'abandoned' WHERE id = ? AND user_id = ?").run(req.params.id, req.userId);
  if (!r.changes) return res.status(404).json({ error: true, message: 'Plan not found' });
  res.json({ ok: true });
});

/**
 * GET /api/plans/certificate/:id/evidence
 *
 * What a credential actually rests on. We cannot offer employer recognition, so
 * we offer the record instead: the assessments passed, their scores and dates,
 * and how many of the questions were independently verified.
 */
router.get('/certificate/:id/evidence', (req, res) => {
  const cert = db.prepare('SELECT * FROM certificates WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!cert) return res.status(404).json({ error: true, message: 'Certificate not found' });

  const stored = parse(cert.evidence_json, null);
  const attempts = db.prepare(`SELECT title, score, correct, total, mode, passed, created_at, module_id
                               FROM quiz_attempts WHERE user_id = ? AND mode = 'graded' AND passed = 1
                               ${cert.course_slug ? 'AND course_slug = ?' : ''} ORDER BY created_at`)
    .all(...(cert.course_slug ? [req.userId, cert.course_slug] : [req.userId]));

  const moduleIds = [...new Set(attempts.map(a => a.module_id).filter(Boolean))];
  let verified = { confirmed: 0, total: 0 };
  if (moduleIds.length) {
    const row = db.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN verification_status = 'confirmed' THEN 1 ELSE 0 END) confirmed
                            FROM quiz_items WHERE module_id IN (${moduleIds.map(() => '?').join(',')})`).get(...moduleIds);
    verified = { confirmed: row.confirmed || 0, total: row.total || 0 };
  }

  res.json({
    ok: true,
    certificate: { id: cert.id, title: cert.title, issued_at: cert.issued_at, mastery: cert.mastery, id_short: cert.id_short },
    issuer: cert.issuer || 'self-attested',
    // Stated plainly, in the payload, so no UI can quietly imply otherwise.
    recognition: 'This certificate is self-attested by your own LearnOS instance. It records what you demonstrably completed here. It is not accredited and carries no employer or institutional recognition.',
    assessments: attempts.map(a => ({ title: a.title, score: a.score, correct: a.correct, total: a.total, date: a.created_at })),
    assessmentsPassed: attempts.length,
    questionVerification: verified,
    evidence: stored,
  });
});

export default router;
