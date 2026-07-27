/**
 * Retention — M10 of docs/MASTERY_SPEC_V2.md §3.7.
 *
 * Passing an assessment once is not mastery. A certificate records that you
 * could do something in March, not that you can do it in September — and
 * Coursera does not solve this either, which makes it a winnable axis.
 *
 * Two ideas, deliberately kept separate:
 *
 *   mastery    what you DEMONSTRATED. Earned, recorded, never silently taken
 *              away — it is the evidence a certificate rests on, and gating uses
 *              it, so passing a module can't lock itself again while you sleep.
 *   retention  what you can PROBABLY still do today: mastery decayed by time
 *              since you last practised. This is what the learner should act on.
 *
 * Conflating them would either erase earned progress or pretend that untouched
 * material stays fresh. We show both.
 */
import db from '../../db/database.js';

// Ebbinghaus-ish exponential decay. Half-life scales with how well the material
// was learned: barely-passed material fades fast, thoroughly-mastered material
// is much stickier. Retention never falls below RETENTION_FLOOR — once you have
// genuinely understood something you rarely return to zero.
export const HALFLIFE_MIN_DAYS = 14;    // mastery 0.0 → forgotten quickly
export const HALFLIFE_MAX_DAYS = 180;   // mastery 1.0 → sticks for months
export const RETENTION_FLOOR = 0.25;
export const REVIEW_THRESHOLD = 0.7;    // below this, it's worth revisiting

const DAY = 86400000;

export function halfLifeDays(mastery) {
  const m = Math.max(0, Math.min(1, Number(mastery) || 0));
  return HALFLIFE_MIN_DAYS + (HALFLIFE_MAX_DAYS - HALFLIFE_MIN_DAYS) * m * m;
}

/** Estimated retention today, given demonstrated mastery and when it was last practised. */
export function retentionFor(mastery, lastPracticedAt, now = Date.now()) {
  const m = Math.max(0, Math.min(1, Number(mastery) || 0));
  if (m <= 0) return 0;
  if (!lastPracticedAt) return m;                 // never practised ⇒ nothing to decay from
  const days = Math.max(0, (now - new Date(lastPracticedAt).getTime()) / DAY);
  if (!Number.isFinite(days)) return m;
  const decayed = m * Math.pow(0.5, days / halfLifeDays(m));
  return Math.round(Math.max(m * RETENTION_FLOOR, decayed) * 1000) / 1000;
}

/** Days until this node's retention crosses the review threshold (0 if already due). */
export function daysUntilReview(mastery, lastPracticedAt, now = Date.now()) {
  const m = Math.max(0, Math.min(1, Number(mastery) || 0));
  if (m <= 0) return 0;
  const target = REVIEW_THRESHOLD * m;            // relative to what was demonstrated
  const hl = halfLifeDays(m);
  const elapsed = lastPracticedAt ? Math.max(0, (now - new Date(lastPracticedAt).getTime()) / DAY) : 0;
  const totalDays = hl * (Math.log(target / m) / Math.log(0.5));
  return Math.max(0, Math.round(totalDays - elapsed));
}

/** Record that a node was practised right now. */
export function markPractised(nodeId, when = new Date().toISOString()) {
  try { db.prepare('UPDATE roadmap_nodes SET last_practiced_at = ? WHERE id = ?').run(when, nodeId); } catch {}
}

/** Nodes whose retention has decayed enough to be worth revisiting, worst first. */
export function nodesNeedingReview(userId, { limit = 10 } = {}) {
  const rows = db.prepare(`SELECT n.id, n.title, n.mastery, n.last_practiced_at, n.course_slug, n.roadmap_id, r.title AS roadmap_title
                           FROM roadmap_nodes n JOIN roadmaps r ON r.id = n.roadmap_id
                           WHERE r.user_id = ? AND n.mastery > 0`).all(userId);
  return rows
    .map(n => {
      const retention = retentionFor(n.mastery, n.last_practiced_at);
      return {
        node_id: n.id, title: n.title, roadmap_id: n.roadmap_id, roadmap_title: n.roadmap_title,
        course_slug: n.course_slug,
        mastery: n.mastery,
        retention,
        lastPracticedAt: n.last_practiced_at,
        daysUntilReview: daysUntilReview(n.mastery, n.last_practiced_at),
        needsReview: retention < REVIEW_THRESHOLD * n.mastery,
      };
    })
    .filter(n => n.needsReview)
    .sort((a, b) => (a.retention / (a.mastery || 1)) - (b.retention / (b.mastery || 1)))
    .slice(0, limit);
}

/**
 * Turn a missed question into a spaced-review card.
 *
 * Keyed on the source item so repeatedly missing the same question reinforces
 * the existing card (resetting it to due) instead of littering the deck with
 * duplicates.
 */
export function cardFromMissedItem(userId, item, deck) {
  if (!item?.id || !item.question) return null;
  const choices = Array.isArray(item.choices) ? item.choices : [];
  const answer = choices[item.answer_idx];
  if (answer === undefined) return null;

  const existing = db.prepare('SELECT id, reps FROM flashcards WHERE user_id = ? AND source_item_id = ?').get(userId, item.id);
  const back = `**${answer}**${item.explanation ? `\n\n${item.explanation}` : ''}`;
  const today = new Date().toISOString().split('T')[0];

  if (existing) {
    // Missed again — pull it back to the front of the queue and make it harder.
    db.prepare('UPDATE flashcards SET back = ?, next_review = ?, interval_days = 0, ease_factor = MAX(1.3, ease_factor - 0.2) WHERE id = ?')
      .run(back, today, existing.id);
    return { id: existing.id, created: false };
  }

  const id = `fc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  try {
    db.prepare(`INSERT INTO flashcards (id, user_id, deck, front, back, interval_days, ease_factor, reps, next_review, source_item_id, source_module_id)
                VALUES (?, ?, ?, ?, ?, 0, 2.5, 0, ?, ?, ?)`)
      .run(id, userId, deck || 'Review', item.question, back, today, item.id, item.module_id || null);
    return { id, created: true };
  } catch { return null; }
}

export default { retentionFor, daysUntilReview, markPractised, nodesNeedingReview, cardFromMissedItem, REVIEW_THRESHOLD };
