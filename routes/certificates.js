import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const certs = db.prepare('SELECT * FROM certificates WHERE user_id = ? ORDER BY issued_at DESC').all(req.userId);
  res.json(certs);
});

router.get('/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM certificates WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!c) return res.status(404).json({ error: true, message: 'Certificate not found' });
  res.json(c);
});

export default router;
