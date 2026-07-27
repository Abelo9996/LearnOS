import { Router } from 'express';
import db, { awardXP, logActivity, awardBadge, updateStreak } from '../db/database.js';
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
  // Starting a session on a not-yet-done node makes it the active module — this
  // is the only thing that restores 'active' status, so the roadmap's active
  // ring/state was otherwise unreachable after the first completion.
  if (roadmap_node_id) {
    db.prepare("UPDATE roadmap_nodes SET status = 'active' WHERE id = ? AND status IN ('next','locked')").run(roadmap_node_id);
  }
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
    // Streak reflects LEARNING, not just visiting the Dashboard (updateStreak was
    // only called from GET /api/stats). Completing a session counts as activity.
    try { updateStreak(req.userId); } catch {}
    // AN agent fires autonomously on every session completion (P9).
    try { enqueueJob(req.userId, 'analyze-session', { sessionId: req.params.id }); } catch {}
    const sess = db.prepare('SELECT roadmap_id, roadmap_node_id FROM sessions WHERE id = ?').get(req.params.id);
    if (sess && sess.roadmap_node_id) {
      // Mastery is NOT hardcoded to 100% (that let one message = full mastery).
      // Completing a session earns an engagement baseline; the Analytics agent
      // (analyze-session, enqueued above) then writes the real computed mastery
      // back, and quizzes push it higher. Never lower an existing higher score.
      const cur = db.prepare('SELECT mastery FROM roadmap_nodes WHERE id = ?').get(sess.roadmap_node_id);
      const provided = (typeof mastery_score === 'number' && mastery_score >= 0 && mastery_score < 1) ? mastery_score : null;
      const newMastery = Math.max(cur?.mastery || 0, provided != null ? provided : 0.65);
      db.prepare("UPDATE roadmap_nodes SET status = 'done', mastery = ? WHERE id = ? AND roadmap_id = ?").run(newMastery, sess.roadmap_node_id, sess.roadmap_id);
      if (newMastery >= 0.8) {
        try { if (awardBadge(req.userId, 'Module mastered', 'star')) logActivity(req.userId, { kind: 'cert', text: 'Earned badge: Module mastered', sub: 'Reached 80% mastery', agent: 'CE' }); } catch {}
      }

      // Prerequisite-aware unlocking (was: unlock an arbitrary node in the next
      // column, ignoring the DAG). A locked node becomes 'next' once ALL of its
      // prerequisite nodes (roadmap_edges → this node) are 'done'.
      const locked = db.prepare("SELECT id FROM roadmap_nodes WHERE roadmap_id = ? AND status = 'locked'").all(sess.roadmap_id);
      for (const cand of locked) {
        const prereqs = db.prepare('SELECT from_node FROM roadmap_edges WHERE roadmap_id = ? AND to_node = ?').all(sess.roadmap_id, cand.id);
        const allDone = prereqs.length === 0 || prereqs.every(p => {
          const pn = db.prepare('SELECT status FROM roadmap_nodes WHERE id = ?').get(p.from_node);
          return pn && pn.status === 'done';
        });
        if (allDone) db.prepare("UPDATE roadmap_nodes SET status = 'next' WHERE id = ?").run(cand.id);
      }

      const node = db.prepare('SELECT col, row_idx, title FROM roadmap_nodes WHERE id = ?').get(sess.roadmap_node_id);
      if (node) {
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
      // Keep next_module / modules_left honest (they were frozen at generation,
      // so the Dashboard forever showed the first node and the full count).
      const upNext = db.prepare("SELECT title FROM roadmap_nodes WHERE roadmap_id = ? AND status IN ('active','next') ORDER BY col, row_idx LIMIT 1").get(sess.roadmap_id);
      db.prepare('UPDATE roadmaps SET mastery = ?, completed_modules = ?, next_module = ?, modules_left = ? WHERE id = ?')
        .run(avg.m, done, upNext?.title || 'Roadmap complete', Math.max(0, total - done), sess.roadmap_id);
      if (done === total && total > 0) {
        const rm = db.prepare('SELECT title FROM roadmaps WHERE id = ?').get(sess.roadmap_id);
        db.prepare('UPDATE roadmaps SET status = ? WHERE id = ?').run('completed', sess.roadmap_id);
        // Completing every module of a roadmap earns a certificate. On a
        // self-hosted single-user instance, finishing the path IS the credential.
        // (Previously gated on a verified course_slug that nothing ever set, so a
        // certificate could never be issued by any code path.)
        const has = db.prepare('SELECT COUNT(*) as c FROM certificates WHERE user_id = ? AND title = ?').get(req.userId, rm.title).c;
        if (!has) {
          const cid = 'ce-' + Date.now();
          // `verified` means "this instance verified the work was actually done"
          // — internally checkable, never externally accredited. The evidence
          // record is what the credential actually rests on, so it is captured
          // at issue time rather than reconstructed later.
          const evidence = {
            roadmap_id: sess.roadmap_id,
            nodes: db.prepare('SELECT title, mastery, status FROM roadmap_nodes WHERE roadmap_id = ?').all(sess.roadmap_id),
            averageMastery: avg.m,
            issuedFor: 'All modules in this roadmap reached the mastery threshold.',
          };
          db.prepare('INSERT INTO certificates (id, user_id, title, mastery, verified, id_short, evidence_json, issuer) VALUES (?, ?, ?, ?, 1, ?, ?, ?)')
            .run(cid, req.userId, rm.title, avg.m,
              'LOS-' + sess.roadmap_id.slice(-3).toUpperCase() + '-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9999)).padStart(4, '0'),
              JSON.stringify(evidence), 'self-attested');
          logActivity(req.userId, { kind: 'cert', text: `Earned certificate: ${rm.title}`, sub: 'Roadmap completed', xp: 200, agent: 'CE' });
          awardXP(req.userId, 200, { silent: true });
          try { awardBadge(req.userId, 'Roadmap complete', 'ribbon'); } catch {}
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
  // The client sends `agent`; accept both so agent attribution is actually
  // persisted (it was always NULL, so every reloaded message showed as "Tutor").
  const { role, agent_code, agent, body, kind, quiz } = req.body;
  if (!role) return res.status(400).json({ error: true, message: 'role required' });
  // Structured turns (e.g. an AS quiz card) legitimately have no prose body —
  // requiring one made every quiz message 400 and vanish on reload.
  const text = body != null ? body : '';
  if (!text && !quiz) return res.status(400).json({ error: true, message: 'body or quiz required' });
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  db.prepare('INSERT INTO session_messages (id, session_id, role, agent_code, body, kind) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.params.id, role, agent_code || agent || null, text, kind || 'text');
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
