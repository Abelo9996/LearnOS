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

export default router;
