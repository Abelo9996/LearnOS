import { Router } from 'express';
import db from '../db/database.js';
import { enqueueJob } from '../ai/jobs.js';
import '../ai/agents/curriculum.js'; // registers the 'generate-roadmap' job handler

const router = Router();

// Generate a real roadmap from a goal (CR-2). Runs async → returns a jobId.
router.post('/generate', (req, res) => {
  const { goal, profile } = req.body;
  if (!goal || !String(goal).trim()) return res.status(400).json({ error: true, message: 'goal required' });
  const jobId = enqueueJob(req.userId, 'generate-roadmap', { goal: String(goal).trim(), profile: profile || null });
  res.json({ ok: true, jobId });
});

router.get('/', (req, res) => {
  const roadmaps = db.prepare('SELECT * FROM roadmaps WHERE user_id = ? ORDER BY created_at').all(req.userId);
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
  nodes.forEach(n => { n.objectives = objsByNode[n.id] || []; });
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
