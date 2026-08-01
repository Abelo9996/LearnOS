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
/**
 * Notifications — the few things worth interrupting for.
 *
 * This endpoint used to count every activity_log row since you last looked, so
 * ticking a lesson raised a "notification". Alerts now come from their own
 * table and are only written for milestones, unlocks, work needing attention,
 * finished background jobs, and due review.
 */
router.get('/notifications', (req, res) => {
  const rows = db.prepare(`SELECT id, kind, title, body, priority, action_screen, action_id, count, created_at, updated_at, read_at
                           FROM notifications
                           WHERE user_id = ? AND dismissed_at IS NULL
                           ORDER BY (read_at IS NULL) DESC,
                                    CASE priority WHEN 'high' THEN 0 ELSE 1 END,
                                    COALESCE(updated_at, created_at) DESC
                           LIMIT 30`).all(req.userId);
  const unread = rows.filter(r => !r.read_at).length;
  res.json({ ok: true, unread, notifications: rows });
});

// Kept for the badge poll — cheap COUNT rather than fetching every row.
router.get('/unread-count', (req, res) => {
  const count = db.prepare(
    'SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read_at IS NULL AND dismissed_at IS NULL'
  ).get(req.userId).c;
  res.json({ count });
});

// Opening the bell marks what is currently shown as read.
router.post('/seen', (req, res) => {
  db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(req.userId);
  res.json({ ok: true });
});

// Dismiss one, or clear them all.
router.post('/notifications/:id/dismiss', (req, res) => {
  const r = db.prepare("UPDATE notifications SET dismissed_at = datetime('now') WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.userId);
  if (!r.changes) return res.status(404).json({ error: true, message: 'Notification not found' });
  res.json({ ok: true });
});

router.post('/notifications/clear', (req, res) => {
  db.prepare("UPDATE notifications SET dismissed_at = datetime('now') WHERE user_id = ? AND dismissed_at IS NULL").run(req.userId);
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
