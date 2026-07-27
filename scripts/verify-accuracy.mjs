#!/usr/bin/env node
/**
 * Verifies the M7 accuracy machinery (docs/MASTERY_SPEC_V2.md §5):
 *   V14 quarantine       disputed/flagged items never appear in a paper or grade anyone
 *   V15 reporting        a learner report quarantines the item immediately
 *   V16 fail-safe        an item that cannot be verified is never marked confirmed
 *   V17 restore          dismissing a report returns the item to 'unverified', not 'confirmed'
 *
 * Runs against the live server. Deliberately needs no LLM: the quarantine
 * guarantees must hold whether or not verification has ever run.
 *
 *   node scripts/verify-accuracy.mjs [baseUrl]
 */
import db from '../db/database.js';
import { STATUS, verificationSummary } from '../ai/quality/factCheck.js';

const BASE = process.argv[2] || 'http://localhost:3001';
const results = [];
const check = (id, name, pass, detail = '') => { results.push({ id, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}${detail ? ` — ${detail}` : ''}`); };
const api = async (path, opts = {}) => {
  const r = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const mod = db.prepare(`SELECT m.id, m.title, COUNT(q.id) n FROM course_modules m JOIN quiz_items q ON q.module_id = m.id
                        GROUP BY m.id HAVING n >= 10 ORDER BY n DESC LIMIT 1`).get();
if (!mod) { console.log('SKIP — no module with a question bank.'); process.exit(0); }
console.log(`Using module: ${mod.title} (${mod.n} items)\n`);

const allIds = db.prepare('SELECT id FROM quiz_items WHERE module_id = ?').all(mod.id).map(r => r.id);
const restore = () => db.prepare(`UPDATE quiz_items SET verification_status='unverified', verification_note=NULL WHERE module_id = ?`).run(mod.id);
restore();
db.prepare('DELETE FROM content_reports').run();
db.prepare('DELETE FROM quiz_attempts WHERE module_id = ?').run(mod.id);

// ── V14: quarantine keeps disputed items out of papers ──────────────────────
const victim = allIds[0];
db.prepare("UPDATE quiz_items SET verification_status='disputed', verification_note='test' WHERE id = ?").run(victim);

let leaked = false;
for (let i = 0; i < 6; i++) {
  const q = await api(`/api/assessments/module/${mod.id}/quiz?mode=practice&count=${mod.n}`);
  if ((q.body.questions || []).some(x => x.id === victim)) { leaked = true; break; }
}
check('V14a', 'a disputed item never appears in a drawn paper', !leaked);

// It must also be refused if someone submits it directly.
const direct = await api(`/api/assessments/module/${mod.id}/submit`, {
  method: 'POST', body: JSON.stringify({ mode: 'practice', item_ids: [victim], answers: [0] }),
});
check('V14b', 'a disputed item is refused even if submitted directly', direct.status >= 400, `status=${direct.status}`);

const summaryDisputed = verificationSummary();
check('V14c', 'disputed items are excluded from the gradeable count',
  summaryDisputed.gradeable === summaryDisputed.total - summaryDisputed.disputed - summaryDisputed.flagged,
  `${summaryDisputed.gradeable}/${summaryDisputed.total} gradeable`);
restore();

// ── V15: learner reporting quarantines immediately ──────────────────────────
const target = allIds[1];
const rep = await api('/api/content/report', {
  method: 'POST', body: JSON.stringify({ target_type: 'quiz_item', target_id: target, reason: 'wrong_answer', detail: 'Option B is also correct.' }),
});
check('V15a', 'reporting an item succeeds and says it was quarantined', rep.status === 200 && rep.body.quarantined === true);
const after = db.prepare('SELECT verification_status FROM quiz_items WHERE id = ?').get(target);
check('V15b', 'the reported item is flagged in the bank', after.verification_status === STATUS.FLAGGED, `status=${after.verification_status}`);

let leaked2 = false;
for (let i = 0; i < 6; i++) {
  const q = await api(`/api/assessments/module/${mod.id}/quiz?mode=practice&count=${mod.n}`);
  if ((q.body.questions || []).some(x => x.id === target)) { leaked2 = true; break; }
}
check('V15c', 'a reported item stops being served immediately', !leaked2);

const bad = await api('/api/content/report', { method: 'POST', body: JSON.stringify({ target_type: 'quiz_item', target_id: 'nope', reason: 'other' }) });
check('V15d', 'reporting something that does not exist 404s', bad.status === 404);
const badReason = await api('/api/content/report', { method: 'POST', body: JSON.stringify({ target_type: 'quiz_item', target_id: target, reason: 'banana' }) });
check('V15e', 'an unknown report reason is rejected', badReason.status === 400);

const list = await api('/api/content/reports');
check('V15f', 'open reports are listed with their target', list.status === 200 && list.body.reports.length >= 1 && !!list.body.reports[0].target);

// ── V17: dismissing restores to unverified, never to confirmed ──────────────
const reportId = list.body.reports[0].id;
await api(`/api/content/reports/${reportId}`, { method: 'PATCH', body: JSON.stringify({ status: 'dismissed' }) });
const restored = db.prepare('SELECT verification_status FROM quiz_items WHERE id = ?').get(target);
check('V17a', 'dismissing a report restores the item to unverified', restored.verification_status === STATUS.UNVERIFIED, `status=${restored.verification_status}`);
check('V17b', 'dismissing never promotes an item to confirmed', restored.verification_status !== STATUS.CONFIRMED);

// ── V16: verification is fail-safe ──────────────────────────────────────────
// With no API credit the verifier cannot run; the contract is that it leaves
// items UNVERIFIED (still usable) and never claims they were confirmed.
const before = verificationSummary();
let threw = null;
try {
  const { verifyCourseItems } = await import('../ai/quality/factCheck.js');
  await verifyCourseItems({ limit: 1 });
} catch (e) { threw = e; }
const afterSummary = verificationSummary();
check('V16a', 'a verifier that cannot run confirms nothing', afterSummary.confirmed <= before.confirmed,
  threw ? `verifier unavailable (${String(threw.message).slice(0, 40)}…)` : 'verifier ran');
check('V16b', 'unverified items remain usable for grading', afterSummary.gradeable > 0, `${afterSummary.gradeable} gradeable`);

// ── Verification visibility ─────────────────────────────────────────────────
const vis = await api('/api/content/verification');
check('V16c', 'verification state is reportable via the API', vis.status === 200 && typeof vis.body.summary?.total === 'number',
  `${vis.body.summary?.gradeable}/${vis.body.summary?.total} gradeable`);

restore();
db.prepare('DELETE FROM content_reports').run();

const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} accuracy checks passed.`);
process.exit(failed ? 1 : 0);
