#!/usr/bin/env node
/**
 * Audit every external link a course cites, and ask whether it is the document
 * the course says it is.
 *
 * The build only ever checked that a URL loads. That catches nothing useful,
 * because the model does not invent hostnames — it invents identifiers, and a
 * fabricated arXiv id resolves perfectly to somebody else's paper. A lesson on
 * policy and value functions cited "Biorthogonal rational functions of R_II
 * type" and was marked verified, because the link worked.
 *
 *   node scripts/check-resources.mjs              report only
 *   node scripts/check-resources.mjs --fix        detach links that are not what they claim
 *
 * --fix clears the url on the lesson rather than deleting the lesson: the
 * teaching text around it is still good, it just should not point at the wrong
 * paper.
 */
import db from '../db/database.js';
import { checkUrlMatchesClaim } from '../ai/agents/research.js';

const FIX = process.argv.includes('--fix');
const CONCURRENCY = 6;

const rows = db.prepare(`
  SELECT l.id, l.title, l.url, m.title AS module_title, c.title AS course_title
    FROM module_lessons l
    JOIN course_modules m ON m.id = l.module_id
    JOIN courses c ON c.slug = m.course_slug
   WHERE l.url IS NOT NULL AND l.url != ''
   ORDER BY c.title, m.order_idx, l.order_idx`).all();

if (!rows.length) { console.log('No external links to check.'); process.exit(0); }
console.log(`Checking ${rows.length} cited link(s)…\n`);

const bad = [];
let checked = 0, unverifiable = 0;

let cursor = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (;;) {
    const i = cursor++;
    if (i >= rows.length) return;
    const r = rows[i];
    let verdict;
    try {
      verdict = await checkUrlMatchesClaim(r.url, r.title, { context: r.module_title });
    } catch (e) {
      verdict = { ok: true, realTitle: null, reason: 'check failed: ' + e.message };
    }
    checked++;
    if (!verdict.realTitle) unverifiable++;
    if (!verdict.ok) bad.push({ ...r, real: verdict.realTitle });
    if (checked % 25 === 0) process.stdout.write(`  …${checked}/${rows.length}\n`);
  }
}));

if (!bad.length) {
  console.log(`\nAll ${rows.length} links check out (${unverifiable} could not be verified either way).`);
  process.exit(0);
}

console.log(`\n${bad.length} of ${rows.length} links point at something else:\n`);
let course = null;
for (const b of bad) {
  if (b.course_title !== course) { course = b.course_title; console.log(`  ${course}`); }
  console.log(`    "${b.title}"`);
  console.log(`      cites ${b.url}`);
  console.log(`      which is: ${b.real}`);
}

if (!FIX) {
  console.log(`\nRe-run with --fix to detach these links (the lesson text is kept).`);
  process.exit(1);
}

const detach = db.prepare('UPDATE module_lessons SET url = NULL WHERE id = ?');
const run = db.transaction(() => { for (const b of bad) detach.run(b.id); });
run();
console.log(`\nDetached ${bad.length} incorrect link(s). Lesson text kept.`);
console.log('Re-run the course through `npm run enrich -- <slug>` to source replacements.');
process.exit(0);
