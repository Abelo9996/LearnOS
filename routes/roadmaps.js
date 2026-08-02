import { Router } from 'express';
import db from '../db/database.js';
import { enqueueJob } from '../ai/jobs.js';
import '../ai/agents/curriculum.js'; // registers the 'generate-roadmap' job handler
import '../ai/agents/specialization.js'; // registers 'plan-specialization' + 'build-pathway-course'
import { applyPlacement } from '../ai/agents/specialization.js';

const router = Router();

// ── Specializations (M4) ────────────────────────────────────────────────────
// A pathway of whole COURSES from where the learner is (A) to their goal (B).

// Plan one from a goal. Async → jobId.
router.post('/specialization', (req, res) => {
  const { goal, level } = req.body || {};
  if (!goal || !String(goal).trim()) return res.status(400).json({ error: true, message: 'goal required' });
  const jobId = enqueueJob(req.userId, 'plan-specialization', { goal: String(goal).trim().slice(0, 400), level });
  res.json({ ok: true, jobId });
});

// The placement diagnostic — answer keys are never sent to the client.
router.get('/:id/placement', (req, res) => {
  const rm = db.prepare('SELECT id, title, goal, placement_json FROM roadmaps WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!rm) return res.status(404).json({ error: true, message: 'Roadmap not found' });
  let qs = [];
  try { qs = JSON.parse(rm.placement_json || '[]'); } catch {}
  if (!qs.length) return res.status(404).json({ error: true, code: 'NO_PLACEMENT', message: 'This pathway has no placement diagnostic.' });
  res.json({
    ok: true, roadmap: { id: rm.id, title: rm.title, goal: rm.goal },
    questions: qs.map((q, i) => ({ index: i, question: q.question, choices: q.choices, skill: q.skill, course_index: q.course_index })),
  });
});

// Score it and move the learner to their real starting point.
router.post('/:id/placement/submit', (req, res) => {
  const { answers } = req.body || {};
  if (!Array.isArray(answers)) return res.status(400).json({ error: true, message: 'answers required' });
  const out = applyPlacement(req.userId, req.params.id, answers);
  if (!out) return res.status(404).json({ error: true, message: 'No placement diagnostic for this roadmap' });
  res.json({ ok: true, ...out });
});

// Build the course behind a pathway node, on demand. Async → jobId.
router.post('/:id/nodes/:nodeId/build', (req, res) => {
  const node = db.prepare('SELECT id, course_slug, build_status FROM roadmap_nodes WHERE id = ? AND roadmap_id = ?').get(req.params.nodeId, req.params.id);
  if (!node) return res.status(404).json({ error: true, message: 'Node not found' });
  if (node.course_slug) return res.json({ ok: true, alreadyBuilt: true, slug: node.course_slug });
  const jobId = enqueueJob(req.userId, 'build-pathway-course', { node_id: node.id, level: req.body?.level });
  res.json({ ok: true, jobId });
});

// Generate a real roadmap from a goal (CR-2). Runs async → returns a jobId.
router.post('/generate', (req, res) => {
  const { goal, profile } = req.body;
  if (!goal || !String(goal).trim()) return res.status(400).json({ error: true, message: 'goal required' });
  const jobId = enqueueJob(req.userId, 'generate-roadmap', { goal: String(goal).trim(), profile: profile || null });
  res.json({ ok: true, jobId });
});

/**
 * GET / — the learner's roadmaps.
 *
 * Building a course also writes a private companion roadmap (`rm-<slug>`) whose
 * nodes are that course's modules. It exists because module mastery is tracked
 * on roadmap_nodes — see applyMasteryForModule in routes/assessments.js — not
 * because a course is a roadmap. A course is a course, and listing it beside
 * real pathways made "your roadmaps" a mix of two different things and counted
 * every course twice.
 *
 * So the companions stay as the progress structure they are, and never appear
 * here. `course_slug IS NULL` is the structural test: a roadmap that points at
 * one course IS that course.
 */
router.get('/', (req, res) => {
  const roadmaps = db.prepare(
    'SELECT * FROM roadmaps WHERE user_id = ? AND course_slug IS NULL ORDER BY created_at'
  ).all(req.userId);
  res.json(roadmaps);
});

router.get('/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM roadmaps WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!r) return res.status(404).json({ error: true, message: 'Roadmap not found' });
  const nodes = db.prepare('SELECT * FROM roadmap_nodes WHERE roadmap_id = ? ORDER BY col, row_idx').all(r.id);
  const edges = db.prepare('SELECT from_node, to_node FROM roadmap_edges WHERE roadmap_id = ?').all(r.id);
  const objsByNode = {};
  for (const o of db.prepare('SELECT node_id, text FROM node_objectives WHERE roadmap_id = ? ORDER BY order_idx').all(r.id)) {
    (objsByNode[o.node_id] ||= []).push(o.text);
  }
  // Attach the size of each stage's course where one has been built, so the map
  // can say what a stage actually is — "11 modules · 150 lessons · 114h" — and
  // not just show a title and a percentage.
  const sizeOf = db.prepare(`SELECT c.hours,
      (SELECT COUNT(*) FROM course_modules m WHERE m.course_slug = c.slug) modules,
      (SELECT COUNT(*) FROM module_lessons l JOIN course_modules m ON m.id = l.module_id WHERE m.course_slug = c.slug) lessons
    FROM courses c WHERE c.slug = ?`);
  nodes.forEach(n => {
    n.objectives = objsByNode[n.id] || [];
    if (n.course_slug) {
      try { n.course = sizeOf.get(n.course_slug) || null; } catch { n.course = null; }
    }
  });
  res.json({ ...r, nodes, edges: edges.map(e => [e.from_node, e.to_node]) });
});

router.patch('/:id', (req, res) => {
  const { title, subtitle, mastery, status, next_module, modules_left } = req.body;
  const fields = []; const vals = [];
  if (title !== undefined)       { fields.push('title = ?');        vals.push(title); }
  if (subtitle !== undefined)    { fields.push('subtitle = ?');     vals.push(subtitle); }
  if (mastery !== undefined)     { fields.push('mastery = ?');      vals.push(mastery); }
  if (status !== undefined)      { fields.push('status = ?');       vals.push(status); }
  if (next_module !== undefined) { fields.push('next_module = ?');  vals.push(next_module); }
  if (modules_left !== undefined){ fields.push('modules_left = ?'); vals.push(modules_left); }
  if (fields.length === 0) return res.status(400).json({ error: true, message: 'No fields to update' });
  fields.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(req.params.id, req.userId);
  db.prepare(`UPDATE roadmaps SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...vals);
  res.json({ ok: true, roadmap: db.prepare('SELECT * FROM roadmaps WHERE id = ?').get(req.params.id) });
});

// Delete a roadmap and its content. Sessions are kept as history but detached
// (sessions.roadmap_id has no ON DELETE action, so they must be unlinked first
// or the FK blocks the delete).
router.delete('/:id', (req, res) => {
  const r = db.prepare('SELECT id FROM roadmaps WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!r) return res.status(404).json({ error: true, message: 'Roadmap not found' });
  const tx = db.transaction(() => {
    const nodeIds = db.prepare('SELECT id FROM roadmap_nodes WHERE roadmap_id = ?').all(r.id).map(n => n.id);
    db.prepare('UPDATE sessions SET roadmap_id = NULL, roadmap_node_id = NULL WHERE roadmap_id = ?').run(r.id);
    db.prepare('DELETE FROM node_objectives WHERE roadmap_id = ?').run(r.id);
    db.prepare('DELETE FROM node_resources WHERE roadmap_id = ?').run(r.id);
    for (const nid of nodeIds) db.prepare('DELETE FROM node_lessons WHERE node_id = ?').run(nid);
    db.prepare('DELETE FROM roadmap_edges WHERE roadmap_id = ?').run(r.id);
    db.prepare('DELETE FROM roadmap_nodes WHERE roadmap_id = ?').run(r.id);
    db.prepare('DELETE FROM roadmaps WHERE id = ?').run(r.id);
  });
  tx();
  res.json({ ok: true });
});

// NOTE: Roadmaps are personal learning instances and are intentionally NOT
// forkable. Sharing/forking happens at the Course level (a course is the
// shareable template; a roadmap is your private progress through one).

router.patch('/:rid/nodes/:nid', (req, res) => {
  const { mastery, status } = req.body;
  const fields = []; const vals = [];
  if (mastery !== undefined) { fields.push('mastery = ?'); vals.push(mastery); }
  if (status !== undefined)  { fields.push('status = ?');  vals.push(status); }
  if (fields.length === 0) return res.status(400).json({ error: true, message: 'No fields to update' });
  vals.push(req.params.nid);
  db.prepare(`UPDATE roadmap_nodes SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  const done = db.prepare("SELECT COUNT(*) as c FROM roadmap_nodes WHERE roadmap_id = ? AND status = 'done'").get(req.params.rid).c;
  const avgMastery = db.prepare('SELECT AVG(mastery) as m FROM roadmap_nodes WHERE roadmap_id = ?').get(req.params.rid).m || 0;
  db.prepare('UPDATE roadmaps SET completed_modules = ?, mastery = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(done, avgMastery, req.params.rid);
  res.json({ ok: true });
});

// ── Manual node creation (§3.11) ─────────────────────────────────────────────

router.post('/:rid/nodes', (req, res) => {
  const { title, objectives, col, row, prereqs } = req.body;
  if (!title) return res.status(400).json({ error: true, message: 'title required' });
  const r = db.prepare('SELECT * FROM roadmaps WHERE id = ? AND user_id = ?').get(req.params.rid, req.userId);
  if (!r) return res.status(404).json({ error: true, message: 'Roadmap not found' });
  const nodeId = `rn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const maxCol = db.prepare('SELECT MAX(col) as m FROM roadmap_nodes WHERE roadmap_id = ?').get(req.params.rid).m || 0;
  const nodeCol = col != null ? col : (maxCol + 1);
  const nodeRow = row || 0;
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO roadmap_nodes (id, roadmap_id, title, col, row_idx, mastery, status) VALUES (?, ?, ?, ?, ?, 0, ?)')
      .run(nodeId, req.params.rid, title, nodeCol, nodeRow, 'next');
    if (objectives && Array.isArray(objectives)) {
      objectives.forEach((o, i) => {
        db.prepare('INSERT INTO node_objectives (id, node_id, roadmap_id, text, order_idx) VALUES (?, ?, ?, ?, ?)')
          .run(`${nodeId}-o${i}`, nodeId, req.params.rid, o, i);
      });
    }
    if (prereqs && Array.isArray(prereqs)) {
      for (const prereqId of prereqs) {
        db.prepare('INSERT OR IGNORE INTO roadmap_edges (roadmap_id, from_node, to_node) VALUES (?, ?, ?)')
          .run(req.params.rid, prereqId, nodeId);
      }
    }
    // Update total_modules count
    const total = db.prepare('SELECT COUNT(*) as c FROM roadmap_nodes WHERE roadmap_id = ?').get(req.params.rid).c;
    db.prepare('UPDATE roadmaps SET total_modules = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(total, req.params.rid);
  });
  tx();
  res.json({ ok: true, nodeId });
});

router.delete('/:rid/nodes/:nid', (req, res) => {
  const r = db.prepare('SELECT * FROM roadmaps WHERE id = ? AND user_id = ?').get(req.params.rid, req.userId);
  if (!r) return res.status(404).json({ error: true, message: 'Roadmap not found' });
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM roadmap_nodes WHERE id = ? AND roadmap_id = ?').run(req.params.nid, req.params.rid);
    db.prepare('DELETE FROM node_objectives WHERE node_id = ?').run(req.params.nid);
    db.prepare('DELETE FROM roadmap_edges WHERE roadmap_id = ? AND (from_node = ? OR to_node = ?)').run(req.params.rid, req.params.nid, req.params.nid);
    const total = db.prepare('SELECT COUNT(*) as c FROM roadmap_nodes WHERE roadmap_id = ?').get(req.params.rid).c;
    db.prepare('UPDATE roadmaps SET total_modules = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(total, req.params.rid);
  });
  tx();
  res.json({ ok: true });
});

export default router;
