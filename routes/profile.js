import { Router } from 'express';
import { runIntake, getProfile } from '../ai/agents/profiling.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(getProfile(req.userId));
});

router.post('/intake', async (req, res) => {
  const { goal, answers } = req.body;
  if (!goal) return res.status(400).json({ error: true, message: 'goal required' });
  try {
    const profile = await runIntake({ userId: req.userId, goal, answers: answers || {} });
    res.json({ ok: true, profile });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

export default router;
