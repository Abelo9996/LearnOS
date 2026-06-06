import { Router } from 'express';
import db, { awardXP } from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const deck = req.query.deck;
  let query = 'SELECT * FROM flashcards WHERE user_id = ?';
  const params = [req.userId];
  if (deck) { query += ' AND deck = ?'; params.push(deck); }
  query += ' ORDER BY next_review IS NULL DESC, next_review ASC';
  res.json(db.prepare(query).all(...params));
});

router.get('/due', (req, res) => {
  const cards = db.prepare("SELECT * FROM flashcards WHERE user_id = ? AND (next_review IS NULL OR next_review <= date('now')) ORDER BY RANDOM()").all(req.userId);
  res.json(cards);
});

router.post('/', (req, res) => {
  const { deck, front, back } = req.body;
  if (!deck || !front || !back) return res.status(400).json({ error: true, message: 'deck, front, and back required' });
  const id = `c-${Date.now()}`;
  db.prepare('INSERT INTO flashcards (id, user_id, deck, front, back) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.userId, deck, front, back);
  res.json({ ok: true, card: db.prepare('SELECT * FROM flashcards WHERE id = ?').get(id) });
});

// SM-2 algorithm: grade is 'again' | 'hard' | 'good' | 'easy'
router.post('/:id/review', (req, res) => {
  const { grade } = req.body;
  if (!grade) return res.status(400).json({ error: true, message: 'grade required' });

  const card = db.prepare('SELECT * FROM flashcards WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!card) return res.status(404).json({ error: true, message: 'Card not found' });

  let { reps, ease_factor, interval_days } = card;
  reps += 1;

  // SM-2 logic (simplified)
  const qualityMap = { again: 0, hard: 3, good: 4, easy: 5 };
  const q = qualityMap[grade] ?? 4;

  ease_factor = Math.max(1.3, ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (grade === 'again') {
    reps = 0;
    interval_days = 0; // < 1 min — re-queued now
  } else if (reps === 1) {
    interval_days = 1;
  } else if (reps === 2) {
    interval_days = 6;
  } else {
    interval_days = Math.round(interval_days * ease_factor);
  }

  const nextReview = interval_days === 0 ? new Date().toISOString().split('T')[0] : new Date(Date.now() + interval_days * 86400000).toISOString().split('T')[0];

  db.prepare('UPDATE flashcards SET reps = ?, ease_factor = ?, interval_days = ?, next_review = ? WHERE id = ?')
    .run(reps, ease_factor, interval_days, nextReview, card.id);

  // Log review
  const rid = `fr-${Date.now()}`;
  db.prepare('INSERT INTO flashcard_reviews (id, card_id, grade, ease_factor, interval_days) VALUES (?, ?, ?, ?, ?)')
    .run(rid, card.id, grade, ease_factor, interval_days);

  // Award XP for reviewing (5 XP base + bonus for easy)
  const xpMap = { again: 2, hard: 5, good: 8, easy: 12 };
  const xp = xpMap[grade] || 5;
  awardXP(req.userId, xp);

  res.json({ ok: true, xp_earned: xp, card: db.prepare('SELECT * FROM flashcards WHERE id = ?').get(card.id), next_review: nextReview });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM flashcards WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// Decks summary
router.get('/stats/decks', (req, res) => {
  const decks = db.prepare("SELECT deck, COUNT(*) as total, SUM(CASE WHEN next_review IS NULL OR next_review <= date('now') THEN 1 ELSE 0 END) as due FROM flashcards WHERE user_id = ? GROUP BY deck").all(req.userId);
  res.json(decks);
});

export default router;
