/**
 * Content reporting — M7 of docs/MASTERY_SPEC_V2.md.
 *
 * Generated content can be confidently wrong in ways no automated check catches.
 * The person actually working through the course is the last line of defence, so
 * reporting has to be one click and has to have teeth: a reported quiz item is
 * immediately pulled out of graded assessment rather than queued for someone to
 * look at eventually.
 */
import { Router } from 'express';
import db from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { verificationSummary, STATUS } from '../ai/quality/factCheck.js';
import { translateLesson, getTranslation, courseTranslationStatus } from '../ai/quality/translate.js';

const router = Router();
router.use(requireAuth);

const REASONS = ['wrong_answer', 'factual_error', 'unclear', 'dead_link', 'other'];
const TARGETS = ['quiz_item', 'lesson'];

/** POST /api/content/report — flag something as wrong. */
router.post('/report', (req, res) => {
  const { target_type, target_id, reason, detail } = req.body || {};
  if (!TARGETS.includes(target_type)) return res.status(400).json({ error: true, message: `target_type must be one of ${TARGETS.join(', ')}` });
  if (!target_id) return res.status(400).json({ error: true, message: 'target_id required' });
  if (!REASONS.includes(reason)) return res.status(400).json({ error: true, message: `reason must be one of ${REASONS.join(', ')}` });

  const exists = target_type === 'quiz_item'
    ? db.prepare('SELECT id FROM quiz_items WHERE id = ?').get(target_id)
    : db.prepare('SELECT id FROM module_lessons WHERE id = ?').get(target_id);
  if (!exists) return res.status(404).json({ error: true, message: 'That content does not exist' });

  const id = `cr-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  db.prepare('INSERT INTO content_reports (id, user_id, target_type, target_id, reason, detail) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, target_type, target_id, reason, (detail || '').slice(0, 2000) || null);

  // Teeth: a reported question stops grading people immediately.
  let quarantined = false;
  if (target_type === 'quiz_item') {
    db.prepare("UPDATE quiz_items SET verification_status = ?, verification_note = ? WHERE id = ?")
      .run(STATUS.FLAGGED, `Reported by learner: ${reason}${detail ? ` — ${String(detail).slice(0, 200)}` : ''}`, target_id);
    quarantined = true;
  }

  res.json({ ok: true, id, quarantined,
    message: quarantined
      ? 'Thanks — that question is now excluded from graded assessments until it is reviewed.'
      : 'Thanks — this has been recorded for review.' });
});

/** GET /api/content/reports — open reports, newest first. */
router.get('/reports', (req, res) => {
  const status = req.query.status || 'open';
  const rows = db.prepare('SELECT * FROM content_reports WHERE status = ? ORDER BY created_at DESC LIMIT 200').all(status);
  const enriched = rows.map(r => {
    const target = r.target_type === 'quiz_item'
      ? db.prepare('SELECT question AS label, verification_status, verification_note FROM quiz_items WHERE id = ?').get(r.target_id)
      : db.prepare('SELECT title AS label FROM module_lessons WHERE id = ?').get(r.target_id);
    return { ...r, target: target || null };
  });
  res.json({ ok: true, reports: enriched });
});

/** PATCH /api/content/reports/:id — resolve or dismiss. */
router.patch('/reports/:id', (req, res) => {
  const { status, restore } = req.body || {};
  if (!['resolved', 'dismissed', 'open'].includes(status)) return res.status(400).json({ error: true, message: 'status must be resolved, dismissed or open' });
  const report = db.prepare('SELECT * FROM content_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: true, message: 'Report not found' });

  db.prepare("UPDATE content_reports SET status = ?, resolved_at = CASE WHEN ? = 'open' THEN NULL ELSE datetime('now') END WHERE id = ?")
    .run(status, status, req.params.id);

  // Dismissing a report (or explicitly restoring) puts the item back in play —
  // but only back to 'unverified', never straight to 'confirmed'. Deciding a
  // complaint was unfounded is not the same as having checked the item.
  if (report.target_type === 'quiz_item' && (status === 'dismissed' || restore)) {
    db.prepare("UPDATE quiz_items SET verification_status = ?, verification_note = NULL WHERE id = ? AND verification_status = ?")
      .run(STATUS.UNVERIFIED, report.target_id, STATUS.FLAGGED);
  }
  res.json({ ok: true });
});

/**
 * Translation (M9). Coursera localises a subset of its catalogue; we can
 * translate any lesson into any language on demand, and cache the result so it
 * is only paid for once.
 */
router.get('/lesson/:id/translation', async (req, res) => {
  const language = String(req.query.language || '').trim();
  if (!language) return res.status(400).json({ error: true, message: 'language required' });
  const cached = getTranslation('lesson', req.params.id, language);
  if (cached) return res.json({ ok: true, cached: true, translation: cached });

  const exists = db.prepare('SELECT id FROM module_lessons WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: true, message: 'Lesson not found' });

  try {
    const t = await translateLesson({ userId: req.userId, lessonId: req.params.id, language });
    if (!t) return res.status(502).json({ error: true, message: 'Translation produced nothing' });
    res.json({ ok: true, cached: !!t.cached, translation: t });
  } catch (e) {
    // Degrade honestly: the original is always still readable.
    res.status(e.code === 'NO_KEY' ? 400 : 502).json({ error: true, code: e.code || null, message: e.message });
  }
});

/** GET /api/content/course/:slug/translation-status?language=… */
router.get('/course/:slug/translation-status', (req, res) => {
  const language = String(req.query.language || '').trim();
  if (!language) return res.status(400).json({ error: true, message: 'language required' });
  res.json({ ok: true, language, ...courseTranslationStatus(req.params.slug, language) });
});

/** GET /api/content/verification — how much of the catalog has been checked. */
router.get('/verification', (req, res) => {
  const slug = req.query.slug || null;
  const summary = verificationSummary(slug);
  const disputed = db.prepare(`SELECT id, course_slug, question, verification_note FROM quiz_items
                               WHERE verification_status IN ('disputed','flagged') ${slug ? 'AND course_slug = ?' : ''}
                               ORDER BY verified_at DESC LIMIT 50`).all(...(slug ? [slug] : []));
  res.json({ ok: true, summary, disputed });
});

/**
 * GET /api/content/reader/:lessonId — readable in-app view of an external
 * resource lesson. The URL is looked up server-side from the lesson row (never
 * taken from the client), fetched behind the SSRF guard, reduced to Markdown,
 * and cached. Returns {ok:false} when the site resists extraction — the UI
 * falls back to the open-original card.
 */
router.get('/reader/:lessonId', async (req, res) => {
  const lesson = db.prepare('SELECT id, title, url, kind FROM module_lessons WHERE id = ?').get(req.params.lessonId);
  if (!lesson || !lesson.url) return res.status(404).json({ error: true, message: 'No external resource on this lesson' });
  if (lesson.kind === 'video') return res.json({ ok: false, reason: 'video' }); // videos embed natively
  try {
    const { fetchReadable } = await import('../ai/reader.js');
    const out = await fetchReadable(lesson.url);
    if (!out) return res.json({ ok: false, reason: 'not_extractable' });
    res.json({ ok: true, title: out.title || lesson.title, source: out.source, markdown: out.markdown, cached: !!out.cached });
  } catch (e) {
    res.json({ ok: false, reason: e.message || 'fetch_failed' });
  }
});

export default router;
