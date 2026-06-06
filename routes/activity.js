import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const activity = db.prepare('SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(req.userId, limit);
  res.json(activity);
});

router.post('/', (req, res) => {
  const { kind, text, sub, xp, agent } = req.body;
  if (!kind || !text) return res.status(400).json({ error: true, message: 'kind and text required' });
  const id = `al-${Date.now()}`;
  db.prepare('INSERT INTO activity_log (id, user_id, kind, text, sub, xp, agent) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, kind, text, sub || null, xp || 0, agent || null);
  // Also update user XP if earned
  if (xp > 0) {
    db.prepare('UPDATE users SET xp = xp + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(xp, req.userId);
  }
  res.json({ ok: true, activity: db.prepare('SELECT * FROM activity_log WHERE id = ?').get(id) });
});

export default router;
