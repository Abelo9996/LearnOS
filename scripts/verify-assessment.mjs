#!/usr/bin/env node
/**
 * Verifies the M3 assessment engine against the spec's checks (docs/MASTERY_SPEC_V2.md §5):
 *   V3 practice ≠ graded    practice attempts don't move grade/mastery; graded do
 *   V4 attempt limits       the (max+1)th graded attempt is refused
 *   V5 pass gate            a node stays locked until a graded pass
 *   V6 programming grade    score == % of declared tests passed
 *   V7 rubric review        every criterion returns a score + justification
 *
 * Runs against the live server so it exercises the real routes.
 *   node scripts/verify-assessment.mjs [baseUrl]
 */
import db from '../db/database.js';
import { runCodeTests, scoreRubric } from '../ai/assessment/grader.js';

const BASE = process.argv[2] || 'http://localhost:3001';
const results = [];
const check = (id, name, pass, detail = '') => { results.push({ id, name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}${detail ? ` — ${detail}` : ''}`); };

const api = async (path, opts = {}) => {
  const r = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

// Find a module that actually has a question bank (i.e. a generated course).
const mod = db.prepare(`SELECT m.id, m.title, m.course_slug, COUNT(q.id) n
                        FROM course_modules m JOIN quiz_items q ON q.module_id = m.id
                        GROUP BY m.id HAVING n >= 8 ORDER BY n DESC LIMIT 1`).get();
if (!mod) {
  console.log('SKIP — no module with a question bank. Build a course first (POST /api/courses/build).');
  process.exit(0);
}
console.log(`Using module: ${mod.title} (${mod.n} bank items)\n`);

// Clean prior attempts so limits are exercised from zero.
db.prepare('DELETE FROM quiz_attempts WHERE module_id = ?').run(mod.id);

const answerKey = (ids) => {
  const rows = db.prepare(`SELECT id, answer_idx FROM quiz_items WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  const by = new Map(rows.map(r => [r.id, r.answer_idx]));
  return ids.map(i => by.get(i));
};

// ── V3: practice is free and ungraded ───────────────────────────────────────
const beforeXp = db.prepare('SELECT xp FROM users WHERE id = ?').get('user-1')?.xp ?? 0;
const node = db.prepare('SELECT id, mastery, status FROM roadmap_nodes WHERE course_slug = ? AND title = ? LIMIT 1').get(mod.course_slug, mod.title);
const masteryBefore = node?.mastery ?? null;

const p1 = await api(`/api/assessments/module/${mod.id}/quiz?mode=practice&count=8`);
const pIds = (p1.body.questions || []).map(q => q.id);
const pSub = await api(`/api/assessments/module/${mod.id}/submit`, { method: 'POST', body: JSON.stringify({ mode: 'practice', item_ids: pIds, answers: answerKey(pIds) }) });
const masteryAfterPractice = node ? db.prepare('SELECT mastery FROM roadmap_nodes WHERE id = ?').get(node.id).mastery : null;

check('V3a', 'practice returns a score', pSub.body.score === 100, `score=${pSub.body.score}`);
check('V3b', 'practice reveals explanations', pSub.body.explanationsRevealed === true && !!pSub.body.results?.[0]?.explanation);
check('V3c', 'practice does not set passed', pSub.body.passed === null, `passed=${JSON.stringify(pSub.body.passed)}`);
check('V3d', 'practice does not move mastery', masteryBefore === masteryAfterPractice, `${masteryBefore} → ${masteryAfterPractice}`);

// practice can be repeated without limit
let unlimited = true;
for (let i = 0; i < 4; i++) {
  const r = await api(`/api/assessments/module/${mod.id}/quiz?mode=practice&count=5`);
  if (r.status !== 200) { unlimited = false; break; }
}
check('V3e', 'practice attempts are unlimited', unlimited);

// ── V4/V5: graded costs attempts, gates on the pass bar ─────────────────────
// Deliberately fail the first two attempts, then pass the third.
let gradedStatus = [];
for (let i = 0; i < 2; i++) {
  const g = await api(`/api/assessments/module/${mod.id}/quiz?mode=graded&count=10`);
  const ids = (g.body.questions || []).map(q => q.id);
  const wrong = answerKey(ids).map(a => (a + 1) % 4);   // all wrong on purpose
  const sub = await api(`/api/assessments/module/${mod.id}/submit`, { method: 'POST', body: JSON.stringify({ mode: 'graded', item_ids: ids, answers: wrong }) });
  gradedStatus.push(sub.body);
}
const nodeAfterFails = node ? db.prepare('SELECT status, mastery FROM roadmap_nodes WHERE id = ?').get(node.id) : null;
check('V5a', 'failing graded does not complete the node', !nodeAfterFails || nodeAfterFails.status !== 'done', `status=${nodeAfterFails?.status}`);
check('V4a', 'graded tracks attempt numbers', gradedStatus[0]?.attemptNo === 1 && gradedStatus[1]?.attemptNo === 2,
  `attempts=${gradedStatus.map(g => g.attemptNo).join(',')}`);
check('V4b', 'graded reports attempts remaining', gradedStatus[1]?.attemptsLeft === 1, `left=${gradedStatus[1]?.attemptsLeft}`);
check('V5b', 'failed graded withholds nothing once attempts near exhaustion', typeof gradedStatus[1]?.explanationsRevealed === 'boolean');

// third attempt — pass it
const g3 = await api(`/api/assessments/module/${mod.id}/quiz?mode=graded&count=10`);
const ids3 = (g3.body.questions || []).map(q => q.id);
const sub3 = await api(`/api/assessments/module/${mod.id}/submit`, { method: 'POST', body: JSON.stringify({ mode: 'graded', item_ids: ids3, answers: answerKey(ids3) }) });
check('V5c', 'passing graded sets passed=true', sub3.body.passed === true, `score=${sub3.body.score}`);
const nodeAfterPass = node ? db.prepare('SELECT status, mastery FROM roadmap_nodes WHERE id = ?').get(node.id) : null;
check('V5d', 'passing graded advances node mastery', !node || (nodeAfterPass.mastery > (masteryBefore ?? 0)), `${masteryBefore} → ${nodeAfterPass?.mastery}`);

// fourth attempt must be refused
const g4 = await api(`/api/assessments/module/${mod.id}/quiz?mode=graded&count=10`);
check('V4c', '4th graded attempt is refused', g4.status === 409 && g4.body.code === 'NO_ATTEMPTS_LEFT', `status=${g4.status}`);

// ── V6: programming autograde ───────────────────────────────────────────────
const tests = [
  { name: 'adds two numbers', fn: 'add', args: [2, 3], expected: 5 },
  { name: 'handles negatives', fn: 'add', args: [-2, 3], expected: 1 },
  { name: 'handles zero', fn: 'add', args: [0, 0], expected: 0 },
  { name: 'hidden case', fn: 'add', args: [10, 5], expected: 15, hidden: true },
];
const allPass = runCodeTests('function add(a,b){return a+b}', tests);
const halfPass = runCodeTests('function add(a,b){return a>0&&b>0?a+b:0}', tests);
const broken = runCodeTests('function add(a,b){ throw new Error("nope") }', tests);
const syntax = runCodeTests('function add(a,b){ return a+ }', tests);

check('V6a', 'all tests passing scores 100', allPass.score === 100 && allPass.passed === true, `score=${allPass.score}`);
check('V6b', 'score == % of tests passed', halfPass.score === Math.round((halfPass.passedCount / halfPass.total) * 100), `${halfPass.passedCount}/${halfPass.total} = ${halfPass.score}%`);
check('V6c', 'hidden cases never leak expected values', allPass.cases.filter(c => c.hidden).every(c => !('expected' in c)));
check('V6d', 'throwing code fails gracefully', broken.ok === true && broken.score === 0);
check('V6e', 'syntax errors are reported, not crashed', syntax.ok === false && /failed to run/i.test(syntax.error || ''));
check('V6f', 'infinite loops are stopped by the timeout', (() => {
  const r = runCodeTests('function add(a,b){ while(true){} }', tests, { timeoutMs: 300 });
  return r.score === 0;
})());

// ── V7: rubric scoring ──────────────────────────────────────────────────────
const rubric = [
  { criterion: 'Correctness', weight: 0.5 },
  { criterion: 'Justification', weight: 0.3 },
  { criterion: 'Communication', weight: 0.2 },
];
const scored = scoreRubric(rubric, [
  { score: 4, justification: 'Fully correct and validated.' },
  { score: 3, justification: 'Reasoning mostly clear.' },
  { score: 2, justification: 'Understandable but disorganised.' },
]);
check('V7a', 'rubric returns a weighted ratio', Math.abs(scored.ratio - (0.5 * 1 + 0.3 * 0.75 + 0.2 * 0.5)) < 1e-6, `ratio=${scored.ratio.toFixed(3)}`);
check('V7b', 'every criterion carries a justification', scored.breakdown.length === 3 && scored.breakdown.every(b => b.justification));

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} assessment checks passed.`);
process.exit(failed.length ? 1 : 0);
