import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const activity = db.prepare('SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(req.userId, limit);
  res.json(activity);
});

// Unread notification count, tracked server-side so it survives reloads,
// browser switches, and cleared localStorage.
router.get('/unread-count', (req, res) => {
  const count = db.prepare(
    "SELECT COUNT(*) as c FROM activity_log WHERE user_id = ? AND created_at > COALESCE((SELECT notifications_seen_at FROM users WHERE id = ?), '1970-01-01')"
  ).get(req.userId, req.userId).c;
  res.json({ count });
});

// Mark all notifications as seen (called when the bell dropdown opens).
router.post('/seen', (req, res) => {
  db.prepare("UPDATE users SET notifications_seen_at = datetime('now') WHERE id = ?").run(req.userId);
  res.json({ ok: true });
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
