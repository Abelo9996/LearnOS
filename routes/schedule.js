import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const events = db.prepare('SELECT * FROM schedule_events WHERE user_id = ? ORDER BY day_of_week, start_hour').all(req.userId);
  res.json(events);
});

router.post('/', (req, res) => {
  const { title, event_type, agent, day_of_week, start_hour, duration_hours } = req.body;
  if (!title || event_type === undefined || day_of_week === undefined || start_hour === undefined || duration_hours === undefined)
    return res.status(400).json({ error: true, message: 'title, event_type, day_of_week, start_hour, duration_hours required' });
  const id = `ev-${Date.now()}`;
  db.prepare('INSERT INTO schedule_events (id, user_id, title, event_type, agent, day_of_week, start_hour, duration_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, title, event_type, agent || 'TU', day_of_week, start_hour, duration_hours);
  res.json({ ok: true, event: db.prepare('SELECT * FROM schedule_events WHERE id = ?').get(id) });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM schedule_events WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

router.patch('/:id', (req, res) => {
  // event_type / day_of_week / agent were missing from this whitelist while the
  // create route accepted them, so editing a block's type, day or agent was a
  // silent no-op that still toasted "updated".
  const { title, start_hour, duration_hours, reminder_sent_at, event_type, day_of_week, agent } = req.body;
  const fields = []; const vals = [];
  if (title !== undefined)         { fields.push('title = ?');          vals.push(title); }
  if (start_hour !== undefined)    { fields.push('start_hour = ?');    vals.push(start_hour); }
  if (duration_hours !== undefined){ fields.push('duration_hours = ?'); vals.push(duration_hours); }
  if (reminder_sent_at !== undefined) { fields.push('reminder_sent_at = ?'); vals.push(reminder_sent_at); }
  if (event_type !== undefined)    { fields.push('event_type = ?');     vals.push(event_type); }
  if (day_of_week !== undefined)   { fields.push('day_of_week = ?');    vals.push(day_of_week); }
  if (agent !== undefined)         { fields.push('agent = ?');          vals.push(agent); }
  if (fields.length === 0) return res.status(400).json({ error: true, message: 'No fields to update' });
  vals.push(req.params.id, req.userId);
  db.prepare(`UPDATE schedule_events SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...vals);
  res.json({ ok: true, event: db.prepare('SELECT * FROM schedule_events WHERE id = ?').get(req.params.id) });
});

// ── Schedule due reminders (§3.8) ────────────────────────────────────────────

router.get('/due', (req, res) => {
  const now = new Date();
  const currentDay = now.getDay(); // 0=Sun
  const currentHour = now.getHours() + now.getMinutes() / 60;
  // Find events within the next 15 minutes that haven't been reminded yet
  const events = db.prepare(
    `SELECT * FROM schedule_events
     WHERE user_id = ?
       AND reminder_sent_at IS NULL
       AND day_of_week = ?
       AND start_hour >= ?
       AND start_hour <= ?`
  ).all(req.userId, currentDay, currentHour, currentHour + 0.25);
  res.json(events);
});

// Mark reminder sent
router.post('/:id/reminder-sent', (req, res) => {
  db.prepare("UPDATE schedule_events SET reminder_sent_at = datetime('now') WHERE id = ? AND user_id = ?").run(req.params.id, req.userId);
  res.json({ ok: true });
});

/**
 * GET /agenda — the work that is actually waiting, in the order it is due.
 *
 * The schedule used to be a weekly grid of blocks you typed in yourself, with
 * no idea that 31 assignments had due dates, that reviews were coming due, or
 * that three courses were part-finished. It was a calendar that knew nothing
 * about the thing it was a calendar for.
 *
 * This gathers the real commitments from the tables that own them and hands
 * back one dated, sorted list. Every item carries where to go, so the schedule
 * becomes a way into the work rather than a picture of it.
 */
router.get('/agenda', (req, res) => {
  const uid = req.userId;
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 60);
  const items = [];

  // Assignments — the only thing here with a real deadline attached.
  for (const a of db.prepare(
    `SELECT id, title, course, due_date, status, priority, estimated_minutes
       FROM assignments
      WHERE user_id = ? AND status != 'graded' AND due_date IS NOT NULL
        AND date(due_date) <= date('now', ?)
      ORDER BY date(due_date)`
  ).all(uid, `+${days} days`)) {
    items.push({
      kind: 'assignment', id: a.id, title: a.title,
      sub: a.course || 'Assignment', due: a.due_date,
      minutes: a.estimated_minutes || null,
      overdue: new Date(a.due_date) < new Date(new Date().toDateString()),
      screen: 'assignments',
    });
  }

  // Spaced review — one entry for the whole batch; a hundred separate cards
  // would drown everything else.
  const dueCards = db.prepare(
    "SELECT COUNT(*) c FROM flashcards WHERE user_id = ? AND (next_review IS NULL OR next_review <= date('now'))"
  ).get(uid).c;
  if (dueCards > 0) {
    items.push({
      kind: 'review', id: 'review-batch', title: `${dueCards} card${dueCards === 1 ? '' : 's'} due for review`,
      sub: 'Spaced repetition', due: new Date().toISOString().slice(0, 10),
      minutes: Math.max(5, Math.round(dueCards * 0.5)), overdue: false, screen: 'cards',
    });
  }

  // Courses in progress — the next unfinished lesson, so "carry on" is one
  // click rather than a hunt through the syllabus.
  for (const e of db.prepare(
    `SELECT e.course_slug, c.title FROM enrollments e JOIN courses c ON c.slug = e.course_slug
      WHERE e.user_id = ? AND e.status != 'completed'`
  ).all(uid)) {
    const next = db.prepare(
      `SELECT l.id, l.title, l.estimated_minutes
         FROM module_lessons l JOIN course_modules m ON m.id = l.module_id
        WHERE m.course_slug = ?
          AND l.id NOT IN (SELECT lesson_id FROM enrollment_progress WHERE user_id = ? AND course_slug = m.course_slug)
        ORDER BY m.order_idx, l.order_idx LIMIT 1`
    ).get(e.course_slug, uid);
    if (next) {
      items.push({
        kind: 'lesson', id: next.id, title: next.title, sub: e.title,
        due: null, minutes: next.estimated_minutes || null, overdue: false,
        screen: 'courses', courseSlug: e.course_slug,
      });
    }
  }

  // Undated work sorts after everything with a deadline.
  items.sort((a, b) => {
    if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
    if (a.due) return -1;
    if (b.due) return 1;
    return 0;
  });

  const today = new Date().toISOString().slice(0, 10);
  res.json({
    ok: true,
    items,
    counts: {
      overdue: items.filter(i => i.overdue).length,
      today:   items.filter(i => i.due === today && !i.overdue).length,
      total:   items.length,
    },
  });
});

export default router;
