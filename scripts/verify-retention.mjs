#!/usr/bin/env node
/**
 * Verifies M10 retention (docs/MASTERY_SPEC_V2.md §5):
 *   V22 decay        retention falls with time since practice, and has a floor
 *   V23 stickiness   better-learned material decays more slowly
 *   V24 separation   decay NEVER lowers demonstrated mastery
 *   V25 review cards a missed question becomes a card; missing it again
 *                    reinforces that card instead of duplicating it
 *   V26 no noise     questions you got right do not clutter the deck
 *
 *   node scripts/verify-retention.mjs [baseUrl]
 */
import db from '../db/database.js';
import { retentionFor, daysUntilReview, halfLifeDays, cardFromMissedItem, markPractised, nodesNeedingReview, REVIEW_THRESHOLD } from '../ai/quality/retention.js';

const BASE = process.argv[2] || 'http://localhost:3001';
const results = [];
const check = (id, name, pass, detail = '') => { results.push({ id, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}${detail ? ` — ${detail}` : ''}`); };
const api = async (path, opts = {}) => {
  const r = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

// ── V22: decay ──────────────────────────────────────────────────────────────
const fresh = retentionFor(0.9, daysAgo(0));
const month = retentionFor(0.9, daysAgo(30));
const year  = retentionFor(0.9, daysAgo(365));
check('V22a', 'freshly practised material retains its mastery', Math.abs(fresh - 0.9) < 0.02, `${fresh}`);
check('V22b', 'retention falls as time passes', month < fresh && year < month, `0d=${fresh} 30d=${month} 365d=${year}`);
check('V22c', 'retention never collapses to zero', year > 0, `365d=${year}`);
check('V22d', 'never-practised mastery is not decayed', retentionFor(0.8, null) === 0.8);
check('V22e', 'zero mastery has zero retention', retentionFor(0, daysAgo(10)) === 0);

// ── V23: stickiness scales with how well it was learned ─────────────────────
const weak = retentionFor(0.5, daysAgo(60)) / 0.5;
const strong = retentionFor(1.0, daysAgo(60)) / 1.0;
check('V23a', 'thoroughly-learned material decays more slowly', strong > weak, `strong=${strong.toFixed(2)} vs weak=${weak.toFixed(2)} of original`);
check('V23b', 'half-life grows with mastery', halfLifeDays(1) > halfLifeDays(0.5) && halfLifeDays(0.5) > halfLifeDays(0));
const dueSoon = daysUntilReview(0.9, daysAgo(0));
const overdue = daysUntilReview(0.9, daysAgo(400));
check('V23c', 'review is scheduled ahead for fresh material', dueSoon > 0, `${dueSoon} days`);
check('V23d', 'long-neglected material is already due', overdue === 0);

// ── V24: decay must never rewrite earned mastery ────────────────────────────
const node = db.prepare("SELECT id, mastery FROM roadmap_nodes WHERE mastery > 0 LIMIT 1").get();
if (node) {
  const before = node.mastery;
  db.prepare('UPDATE roadmap_nodes SET last_practiced_at = ? WHERE id = ?').run(daysAgo(400), node.id);
  const r = await api('/api/assessments/retention');
  const after = db.prepare('SELECT mastery FROM roadmap_nodes WHERE id = ?').get(node.id).mastery;
  const reported = (r.body.nodes || []).find(n => n.node_id === node.id);
  check('V24a', 'reading retention does not alter stored mastery', after === before, `${before} → ${after}`);
  check('V24b', 'retention is reported alongside, and below, mastery',
    !!reported && reported.retention < reported.mastery, `mastery=${reported?.mastery} retention=${reported?.retention}`);
  check('V24c', 'a long-neglected node is listed as needing review',
    (r.body.needsReview || []).some(n => n.node_id === node.id), `${(r.body.needsReview || []).length} flagged`);
  markPractised(node.id);
  const r2 = await api('/api/assessments/retention');
  const refreshed = (r2.body.nodes || []).find(n => n.node_id === node.id);
  check('V24d', 'practising restores retention', refreshed && Math.abs(refreshed.retention - refreshed.mastery) < 0.02, `retention=${refreshed?.retention}`);
} else {
  check('V24a', 'a node with mastery exists to test against', false, 'none found');
}

// ── V25/V26: missed questions become review cards ───────────────────────────
const item = db.prepare('SELECT id, question, choices_json, answer_idx, explanation, module_id FROM quiz_items LIMIT 1').get();
if (item) {
  db.prepare('DELETE FROM flashcards WHERE source_item_id = ?').run(item.id);
  const parsed = { ...item, choices: JSON.parse(item.choices_json) };

  const first = cardFromMissedItem('user-1', parsed, 'Test deck');
  check('V25a', 'a missed question becomes a review card', !!first && first.created === true);
  const card = db.prepare('SELECT * FROM flashcards WHERE source_item_id = ?').get(item.id);
  check('V25b', 'the card carries the question and the correct answer', !!card && card.front === item.question && card.back.includes(parsed.choices[item.answer_idx]));
  check('V25c', 'the card is due immediately', card.next_review <= new Date().toISOString().split('T')[0]);

  // Make it look reviewed, then miss it again.
  db.prepare('UPDATE flashcards SET interval_days = 10, ease_factor = 2.5, next_review = ? WHERE id = ?').run('2099-01-01', card.id);
  const second = cardFromMissedItem('user-1', parsed, 'Test deck');
  const after = db.prepare('SELECT * FROM flashcards WHERE source_item_id = ?').all(item.id);
  check('V25d', 'missing it again reinforces rather than duplicating', second?.created === false && after.length === 1, `${after.length} card(s)`);
  check('V25e', 'a repeated miss pulls the card back to due', after[0].next_review <= new Date().toISOString().split('T')[0]);
  check('V25f', 'a repeated miss makes the card harder', after[0].ease_factor < 2.5, `ease=${after[0].ease_factor}`);

  db.prepare('DELETE FROM flashcards WHERE source_item_id = ?').run(item.id);
} else {
  check('V25a', 'a quiz item exists to test against', false, 'none found');
}

// V26: an all-correct submission must create no cards.
const mod = db.prepare(`SELECT m.id FROM course_modules m JOIN quiz_items q ON q.module_id = m.id GROUP BY m.id HAVING COUNT(q.id) >= 5 LIMIT 1`).get();
if (mod) {
  const before = db.prepare('SELECT COUNT(*) c FROM flashcards WHERE user_id = ?').get('user-1').c;
  const q = await api(`/api/assessments/module/${mod.id}/quiz?mode=practice&count=5`);
  const ids = (q.body.questions || []).map(x => x.id);
  const key = db.prepare(`SELECT id, answer_idx FROM quiz_items WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  const byId = new Map(key.map(k => [k.id, k.answer_idx]));
  const sub = await api(`/api/assessments/module/${mod.id}/submit`, {
    method: 'POST', body: JSON.stringify({ mode: 'practice', item_ids: ids, answers: ids.map(i => byId.get(i)) }),
  });
  const after = db.prepare('SELECT COUNT(*) c FROM flashcards WHERE user_id = ?').get('user-1').c;
  check('V26a', 'a perfect attempt creates no review cards', sub.body.score === 100 && after === before && sub.body.cardsQueued === 0, `queued=${sub.body.cardsQueued}`);

  // And a wrong one does.
  const q2 = await api(`/api/assessments/module/${mod.id}/quiz?mode=practice&count=5`);
  const ids2 = (q2.body.questions || []).map(x => x.id);
  const key2 = db.prepare(`SELECT id, answer_idx FROM quiz_items WHERE id IN (${ids2.map(() => '?').join(',')})`).all(...ids2);
  const by2 = new Map(key2.map(k => [k.id, k.answer_idx]));
  const sub2 = await api(`/api/assessments/module/${mod.id}/submit`, {
    method: 'POST', body: JSON.stringify({ mode: 'practice', item_ids: ids2, answers: ids2.map(i => (by2.get(i) + 1) % 4) }),
  });
  check('V26b', 'wrong answers queue exactly that many review cards', sub2.body.cardsQueued === sub2.body.total - sub2.body.correct,
    `${sub2.body.cardsQueued} queued for ${sub2.body.total - sub2.body.correct} wrong`);
  db.prepare("DELETE FROM flashcards WHERE source_item_id IS NOT NULL AND user_id = 'user-1'").run();
}

const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} retention checks passed.`);
process.exit(failed ? 1 : 0);
