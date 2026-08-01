/**
 * Course sharing — M12 of docs/MASTERY_SPEC_V2.md.
 *
 * LearnOS is single-user and self-hosted, so it cannot host a social network,
 * and pretending otherwise (seeded "members", invented threads, a leaderboard of
 * fabricated contributors) was dishonest in exactly the way the rest of this
 * codebase refuses to be.
 *
 * What an open-source local tool CAN genuinely participate in is a content
 * commons: a course is a file. Export it, send it to someone, they import it and
 * have the whole thing — readings, resources, labs, question bank and all. No
 * server, no accounts, no network required.
 */
import { Router } from 'express';
import db, { logActivity } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { isPublicUrl } from '../middleware/url-safety.js';

const router = Router();
router.use(requireAuth);

export const BUNDLE_VERSION = 1;
const parse = (s, fb) => { try { return s ? JSON.parse(s) : fb; } catch { return fb; } };

/**
 * Build the portable bundle for a course.
 *
 * Exported as a function so publishing to the community registry produces
 * byte-for-byte what a file download would: one definition, no chance of the
 * two drifting into subtly different bundles.
 */
export function buildBundle(slug) {
  const course = db.prepare('SELECT * FROM courses WHERE slug = ?').get(slug);
  if (!course) return null;

  const modules = db.prepare('SELECT * FROM course_modules WHERE course_slug = ? ORDER BY order_idx').all(course.slug);
  return {
    bundleVersion: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    course: {
      title: course.title, blurb: course.blurb, hours: course.hours, level: course.level,
      tags: parse(course.tags, []), outcomes: parse(course.outcomes, []),
      prerequisites: parse(course.prerequisites, []), skills: parse(course.skills, []),
    },
    modules: modules.map(m => ({
      title: m.title, summary: m.summary, order_idx: m.order_idx,
      estimated_minutes: m.estimated_minutes, objectives: parse(m.objectives, []),
      lessons: db.prepare('SELECT * FROM module_lessons WHERE module_id = ? ORDER BY order_idx').all(m.id)
        .map(l => ({
          title: l.title, body_md: l.body_md, kind: l.kind, order_idx: l.order_idx, url: l.url,
          estimated_minutes: l.estimated_minutes, is_graded: l.is_graded, is_optional: l.is_optional,
          pass_threshold: l.pass_threshold, max_attempts: l.max_attempts,
          lab_language: l.lab_language, starter_code: l.starter_code, lab_tests: parse(l.lab_tests_json, null),
        })),
      // The question bank travels too — a course without its assessment is half a course.
      quiz_items: db.prepare('SELECT question, choices_json, answer_idx, explanation, difficulty, skill, verification_status FROM quiz_items WHERE module_id = ?').all(m.id)
        .map(q => ({
          question: q.question, choices: parse(q.choices_json, []), answer_idx: q.answer_idx,
          explanation: q.explanation, difficulty: q.difficulty, skill: q.skill,
          // Verification is per-instance evidence, not a property of the content:
          // the importer must check for themselves rather than inherit our verdict.
          wasVerifiedByExporter: q.verification_status === 'confirmed',
        })),
    })),
  };
}

/** GET /api/share/course/:slug — the whole course as one portable JSON bundle. */
router.get('/course/:slug', (req, res) => {
  const bundle = buildBundle(req.params.slug);
  if (!bundle) return res.status(404).json({ error: true, message: 'Course not found' });
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.slug}.learnos.json"`);
  res.json(bundle);
});

/** Validate an incoming bundle without trusting any of it. */
function validateBundle(b) {
  const errors = [];
  if (!b || typeof b !== 'object') return ['Not a JSON object'];
  if (b.bundleVersion !== BUNDLE_VERSION) errors.push(`Unsupported bundle version: ${b.bundleVersion ?? 'missing'} (expected ${BUNDLE_VERSION})`);
  if (!b.course?.title) errors.push('Missing course title');
  if (!Array.isArray(b.modules) || !b.modules.length) errors.push('Bundle contains no modules');
  const lessons = (b.modules || []).flatMap(m => m.lessons || []);
  if (!lessons.length) errors.push('Bundle contains no lessons');
  return errors;
}

/**
 * POST /api/share/import — import a bundle someone shared.
 *
 * Imported content is untrusted: URLs are checked against the same SSRF policy
 * as anything else, and every question arrives as 'unverified' regardless of
 * what the exporter believed, because verification is evidence this instance
 * gathered, not a claim that travels with a file.
 */
router.post('/import', (req, res) => {
  const bundle = req.body?.bundle ?? req.body;
  const errors = validateBundle(bundle);
  if (errors.length) return res.status(400).json({ error: true, message: errors[0], errors });

  const base = String(bundle.course.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'course';
  const slug = `${base}-${Date.now().toString(36)}`;
  const J = (v) => JSON.stringify(Array.isArray(v) ? v : []);
  const c = bundle.course;

  let lessonCount = 0, itemCount = 0, droppedUrls = 0;

  const run = db.transaction(() => {
    db.prepare(`INSERT INTO courses (slug, title, blurb, author, verified, rating, stars, forks, hours, version, tags, outcomes, prerequisites, skills, level)
                VALUES (?, ?, ?, 'Imported', 0, 0, 0, 0, ?, 'v1.0', ?, ?, ?, ?, ?)`)
      .run(slug, c.title, c.blurb || '', Number(c.hours) || 0, J(c.tags), J(c.outcomes), J(c.prerequisites), J(c.skills), c.level || 'intermediate');

    bundle.modules.forEach((m, i) => {
      const mid = `cm-${slug}-${i}`;
      db.prepare('INSERT INTO course_modules (id, course_slug, title, summary, order_idx, estimated_minutes, objectives) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(mid, slug, m.title || `Module ${i + 1}`, m.summary || null, i, Number(m.estimated_minutes) || 0, J(m.objectives));

      (m.lessons || []).forEach((l, k) => {
        // A shared file could carry an internal or malicious URL; apply the same
        // policy we apply to anything else from outside.
        let url = l.url || null;
        if (url && !isPublicUrl(url)) { url = null; droppedUrls++; }
        db.prepare(`INSERT INTO module_lessons (id, module_id, title, body_md, kind, order_idx, url, estimated_minutes, is_graded, is_optional, pass_threshold, max_attempts, lab_language, starter_code, lab_tests_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(`ml-${mid}-${k}`, mid, l.title || 'Lesson', l.body_md || '', l.kind || 'reading', k, url,
            Number(l.estimated_minutes) || 10, l.is_graded ? 1 : 0, l.is_optional ? 1 : 0,
            l.pass_threshold ?? null, l.max_attempts ?? null,
            l.lab_language || null, l.starter_code || null,
            l.lab_tests ? JSON.stringify(l.lab_tests) : null);
        lessonCount++;
      });

      (m.quiz_items || []).forEach((q, k) => {
        if (!q?.question || !Array.isArray(q.choices) || q.choices.length < 2) return;
        const idx = Number(q.answer_idx);
        if (!Number.isInteger(idx) || idx < 0 || idx >= q.choices.length) return;
        db.prepare(`INSERT INTO quiz_items (id, course_slug, module_id, question, choices_json, answer_idx, explanation, difficulty, skill, verification_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unverified')`)
          .run(`qi-${mid}-${k}`, slug, mid, q.question, JSON.stringify(q.choices), idx, q.explanation || null, q.difficulty || 'medium', q.skill || null);
        itemCount++;
      });
    });

    db.prepare('INSERT OR IGNORE INTO enrollments (user_id, course_slug, progress, status) VALUES (?, ?, 0, ?)').run(req.userId, slug, 'enrolled');
  });

  try {
    run();
  } catch (e) {
    return res.status(500).json({ error: true, message: `Import failed: ${e.message}` });
  }

  try { logActivity(req.userId, { kind: 'session', text: `Imported course: ${c.title}`, sub: `${bundle.modules.length} modules · ${lessonCount} lessons`, agent: 'CR' }); } catch {}

  res.json({
    ok: true, slug, title: c.title,
    modules: bundle.modules.length, lessons: lessonCount, quizItems: itemCount, droppedUrls,
    note: 'Imported questions start unverified — run the fact-checker before relying on them to grade you.',
  });
});

/** GET /api/share/exportable — courses available to export, with size hints. */
router.get('/exportable', (req, res) => {
  const rows = db.prepare(`SELECT c.slug, c.title, c.hours,
                             (SELECT COUNT(*) FROM course_modules m WHERE m.course_slug = c.slug) modules,
                             (SELECT COUNT(*) FROM module_lessons l JOIN course_modules m ON m.id = l.module_id WHERE m.course_slug = c.slug) lessons,
                             (SELECT COUNT(*) FROM quiz_items q WHERE q.course_slug = c.slug) quizItems
                           FROM courses c ORDER BY c.title`).all();
  res.json({ ok: true, courses: rows });
});

export default router;
