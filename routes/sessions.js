import { Router } from 'express';
import db, { awardXP, logActivity } from '../db/database.js';
import { enqueueJob } from '../ai/jobs.js';
import '../ai/agents/analytics.js'; // registers 'analyze-session' handler

const router = Router();

router.get('/', (req, res) => {
  const sessions = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(sessions);
});

router.get('/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!s) return res.status(404).json({ error: true, message: 'Session not found' });
  const messages = db.prepare('SELECT * FROM session_messages WHERE session_id = ? ORDER BY created_at').all(s.id);
  res.json({ ...s, messages });
});

router.post('/', (req, res) => {
  const { title, subtitle, agent, course, level, roadmap_id, roadmap_node_id } = req.body;
  if (!title) return res.status(400).json({ error: true, message: 'title required' });
  const id = `sess-${Date.now()}`;
  const total = db.prepare('SELECT COUNT(*) as c FROM sessions WHERE user_id = ? AND roadmap_id = ?').get(req.userId, roadmap_id || '')?.c || 0;
  db.prepare("INSERT INTO sessions (id, user_id, roadmap_id, roadmap_node_id, title, subtitle, agent, course, level, session_index, total_sessions, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')")
    .run(id, req.userId, roadmap_id || null, roadmap_node_id || null, title, subtitle || '', agent || 'TU', course, level, total + 1, 12);
  res.json({ ok: true, session: db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) });
});

router.patch('/:id', (req, res) => {
  const { status, duration_seconds, mastery_score } = req.body;
  const fields = []; const vals = [];
  if (status !== undefined)         { fields.push('status = ?');          vals.push(status); }
  if (duration_seconds !== undefined){ fields.push('duration_seconds = ?'); vals.push(duration_seconds); }
  if (mastery_score !== undefined)  { fields.push('mastery_score = ?');   vals.push(mastery_score); }
  if (fields.length === 0) return res.status(400).json({ error: true, message: 'No fields to update' });
  fields.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(req.params.id, req.userId);
  db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...vals);

  // Update roadmap node mastery when session completed
  if (status === 'completed') {
    // Descriptive feed entry (#25) + XP (silent so we don't double-log).
    const sTitle = db.prepare('SELECT title FROM sessions WHERE id = ?').get(req.params.id)?.title || 'Session';
    logActivity(req.userId, { kind: 'session', text: `Completed session: "${sTitle}"`, xp: 25, agent: 'TU' });
    awardXP(req.userId, 25, { silent: true });
    // AN agent fires autonomously on every session completion (P9).
    try { enqueueJob(req.userId, 'analyze-session', { sessionId: req.params.id }); } catch {}
    const sess = db.prepare('SELECT roadmap_id, roadmap_node_id FROM sessions WHERE id = ?').get(req.params.id);
    if (sess && sess.roadmap_node_id) {
      db.prepare("UPDATE roadmap_nodes SET status = 'done', mastery = 1.0 WHERE id = ? AND roadmap_id = ?").run(sess.roadmap_node_id, sess.roadmap_id);
      const node = db.prepare('SELECT col, row_idx, title FROM roadmap_nodes WHERE id = ?').get(sess.roadmap_node_id);
      if (node) {
        const next = db.prepare("SELECT id FROM roadmap_nodes WHERE roadmap_id = ? AND col = ? AND status = 'locked' LIMIT 1").get(sess.roadmap_id, node.col + 1);
        if (next) db.prepare("UPDATE roadmap_nodes SET status = 'next' WHERE id = ?").run(next.id);

        // Feed spaced review (#17): turn this module's objectives into due cards.
        const objectives = db.prepare('SELECT text FROM node_objectives WHERE node_id = ? ORDER BY order_idx').all(sess.roadmap_node_id);
        for (const o of objectives.slice(0, 4)) {
          const dupe = db.prepare('SELECT 1 FROM flashcards WHERE user_id = ? AND deck = ? AND back = ?').get(req.userId, node.title, o.text);
          if (!dupe) {
            db.prepare('INSERT INTO flashcards (id, user_id, deck, front, back) VALUES (?, ?, ?, ?, ?)')
              .run(`c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, req.userId, node.title, `Recall: ${o.text}`, o.text);
          }
        }
      }
    }
    if (sess.roadmap_id) {
      const avg = db.prepare('SELECT AVG(mastery) as m FROM roadmap_nodes WHERE roadmap_id = ?').get(sess.roadmap_id);
      const done = db.prepare("SELECT COUNT(*) as c FROM roadmap_nodes WHERE roadmap_id = ? AND status = 'done'").get(sess.roadmap_id).c;
      const total = db.prepare('SELECT COUNT(*) as c FROM roadmap_nodes WHERE roadmap_id = ?').get(sess.roadmap_id).c;
      db.prepare('UPDATE roadmaps SET mastery = ?, completed_modules = ? WHERE id = ?').run(avg.m, done, sess.roadmap_id);
      if (done === total && total > 0) {
        const rm = db.prepare('SELECT title, course_slug FROM roadmaps WHERE id = ?').get(sess.roadmap_id);
        db.prepare('UPDATE roadmaps SET status = ? WHERE id = ?').run('completed', sess.roadmap_id);
        // #21 — A verifiable certificate is only issued for LearnOS-verified courses.
        // A roadmap qualifies when it's tied to a course with verified = 1.
        const course = rm.course_slug
          ? db.prepare('SELECT slug, verified FROM courses WHERE slug = ?').get(rm.course_slug)
          : null;
        const isVerified = !!(course && course.verified);
        const has = db.prepare('SELECT COUNT(*) as c FROM certificates WHERE user_id = ? AND title = ?').get(req.userId, rm.title).c;
        if (isVerified && !has) {
          const cid = 'ce-' + Date.now();
          db.prepare('INSERT INTO certificates (id, user_id, title, mastery, verified, course_slug, id_short) VALUES (?, ?, ?, ?, 1, ?, ?)')
            .run(cid, req.userId, rm.title, avg.m, course.slug,
              'LOS-' + sess.roadmap_id.slice(-3).toUpperCase() + '-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random()*9999)).padStart(4,'0'));
          logActivity(req.userId, { kind: 'cert', text: `Earned certificate: ${rm.title}`, sub: 'Verified credential', xp: 200, agent: 'CE' });
          awardXP(req.userId, 200, { silent: true });
        } else if (!isVerified) {
          // Completion of an unverified/personal roadmap — recorded, but not a formal certificate.
          logActivity(req.userId, { kind: 'session', text: `Completed roadmap: ${rm.title}`, sub: 'Completion record (course not LearnOS-verified)', xp: 100, agent: 'CR' });
          awardXP(req.userId, 100, { silent: true });
        }
      }
    }
  }

  res.json({ ok: true, session: db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id) });
});

// Fetch the latest AN-agent analysis for a session (P9). Polls the
// agent_jobs table; returns latest 'analyze-session' job result for this user.
router.get('/:id/analysis', (req, res) => {
  const row = db.prepare(
    `SELECT result_json, status, error FROM agent_jobs
     WHERE user_id = ? AND kind = 'analyze-session'
       AND input_json LIKE ?
     ORDER BY created_at DESC LIMIT 1`
  ).get(req.userId, `%"sessionId":"${req.params.id}"%`);
  if (!row) return res.json({ status: 'none' });
  let result = null;
  try { result = row.result_json ? JSON.parse(row.result_json) : null; } catch {}
  res.json({ status: row.status, error: row.error, result });
});

// Whiteboard strokes (§3.10)
router.get('/:id/whiteboard', (req, res) => {
  const strokes = db.prepare('SELECT * FROM whiteboard_strokes WHERE session_id = ? ORDER BY created_at').all(req.params.id);
  res.json(strokes);
});

router.post('/:id/whiteboard', (req, res) => {
  const { stroke_json } = req.body;
  if (!stroke_json) return res.status(400).json({ error: true, message: 'stroke_json required' });
  const id = `wbs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.prepare('INSERT INTO whiteboard_strokes (id, session_id, stroke_json) VALUES (?, ?, ?)')
    .run(id, req.params.id, JSON.stringify(stroke_json));
  res.json({ ok: true, id });
});

router.delete('/:id/whiteboard/:strokeId', (req, res) => {
  db.prepare('DELETE FROM whiteboard_strokes WHERE id = ? AND session_id = ?').run(req.params.strokeId, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id/whiteboard', (req, res) => {
  db.prepare('DELETE FROM whiteboard_strokes WHERE session_id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Messages
router.post('/:id/messages', (req, res) => {
  const { role, agent_code, body, kind } = req.body;
  if (!role || !body) return res.status(400).json({ error: true, message: 'role and body required' });
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  db.prepare('INSERT INTO session_messages (id, session_id, role, agent_code, body, kind) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.params.id, role, agent_code || null, body, kind || 'text');
  const msg = db.prepare('SELECT * FROM session_messages WHERE id = ?').get(id);
  res.json({ ok: true, message: msg });
});

router.patch('/:id/messages/:mid', (req, res) => {
  const { user_rating } = req.body;
  if (user_rating !== undefined) {
    db.prepare('UPDATE session_messages SET user_rating = ? WHERE id = ? AND session_id = ?')
      .run(user_rating, req.params.mid, req.params.id);
  }
  res.json({ ok: true });
});

export default router;
