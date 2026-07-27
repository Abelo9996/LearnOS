#!/usr/bin/env node
/**
 * Content-integrity checks (docs/MASTERY_SPEC_V2.md §5, V10-V12).
 *
 *   V10 resources live       every shipped URL is reachable
 *   V11 no-key degradation   AI surfaces fail honestly, never crash
 *   V12 no fabrication       no placeholder/lorem/TODO content ships
 *
 *   node scripts/verify-integrity.mjs [baseUrl]
 */
import db from '../db/database.js';
import { checkUrlReachable } from '../ai/agents/research.js';

const BASE = process.argv[2] || 'http://localhost:3001';
const results = [];
const check = (id, name, pass, detail = '') => { results.push({ id, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}${detail ? ` — ${detail}` : ''}`); };

// ── V12: no fabricated or placeholder content ───────────────────────────────
// Real generated prose can legitimately discuss these words, so we only flag
// them where they betray unfinished scaffolding.
const PLACEHOLDER = [
  /lorem ipsum/i,
  /\bTODO\b/,
  /\bFIXME\b/,
  /\[insert [^\]]+\]/i,
  /\bplaceholder text\b/i,
  /\bcoming soon\b/i,
  /\bYOUR_[A-Z_]+\b/,
];
const lessons = db.prepare('SELECT id, title, body_md, kind FROM module_lessons').all();
const offenders = lessons.filter(l => PLACEHOLDER.some(re => re.test(l.body_md || '') || re.test(l.title || '')));
check('V12a', 'no placeholder text in any lesson', offenders.length === 0,
  offenders.length ? offenders.slice(0, 3).map(o => o.title).join(' | ') : `${lessons.length} lessons scanned`);

const emptyReadings = lessons.filter(l => l.kind === 'reading' && (l.body_md || '').trim().length < 200);
check('V12b', 'no near-empty readings ship', emptyReadings.length === 0,
  emptyReadings.length ? `${emptyReadings.length} thin` : 'all readings have substance');

const items = db.prepare('SELECT id, question, choices_json, answer_idx, explanation FROM quiz_items').all();
const badItems = items.filter(q => {
  let ch = []; try { ch = JSON.parse(q.choices_json || '[]'); } catch {}
  return ch.length < 2 || q.answer_idx == null || q.answer_idx < 0 || q.answer_idx >= ch.length;
});
check('V12c', 'every quiz item has choices and a valid answer index', badItems.length === 0,
  `${items.length} items scanned${badItems.length ? `, ${badItems.length} invalid` : ''}`);

const noExplain = items.filter(q => !(q.explanation || '').trim());
check('V12d', 'every quiz item teaches via an explanation', noExplain.length === 0,
  noExplain.length ? `${noExplain.length} missing` : 'all explained');

// ── V10: every shipped URL is actually reachable ────────────────────────────
const urls = [
  ...db.prepare("SELECT DISTINCT url FROM module_lessons WHERE url IS NOT NULL AND url != ''").all().map(r => r.url),
  ...db.prepare("SELECT DISTINCT url FROM node_resources WHERE status = 'verified'").all().map(r => r.url),
];
const unique = [...new Set(urls)];
console.log(`\nChecking ${unique.length} shipped URLs…`);
// A single failed request is not proof a link is dead — with ~90 URLs checked at
// once, one transient network blip would fail the whole suite. Retry before
// declaring anything broken.
const reachableWithRetry = async (u, attempts = 3) => {
  for (let i = 0; i < attempts; i++) {
    try { if (await checkUrlReachable(u)) return true; } catch { /* retry */ }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 400 * (i + 1)));
  }
  return false;
};
const dead = [];
await Promise.all(unique.map(async (u) => { if (!(await reachableWithRetry(u))) dead.push(u); }));
check('V10', 'every shipped resource URL is reachable', dead.length === 0,
  dead.length ? `${dead.length} dead: ${dead.slice(0, 3).join(', ')}` : `${unique.length} verified`);

// ── V11: honest degradation ─────────────────────────────────────────────────
// Every AI surface must answer with a structured error, never a stack trace or
// a hang, and never fabricate a result.
const api = async (path, opts = {}) => {
  try {
    const r = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } catch (e) { return { status: 0, body: { error: true, message: e.message } }; }
};

const health = await api('/api/courses');
if (health.status !== 200) {
  check('V11', 'server reachable for degradation checks', false, `GET /api/courses → ${health.status}`);
} else {
  const bad = await api('/api/courses/build', { method: 'POST', body: JSON.stringify({}) });
  check('V11a', 'missing required input is rejected cleanly', bad.status === 400 && bad.body.error === true, `status=${bad.status}`);

  const noQuiz = await api('/api/assessments/module/does-not-exist/quiz?mode=practice');
  check('V11b', 'unknown module returns a structured 404', noQuiz.status === 404 && !!noQuiz.body.message, `status=${noQuiz.status}`);

  const badSubmit = await api('/api/assessments/module/does-not-exist/submit', { method: 'POST', body: JSON.stringify({ mode: 'practice', item_ids: ['nope'], answers: [0] }) });
  check('V11c', 'submitting unknown questions is refused, not scored', badSubmit.status >= 400, `status=${badSubmit.status}`);

  const noPlacement = await api('/api/roadmaps/rm-does-not-exist/placement');
  check('V11d', 'missing placement returns a structured error', noPlacement.status === 404 && !!noPlacement.body.message, `status=${noPlacement.status}`);

  const noTests = db.prepare("SELECT id FROM assignments WHERE tests_json IS NULL LIMIT 1").get();
  if (noTests) {
    const run = await api(`/api/assessments/assignment/${noTests.id}/run`, { method: 'POST', body: JSON.stringify({ source: 'x' }) });
    check('V11e', 'autograde on an assignment with no tests explains itself', run.status === 400 && run.body.code === 'NO_TESTS', `status=${run.status}`);
  } else {
    check('V11e', 'autograde on an assignment with no tests explains itself', true, 'skipped — none present');
  }
}

const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} integrity checks passed.`);
process.exit(failed ? 1 : 0);
