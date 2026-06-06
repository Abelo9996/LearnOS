import { Router } from 'express';
import db, { awardXP, logActivity } from '../db/database.js';
import { enqueueJob } from '../ai/jobs.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', (req, res) => {
  const status = req.query.status;
  let query = 'SELECT * FROM assignments WHERE user_id = ?';
  const params = [req.userId];
  if (status) { query += ' AND status = ?'; params.push(status); }
  query += ' ORDER BY due_date ASC';
  const assignments = db.prepare(query).all(...params);
  res.json(assignments);
});

router.get('/:id', (req, res) => {
  const a = db.prepare('SELECT * FROM assignments WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!a) return res.status(404).json({ error: true, message: 'Assignment not found' });
  res.json(a);
});

router.post('/', (req, res) => {
  const { title, course, priority, estimated_minutes, due_date, kind, description, tasks } = req.body;
  if (!title || !course) return res.status(400).json({ error: true, message: 'title and course required' });
  const id = `a-${Date.now()}-${Math.random().toString(36).slice(2,5)}`;
  db.prepare('INSERT INTO assignments (id, user_id, title, course, priority, estimated_minutes, due_date, kind, description, tasks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, title, course, priority || 'med', estimated_minutes || 60, due_date || null,
      kind || 'homework', description || null, JSON.stringify(Array.isArray(tasks) ? tasks : []));
  res.json({ ok: true, assignment: db.prepare('SELECT * FROM assignments WHERE id = ?').get(id) });
});

router.patch('/:id', (req, res) => {
  const { title, status, progress, grade, priority, due_date } = req.body;
  const fields = []; const vals = [];
  if (title !== undefined)   { fields.push('title = ?');     vals.push(title); }
  if (status !== undefined)  { fields.push('status = ?');    vals.push(status); }
  if (progress !== undefined){ fields.push('progress = ?');  vals.push(progress); }
  if (grade !== undefined)   { fields.push('grade = ?');     vals.push(grade); }
  if (priority !== undefined){ fields.push('priority = ?');  vals.push(priority); }
  if (due_date !== undefined){ fields.push('due_date = ?');  vals.push(due_date); }
  if (fields.length === 0) return res.status(400).json({ error: true, message: 'No fields to update' });
  fields.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(req.params.id, req.userId);
  db.prepare(`UPDATE assignments SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...vals);

  // Feed integration (#25): log real assignment activity.
  const a = db.prepare('SELECT title, course FROM assignments WHERE id = ?').get(req.params.id);
  if (a) {
    if (status === 'graded' && grade !== undefined && grade !== null) {
      logActivity(req.userId, { kind: 'assignment', text: `Submitted & graded: "${a.title}" — ${grade}%`, sub: a.course, xp: 50, agent: 'AS' });
      awardXP(req.userId, 50, { silent: true });
    } else if (status === 'submitted' || status === 'done') {
      logActivity(req.userId, { kind: 'assignment', text: `Submitted assignment: "${a.title}"`, sub: a.course, xp: 50, agent: 'AS' });
      awardXP(req.userId, 50, { silent: true });
    }
  }
  res.json({ ok: true, assignment: db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM assignments WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// ── Assignment submissions + LLM grading (§3.5) ──────────────────────────────

router.post('/:id/submit', requireAuth, (req, res) => {
  const { body_md } = req.body;
  if (!body_md) return res.status(400).json({ error: true, message: 'body_md required' });
  const a = db.prepare('SELECT * FROM assignments WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!a) return res.status(404).json({ error: true, message: 'Assignment not found' });
  const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.prepare('INSERT INTO assignment_submissions (id, assignment_id, user_id, body_md) VALUES (?, ?, ?, ?)')
    .run(id, req.params.id, req.userId, body_md);
  // Enqueue grading job
  try { enqueueJob(req.userId, 'grade-assignment', { submissionId: id }); } catch {}
  logActivity(req.userId, { kind: 'assignment', text: `Submitted assignment: "${a.title}"`, sub: a.course, xp: 30, agent: 'AS' });
  awardXP(req.userId, 30, { silent: true });
  res.json({ ok: true, submission: db.prepare('SELECT * FROM assignment_submissions WHERE id = ?').get(id) });
});

router.get('/:id/submission', requireAuth, (req, res) => {
  const sub = db.prepare('SELECT * FROM assignment_submissions WHERE assignment_id = ? AND user_id = ? ORDER BY submitted_at DESC LIMIT 1').get(req.params.id, req.userId);
  if (!sub) return res.json({ status: 'none' });
  res.json({ status: sub.grade != null ? 'graded' : 'pending', submission: sub });
});

export default router;
