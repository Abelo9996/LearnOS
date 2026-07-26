#!/usr/bin/env node
/**
 * Verifies M4 specialization pathways (docs/MASTERY_SPEC_V2.md §5):
 *   V9  placement — the diagnostic sets a defensible starting node
 *   V8  gating    — a pathway of courses progresses only on demonstrated mastery
 *
 * Placement is pure logic, so it is tested exhaustively with a synthetic pathway
 * (no LLM needed): a learner who knows the first two courses must start at the
 * third, one who knows nothing must start at the first, and knowing a LATER
 * course must never skip an earlier one they failed.
 *
 *   node scripts/verify-specialization.mjs
 */
import db from '../db/database.js';
import { applyPlacement } from '../ai/agents/specialization.js';

const results = [];
const check = (id, name, pass, detail = '') => { results.push({ id, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}${detail ? ` — ${detail}` : ''}`); };

const RM = 'sp-verify-test';
const COURSES = ['Foundations', 'Core Skills', 'Applied Practice', 'Advanced Topics'];

function seed() {
  cleanup();
  // 3 questions per course, answer_idx always 0 for simplicity.
  const questions = [];
  COURSES.forEach((c, ci) => {
    for (let k = 0; k < 3; k++) {
      questions.push({ question: `${c} q${k}`, choices: ['right', 'wrong', 'wrong', 'wrong'], answer_idx: 0, skill: `${c} skill ${k}`, course_index: ci });
    }
  });
  db.prepare(`INSERT INTO roadmaps (id, user_id, title, subtitle, authored_by, mastery, total_modules, completed_modules, status, next_module, modules_left, kind, goal, placement_json)
              VALUES (?, 'user-1', 'Verify Pathway', 'test', 'test', 0, ?, 0, 'active', '', ?, 'specialization', 'test goal', ?)`)
    .run(RM, COURSES.length, COURSES.length, JSON.stringify(questions));
  COURSES.forEach((c, i) => {
    db.prepare(`INSERT INTO roadmap_nodes (id, roadmap_id, title, col, row_idx, mastery, status, node_kind, course_topic, build_status)
                VALUES (?, ?, ?, ?, 0, 0, ?, 'course', ?, 'planned')`)
      .run(`${RM}-c${i}`, RM, c, i, i === 0 ? 'active' : i === 1 ? 'next' : 'locked', c);
    if (i > 0) db.prepare('INSERT OR IGNORE INTO roadmap_edges (roadmap_id, from_node, to_node) VALUES (?, ?, ?)').run(RM, `${RM}-c${i - 1}`, `${RM}-c${i}`);
  });
  return questions;
}
function cleanup() {
  for (const t of ['node_objectives', 'roadmap_edges', 'roadmap_nodes']) db.prepare(`DELETE FROM ${t} WHERE roadmap_id = ?`).run(RM);
  db.prepare('DELETE FROM roadmaps WHERE id = ?').run(RM);
}
const statuses = () => db.prepare("SELECT id, title, status, mastery FROM roadmap_nodes WHERE roadmap_id = ? ORDER BY id").all(RM);

// answers: for each course index, whether the learner answers correctly
const answersFor = (correctByCourse) => {
  const out = [];
  COURSES.forEach((_, ci) => { for (let k = 0; k < 3; k++) out.push(correctByCourse[ci] ? 0 : 1); });
  return out;
};

// ── V9a: knows nothing → starts at course 0 ─────────────────────────────────
seed();
let r = applyPlacement('user-1', RM, answersFor([false, false, false, false]));
check('V9a', 'a learner who demonstrates nothing starts at the first course', r.startIndex === 0 && r.skipped === 0, `start="${r.startNode}"`);
check('V9b', 'no course is marked done when nothing was demonstrated', statuses().every(n => n.status !== 'done'));

// ── V9c: knows the first two → starts at the third ──────────────────────────
seed();
r = applyPlacement('user-1', RM, answersFor([true, true, false, false]));
let st = statuses();
check('V9c', 'demonstrated courses are skipped', r.startIndex === 2 && r.startNode === 'Applied Practice', `start="${r.startNode}" skipped=${r.skipped}`);
check('V9d', 'skipped courses are marked done with real mastery', st[0].status === 'done' && st[1].status === 'done' && st[0].mastery >= 0.8);
check('V9e', 'the starting course is active and the next is queued', st[2].status === 'active' && st[3].status === 'next');

// ── V9f: knowing a LATER course must not skip an earlier failure ────────────
seed();
r = applyPlacement('user-1', RM, answersFor([false, true, true, true]));
check('V9f', 'a later strength never skips an earlier gap', r.startIndex === 0, `start="${r.startNode}"`);

// ── V9g: knows everything → starts at the last course, never past the end ───
seed();
r = applyPlacement('user-1', RM, answersFor([true, true, true, true]));
check('V9g', 'demonstrating everything still lands on a real course', r.startIndex === COURSES.length - 1 && !!r.startNode, `start="${r.startNode}"`);

// ── V9h: partial knowledge below the bar does not skip ──────────────────────
seed();
const partial = [];
COURSES.forEach((_, ci) => { for (let k = 0; k < 3; k++) partial.push(ci === 0 && k < 2 ? 0 : 1); }); // 2/3 = 0.67 < 0.75
r = applyPlacement('user-1', RM, partial);
check('V9h', 'scoring below the skip threshold does not skip the course', r.startIndex === 0, `course0 ratio=${r.perCourse[0].ratio.toFixed(2)}`);
check('V9i', 'placement reports the specific skill gaps', Array.isArray(r.perCourse[0].gaps) && r.perCourse[0].gaps.length > 0, `gaps=${r.perCourse[0].gaps.length}`);

// ── V8: pathway gating — locked until the predecessor is done ───────────────
seed();
applyPlacement('user-1', RM, answersFor([false, false, false, false]));
st = statuses();
check('V8a', 'later pathway courses start locked', st[2].status === 'locked' && st[3].status === 'locked');
const edges = db.prepare('SELECT from_node, to_node FROM roadmap_edges WHERE roadmap_id = ?').all(RM);
check('V8b', 'pathway courses are chained by prerequisite edges', edges.length === COURSES.length - 1);

cleanup();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} specialization checks passed.`);
process.exit(failed ? 1 : 0);
