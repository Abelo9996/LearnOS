import { Router } from 'express';
import { getJob } from '../ai/jobs.js';

const router = Router();

// Poll an async job's status/result (PLAT-06).
router.get('/:id', (req, res) => {
  const job = getJob(req.params.id, req.userId);
  if (!job) return res.status(404).json({ error: true, message: 'Job not found' });
  res.json(job);
});

export default router;
