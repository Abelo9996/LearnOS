import { Router } from 'express';
import { fsrs, generatorParameters, createEmptyCard, Rating, State } from 'ts-fsrs';
import db, { awardXP } from '../db/database.js';

const router = Router();

const parse = (s, fb) => { try { return s ? JSON.parse(s) : fb; } catch { return fb; } };

// FSRS-6 scheduler with default parameters. Those defaults already beat SM-2
// out of the box; the optimizer only pays off after a few hundred reviews, so a
// single self-hosted learner runs on the defaults indefinitely and it's still
// better than what we hand-rolled. One shared instance — it's stateless.
const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));
const GRADE_TO_RATING = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy };
const dayStr = (d) => new Date(d).toISOString().slice(0, 10);

/** Reconstruct an FSRS card from a stored row (or a fresh one if never reviewed). */
function toFsrsCard(row) {
  if (row.stability == null || row.state == null) return createEmptyCard(new Date());
  return {
    due: new Date((row.next_review ? row.next_review + 'T00:00:00Z' : new Date().toISOString())),
    stability: row.stability,
    difficulty: row.difficulty ?? 5,
    elapsed_days: 0,
    scheduled_days: row.interval_days || 0,
    reps: row.reps || 0,
    lapses: row.lapses || 0,
    learning_steps: 0,
    state: row.state ?? State.New,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

// Human "next due" for the review buttons — FSRS returns a real timestamp per
// grade, so the labels reflect this card's actual schedule instead of fixed
// guesses.
function humanizeDue(due, now) {
  const mins = Math.max(1, Math.round((new Date(due) - now) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d`;
  const mo = Math.round(days / 30);
  return mo < 12 ? `${mo}mo` : `${Math.round(mo / 12)}y`;
}

function previewFor(row, now) {
  const sched = scheduler.repeat(toFsrsCard(row), now);
  return {
    again: humanizeDue(sched[Rating.Again].card.due, now),
    hard: humanizeDue(sched[Rating.Hard].card.due, now),
    good: humanizeDue(sched[Rating.Good].card.due, now),
    easy: humanizeDue(sched[Rating.Easy].card.due, now),
  };
}

/**
 * Turn a graded quiz item into a recall card: the question on the front, the
 * correct answer and its explanation on the back. The question bank is already
 * vetted content tied to a module, which makes it the natural, LLM-free source
 * for review — no key required, and the cards match exactly what the course
 * grades you on.
 */
function cardFromItem(it) {
  const choices = Array.isArray(it.choices) ? it.choices : parse(it.choices_json, []);
  const answer = choices[it.answer_idx];
  if (!it.question || answer == null) return null;
  const back = `**${answer}**` + (it.explanation ? `\n\n${it.explanation}` : '');
  return { front: String(it.question).trim(), back };
}

// The missed-question → card path lives in ai/quality/retention.js
// (cardFromMissedItem) and already runs on every graded submission. This file
// only adds the *proactive* direction: build a deck from a course up front,
// before you've been quizzed, so review has something in it to begin with.

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
  const now = new Date();
  // Attach FSRS's real per-grade schedule so the review buttons show what each
  // answer will actually do to this card, not fixed guesses.
  res.json(cards.map(c => ({ ...c, preview: previewFor(c, now) })));
});

router.post('/', (req, res) => {
  const { deck, front, back } = req.body;
  if (!deck || !front || !back) return res.status(400).json({ error: true, message: 'deck, front, and back required' });
  const id = `c-${Date.now()}`;
  db.prepare('INSERT INTO flashcards (id, user_id, deck, front, back) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.userId, deck, front, back);
  res.json({ ok: true, card: db.prepare('SELECT * FROM flashcards WHERE id = ?').get(id) });
});

// FSRS-6 scheduling. grade is 'again' | 'hard' | 'good' | 'easy'.
router.post('/:id/review', (req, res) => {
  const { grade } = req.body;
  const rating = GRADE_TO_RATING[grade];
  if (!rating) return res.status(400).json({ error: true, message: 'grade must be again|hard|good|easy' });

  const card = db.prepare('SELECT * FROM flashcards WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!card) return res.status(404).json({ error: true, message: 'Card not found' });

  const now = new Date();
  // FSRS reads the card's stability/difficulty/state and elapsed time and
  // returns the updated card plus a review log. It predicts recall probability
  // rather than nudging a single ease factor, which is why its intervals hold
  // up far better than SM-2's.
  const { card: nc, log } = scheduler.next(toFsrsCard(card), now, rating);
  const nextReview = dayStr(nc.due);

  db.prepare(`UPDATE flashcards SET reps = ?, interval_days = ?, next_review = ?,
              stability = ?, difficulty = ?, state = ?, lapses = ?, last_review = ? WHERE id = ?`)
    .run(nc.reps, nc.scheduled_days, nextReview, nc.stability, nc.difficulty, nc.state, nc.lapses, now.toISOString(), card.id);

  // The review log keeps ease_factor/interval_days columns fed for anything
  // still reading them; stability is the real signal now.
  const rid = `fr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    db.prepare('INSERT INTO flashcard_reviews (id, card_id, grade, ease_factor, interval_days) VALUES (?, ?, ?, ?, ?)')
      .run(rid, card.id, grade, nc.difficulty, nc.scheduled_days);
  } catch { /* logging is best-effort */ }

  const xpMap = { again: 2, hard: 5, good: 8, easy: 12 };
  const xp = xpMap[grade] || 5;
  awardXP(req.userId, xp);

  res.json({ ok: true, xp_earned: xp, next_review: nextReview, interval_days: nc.scheduled_days, state: State[nc.state] });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM flashcards WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

/**
 * POST /generate  { course_slug, module_id? } — build a review deck from a
 * course's question bank.
 *
 * Spaced review was empty until you hand-wrote cards, which is why it felt
 * useless. This fills it from content you're already studying: every graded
 * question becomes a recall card, tied back to its module so you can review a
 * whole course or just one module before its assignment. Deduped, so running it
 * again only adds what's new.
 */
router.post('/generate', (req, res) => {
  const { course_slug, module_id } = req.body || {};
  if (!course_slug) return res.status(400).json({ error: true, message: 'course_slug required' });
  const course = db.prepare('SELECT slug, title FROM courses WHERE slug = ?').get(course_slug);
  if (!course) return res.status(404).json({ error: true, message: 'Course not found' });

  let sql = "SELECT id, module_id, question, choices_json, answer_idx, explanation FROM quiz_items WHERE course_slug = ? AND (verification_status IS NULL OR verification_status NOT IN ('disputed', 'flagged'))";
  const params = [course_slug];
  if (module_id) { sql += ' AND module_id = ?'; params.push(module_id); }
  const items = db.prepare(sql).all(...params);

  const seen = new Set(
    db.prepare('SELECT source_item_id FROM flashcards WHERE user_id = ? AND source_item_id IS NOT NULL')
      .all(req.userId).map(r => r.source_item_id),
  );
  const ins = db.prepare(
    'INSERT OR IGNORE INTO flashcards (id, user_id, deck, front, back, source_item_id, source_module_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  let created = 0;
  const tx = db.transaction(() => {
    for (const it of items) {
      if (seen.has(it.id)) continue;
      const card = cardFromItem(it);
      if (!card) continue;
      ins.run(`fc-${req.userId}-${it.id}`, req.userId, course.title, card.front, card.back, it.id, it.module_id);
      created++;
    }
  });
  tx();

  res.json({ ok: true, created, deck: course.title, alreadyHad: items.length - created, totalQuestions: items.length });
});

// Decks summary
router.get('/stats/decks', (req, res) => {
  const decks = db.prepare("SELECT deck, COUNT(*) as total, SUM(CASE WHEN next_review IS NULL OR next_review <= date('now') THEN 1 ELSE 0 END) as due FROM flashcards WHERE user_id = ? GROUP BY deck").all(req.userId);
  res.json(decks);
});

export default router;
