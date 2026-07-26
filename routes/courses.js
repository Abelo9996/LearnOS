import { Router } from 'express';
import db, { logActivity, awardXP } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { isPublicUrl } from '../middleware/url-safety.js';
import { generateCourse } from '../ai/agents/course.js';
import { enqueueJob } from '../ai/jobs.js';
import '../ai/agents/courseBuilder.js'; // registers the 'build-course' job handler

const router = Router();

// ── Helper: get course by slug ───────────────────────────────────────────────
function getCourse(slug) {
  return db.prepare('SELECT * FROM courses WHERE slug = ?').get(slug);
}

// AI course generation — the Curriculum agent designs a full Coursera-grade
// course (readings, verified resources, assignments, capstone). Declared before
// the /:slug routes so "generate" is never captured as a slug.
router.post('/generate', requireAuth, async (req, res) => {
  const { topic, level } = req.body || {};
  if (!topic || !String(topic).trim()) return res.status(400).json({ error: true, message: 'topic required' });
  try {
    const result = await generateCourse({ userId: req.userId, topic: String(topic).slice(0, 200), level });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(e.code === 'NO_KEY' ? 400 : 502).json({ error: true, code: e.code || null, message: e.message });
  }
});

// Staged build (M2) — one LLM call per module produces a course with real depth.
// Too slow for a request/response cycle, so it returns a jobId to poll; the job
// reports progress per module and validates the result against the depth floors.
router.post('/build', requireAuth, (req, res) => {
  const { topic, level } = req.body || {};
  if (!topic || !String(topic).trim()) return res.status(400).json({ error: true, message: 'topic required' });
  const jobId = enqueueJob(req.userId, 'build-course', { topic: String(topic).slice(0, 200), level });
  res.json({ ok: true, jobId });
});

router.get('/', (req, res) => {
  const search = req.query.search || '';
  let courses;
  if (search) {
    const term = `%${search}%`;
    courses = db.prepare("SELECT * FROM courses WHERE title LIKE ? OR author LIKE ? OR blurb LIKE ? ORDER BY rating DESC").all(term, term, term);
  } else {
    courses = db.prepare('SELECT * FROM courses ORDER BY rating DESC').all();
  }
  res.json(courses);
});

router.get('/:slug', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM courses WHERE slug = ?').get(req.params.slug);
  if (!c) return res.status(404).json({ error: true, message: 'Course not found' });
  // Attach enrollment status
  const enrollment = db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_slug = ?').get(req.userId, req.params.slug);
  const starred = db.prepare("SELECT 1 FROM starred_items WHERE user_id = ? AND item_type = 'course' AND item_id = ?").get(req.userId, req.params.slug);
  res.json({ ...c, enrollment: enrollment || null, starred: !!starred });
});

router.post('/:slug/enroll', requireAuth, (req, res) => {
  const already = db.prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND course_slug = ?').get(req.userId, req.params.slug);
  db.prepare("INSERT OR REPLACE INTO enrollments (user_id, course_slug, progress, status, enrolled_at) VALUES (?, ?, 0, 'enrolled', CURRENT_TIMESTAMP)")
    .run(req.userId, req.params.slug);
  if (!already) {
    const c = db.prepare('SELECT title FROM courses WHERE slug = ?').get(req.params.slug);
    logActivity(req.userId, { kind: 'session', text: `Enrolled in: ${c?.title || req.params.slug}`, sub: 'Course', agent: 'CR' });
  }
  res.json({ ok: true, enrolled: true });
});

router.delete('/:slug/enroll', requireAuth, (req, res) => {
  db.prepare('DELETE FROM enrollments WHERE user_id = ? AND course_slug = ?').run(req.userId, req.params.slug);
  res.json({ ok: true, enrolled: false });
});

router.patch('/:slug/enroll', requireAuth, (req, res) => {
  const { progress, status } = req.body;
  const fields = []; const vals = [];
  if (progress !== undefined) { fields.push('progress = ?'); vals.push(progress); }
  if (status !== undefined)   { fields.push('status = ?');   vals.push(status); }
  if (fields.length === 0) return res.status(400).json({ error: true, message: 'No fields to update' });
  vals.push(req.userId, req.params.slug);
  db.prepare(`UPDATE enrollments SET ${fields.join(', ')} WHERE user_id = ? AND course_slug = ?`).run(...vals);
  res.json({ ok: true });
});


router.post('/', requireAuth, (req, res) => {
  const { slug, title, blurb, author, hours, tags, syllabus, rating, stars, forks, thumbnail_url } = req.body;
  if (!slug || !title) return res.status(400).json({ error: true, message: 'slug and title required' });
  // S-07: SSRF guard on user-supplied thumbnail URL. Same-origin /uploads/*
  // paths are allowed (matching the avatar_url rule in routes/users.js) —
  // otherwise an uploaded thumbnail was always rejected as "unsafe".
  if (thumbnail_url && !thumbnail_url.startsWith('/uploads/') && !isPublicUrl(thumbnail_url)) {
    return res.status(400).json({ error: true, code: 'UNSAFE_URL', message: 'thumbnail_url must be an uploaded path or a public http(s) URL' });
  }
  // NOTE: this INSERT previously listed 12 columns but supplied only 11 values,
  // so every course creation threw a SQLite arity error and 500'd.
  db.prepare('INSERT OR REPLACE INTO courses (slug, title, blurb, author, verified, rating, stars, forks, hours, version, tags, thumbnail_url) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)')
    .run(slug, title, blurb || '', author || 'You', rating || 0, stars || 0, forks || 0, hours || 0, 'v1.0', tags || '[]', thumbnail_url || null);

  // Build real modules + a starter lesson from the bundled roadmap syllabus.
  // Previously `syllabus` was read off the body and silently discarded, so
  // "Bundle from a roadmap" always produced an empty, unreadable course.
  let modulesCreated = 0;
  try {
    const parsed = typeof syllabus === 'string' ? JSON.parse(syllabus || '[]') : (syllabus || []);
    (Array.isArray(parsed) ? parsed : []).forEach((m, i) => {
      if (!m || !m.title) return;
      const mid = `cm-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`;
      const objectives = Array.isArray(m.objectives) ? m.objectives : [];
      db.prepare('INSERT INTO course_modules (id, course_slug, title, summary, order_idx, estimated_minutes) VALUES (?, ?, ?, ?, ?, ?)')
        .run(mid, slug, m.title, objectives.join(' · ') || null, i, m.estimated_minutes || 45);
      const body = `# ${m.title}\n\n` + (objectives.length
        ? `## What you'll learn\n\n${objectives.map(o => `- ${o}`).join('\n')}\n\n`
        : '') + `Open a tutor session on this module to go deeper, and use the Research agent to pull in lectures, papers and further reading.`;
      db.prepare('INSERT INTO module_lessons (id, module_id, title, body_md, kind, order_idx) VALUES (?, ?, ?, ?, ?, ?)')
        .run(`ml-${mid}-0`, mid, m.title, body, 'reading', 0);
      modulesCreated++;
    });
  } catch { /* a malformed syllabus must never fail course creation */ }

  // Auto-enroll creator
  db.prepare('INSERT OR IGNORE INTO enrollments (user_id, course_slug, progress, status) VALUES (?, ?, 0, ?)').run(req.userId, slug, 'enrolled');
  logActivity(req.userId, { kind: 'session', text: `Published course: ${title}`, sub: modulesCreated ? `${modulesCreated} modules bundled` : 'Awaiting content', agent: 'CR' });
  res.json({ ok: true, modules: modulesCreated, course: db.prepare('SELECT * FROM courses WHERE slug = ?').get(slug) });
});
// ── Course modules CRUD (§3.2) ───────────────────────────────────────────────

router.get('/:slug/modules', requireAuth, (req, res) => {
  const modules = db.prepare('SELECT * FROM course_modules WHERE course_slug = ? ORDER BY order_idx').all(req.params.slug);
  for (const m of modules) {
    m.lessons = db.prepare('SELECT * FROM module_lessons WHERE module_id = ? ORDER BY order_idx').all(m.id);
  }
  res.json(modules);
});

router.post('/:slug/modules', requireAuth, (req, res) => {
  const c = getCourse(req.params.slug);
  if (!c) return res.status(404).json({ error: true, message: 'Course not found' });
  // Single-user self-hosted instance: the local user owns their library, so
  // there is no meaningful author/admin distinction to enforce here. The old
  // check compared `c.author` (a display name) against req.userId ('user-1')
  // and could never pass, making all module/lesson editing a permanent 403.
  const { title, summary, order_idx, estimated_minutes } = req.body;
  if (!title) return res.status(400).json({ error: true, message: 'title required' });
  const id = `cm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.prepare('INSERT INTO course_modules (id, course_slug, title, summary, order_idx, estimated_minutes) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.params.slug, title, summary || null, order_idx || 0, estimated_minutes || 45);
  res.json({ ok: true, module: db.prepare('SELECT * FROM course_modules WHERE id = ?').get(id) });
});

router.patch('/:slug/modules/:mid', requireAuth, (req, res) => {
  const c = getCourse(req.params.slug);
  if (!c) return res.status(404).json({ error: true, message: 'Course not found' });
  // Single-user self-hosted instance: the local user owns their library, so
  // there is no meaningful author/admin distinction to enforce here. The old
  // check compared `c.author` (a display name) against req.userId ('user-1')
  // and could never pass, making all module/lesson editing a permanent 403.
  const { title, summary, order_idx, estimated_minutes } = req.body;
  const fields = []; const vals = [];
  if (title !== undefined)          { fields.push('title = ?');          vals.push(title); }
  if (summary !== undefined)        { fields.push('summary = ?');        vals.push(summary); }
  if (order_idx !== undefined)      { fields.push('order_idx = ?');      vals.push(order_idx); }
  if (estimated_minutes !== undefined) { fields.push('estimated_minutes = ?'); vals.push(estimated_minutes); }
  if (fields.length === 0) return res.status(400).json({ error: true, message: 'No fields to update' });
  vals.push(req.params.mid);
  db.prepare(`UPDATE course_modules SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true, module: db.prepare('SELECT * FROM course_modules WHERE id = ?').get(req.params.mid) });
});

router.delete('/:slug/modules/:mid', requireAuth, (req, res) => {
  const c = getCourse(req.params.slug);
  if (!c) return res.status(404).json({ error: true, message: 'Course not found' });
  // Single-user self-hosted instance: the local user owns their library, so
  // there is no meaningful author/admin distinction to enforce here. The old
  // check compared `c.author` (a display name) against req.userId ('user-1')
  // and could never pass, making all module/lesson editing a permanent 403.
  db.prepare('DELETE FROM course_modules WHERE id = ?').run(req.params.mid);
  res.json({ ok: true });
});

// ── Module lessons CRUD (§3.2) ───────────────────────────────────────────────

router.post('/:slug/modules/:mid/lessons', requireAuth, (req, res) => {
  const c = getCourse(req.params.slug);
  if (!c) return res.status(404).json({ error: true, message: 'Course not found' });
  // Single-user self-hosted instance: the local user owns their library, so
  // there is no meaningful author/admin distinction to enforce here. The old
  // check compared `c.author` (a display name) against req.userId ('user-1')
  // and could never pass, making all module/lesson editing a permanent 403.
  const { title, body_md, kind, order_idx } = req.body;
  if (!title) return res.status(400).json({ error: true, message: 'title required' });
  const id = `ml-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.prepare('INSERT INTO module_lessons (id, module_id, title, body_md, kind, order_idx) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.params.mid, title, body_md || '', kind || 'reading', order_idx || 0);
  res.json({ ok: true, lesson: db.prepare('SELECT * FROM module_lessons WHERE id = ?').get(id) });
});

router.patch('/:slug/modules/:mid/lessons/:lid', requireAuth, (req, res) => {
  const c = getCourse(req.params.slug);
  if (!c) return res.status(404).json({ error: true, message: 'Course not found' });
  // Single-user self-hosted instance: the local user owns their library, so
  // there is no meaningful author/admin distinction to enforce here. The old
  // check compared `c.author` (a display name) against req.userId ('user-1')
  // and could never pass, making all module/lesson editing a permanent 403.
  const { title, body_md, kind, order_idx } = req.body;
  const fields = []; const vals = [];
  if (title !== undefined)     { fields.push('title = ?');     vals.push(title); }
  if (body_md !== undefined)   { fields.push('body_md = ?');   vals.push(body_md); }
  if (kind !== undefined)      { fields.push('kind = ?');      vals.push(kind); }
  if (order_idx !== undefined) { fields.push('order_idx = ?'); vals.push(order_idx); }
  if (fields.length === 0) return res.status(400).json({ error: true, message: 'No fields to update' });
  fields.push("updated_at = datetime('now')");
  vals.push(req.params.lid);
  db.prepare(`UPDATE module_lessons SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true, lesson: db.prepare('SELECT * FROM module_lessons WHERE id = ?').get(req.params.lid) });
});

router.delete('/:slug/modules/:mid/lessons/:lid', requireAuth, (req, res) => {
  const c = getCourse(req.params.slug);
  if (!c) return res.status(404).json({ error: true, message: 'Course not found' });
  // Single-user self-hosted instance: the local user owns their library, so
  // there is no meaningful author/admin distinction to enforce here. The old
  // check compared `c.author` (a display name) against req.userId ('user-1')
  // and could never pass, making all module/lesson editing a permanent 403.
  db.prepare('DELETE FROM module_lessons WHERE id = ?').run(req.params.lid);
  res.json({ ok: true });
});

// ── Enrollment progress (§3.2/3.4) ───────────────────────────────────────────

router.post('/:slug/progress/:lessonId', requireAuth, (req, res) => {
  const c = getCourse(req.params.slug);
  if (!c) return res.status(404).json({ error: true, message: 'Course not found' });
  db.prepare('INSERT OR IGNORE INTO enrollment_progress (user_id, course_slug, lesson_id) VALUES (?, ?, ?)')
    .run(req.userId, req.params.slug, req.params.lessonId);
  // Recalculate progress
  const totalLessons = db.prepare('SELECT COUNT(*) as c FROM module_lessons ml JOIN course_modules cm ON ml.module_id = cm.id WHERE cm.course_slug = ?').get(req.params.slug).c;
  const completedLessons = db.prepare('SELECT COUNT(*) as c FROM enrollment_progress WHERE user_id = ? AND course_slug = ?').get(req.userId, req.params.slug).c;
  const progress = totalLessons > 0 ? completedLessons / totalLessons : 0;
  db.prepare('UPDATE enrollments SET progress = ? WHERE user_id = ? AND course_slug = ?').run(progress, req.userId, req.params.slug);
  logActivity(req.userId, { kind: 'session', text: `Completed lesson in ${c.title}`, sub: `${completedLessons}/${totalLessons} lessons`, xp: 10 });
  awardXP(req.userId, 10, { silent: true });
  res.json({ ok: true, progress });
});

router.get('/:slug/progress', requireAuth, (req, res) => {
  const totalLessons = db.prepare('SELECT COUNT(*) as c FROM module_lessons ml JOIN course_modules cm ON ml.module_id = cm.id WHERE cm.course_slug = ?').get(req.params.slug).c;
  const completedLessons = db.prepare('SELECT COUNT(*) as c FROM enrollment_progress WHERE user_id = ? AND course_slug = ?').get(req.userId, req.params.slug).c;
  const completedIds = db.prepare('SELECT lesson_id FROM enrollment_progress WHERE user_id = ? AND course_slug = ?').all(req.userId, req.params.slug).map(r => r.lesson_id);
  res.json({ total: totalLessons, completed: completedLessons, completedIds, progress: totalLessons > 0 ? completedLessons / totalLessons : 0 });
});

// ── Course verification (§3.9) ───────────────────────────────────────────────

router.post('/:slug/verify', requireAuth, (req, res) => {
  // Self-hosted single-user instance — you curate your own catalog.
  const c = getCourse(req.params.slug);
  if (!c) return res.status(404).json({ error: true, message: 'Course not found' });
  db.prepare("UPDATE courses SET verified = 1, verified_by = ?, verified_at = datetime('now') WHERE slug = ?").run(req.userId, req.params.slug);
  logActivity(req.userId, { kind: 'session', text: `Verified course: ${c.title}`, sub: 'Admin action', agent: 'CE' });
  res.json({ ok: true });
});

router.post('/:slug/unverify', requireAuth, (req, res) => {
  // Self-hosted single-user instance — you curate your own catalog.
  const c = getCourse(req.params.slug);
  if (!c) return res.status(404).json({ error: true, message: 'Course not found' });
  db.prepare("UPDATE courses SET verified = 0, verified_by = NULL, verified_at = NULL WHERE slug = ?").run(req.params.slug);
  logActivity(req.userId, { kind: 'session', text: `Unverified course: ${c.title}`, sub: 'Admin action', agent: 'CE' });
  res.json({ ok: true });
});

export default router;
