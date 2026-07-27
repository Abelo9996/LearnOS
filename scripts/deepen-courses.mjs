#!/usr/bin/env node
/**
 * Brings every course that fails the depth floors up to standard, in place.
 *
 * The six hand-written seed courses predate the depth model (3 modules, ~370
 * chars per lesson, no quiz items). This deepens them rather than deleting them,
 * so a fresh install still ships a catalog — one that meets the floors.
 *
 *   npm run deepen              deepen every failing course
 *   npm run deepen -- <slug>    deepen one
 *   npm run deepen -- --dry     list what would be deepened
 */
import { validateAllCourses, validateCourseDepth } from '../ai/quality/depthFloors.js';
import { enrichCourse } from '../ai/agents/courseBuilder.js';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const only = args.find(a => !a.startsWith('--'));

const failing = only
  ? [validateCourseDepth(only)]
  : validateAllCourses().filter(r => !r.ok);

if (!failing.length) { console.log('All courses already meet the depth floors.'); process.exit(0); }

console.log(`${failing.length} course(s) below the floors:`);
for (const f of failing) console.log(`  ${f.slug} — ${f.violations.length} violations (${f.stats.modules} modules, ${f.stats.lessons} lessons, ${f.stats.quizItems} items)`);
if (dry) process.exit(0);

console.log('\nDeepening (one LLM call per gap, modules run 4-wide)…\n');
let ok = 0;
for (const f of failing) {
  process.stdout.write(`${f.slug} … `);
  try {
    const r = await enrichCourse({ userId: 'user-1', slug: f.slug, onProgress: () => {} });
    const s = r.depth.stats;
    console.log(`${r.depth.ok ? 'PASS' : `${r.depth.violations} left`} — ${s.modules} modules, ${s.lessons} lessons, ${s.quizItems} items, ${s.declaredHours}h`);
    if (r.depth.ok) ok++;
  } catch (e) {
    console.log(`FAILED — ${e?.message || e}`);
  }
}
console.log(`\n${ok}/${failing.length} now meet the depth floors.`);
process.exit(0);
