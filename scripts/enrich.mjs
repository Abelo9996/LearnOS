#!/usr/bin/env node
/**
 * Deepen an existing course until it clears the depth floors.
 *
 * `npm run verify` names the courses that fall short and `depth-check.mjs`
 * says why, per module — but until now there was no way to act on that without
 * the UI. This is that way. It runs the same enrichCourse() the app's job queue
 * runs, in place, so a course that shipped with an unassessed module or a thin
 * reading gets repaired rather than regenerated from scratch.
 *
 *   node scripts/enrich.mjs <slug> [<slug>…]
 *   node scripts/enrich.mjs --failing      every course below the floors
 *
 * Needs a working OpenRouter key, since it generates real content.
 */
import db from '../db/database.js';
import { enrichCourse } from '../ai/agents/courseBuilder.js';

const args = process.argv.slice(2);
const userId = 'user-1';

if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node scripts/enrich.mjs <slug>… | --failing');
  process.exit(args.length ? 0 : 1);
}

let slugs;
if (args.includes('--failing')) {
  // Ask the depth model itself which courses fall short, rather than
  // reimplementing the floors here where the two could drift apart.
  const { validateAllCourses } = await import('../ai/quality/depthFloors.js');
  slugs = validateAllCourses().filter(r => !r.ok).map(r => r.slug);
} else {
  slugs = args.filter(a => !a.startsWith('-'));
}

if (!slugs.length) { console.log('Nothing to enrich — every course meets the floors.'); process.exit(0); }

console.log(`Enriching ${slugs.length} course(s). This makes real model calls and is not quick.\n`);

let failed = 0;
for (const slug of slugs) {
  const course = db.prepare('SELECT title FROM courses WHERE slug = ?').get(slug);
  if (!course) { console.error(`SKIP  ${slug} — no such course`); failed++; continue; }
  console.log(`── ${course.title}`);
  let lastPct = -1;
  try {
    await enrichCourse({
      userId, slug,
      onProgress: (p, msg) => {
        const pct = Math.round((p || 0) * 100);
        if (pct !== lastPct) { lastPct = pct; console.log(`   ${String(pct).padStart(3)}%  ${msg || ''}`); }
      },
    });
    const after = db.prepare(`SELECT
        (SELECT COUNT(*) FROM course_modules WHERE course_slug = ?) modules,
        (SELECT COUNT(*) FROM module_lessons l JOIN course_modules m ON m.id = l.module_id WHERE m.course_slug = ?) lessons,
        (SELECT COUNT(*) FROM quiz_items WHERE course_slug = ?) items`).get(slug, slug, slug);
    console.log(`   done — ${after.modules} modules, ${after.lessons} lessons, ${after.items} questions\n`);
  } catch (e) {
    failed++;
    console.error(`   FAILED — ${e.message}\n`);
  }
}

console.log(failed
  ? `${slugs.length - failed}/${slugs.length} enriched. Re-run: node scripts/depth-check.mjs`
  : `All ${slugs.length} enriched. Re-run: node scripts/depth-check.mjs`);
process.exit(failed ? 1 : 0);
