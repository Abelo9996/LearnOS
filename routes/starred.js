import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const items = db.prepare('SELECT * FROM starred_items WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(items);
});

router.post('/', (req, res) => {
  const { item_type, item_id } = req.body;
  if (!item_type || !item_id) return res.status(400).json({ error: true, message: 'item_type and item_id required' });
  db.prepare('INSERT OR IGNORE INTO starred_items (user_id, item_type, item_id) VALUES (?, ?, ?)')
    .run(req.userId, item_type, item_id);
  res.json({ ok: true });
});

router.delete('/:type/:id', (req, res) => {
  db.prepare('DELETE FROM starred_items WHERE user_id = ? AND item_type = ? AND item_id = ?')
    .run(req.userId, req.params.type, req.params.id);
  res.json({ ok: true });
});

export default router;
