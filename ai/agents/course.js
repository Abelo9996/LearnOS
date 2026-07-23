/**
 * Course generator — the "AI university" centerpiece. Given a topic, the
 * Curriculum agent designs a rigorous, multi-module course comparable to a top
 * Coursera specialization: substantial readings, a diverse mix of real
 * external resources (lecture videos, papers, books, blogs, docs), a hands-on
 * assignment per module, and a capstone project.
 *
 * Every external URL is reachability-checked before it becomes a lesson, so a
 * generated course never ships dead links.
 */
import db, { logActivity } from '../../db/database.js';
import { complete } from '../llm.js';
import { checkUrlReachable } from './research.js';

const LEVELS = ['beginner', 'intermediate', 'advanced'];

const courseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    blurb: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    hours: { type: 'integer' },
    modules: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          objectives: { type: 'array', items: { type: 'string' } },
          reading_md: { type: 'string' },
          resources: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                url: { type: 'string' },
                kind: { type: 'string', enum: ['video', 'paper', 'book', 'blog', 'article', 'website', 'docs', 'repo'] },
                source: { type: 'string' },
                summary: { type: 'string' },
              },
              required: ['title', 'url', 'kind', 'source', 'summary'],
            },
          },
          assignment: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              kind: { type: 'string', enum: ['coding', 'project', 'homework', 'quiz', 'analysis'] },
              description: { type: 'string' },
              tasks: { type: 'array', items: { type: 'string' } },
            },
            required: ['title', 'kind', 'description', 'tasks'],
          },
        },
        required: ['title', 'summary', 'objectives', 'reading_md', 'resources', 'assignment'],
      },
    },
    capstone: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        tasks: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'description', 'tasks'],
    },
  },
  required: ['title', 'blurb', 'tags', 'hours', 'modules', 'capstone'],
};

const SYSTEM = `You are the Curriculum agent for LearnOS. Design a rigorous, university-grade course on the requested topic — comparable in depth and structure to a top Coursera specialization, but better because it weaves in the best of the open web.

Produce 5-6 modules in a sensible learning order. For EACH module:
- "reading_md": a substantial original lesson in Markdown (250-450 words) that actually teaches the concept — headings, worked intuition, and why it matters. This is the core reading, not a summary.
- "objectives": 2-4 concrete learning objectives.
- "resources": 3-5 REAL, canonical external resources that genuinely exist at long-stable URLs. Diversify "kind" across lecture videos (prefer YouTube: MIT OCW, Stanford, 3Blue1Brown, conference talks), scientific papers (arXiv, ACL, NeurIPS), canonical books, high-signal blogs (e.g. distill.pub), reputable articles/docs, and key repos. NEVER invent URLs — omit anything you are not confident exists; a verifier drops dead links.
- "assignment": one hands-on assignment (coding/project/homework/analysis) with a concrete 4-7 step task checklist that applies the module's objectives.

Then a "capstone": a substantial final project that synthesizes the whole course into something the learner builds and can show off.

Calibrate depth to the requested level. "hours" is a realistic total. Return only the structured object.`;

export async function generateCourse({ userId, topic, level }) {
  const lvl = LEVELS.includes(level) ? level : 'intermediate';
  const out = await complete({
    userId, agentCode: 'CR',
    schema: courseSchema,
    maxTokens: 8000,
    system: SYSTEM,
    messages: `Topic: ${topic}\nTarget level: ${lvl}\nDesign the full course.`,
  });
  const c = out.json;
  if (!c || !c.title || !Array.isArray(c.modules) || c.modules.length === 0) {
    throw new Error('Curriculum agent returned an invalid course');
  }
  return persistCourse(userId, c, lvl);
}

// Persist a generated course object into the real course/module/lesson tables +
// real user-scoped assignments, verifying every external URL first.
export async function persistCourse(userId, c, level = 'intermediate') {
  const slug = (String(c.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'course')
    + '-' + Date.now().toString(36);

  // Verify all external URLs across the whole course in parallel, once.
  const allResources = [];
  for (const m of c.modules) for (const r of (m.resources || [])) if (r && r.url) allResources.push(r);
  const reachable = new Set();
  await Promise.all(allResources.map(async (r) => {
    try { if (await checkUrlReachable(r.url, r.kind)) reachable.add(r.url); } catch { /* drop */ }
  }));

  const tags = Array.isArray(c.tags) ? c.tags : [];
  const hours = Number.isFinite(c.hours) ? c.hours : Math.max(4, c.modules.length * 3);
  db.prepare('INSERT OR REPLACE INTO courses (slug, title, blurb, author, verified, rating, stars, forks, hours, version, tags, thumbnail_url) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)')
    .run(slug, c.title, c.blurb || '', 'You', 0, 0, 0, hours, 'v1.0', JSON.stringify(tags), null);

  let moduleCount = 0, lessonCount = 0, resourceCount = 0, assignmentCount = 0;
  const dueBase = Date.now();

  c.modules.forEach((m, i) => {
    if (!m || !m.title) return;
    const mid = `cm-${slug}-${i}`;
    const objectives = Array.isArray(m.objectives) ? m.objectives : [];
    db.prepare('INSERT INTO course_modules (id, course_slug, title, summary, order_idx, estimated_minutes) VALUES (?, ?, ?, ?, ?, ?)')
      .run(mid, slug, m.title, m.summary || objectives.join(' · ') || null, i, 45 + (m.resources?.length || 0) * 10);
    moduleCount++;
    let li = 0;

    // 1. Core reading
    const reading = m.reading_md && m.reading_md.length > 40
      ? m.reading_md
      : `# ${m.title}\n\n${m.summary || ''}\n\n${objectives.length ? '## Objectives\n\n' + objectives.map(o => `- ${o}`).join('\n') : ''}`;
    db.prepare('INSERT INTO module_lessons (id, module_id, title, body_md, kind, order_idx) VALUES (?, ?, ?, ?, ?, ?)')
      .run(`ml-${mid}-${li}`, mid, m.title, reading, 'reading', li); li++; lessonCount++;

    // 2. Verified external resources → one lesson each (video/blog/paper/…).
    // The URL is stored on the lesson so the viewer can embed it (videos play
    // inline; others render as rich resource cards).
    for (const r of (m.resources || [])) {
      if (!r || !r.url || !reachable.has(r.url)) continue;
      const body = `${r.summary || ''}\n\n_Source: ${r.source || new URL(r.url).hostname}_`;
      db.prepare('INSERT INTO module_lessons (id, module_id, title, body_md, kind, order_idx, url) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(`ml-${mid}-${li}`, mid, r.title, body, r.kind || 'article', li, r.url); li++; lessonCount++; resourceCount++;
    }

    // 3. Assignment → a lesson AND a real user-scoped assignment row
    const a = m.assignment;
    if (a && a.title && Array.isArray(a.tasks) && a.tasks.length) {
      const abody = `# ${a.title}\n\n${a.description || ''}\n\n## Your tasks\n\n${a.tasks.map((t, k) => `${k + 1}. ${t}`).join('\n')}`;
      db.prepare('INSERT INTO module_lessons (id, module_id, title, body_md, kind, order_idx) VALUES (?, ?, ?, ?, ?, ?)')
        .run(`ml-${mid}-${li}`, mid, a.title, abody, 'exercise', li); li++; lessonCount++;
      db.prepare(`INSERT INTO assignments (id, user_id, title, course, status, progress, priority, estimated_minutes, kind, description, tasks, due_date)
                  VALUES (?, ?, ?, ?, 'todo', 0, 'med', ?, ?, ?, ?, ?)`)
        .run(`as-${mid}`, userId, a.title, c.title, a.kind === 'quiz' ? 30 : a.kind === 'project' ? 240 : 90,
          a.kind || 'homework', a.description || '', JSON.stringify(a.tasks), new Date(dueBase + 86400000 * (7 + i * 3)).toISOString().split('T')[0]);
      assignmentCount++;
    }
  });

  // Capstone project → its own module + a real project assignment
  const cap = c.capstone;
  if (cap && cap.title && Array.isArray(cap.tasks) && cap.tasks.length) {
    const mid = `cm-${slug}-capstone`;
    db.prepare('INSERT INTO course_modules (id, course_slug, title, summary, order_idx, estimated_minutes) VALUES (?, ?, ?, ?, ?, ?)')
      .run(mid, slug, `Capstone · ${cap.title}`, cap.description?.slice(0, 140) || 'Synthesize the whole course into a project', c.modules.length, 300);
    moduleCount++;
    const cbody = `# ${cap.title}\n\n${cap.description || ''}\n\n## Deliverables\n\n${cap.tasks.map((t, k) => `${k + 1}. ${t}`).join('\n')}`;
    db.prepare('INSERT INTO module_lessons (id, module_id, title, body_md, kind, order_idx) VALUES (?, ?, ?, ?, ?, ?)')
      .run(`ml-${mid}-0`, mid, cap.title, cbody, 'project', 0); lessonCount++;
    db.prepare(`INSERT INTO assignments (id, user_id, title, course, status, progress, priority, estimated_minutes, kind, description, tasks, due_date)
                VALUES (?, ?, ?, ?, 'todo', 0, 'high', 300, 'project', ?, ?, ?)`)
      .run(`as-${mid}`, userId, cap.title, c.title, cap.description || '', JSON.stringify(cap.tasks),
        new Date(dueBase + 86400000 * (7 + c.modules.length * 3 + 7)).toISOString().split('T')[0]);
    assignmentCount++;
  }

  db.prepare('INSERT OR IGNORE INTO enrollments (user_id, course_slug, progress, status) VALUES (?, ?, 0, ?)').run(userId, slug, 'enrolled');
  try { logActivity(userId, { kind: 'session', text: `AI-generated course: ${c.title}`, sub: `${moduleCount} modules · ${resourceCount} resources · ${assignmentCount} assignments`, agent: 'CR' }); } catch {}

  return { slug, title: c.title, modules: moduleCount, lessons: lessonCount, resources: resourceCount, assignments: assignmentCount };
}
