import { Router } from 'express';
import db from '../db/database.js';
import { enqueueJob } from '../ai/jobs.js';
import '../ai/agents/research.js'; // registers the 'propose-resources' + 'verify-resource' job handlers

const router = Router();

// Node lesson body (Markdown). Returns {body_md: null} if no lesson exists.
router.get('/:id/lesson', (req, res) => {
  const row = db.prepare('SELECT body_md, updated_at FROM node_lessons WHERE node_id = ?').get(req.params.id);
  res.json(row || { body_md: null });
});

router.put('/:id/lesson', (req, res) => {
  const { body_md } = req.body || {};
  if (!body_md || typeof body_md !== 'string') return res.status(400).json({ error: true, message: 'body_md required' });
  db.prepare(`INSERT INTO node_lessons (node_id, body_md, updated_at) VALUES (?, ?, datetime('now'))
              ON CONFLICT(node_id) DO UPDATE SET body_md = excluded.body_md, updated_at = datetime('now')`)
    .run(req.params.id, body_md);
  res.json({ ok: true });
});

// List verified resources for a node. Pass ?include=proposed to also see unverified
// proposals (used by the "Show unverified" toggle in the UI).
router.get('/:id/resources', (req, res) => {
  const include = req.query.include || 'verified';
  const allowed = include === 'all' ? ['verified', 'proposed'] : include === 'proposed' ? ['verified', 'proposed'] : ['verified'];
  const placeholders = allowed.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT id, node_id, roadmap_id, kind, title, url, source, summary, status, verified_at
     FROM node_resources
     WHERE node_id = ? AND status IN (${placeholders})
     ORDER BY (status='verified') DESC, created_at DESC`
  ).all(req.params.id, ...allowed);
  res.json(rows);
});

// Trigger the RE agent to propose more resources for a node. Async (returns jobId).
router.post('/:id/resources/propose', (req, res) => {
  const node = db.prepare('SELECT id, roadmap_id, title FROM roadmap_nodes WHERE id = ?').get(req.params.id);
  if (!node) return res.status(404).json({ error: true, message: 'Node not found' });
  const objectives = db.prepare('SELECT text FROM node_objectives WHERE node_id = ? ORDER BY order_idx').all(node.id).map(o => o.text);
  const kind = req.body?.kind || null;
  const jobId = enqueueJob(req.userId, 'propose-resources', {
    node_id: node.id, roadmap_id: node.roadmap_id, title: node.title, objectives, kind,
  });
  res.json({ ok: true, jobId });
});

// Manual reject (admin / cleanup). Soft-delete by status change.
router.patch('/:nodeId/resources/:resId', (req, res) => {
  const { status } = req.body;
  if (!['verified', 'rejected', 'proposed'].includes(status)) return res.status(400).json({ error: true, message: 'invalid status' });
  db.prepare('UPDATE node_resources SET status = ? WHERE id = ? AND node_id = ?').run(status, req.params.resId, req.params.nodeId);
  res.json({ ok: true });
});

export default router;
