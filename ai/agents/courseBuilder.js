/**
 * Staged course builder — M2 of docs/MASTERY_SPEC_V2.md.
 *
 * The old generator asked one 8000-token call to produce an entire course. That
 * made shallowness *structural*: our courses averaged 370 characters of body per
 * lesson while the reference Coursera course ships 42 videos, 9 quizzes, 2 graded
 * programming assignments and 18 labs across 3 modules.
 *
 * This pipeline spends calls where depth is created:
 *
 *   Stage 1  blueprint      1 call   outcomes, prerequisites, skills, module plan
 *   Stage 2  module content N calls  per module: full readings, 10 quiz items,
 *                                    a hands-on lab, a graded assessment, resources
 *   Stage 3  verify         —        every external URL reachability-checked
 *   Stage 4  assemble       —        persist, compute honest hours, validate floors
 *
 * Each module therefore yields ~8-10 real lessons instead of ~2, and the result
 * is validated against ai/quality/depthFloors.js before it is called done.
 */
import db, { logActivity } from '../../db/database.js';
import { complete } from '../llm.js';
import { checkUrlReachable } from './research.js';
import { validateCourseDepth, FLOORS } from '../quality/depthFloors.js';
import { registerJobHandler, setJobProgress } from '../jobs.js';

const LEVELS = ['beginner', 'intermediate', 'advanced'];

// ── Stage 1: blueprint ───────────────────────────────────────────────────────
const blueprintSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    blurb: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    outcomes: { type: 'array', items: { type: 'string' } },
    prerequisites: { type: 'array', items: { type: 'string' } },
    skills: { type: 'array', items: { type: 'string' } },
    modules: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          objectives: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'summary', 'objectives'],
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
  required: ['title', 'blurb', 'tags', 'outcomes', 'prerequisites', 'skills', 'modules', 'capstone'],
};

const BLUEPRINT_SYSTEM = `You are the Curriculum agent for LearnOS, designing a course that must stand next to a top Coursera specialization and win.

Design the BLUEPRINT only — no lesson bodies yet.

Requirements:
- ${FLOORS.modulesPerCourse}-9 modules in a genuine learning order, where each module depends on the one before it. Cover the topic from its foundations through to advanced, applied practice. Do not stop at an introductory survey.
- "outcomes": 4-6 things the learner can DO afterwards (capabilities, not topics). Start each with a verb.
- "prerequisites": what they genuinely need first (empty array if none).
- "skills": 5-10 named skills this course builds, each trackable to mastery.
- Each module: a clear title, a 1-2 sentence summary, and 3-5 measurable objectives.
- "capstone": a substantial final project synthesizing the whole course into something the learner builds and can show off.

Calibrate scope and rigor to the requested level. Return only the structured object.`;

// ── Stage 2: per-module content ──────────────────────────────────────────────
// Split into TWO calls per module. A single combined call let the readings eat
// the whole token budget: a real 9-module build produced 39 readings but 0 labs,
// 0 graded assessments and 0 resources. Prose and assessment now get their own
// budgets so neither can starve the other.
const readingsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    readings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          body_md: { type: 'string' },
          minutes: { type: 'integer' },
        },
        required: ['title', 'body_md', 'minutes'],
      },
    },
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
          minutes: { type: 'integer' },
        },
        required: ['title', 'url', 'kind', 'source', 'summary', 'minutes'],
      },
    },
  },
  required: ['readings', 'resources'],
};

const assessmentSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    quiz_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          question: { type: 'string' },
          choices: { type: 'array', items: { type: 'string' } },
          answer_idx: { type: 'integer' },
          explanation: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          skill: { type: 'string' },
        },
        required: ['question', 'choices', 'answer_idx', 'explanation', 'difficulty', 'skill'],
      },
    },
    lab: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        steps: { type: 'array', items: { type: 'string' } },
        minutes: { type: 'integer' },
      },
      required: ['title', 'description', 'steps', 'minutes'],
    },
    graded: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        kind: { type: 'string', enum: ['coding', 'project', 'homework', 'analysis'] },
        description: { type: 'string' },
        tasks: { type: 'array', items: { type: 'string' } },
        minutes: { type: 'integer' },
        rubric: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              criterion: { type: 'string' },
              weight: { type: 'number' },
              excellent: { type: 'string' },
              adequate: { type: 'string' },
              poor: { type: 'string' },
            },
            required: ['criterion', 'weight', 'excellent', 'adequate', 'poor'],
          },
        },
      },
      required: ['title', 'kind', 'description', 'tasks', 'minutes', 'rubric'],
    },
  },
  required: ['quiz_items', 'lab', 'graded'],
};

const READINGS_SYSTEM = `You are the Curriculum agent for LearnOS writing the TEACHING CONTENT of one module. This module must be as substantial as a week of a top university course. Thin output is a failure.

Produce:
- "readings": 3-4 original lessons that actually TEACH. Each body_md must be at least 450 words (${FLOORS.readingChars}+ characters) of real instruction in Markdown: headings, worked intuition, a concrete example or derivation, common pitfalls, and why it matters. Do not summarize — teach. Never use placeholder text.
- "resources": 4-6 REAL, canonical external resources at long-stable URLs. Diversify "kind" across lecture videos (prefer YouTube: MIT OCW, Stanford, 3Blue1Brown, conference talks), papers (arXiv), canonical books, high-signal blogs, docs and key repos. NEVER invent a URL — omit anything you are not confident exists; a verifier drops dead links, and a module with no surviving resources is a failure.

"minutes" fields are honest time estimates for a learner at the stated level.`;

const ASSESSMENT_SYSTEM = `You are the Assessment agent for LearnOS writing the ASSESSMENT for one module of a course. The teaching content already exists; you are writing what proves the learner absorbed it.

Produce ALL THREE:
- "quiz_items": exactly 10 practice questions with 4 choices each, the correct "answer_idx" (0-based), and an "explanation" that teaches why the answer is right and why the tempting distractor is wrong. Vary difficulty across easy/medium/hard. Tag each with the "skill" it tests.
- "lab": a hands-on exercise the learner actually performs, with 4-8 concrete steps. This is the "doing" half of the module.
- "graded": the assessment that counts, with a 4-7 step task list and a 3-5 criterion rubric whose weights sum to 1.

"minutes" fields are honest time estimates. Returning fewer than 10 quiz items, or omitting the lab or the graded assessment, is a failure.`;

// ── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Build a full course through the staged pipeline.
 * @param {function(number,string)} onProgress called with (0..1, message)
 */
export async function buildCourse({ userId, topic, level, onProgress = () => {} }) {
  const lvl = LEVELS.includes(level) ? level : 'intermediate';

  onProgress(0.02, 'Designing the course blueprint…');
  const bp = (await complete({
    userId, agentCode: 'CR',
    schema: blueprintSchema,
    maxTokens: 4000,
    system: BLUEPRINT_SYSTEM,
    messages: `Topic: ${topic}\nTarget level: ${lvl}\nDesign the blueprint.`,
  })).json;

  if (!bp || !bp.title || !Array.isArray(bp.modules) || !bp.modules.length) {
    throw new Error('Curriculum agent returned an invalid blueprint');
  }

  // Stage 2 — one call per module. This is where the depth actually comes from.
  const modules = [];
  const failures = [];
  const N = bp.modules.length;
  for (let i = 0; i < N; i++) {
    const m = bp.modules[i];
    const context = [
      `Course: ${bp.title} (${lvl})`,
      `Course outcomes: ${(bp.outcomes || []).join('; ')}`,
      `This module (${i + 1} of ${N}): ${m.title}`,
      `Module summary: ${m.summary}`,
      `Module objectives: ${(m.objectives || []).join('; ')}`,
      i > 0 ? `Already covered: ${bp.modules.slice(0, i).map(x => x.title).join('; ')}` : 'This is the first module.',
    ].join('\n');

    try {
      onProgress(0.05 + 0.85 * (i / N), `Writing module ${i + 1}/${N}: ${m.title}`);
      const teaching = (await complete({
        userId, agentCode: 'CR',
        schema: readingsSchema,
        maxTokens: 8000,
        system: READINGS_SYSTEM,
        messages: `${context}\n\nWrite the readings and resources for this module.`,
      })).json;

      if (!teaching || !Array.isArray(teaching.readings) || !teaching.readings.length) {
        throw new Error('module readings came back empty');
      }

      // Second call: assessment gets its own budget, so readings can't starve it.
      onProgress(0.05 + 0.85 * ((i + 0.5) / N), `Assessing module ${i + 1}/${N}: ${m.title}`);
      let assessment = {};
      try {
        assessment = (await complete({
          userId, agentCode: 'AS',
          schema: assessmentSchema,
          maxTokens: 6000,
          system: ASSESSMENT_SYSTEM,
          messages: `${context}\n\nWrite the quiz items, lab and graded assessment for this module.`,
        })).json || {};
      } catch (e) {
        console.warn(`[courseBuilder] assessment for module ${i + 1} failed: ${e?.message || e}`);
        failures.push({ module: m.title, stage: 'assessment', error: e?.message || String(e) });
      }

      modules.push({ ...m, ...teaching, ...assessment });
    } catch (e) {
      // One weak module must not sink the course, but the failure must be
      // visible — silently pushing an empty module is how a "successful" build
      // shipped 1 lesson across 8 modules.
      console.warn(`[courseBuilder] module ${i + 1} (${m.title}) failed: ${e?.message || e}`);
      failures.push({ module: m.title, stage: 'teaching', error: e?.message || String(e) });
      modules.push({ ...m, readings: [], quiz_items: [], lab: null, graded: null, resources: [] });
    }
  }

  onProgress(0.92, 'Verifying external resources…');
  await topUpResources({ userId, bp, modules, level: lvl, onProgress });

  const persisted = await persistRichCourse(userId, { ...bp, modules }, lvl);

  onProgress(0.99, 'Checking depth floors…');
  const depth = validateCourseDepth(persisted.slug);
  onProgress(1, depth.ok ? 'Course ready' : `Course ready (${depth.violations.length} depth warnings)`);

  return { ...persisted, failures, depth: { ok: depth.ok, violations: depth.violations.length, stats: depth.stats } };
}

// ── Resource top-up ──────────────────────────────────────────────────────────
// Models confidently cite URLs that don't exist. We never ship a dead link, so
// those get dropped — which left real builds with modules holding 0 verified
// resources. This pass re-asks for *canonical* sources (the kind that genuinely
// have stable URLs) for any module still under the floor.

const topUpSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
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
          minutes: { type: 'integer' },
        },
        required: ['title', 'url', 'kind', 'source', 'summary', 'minutes'],
      },
    },
  },
  required: ['resources'],
};

const TOPUP_SYSTEM = `You are the Research agent for LearnOS. A module currently has too few WORKING external resources, because previously suggested URLs failed a reachability check.

Suggest 8 resources whose URLs you are certain exist and are stable. Strongly prefer:
- Wikipedia articles (https://en.wikipedia.org/wiki/<Exact_Article_Title>)
- arXiv papers you know the real ID of (https://arxiv.org/abs/XXXX.XXXXX)
- Official documentation root pages of well-known projects
- Long-established YouTube channels' well-known videos (3Blue1Brown, MIT OpenCourseWare)
- Canonical textbook or course homepages at university domains

Accuracy of the URL matters more than novelty. Do not invent article titles, paper IDs or video IDs. If unsure of an exact URL, prefer a well-known Wikipedia article on the concept.`;

async function verifyReachable(resources) {
  const ok = new Set();
  await Promise.all((resources || []).map(async (r) => {
    if (!r || !r.url) return;
    try { if (await checkUrlReachable(r.url, r.kind)) ok.add(r.url); } catch { /* drop */ }
  }));
  return ok;
}

async function topUpResources({ userId, bp, modules, level, onProgress }) {
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    const have = await verifyReachable(m.resources);
    m.resources = (m.resources || []).filter(r => have.has(r.url));
    if (m.resources.length >= FLOORS.resourcesPerModule) continue;

    onProgress(0.92, `Finding working resources for “${m.title}”…`);
    try {
      const extra = (await complete({
        userId, agentCode: 'RE',
        schema: topUpSchema,
        maxTokens: 2000,
        system: TOPUP_SYSTEM,
        messages: `Course: ${bp.title} (${level})\nModule: ${m.title}\nSummary: ${m.summary || ''}\nObjectives: ${(m.objectives || []).join('; ')}\n\nSuggest resources with URLs you are confident exist.`,
      })).json;
      const okExtra = await verifyReachable(extra?.resources);
      const seen = new Set(m.resources.map(r => r.url));
      for (const r of (extra?.resources || [])) {
        if (okExtra.has(r.url) && !seen.has(r.url)) { m.resources.push(r); seen.add(r.url); }
      }
    } catch (e) {
      console.warn(`[courseBuilder] resource top-up failed for ${m.title}: ${e?.message || e}`);
    }
  }
}

// ── Persistence ──────────────────────────────────────────────────────────────

export async function persistRichCourse(userId, c, level = 'intermediate') {
  const slug = (String(c.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'course')
    + '-' + Date.now().toString(36);

  // Verify every external URL once, in parallel. A generated course never ships
  // a dead link.
  const all = [];
  for (const m of c.modules) for (const r of (m.resources || [])) if (r && r.url) all.push(r);
  const reachable = new Set();
  await Promise.all(all.map(async (r) => {
    try { if (await checkUrlReachable(r.url, r.kind)) reachable.add(r.url); } catch { /* drop */ }
  }));

  const J = (v) => JSON.stringify(Array.isArray(v) ? v : []);
  db.prepare(`INSERT OR REPLACE INTO courses (slug, title, blurb, author, verified, rating, stars, forks, hours, version, tags, thumbnail_url, outcomes, prerequisites, skills, level)
              VALUES (?, ?, ?, 'You', 0, 0, 0, 0, ?, 'v1.0', ?, NULL, ?, ?, ?, ?)`)
    .run(slug, c.title, c.blurb || '', 0, J(c.tags), J(c.outcomes), J(c.prerequisites), J(c.skills), level);

  let lessonCount = 0, itemCount = 0, resourceCount = 0, assignmentCount = 0, totalMinutes = 0;
  const dueBase = Date.now();
  const pathway = [];

  c.modules.forEach((m, i) => {
    if (!m || !m.title) return;
    const mid = `cm-${slug}-${i}`;
    const objectives = Array.isArray(m.objectives) ? m.objectives : [];
    let li = 0, moduleMinutes = 0;

    // The module row must exist before its lessons — module_lessons.module_id is
    // a foreign key. Its estimated_minutes is filled in once the lessons are known.
    db.prepare('INSERT INTO course_modules (id, course_slug, title, summary, order_idx, estimated_minutes, objectives) VALUES (?, ?, ?, ?, ?, 0, ?)')
      .run(mid, slug, m.title, m.summary || objectives.join(' · ') || null, i, J(objectives));

    const addLesson = (title, body, kind, opts = {}) => {
      const mins = Math.max(1, Number(opts.minutes) || 10);
      db.prepare(`INSERT INTO module_lessons (id, module_id, title, body_md, kind, order_idx, url, estimated_minutes, is_graded, is_optional, pass_threshold, max_attempts)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(`ml-${mid}-${li}`, mid, title, body || '', kind, li, opts.url || null, mins,
          opts.graded ? 1 : 0, opts.optional ? 1 : 0, opts.passThreshold ?? null, opts.maxAttempts ?? null);
      const id = `ml-${mid}-${li}`;
      li++; lessonCount++; moduleMinutes += mins;
      return id;
    };

    // 1. Readings — the substance.
    for (const r of (m.readings || [])) {
      if (!r || !r.body_md) continue;
      addLesson(r.title || m.title, r.body_md, 'reading', { minutes: r.minutes || 12 });
    }

    // 2. Verified external resources — embeddable media.
    for (const r of (m.resources || [])) {
      if (!r || !r.url || !reachable.has(r.url)) continue;
      const body = `${r.summary || ''}\n\n_Source: ${r.source || safeHost(r.url)}_`;
      addLesson(r.title, body, r.kind || 'article', { url: r.url, minutes: r.minutes || 15 });
      resourceCount++;
    }

    // 3. Hands-on lab — the "doing" half.
    if (m.lab && m.lab.title) {
      const steps = (m.lab.steps || []).map((s, k) => `${k + 1}. ${s}`).join('\n');
      addLesson(m.lab.title, `# ${m.lab.title}\n\n${m.lab.description || ''}\n\n## Steps\n\n${steps}`, 'lab',
        { minutes: m.lab.minutes || 45 });
    }

    // 4. Practice quiz — ungraded, drawn from the item bank below.
    const items = Array.isArray(m.quiz_items) ? m.quiz_items.filter(q => q && q.question && Array.isArray(q.choices) && q.choices.length >= 2) : [];
    if (items.length) {
      const quizLessonId = addLesson(`Practice quiz · ${m.title}`,
        `Check your understanding of **${m.title}**. This is practice — unlimited attempts, and every answer is explained.`,
        'practice_quiz', { minutes: Math.max(5, Math.round(items.length * 1.5)) });
      items.forEach((q, k) => {
        try {
          db.prepare(`INSERT INTO quiz_items (id, course_slug, module_id, lesson_id, question, choices_json, answer_idx, explanation, difficulty, skill)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(`qi-${mid}-${k}`, slug, mid, quizLessonId, q.question, JSON.stringify(q.choices),
              Math.max(0, Math.min(q.choices.length - 1, Number(q.answer_idx) || 0)),
              q.explanation || null, q.difficulty || 'medium', q.skill || null);
          itemCount++;
        } catch { /* skip a malformed item */ }
      });
    }

    // 5. Graded assessment — the thing that counts, with a real rubric.
    const g = m.graded;
    if (g && g.title && Array.isArray(g.tasks) && g.tasks.length) {
      const body = `# ${g.title}\n\n${g.description || ''}\n\n## Your tasks\n\n${g.tasks.map((t, k) => `${k + 1}. ${t}`).join('\n')}`;
      addLesson(g.title, body, 'graded_quiz', { minutes: g.minutes || 60, graded: true, passThreshold: 0.8, maxAttempts: 3 });
      db.prepare(`INSERT INTO assignments (id, user_id, title, course, status, progress, priority, estimated_minutes, kind, description, tasks, due_date, rubric_json, pass_threshold, max_attempts)
                  VALUES (?, ?, ?, ?, 'todo', 0, 'med', ?, ?, ?, ?, ?, ?, 0.8, 3)`)
        .run(`as-${mid}`, userId, g.title, c.title, g.minutes || 60, g.kind || 'homework',
          g.description || '', JSON.stringify(g.tasks),
          new Date(dueBase + 86400000 * (7 + i * 3)).toISOString().split('T')[0],
          JSON.stringify(g.rubric || []));
      assignmentCount++;
    }

    db.prepare('UPDATE course_modules SET estimated_minutes = ? WHERE id = ?').run(moduleMinutes, mid);

    totalMinutes += moduleMinutes;
    pathway.push({ title: m.title, objectives, resources: (m.resources || []).filter(r => r && r.url && reachable.has(r.url)) });
  });

  // Capstone module.
  const cap = c.capstone;
  if (cap && cap.title && Array.isArray(cap.tasks) && cap.tasks.length) {
    const mid = `cm-${slug}-capstone`;
    const body = `# ${cap.title}\n\n${cap.description || ''}\n\n## Deliverables\n\n${cap.tasks.map((t, k) => `${k + 1}. ${t}`).join('\n')}`;
    db.prepare('INSERT INTO course_modules (id, course_slug, title, summary, order_idx, estimated_minutes, objectives) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(mid, slug, `Capstone · ${cap.title}`, (cap.description || '').slice(0, 140), c.modules.length, 300, J([]));
    db.prepare(`INSERT INTO module_lessons (id, module_id, title, body_md, kind, order_idx, estimated_minutes, is_graded, pass_threshold, max_attempts)
                VALUES (?, ?, ?, ?, 'project', 0, 300, 1, 0.8, 3)`)
      .run(`ml-${mid}-0`, mid, cap.title, body);
    db.prepare(`INSERT INTO assignments (id, user_id, title, course, status, progress, priority, estimated_minutes, kind, description, tasks, due_date, pass_threshold, max_attempts)
                VALUES (?, ?, ?, ?, 'todo', 0, 'high', 300, 'project', ?, ?, ?, 0.8, 3)`)
      .run(`as-${mid}`, userId, cap.title, c.title, cap.description || '', JSON.stringify(cap.tasks),
        new Date(dueBase + 86400000 * (7 + c.modules.length * 3 + 7)).toISOString().split('T')[0]);
    lessonCount++; assignmentCount++; totalMinutes += 300;
    pathway.push({ title: `Capstone · ${cap.title}`, objectives: [], resources: [] });
  }

  // Honest hours: derived from the per-item estimates, never asserted by the LLM.
  db.prepare('UPDATE courses SET hours = ? WHERE slug = ?').run(Math.max(1, Math.round(totalMinutes / 60)), slug);
  db.prepare('INSERT OR IGNORE INTO enrollments (user_id, course_slug, progress, status) VALUES (?, ?, 0, ?)').run(userId, slug, 'enrolled');

  const rmId = createCompanionRoadmap(userId, slug, c.title, level, pathway);

  try {
    logActivity(userId, { kind: 'session', text: `AI-built course: ${c.title}`,
      sub: `${c.modules.length} modules · ${lessonCount} lessons · ${itemCount} quiz items · ${Math.round(totalMinutes / 60)}h`, agent: 'CR' });
  } catch {}

  return { slug, roadmap_id: rmId, title: c.title, modules: c.modules.length, lessons: lessonCount,
    quizItems: itemCount, resources: resourceCount, assignments: assignmentCount, hours: Math.round(totalMinutes / 60) };
}

// Companion roadmap: the course's modules as a mastery-gated pathway.
function createCompanionRoadmap(userId, slug, title, level, pathway) {
  const rmId = `rm-${slug}`;
  try {
    db.prepare(`INSERT INTO roadmaps (id, user_id, title, subtitle, authored_by, mastery, total_modules, completed_modules, status, next_module, modules_left, course_slug)
                VALUES (?, ?, ?, ?, 'Curriculum agent', 0, ?, 0, 'active', ?, ?, ?)`)
      .run(rmId, userId, title, `Guided pathway · ${level}`, pathway.length, pathway[0]?.title || '', pathway.length, slug);
    pathway.forEach((p, i) => {
      const nid = `${rmId}-n${i}`;
      db.prepare('INSERT INTO roadmap_nodes (id, roadmap_id, title, col, row_idx, mastery, status, course_slug) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
        .run(nid, rmId, p.title, i % 6, Math.floor(i / 6), i === 0 ? 'active' : i === 1 ? 'next' : 'locked', slug);
      (p.objectives || []).slice(0, 5).forEach((o, k) => {
        try { db.prepare('INSERT INTO node_objectives (id, node_id, roadmap_id, text, order_idx) VALUES (?, ?, ?, ?, ?)').run(`no-${nid}-${k}`, nid, rmId, o, k); } catch {}
      });
      (p.resources || []).forEach((r, k) => {
        try {
          db.prepare(`INSERT INTO node_resources (id, node_id, roadmap_id, kind, title, url, source, summary, status, verified_at, verified_by)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'verified', datetime('now'), 'Research agent')`)
            .run(`nr-${nid}-${k}`, nid, rmId, r.kind || 'article', r.title || r.url, r.url, r.source || safeHost(r.url), r.summary || null);
        } catch {}
      });
      if (i > 0) db.prepare('INSERT OR IGNORE INTO roadmap_edges (roadmap_id, from_node, to_node) VALUES (?, ?, ?)').run(rmId, `${rmId}-n${i - 1}`, nid);
    });
  } catch { return null; }
  return rmId;
}

function safeHost(url) { try { return new URL(url).hostname; } catch { return null; } }

// A staged build makes one LLM call per module, so it runs as a background job
// with real progress rather than blocking an HTTP request for minutes.
registerJobHandler('build-course', async ({ userId, input, jobId }) =>
  buildCourse({
    userId,
    topic: input?.topic,
    level: input?.level,
    onProgress: (pct, msg) => setJobProgress(jobId, pct, msg),
  }));

export default { buildCourse, persistRichCourse };
