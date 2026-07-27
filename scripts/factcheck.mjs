#!/usr/bin/env node
/**
 * Independently verify quiz answer keys (M7).
 *
 * Poses every unverified question COLD to a separate pass — no answer key, no
 * explanation — and disputes anything where the independent answer differs, more
 * than one option is defensible, or the question is ambiguous. Disputed items are
 * immediately excluded from graded assessment.
 *
 *   npm run factcheck                  verify every unverified item
 *   npm run factcheck -- <slug>        one course
 *   npm run factcheck -- --limit 20    cap the run (useful for cost control)
 *   npm run factcheck -- --status      just report current verification state
 */
import { verifyCourseItems, verificationSummary } from '../ai/quality/factCheck.js';
import db from '../db/database.js';

const args = process.argv.slice(2);
const slug = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a)) || null;
const limitFlag = args.indexOf('--limit');
const limit = limitFlag !== -1 ? parseInt(args[limitFlag + 1], 10) : null;

const report = () => {
  const s = verificationSummary(slug);
  console.log(`\nVerification state${slug ? ` for ${slug}` : ''}:`);
  console.log(`  confirmed  ${s.confirmed}`);
  console.log(`  unverified ${s.unverified}   (usable, just unchecked)`);
  console.log(`  disputed   ${s.disputed}   (excluded from graded assessment)`);
  console.log(`  flagged    ${s.flagged}   (learner-reported, excluded)`);
  console.log(`  → ${s.gradeable}/${s.total} items are usable for grading`);
  if (s.disputed || s.flagged) {
    const bad = db.prepare(`SELECT question, verification_note FROM quiz_items WHERE verification_status IN ('disputed','flagged') ${slug ? 'AND course_slug = ?' : ''} LIMIT 10`).all(...(slug ? [slug] : []));
    console.log('\nNeeds review:');
    for (const b of bad) console.log(`  · ${b.question.slice(0, 90)}\n    ${b.verification_note || ''}`);
  }
};

if (args.includes('--status')) { report(); process.exit(0); }

console.log(`Verifying${slug ? ` ${slug}` : ' all courses'}${limit ? ` (max ${limit} items)` : ''}…`);
try {
  const t = await verifyCourseItems({ slug, limit, onProgress: (_p, m) => process.stdout.write(`\r${m}   `) });
  console.log(`\n\nconfirmed ${t.confirmed} · disputed ${t.disputed} · unverified ${t.unverified} of ${t.total}`);
} catch (e) {
  console.error(`\nVerification stopped: ${e?.message || e}`);
  if (/402|credit/i.test(e?.message || '')) {
    console.error('Add OpenRouter credits and re-run — already-verified items are skipped, so it resumes where it stopped.');
  }
}
report();
process.exit(0);
