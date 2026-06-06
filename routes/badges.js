import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const badges = db.prepare('SELECT * FROM badges WHERE user_id = ? ORDER BY earned_at DESC').all(req.userId);
  res.json(badges);
});

router.post('/', (req, res) => {
  const { label, glyph } = req.body;
  if (!label || !glyph) return res.status(400).json({ error: true, message: 'label and glyph required' });
  const id = `b-${Date.now()}`;
  db.prepare('INSERT INTO badges (id, user_id, label, glyph) VALUES (?, ?, ?, ?)')
    .run(id, req.userId, label, glyph);
  res.json({ ok: true, badge: db.prepare('SELECT * FROM badges WHERE id = ?').get(id) });
});

export default router;
