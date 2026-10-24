/**
 * Course builder.
 *
 *   blueprint   1 call    outcomes, prerequisites, the code language, notation,
 *                         a running example, and every module's lessons with the
 *                         concepts each introduces (each concept exactly once)
 *   lessons     per lesson: drafted in order within a module, then reviewed,
 *                         code-run and revised (ai/agents/lessonWriter.js)
 *   assessment  per module: quiz, lab and graded work written from the finished
 *                         lessons and checked mechanically (assessmentWriter.js)
 *   resources   per module: chosen after the lessons, verified to exist and to
 *                         be what they claim; links go on a further-reading page
 *   persist     lessons, optional videos and reading lists, lab, quiz, graded
 *                         work; honest hours; depth floors; a build report
 *
 * Modules are written in parallel (LEARNOS_BUILD_CONCURRENCY, default 6). The
 * same per-module path finishes a course a build left incomplete.
 */
import db, { logActivity, notify } from '../../db/database.js';
import { complete } from '../llm.js';
import { checkUrlReachable, checkUrlMatchesClaim } from './research.js';
import { validateCourseDepth, FLOORS } from '../quality/depthFloors.js';
import { registerJobHandler, setJobProgress } from '../jobs.js';
import { getProfile } from './profiling.js';
import { contentDirective, resourceDirective, videosPerModule } from './learningStyle.js';
import { draftLesson, polishLesson } from './lessonWriter.js';
import { writeAssessment } from './assessmentWriter.js';
import { availablePythonLibraries } from '../assessment/labRunner.js';

const LEVELS = ['beginner', 'intermediate', 'advanced'];

// How many modules are written at once. Modules are independent given the
// blueprint, so this is pure wall-clock win; kept modest to stay well inside
// provider rate limits.
const MODULE_CONCURRENCY = Math.max(1, parseInt(process.env.LEARNOS_BUILD_CONCURRENCY || '', 10) || 6);

/** Bounded-concurrency map that preserves input order in the output. */
async function mapWithConcurrency(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

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
          lessons: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                objectives: { type: 'array', items: { type: 'string' } },
                concepts: { type: 'array', items: { type: 'string' } },
              },
              required: ['title', 'objectives', 'concepts'],
            },
          },
        },
        required: ['title', 'summary', 'objectives', 'lessons'],
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
  required: ['title', 'blurb', 'tags', 'outcomes', 'prerequisites', 'skills', 'audience', 'code_language', 'notation', 'throughline', 'modules', 'capstone'],
};
Object.assign(blueprintSchema.properties, {
  audience: { type: 'string' },
  code_language: { type: 'string', enum: ['python', 'javascript', 'cpp', 'c', 'java', 'go', 'none'] },
  notation: { type: 'string' },
  throughline: { type: 'string' },
});

const BLUEPRINT_SYSTEM = `You are the Curriculum agent for LearnOS, designing a course that must stand next to a top Coursera specialization and win.

Design the BLUEPRINT only, no lesson bodies yet.

Requirements:
- ${FLOORS.modulesPerCourse}-9 modules in a genuine learning order, where each module depends on the one before it. Cover the topic from its foundations through to advanced, applied practice. Do not stop at an introductory survey.
- "outcomes": 4-6 things the learner can DO afterwards (capabilities, not topics). Start each with a verb.
- "prerequisites": what they genuinely need first (empty array if none).
- "skills": 5-10 named skills this course builds, each trackable to mastery.
- Each module: a clear title, a 1-2 sentence summary, 3-5 measurable objectives, and its "lessons": 2-4 lessons in teaching order. Each lesson has a specific title, 2-3 objectives (what the learner can do after it), and "concepts": the new concepts it introduces. Plan the concepts across the WHOLE course so each concept is introduced exactly once, in the lesson where it is first needed, and only after the concepts it depends on. No two lessons may cover the same ground.
- "audience": one sentence on who this is for and what they already know.
- "code_language": the one programming language every code example and lab uses ("python" for most technical topics unless the topic or pathway names another; "none" for subjects with no programming such as history or philosophy).
- "notation": the symbols and naming conventions the whole course will use (e.g. "vectors bold lowercase $\\mathbf{x}$, matrices bold uppercase, joint angles $\\theta_i$, frames {0}..{n}"), or "" if the subject has none.
- "throughline": one concrete running example the course returns to and extends module by module (a specific system, dataset, text, case or project), so lessons connect instead of starting over. If it is a dataset, describe it so a few lines of code can generate a small synthetic version of it (columns, sizes, how values are distributed); there are no data files.
- "capstone": a substantial final project synthesizing the whole course into something the learner builds and can show off.

If a "Pathway context" is provided (the specialization this course belongs to and the learner's end goal), anchor the whole course to it: module topics, examples and terminology must serve that goal. An "OOP" course inside a C++ pathway is a C++ OOP course, never drift to a different language or domain.

Calibrate scope and rigor to the requested level. Return only the structured object.`;

// ── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Write one module: its lessons in order (each told what came before), then
 * review and revision of all of them at once, then the assessment written from
 * the finished lessons, then resources chosen to complement them.
 */
async function writeModuleContent({ userId, ctx, m, i, plan: lessonPlans, taughtBefore, learningStyle = '', failures, quality, tick = () => {}, onLessonDone = () => {} }) {
  const plans = { [i]: lessonPlans };
  try {
    // Lessons inside a module are written in order: each one is handed what
    // the previous one actually taught.
    const drafts = [];
    let prev = null;
    for (const plan of plans[i]) {
      tick(`Module ${i + 1}: drafting "${plan.title}"`);
      try {
        const d = await draftLesson({ userId, ctx: { ...ctx, taughtBefore: taughtBefore(plan.index) }, plan, prev });
        drafts.push({ plan, draft: d });
        prev = { title: plan.title, summary: d.summary };
      } catch (e) {
        failures.push({ module: m.title, lesson: plan.title, stage: 'lesson', error: e?.message || String(e) });
      }
    }
    if (!drafts.length) throw new Error('every lesson in the module failed');
    // Review, code runs and revisions for the module's lessons, all at once.
    tick(`Module ${i + 1}: reviewing ${drafts.length} lessons`);
    const polished = await Promise.all(drafts.map(async ({ plan, draft }) => {
      try {
        const l = await polishLesson({ userId, plan, draft });
        return { ...l, objectives: plan.objectives };
      } catch (e) {
        // A failed review keeps the draft rather than losing the lesson.
        failures.push({ module: m.title, lesson: plan.title, stage: 'review', error: e?.message || String(e) });
        return { title: plan.title, body_md: draft.body, minutes: 15, summary: draft.summary, objectives: plan.objectives, quality: { revisions: 0, reviewIssues: [], codeFailures: [], codeRan: 0, lint: [], reviewError: e?.message } };
      } finally {
        onLessonDone();
      }
    }));
    const lessons = polished;

    tick(`Module ${i + 1}: writing the quiz and lab`);
    let assessment = {};
    try {
      assessment = await writeAssessment({ userId, ctx, lessons });
    } catch (e) {
      console.warn(`[courseBuilder] assessment for module ${i + 1} failed: ${e?.message || e}`);
      failures.push({ module: m.title, stage: 'assessment', error: e?.message || String(e) });
    }

    // Resources come after the lessons, chosen to complement what was written.
    let resources = [];
    try {
      resources = (await complete({
        userId, agentCode: 'RE',
        schema: topUpSchema,
        maxTokens: 2500,
        system: RESOURCE_SYSTEM,
        messages: `Course: ${ctx.courseTitle} (${ctx.level})\nModule: ${m.title}\nLessons: ${lessons.map(l => l.title).join('; ')}\nObjectives: ${(m.objectives || []).join('; ')}\n\n${resourceDirective(learningStyle)}\n\nSuggest the resources.`,
      })).json?.resources || [];
    } catch (e) {
      failures.push({ module: m.title, stage: 'resources', error: e?.message || String(e) });
    }

    tick(`Finished module ${i + 1}`);
    quality.push({
      module: m.title,
      lessons: lessons.map(l => ({ title: l.title, revisions: l.quality.revisions, issues: l.quality.reviewIssues.length, codeRan: l.quality.codeRan, codeFailures: l.quality.codeFailures.length, lint: l.quality.lint })),
      assessment: assessment.report || null,
    });
    return {
      ...m,
      readings: lessons.map(l => ({ title: l.title, body_md: l.body_md, minutes: l.minutes })),
      resources,
      quiz_items: assessment.quiz_items || [],
      lab: assessment.lab || null,
      graded: assessment.graded || null,
    };
  } catch (e) {
    console.warn(`[courseBuilder] module ${i + 1} (${m.title}) failed: ${e?.message || e}`);
    failures.push({ module: m.title, stage: 'teaching', error: e?.message || String(e) });
    return { ...m, readings: [], quiz_items: [], lab: null, graded: null, resources: [] };
  }
}

/**
 * Build a full course through the staged pipeline.
 * @param {function(number,string)} onProgress called with (0..1, message)
 */
export async function buildCourse({ userId, topic, level, pathwayContext, learningStyle = '', onProgress = () => {} }) {
  const lvl = LEVELS.includes(level) ? level : 'intermediate';
  // The learner's stated modality shapes every lesson: a visual learner gets
  // more diagrams and video, a hands-on learner more runnable practice.
  const modalityDirective = contentDirective(learningStyle);

  onProgress(0.02, 'Designing the course blueprint…');
  const ctxLine = pathwayContext ? `\nPathway context: ${pathwayContext}` : '';

  // The blueprint is a single call that gates the ENTIRE build, one malformed
  // or truncated JSON response would otherwise sink the whole course. It failed
  // intermittently because a verbose model can run past the token budget and cut
  // the JSON mid-object (parse → null). Retry a few times, raising the budget so
  // a truncated response has room to complete on the next attempt.
  // A blueprint is usable with modules to write; it is only *good* with enough
  // of them, each with planned lessons. Retry for good, settle for usable.
  const usableBlueprint = (bp) => bp && bp.title && Array.isArray(bp.modules) && bp.modules.length > 0;
  const validBlueprint = (bp) => usableBlueprint(bp) && bp.modules.length >= FLOORS.modulesPerCourse - 1
    && bp.modules.every(m => Array.isArray(m.lessons) && m.lessons.length > 0);
  let best = null;
  let bp = null, lastStop = null;
  for (let attempt = 0; attempt < 3 && !validBlueprint(bp); attempt++) {
    if (attempt > 0) onProgress(0.02, 'Refining the course blueprint…');
    try {
      const res = await complete({
        userId, agentCode: 'CR',
        schema: blueprintSchema,
        maxTokens: 16000 + attempt * 4000, // a planned syllabus is long, and reasoning models think first
        system: BLUEPRINT_SYSTEM,
        messages: `Topic: ${topic}\nTarget level: ${lvl}${ctxLine}\nDesign the blueprint.`,
      });
      bp = res.json;
      lastStop = res.stopReason;
      if (usableBlueprint(bp) && (!best || bp.modules.length > best.modules.length)) best = bp;
    } catch (e) {
      // A hard failure (e.g. no API key) should surface as itself, not as a
      // generic "invalid blueprint".
      if (attempt === 2) throw e;
    }
  }

  if (!validBlueprint(bp) && best) bp = best;
  if (!usableBlueprint(bp)) {
    throw new Error(lastStop === 'length'
      ? 'The course blueprint was too long to finish generating, try a narrower topic.'
      : 'Curriculum agent returned an invalid blueprint');
  }

  // Stage 2, two calls per module. This is where the depth comes from, and it
  // is also the whole cost of a build, so modules are written CONCURRENTLY.
  // Sequentially a 9-module course took ~13 minutes; the modules don't depend on
  // each other's output (only on the blueprint), so a bounded pool cuts that to
  // a few minutes without hammering the provider.
  const failures = [];
  const quality = [];
  const N = bp.modules.length;

  // Lesson plan: every lesson knows which concepts came before it, so lessons
  // build on each other instead of each starting from scratch.
  const plans = bp.modules.map((m) => {
    const lessons = (Array.isArray(m.lessons) && m.lessons.length ? m.lessons : [{ title: m.title, objectives: m.objectives || [], concepts: [] }])
      .filter(l => l && l.title)
      .slice(0, 4);
    return lessons.map((l, k) => ({ ...l, index: k, objectives: Array.isArray(l.objectives) ? l.objectives : [], concepts: Array.isArray(l.concepts) ? l.concepts : [] }));
  });
  const conceptsBefore = (mi, li) => {
    const out = [];
    plans.forEach((ls, i) => ls.forEach((l, k) => { if (i < mi || (i === mi && k < li)) out.push(...l.concepts); }));
    return out.slice(-60);
  };
  const outline = bp.modules.map((m, i) => `${i + 1}. ${m.title}: ${plans[i].map(l => l.title).join(' | ')}`).join('\n');
  const totalLessons = plans.reduce((n, ls) => n + ls.length, 0);
  const pythonLibraries = bp.code_language === 'python' ? await availablePythonLibraries().catch(() => []) : [];
  let lessonsDone = 0;

  const buildModule = (m, i) => writeModuleContent({
    userId, m, i, plan: plans[i], learningStyle, failures, quality,
    ctx: {
      courseTitle: bp.title, level: lvl, pathwayContext, audience: bp.audience,
      codeLanguage: bp.code_language || 'none', notation: bp.notation, throughline: bp.throughline,
      outline, moduleIndex: i, moduleTitle: m.title, moduleObjectives: m.objectives || [],
      lessonsInModule: plans[i].length, styleDirective: modalityDirective, pythonLibraries,
    },
    taughtBefore: (li) => conceptsBefore(i, li),
    tick: (msg) => onProgress(0.05 + 0.85 * (lessonsDone / Math.max(1, totalLessons)), msg.replace(/^Module (\d+)/, `Module $1/${N}`)),
    onLessonDone: () => { lessonsDone++; },
  });

  const modules = await mapWithConcurrency(bp.modules, MODULE_CONCURRENCY, buildModule);

  onProgress(0.92, 'Verifying external resources…');
  await topUpResources({ userId, bp, modules, level: lvl, learningStyle, onProgress });

  const persisted = await persistRichCourse(userId, { ...bp, modules }, lvl);

  onProgress(0.99, 'Checking depth floors…');
  const depth = validateCourseDepth(persisted.slug);
  onProgress(1, depth.ok ? 'Course ready' : `Course ready (${depth.violations.length} depth warnings)`);

  const report = { failures, quality, depth: { ok: depth.ok, violations: depth.violations.length, stats: depth.stats } };
  try { db.prepare('UPDATE courses SET build_report = ? WHERE slug = ?').run(JSON.stringify(report), persisted.slug); } catch { /* older schema */ }
  return { ...persisted, ...report };
}

const finishPlanSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    code_language: { type: 'string', enum: ['python', 'javascript', 'cpp', 'c', 'java', 'go', 'none'] },
    notation: { type: 'string' },
    throughline: { type: 'string' },
    modules: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          index: { type: 'integer' },
          lessons: blueprintSchema.properties.modules.items.properties.lessons,
        },
        required: ['index', 'lessons'],
      },
    },
  },
  required: ['code_language', 'notation', 'throughline', 'modules'],
};

/**
 * Finish a course a build left incomplete, in place: every module with no
 * lessons is planned and written by the same pipeline as a fresh build, and
 * every module that has lessons but no quiz, lab or graded work gets them,
 * written from its existing lessons. Nothing that exists is rewritten.
 */
export async function enrichCourse({ userId, slug, onProgress = () => {} }) {
  const course = db.prepare('SELECT slug, title, blurb, level FROM courses WHERE slug = ?').get(slug);
  if (!course) throw new Error(`Course not found: ${slug}`);
  const lvl = LEVELS.includes(course.level) ? course.level : 'intermediate';
  const parse = (v) => { try { return JSON.parse(v || '[]'); } catch { return []; } };
  const modules = db.prepare('SELECT id, title, summary, objectives, order_idx FROM course_modules WHERE course_slug = ? ORDER BY order_idx').all(slug)
    .map(m => ({ ...m, objectives: parse(m.objectives), lessons: db.prepare('SELECT id, title, kind, body_md, is_graded FROM module_lessons WHERE module_id = ? ORDER BY order_idx').all(m.id) }));
  const isCapstone = (m) => /-capstone$/.test(m.id) || /^capstone\b/i.test(m.title || '');
  const teaching = modules.filter(m => !isCapstone(m));
  const empty = teaching.filter(m => !m.lessons.some(l => l.kind === 'reading'));
  const lacking = teaching.filter(m => !empty.includes(m) && (!m.lessons.some(l => l.kind === 'practice_quiz') || !m.lessons.some(l => l.kind === 'lab') || !m.lessons.some(l => l.is_graded)));
  const failures = [];
  const quality = [];

  const outline = teaching.map((m, i) => `${i + 1}. ${m.title}${m.lessons.length ? `: ${m.lessons.filter(l => l.kind === 'reading').map(l => l.title).join(' | ')}` : ' (not written yet)'}`).join('\n');
  const plan = empty.length ? (await complete({
    userId, agentCode: 'CR', schema: finishPlanSchema, maxTokens: 12000,
    system: `${BLUEPRINT_SYSTEM}\n\nYou are COMPLETING an existing course, not designing a new one. Some modules have no lessons yet. Plan 2-4 lessons for each of those modules only (by its index in the outline), building on what the written modules already teach and never repeating it. Also give the course's code language, notation and running example, consistent with the existing lessons.`,
    messages: `Course: ${course.title} (${lvl})\n${course.blurb || ''}\n\nOutline (index. module: lessons):\n${outline}\n\nModules to plan: ${empty.map(m => teaching.indexOf(m) + 1).join(', ')}`,
  })).json : null;
  if (empty.length && !plan) throw new Error('Could not plan the missing lessons; try again.');
  const pythonLibraries = plan?.code_language === 'python' ? await availablePythonLibraries().catch(() => []) : [];
  const styleDirective = contentDirective((() => { try { return getProfile(userId)?.learning_style || ''; } catch { return ''; } })());

  const work = [...empty.map(m => ({ m, kind: 'full' })), ...lacking.map(m => ({ m, kind: 'assess' }))];
  let done = 0;
  const stamp = Date.now().toString(36);
  await mapWithConcurrency(work, MODULE_CONCURRENCY, async ({ m, kind }) => {
    const i = teaching.indexOf(m);
    const ctx = {
      courseTitle: course.title, level: lvl, codeLanguage: plan?.code_language || 'none', notation: plan?.notation || '', throughline: plan?.throughline || '',
      outline, moduleIndex: i, moduleTitle: m.title, moduleObjectives: m.objectives, styleDirective, pythonLibraries,
    };
    const tick = (msg) => onProgress(0.05 + 0.9 * (done / Math.max(1, work.length)), msg.replace(/^Module (\d+)/, `Module $1/${teaching.length}`));
    try {
      let content;
      if (kind === 'full') {
        const lessonPlans = ((plan.modules || []).find(x => x.index === i + 1)?.lessons || [{ title: m.title, objectives: m.objectives, concepts: [] }])
          .slice(0, 4).map((l, k) => ({ ...l, index: k, objectives: l.objectives || [], concepts: l.concepts || [] }));
        content = await writeModuleContent({
          userId, m, i, plan: lessonPlans, failures, quality, tick,
          ctx: { ...ctx, lessonsInModule: lessonPlans.length },
          taughtBefore: () => teaching.slice(0, i).flatMap(x => x.lessons.filter(l => l.kind === 'reading').map(l => l.title)).slice(-40),
        });
      } else {
        tick(`Module ${i + 1}: writing the missing quiz and lab`);
        const readings = m.lessons.filter(l => l.kind === 'reading').map(l => ({ title: l.title, body_md: l.body_md, objectives: [] }));
        const a = await writeAssessment({ userId, ctx, lessons: readings });
        content = {
          quiz_items: m.lessons.some(l => l.kind === 'practice_quiz') ? [] : a.quiz_items,
          lab: m.lessons.some(l => l.kind === 'lab') ? null : a.lab,
          graded: m.lessons.some(l => l.is_graded) ? null : a.graded,
        };
      }
      const reachable = await verifyReachable(content.resources || [], m.title);
      const saved = persistModuleContent(userId, {
        slug, courseTitle: course.title, mid: m.id, m: { ...m, ...content }, reachable,
        startOrder: m.lessons.length, idPrefix: `ml-${m.id}-f${stamp}-`,
        dueDate: new Date(Date.now() + 86400000 * (7 + i * 3)).toISOString().split('T')[0],
      });
      db.prepare('UPDATE course_modules SET estimated_minutes = estimated_minutes + ? WHERE id = ?').run(saved.minutes, m.id);
    } catch (e) {
      failures.push({ module: m.title, stage: kind, error: e?.message || String(e) });
    }
    done++;
  });

  const minutes = db.prepare('SELECT COALESCE(SUM(ml.estimated_minutes), 0) m FROM module_lessons ml JOIN course_modules cm ON cm.id = ml.module_id WHERE cm.course_slug = ? AND COALESCE(ml.is_optional, 0) = 0').get(slug).m;
  db.prepare('UPDATE courses SET hours = ? WHERE slug = ?').run(Math.max(1, Math.round(minutes / 60)), slug);
  const depth = validateCourseDepth(slug);
  try {
    notify(userId, { kind: 'job', priority: 'normal', title: `Course finished, ${course.title}`,
      body: `${empty.length} module${empty.length === 1 ? '' : 's'} written${lacking.length ? `, ${lacking.length} given their missing practice` : ''}${failures.length ? `; ${failures.length} step(s) failed` : ''}.`,
      actionScreen: 'courses', actionId: slug });
  } catch {}
  onProgress(1, failures.length ? `Finished with ${failures.length} problem(s)` : 'Course finished');
  return { slug, filled: empty.length, completed: lacking.length, failures, quality, depth: { ok: depth.ok, violations: depth.violations.length } };
}

registerJobHandler('enrich-course', async ({ userId, input, jobId }) =>
  enrichCourse({ userId, slug: input?.slug, onProgress: (p, m) => setJobProgress(jobId, p, m) }));

// ── Resource top-up ──────────────────────────────────────────────────────────
// Models confidently cite URLs that don't exist. We never ship a dead link, so
// those get dropped, which left real builds with modules holding 0 verified
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

const RESOURCE_SYSTEM = `You are the Research agent for LearnOS. The module's lessons are already written; pick 5-7 external resources that a learner would genuinely use NEXT TO them: a different explanation of the hardest idea, a lecture that shows it, a reference to keep open, a place to practice.

Prefer, in this order: lecture videos from well-known courses and channels (MIT OpenCourseWare, Stanford, 3Blue1Brown, StatQuest, freeCodeCamp, Computerphile, CrashCourse, Khan Academy, conference talks); free textbooks and course notes at university or author domains; official documentation and tutorials; interactive explainers; landmark papers (arXiv IDs you know exactly). At most ONE Wikipedia page, and only when nothing better exists.

The title must be the resource's REAL title, exactly as it appears on the page (a verifier compares them), and the summary says what the learner gets from it for THIS module. Never invent a URL, a video ID, a paper ID or a title; leave a resource out if you are not certain it exists at that address.`;

const TOPUP_SYSTEM = `You are the Research agent for LearnOS. A module currently has too few WORKING external resources, because previously suggested URLs failed a reachability check.

Suggest 8 resources whose URLs you are certain exist and are stable. Nobody learns from an encyclopedia dump, so prefer sources that actively TEACH, in this order:
- Well-known LECTURE VIDEOS on long-established channels (3Blue1Brown, MIT OpenCourseWare, Stanford, StatQuest, freeCodeCamp, Computerphile, conference talks), only videos famous enough that you are certain of the exact URL.
- Interactive or visual explainers and tutorials (official "learn"/"getting started" guides, well-regarded course pages).
- Official documentation root pages of well-known projects.
- Canonical textbook or course homepages at university domains, and arXiv papers whose real ID you know (https://arxiv.org/abs/XXXX.XXXXX).

Use Wikipedia ONLY as a last resort for a concept that genuinely has no better teaching source, never as the default. Accuracy of the URL matters more than novelty: do not invent article titles, paper IDs or video IDs. Omit anything you are not sure exists.`;

/**
 * A resource has to load AND be the thing it claims to be.
 *
 * The model does not invent hostnames, it invents identifiers, so a fabricated
 * citation resolves perfectly to somebody else's paper. Reachability alone let
 * a lesson on value functions cite "Biorthogonal rational functions of R_II
 * type" and call it verified.
 */
async function verifyReachable(resources, context = '') {
  const ok = new Set();
  await Promise.all((resources || []).map(async (r) => {
    if (!r || !r.url) return;
    try {
      if (!await checkUrlReachable(r.url, r.kind)) return;
      const claim = await checkUrlMatchesClaim(r.url, r.title || '', { context });
      if (!claim.ok) return;
      ok.add(r.url);
    } catch { /* drop */ }
  }));
  return ok;
}

// Lecture videos carry a course visually, but they are also the resource kind
// the model most often hallucinates, so verified-video count gets its own
// floor (raised for visual learners) and its own dedicated top-up ask.

async function topUpResources({ userId, bp, modules, level, learningStyle = '', onProgress }) {
  const videoFloor = videosPerModule(learningStyle);
  const sourceDirective = resourceDirective(learningStyle);
  await mapWithConcurrency(modules, MODULE_CONCURRENCY, async (m) => {
    const have = await verifyReachable(m.resources, m.title);
    m.resources = (m.resources || []).filter(r => have.has(r.url));
    capWikipedia(m);

    if (m.resources.length < FLOORS.resourcesPerModule) {
      onProgress(0.92, `Finding working resources for “${m.title}”…`);
      try {
        const extra = (await complete({
          userId, agentCode: 'RE',
          schema: topUpSchema,
          maxTokens: 2000,
          system: TOPUP_SYSTEM,
          messages: `Course: ${bp.title} (${level})\nModule: ${m.title}\nSummary: ${m.summary || ''}\nObjectives: ${(m.objectives || []).join('; ')}\n\n${sourceDirective}\n\nSuggest resources with URLs you are confident exist.`,
        })).json;
        const okExtra = await verifyReachable(extra?.resources, m.title);
        const seen = new Set(m.resources.map(r => r.url));
        for (const r of (extra?.resources || [])) {
          if (okExtra.has(r.url) && !seen.has(r.url)) { m.resources.push(r); seen.add(r.url); }
        }
      } catch (e) {
        console.warn(`[courseBuilder] resource top-up failed for ${m.title}: ${e?.message || e}`);
      }
    }

    // Dedicated video pass: hallucinated video URLs get dropped by the oEmbed
    // verifier, so ask specifically for famous lecture videos until the module
    // has enough that actually exist.
    const videos = m.resources.filter(r => r.kind === 'video').length;
    if (videos < videoFloor) {
      onProgress(0.94, `Finding lecture videos for “${m.title}”…`);
      try {
        const extra = (await complete({
          userId, agentCode: 'RE',
          schema: topUpSchema,
          maxTokens: 2000,
          system: TOPUP_SYSTEM,
          messages: `Course: ${bp.title} (${level})\nModule: ${m.title}\nObjectives: ${(m.objectives || []).join('; ')}\n\nSuggest 6-8 LECTURE VIDEOS ONLY (kind "video", YouTube) covering this module. Only include videos famous enough that you are certain of the exact URL, well-known channels: MIT OpenCourseWare, Stanford, 3Blue1Brown, StatQuest, freeCodeCamp, Computerphile, Fireship, CppCon, conference keynotes. A verifier checks each video actually exists.`,
        })).json;
        const okExtra = await verifyReachable((extra?.resources || []).filter(r => r?.kind === 'video'), m.title);
        const seen = new Set(m.resources.map(r => r.url));
        for (const r of (extra?.resources || [])) {
          if (r?.kind === 'video' && okExtra.has(r.url) && !seen.has(r.url)) {
            m.resources.push(r); seen.add(r.url);
          }
        }
      } catch (e) {
        console.warn(`[courseBuilder] video top-up failed for ${m.title}: ${e?.message || e}`);
      }
    }
    capWikipedia(m);
  });
}

// One encyclopedia page per module at most: nobody learns a subject from a
// stack of Wikipedia links, and it was the generator's default for everything.
function capWikipedia(m) {
  let wiki = 0;
  m.resources = (m.resources || []).filter((r) => {
    if (!/wikipedia\.org/i.test(r.url || '')) return true;
    wiki++;
    return wiki <= 1;
  });
}

// ── Persistence ──────────────────────────────────────────────────────────────

/**
 * Write one module's generated content (lessons, videos, further reading, lab,
 * practice quiz, graded work) into an existing module row. Used by a fresh
 * build and by "Finish building", which fills modules a build left empty.
 */
function persistModuleContent(userId, { slug, courseTitle, mid, m, reachable, startOrder = 0, idPrefix, dueDate }) {
  const out = { lessons: 0, minutes: 0, items: 0, resources: 0, assignments: 0 };
  let li = startOrder;
  const addLesson = (title, body, kind, opts = {}) => {
    const mins = Math.max(1, Number(opts.minutes) || 10);
    db.prepare(`INSERT INTO module_lessons (id, module_id, title, body_md, kind, order_idx, url, estimated_minutes, is_graded, is_optional, pass_threshold, max_attempts)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(`${idPrefix}${li}`, mid, title, body || '', kind, li, opts.url || null, mins,
        opts.graded ? 1 : 0, opts.optional ? 1 : 0, opts.passThreshold ?? null, opts.maxAttempts ?? null);
    const id = `${idPrefix}${li}`;
    li++; out.lessons++; out.minutes += mins;
    return id;
  };

  // 1+2. Readings, with the module's lecture videos interleaved as optional
  // "watch" lessons. Everything else external (articles, docs, books, papers)
  // goes on one optional "Further reading" page: a link with a two-line
  // summary is not a lesson, and counting those as lessons made half of a
  // course a list of iframes of other people's websites.
  const readings = (m.readings || []).filter(r => r && r.body_md);
  const extRes = (m.resources || []).filter(r => r && r.url && reachable.has(r.url));
  const videos = extRes.filter(r => r.kind === 'video' && youtubeId(r.url));
  const further = extRes.filter(r => !videos.includes(r));
  const steps = Math.max(readings.length, videos.length);
  for (let k = 0; k < steps; k++) {
    const rd = readings[k];
    if (rd) addLesson(rd.title || m.title, rd.body_md, 'reading', { minutes: rd.minutes || 12 });
    const v = videos[k];
    if (v) {
      addLesson(v.title, `${v.summary || ''}\n\n_Source: ${v.source || safeHost(v.url)}_`, 'video', { url: v.url, minutes: v.minutes || 15, optional: true });
      out.resources++;
    }
  }
  if (further.length) {
    addLesson(`Further reading · ${m.title}`, furtherReadingMarkdown(further), 'resources', { minutes: 5, optional: true });
    out.resources += further.length;
  }

  // 3. Hands-on lab, the "doing" half, runnable where the topic allows it.
  if (m.lab && m.lab.title) {
    const steps = (m.lab.steps || []).map((s, k) => `${k + 1}. ${s}`).join('\n');
    const lid = addLesson(m.lab.title, `# ${m.lab.title}\n\n${m.lab.description || ''}\n\n## Steps\n\n${steps}`, 'lab',
      { minutes: m.lab.minutes || 45 });
    attachLabCode(lid, m.lab);
  }

  // 4. Practice quiz, ungraded, drawn from the item bank below.
  const items = Array.isArray(m.quiz_items) ? m.quiz_items.filter(q => q && q.question && Array.isArray(q.choices) && q.choices.length >= 2) : [];
  if (items.length) {
    const quizLessonId = addLesson(`Practice quiz · ${m.title}`,
      `Check your understanding of **${m.title}**. This is practice, unlimited attempts, and every answer is explained.`,
      'practice_quiz', { minutes: Math.max(5, Math.round(items.length * 1.5)) });
    items.forEach((q, k) => {
      try {
        db.prepare(`INSERT INTO quiz_items (id, course_slug, module_id, lesson_id, question, choices_json, answer_idx, explanation, difficulty, skill, verification_status, verification_note, verified_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'unverified' THEN NULL ELSE datetime('now') END)`)
          .run(`${idPrefix.replace(/^ml-/, 'qi-')}q${k}`, slug, mid, quizLessonId, q.question, JSON.stringify(q.choices),
            Math.max(0, Math.min(q.choices.length - 1, Number(q.answer_idx) || 0)),
            q.explanation || null, q.difficulty || 'medium', q.skill || null,
            q.verification_status || 'unverified', q.verification_note || null, q.verification_status || 'unverified');
        out.items++;
      } catch { /* skip a malformed item */ }
    });
  }

  // 5. Graded assessment, the thing that counts, with a real rubric.
  const g = m.graded;
  if (g && g.title && Array.isArray(g.tasks) && g.tasks.length) {
    const body = `# ${g.title}\n\n${g.description || ''}\n\n## Your tasks\n\n${g.tasks.map((t, k) => `${k + 1}. ${t}`).join('\n')}`;
    addLesson(g.title, body, 'graded_quiz', { minutes: g.minutes || 60, graded: true, passThreshold: 0.8, maxAttempts: 3 });
    db.prepare(`INSERT OR REPLACE INTO assignments (id, user_id, title, course, status, progress, priority, estimated_minutes, kind, description, tasks, due_date, rubric_json, pass_threshold, max_attempts)
                VALUES (?, ?, ?, ?, 'todo', 0, 'med', ?, ?, ?, ?, ?, ?, 0.8, 3)`)
      .run(`as-${mid}`, userId, g.title, courseTitle, g.minutes || 60, g.kind || 'homework',
        g.description || '', JSON.stringify(g.tasks),
        dueDate,
        JSON.stringify(g.rubric || []));
    out.assignments++;
  }

  return out;
}

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
    // The module row must exist before its lessons, module_lessons.module_id is
    // a foreign key. Its estimated_minutes is filled in once the lessons are known.
    db.prepare('INSERT INTO course_modules (id, course_slug, title, summary, order_idx, estimated_minutes, objectives) VALUES (?, ?, ?, ?, ?, 0, ?)')
      .run(mid, slug, m.title, m.summary || objectives.join(' · ') || null, i, J(objectives));

    const saved = persistModuleContent(userId, {
      slug, courseTitle: c.title, mid, m, reachable, idPrefix: `ml-${mid}-`,
      dueDate: new Date(dueBase + 86400000 * (7 + i * 3)).toISOString().split('T')[0],
    });
    lessonCount += saved.lessons; itemCount += saved.items; resourceCount += saved.resources; assignmentCount += saved.assignments;
    const moduleMinutes = saved.minutes;

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

  // A build takes minutes; the learner has almost certainly gone elsewhere, so
  // finishing is exactly the kind of thing a notification is for.
  try {
    notify(userId, {
      kind: 'job', priority: 'normal',
      title: `Course ready, ${c.title}`,
      body: `${c.modules.length} modules · ${lessonCount} lessons · ${itemCount} practice questions.`,
      actionScreen: 'courses', actionId: slug,
    });
  } catch {}

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

const RESOURCE_LABEL = { video: 'Video', paper: 'Paper', book: 'Book', blog: 'Article', article: 'Article', website: 'Website', docs: 'Documentation', repo: 'Code' };

/** One module's external resources as a readable list, not as lessons. */
export function furtherReadingMarkdown(resources) {
  const lines = ['Optional resources that go well with this module. They do not count toward your progress.', ''];
  for (const r of resources) {
    const label = RESOURCE_LABEL[r.kind] || 'Link';
    const src = r.source || safeHost(r.url) || '';
    lines.push(`- **[${String(r.title || r.url).replace(/[\[\]]/g, '')}](${r.url})** · ${label}${src ? `, ${src}` : ''}${r.minutes ? `, about ${r.minutes} min` : ''}`);
    if (r.summary) lines.push(`  ${String(r.summary).replace(/\s+/g, ' ').trim()}`);
  }
  return lines.join('\n');
}

function youtubeId(url) {
  try {
    const u = new URL(url);
    if (/(^|\.)youtu\.be$/.test(u.hostname)) return u.pathname.slice(1) || null;
    if (/(^|\.)youtube\.com$/.test(u.hostname)) return u.searchParams.get('v') || (u.pathname.match(/^\/(embed|shorts)\/([\w-]+)/) || [])[2] || null;
  } catch { /* not a URL */ }
  return null;
}

// Attach runnable code to a lab lesson, but only when it is actually runnable:
// a language we support, starter code to edit, and tests shaped as data.
function attachLabCode(lessonId, lab) {
  if (!lessonId || !lab) return;
  const lang = lab.language;
  const RUNNABLE = ['javascript', 'python', 'cpp', 'c', 'java', 'go'];
  if (!RUNNABLE.includes(lang)) return;
  // Test args/expected travel as JSON strings (see the schema comment) and are
  // decoded here; anything that doesn't decode cleanly is dropped rather than
  // shipped as a broken case.
  const tests = (Array.isArray(lab.tests) ? lab.tests : []).flatMap((t) => {
    if (!t || typeof t.fn !== 'string') return [];
    try {
      const args = JSON.parse(t.args_json ?? '[]');
      const expected = JSON.parse(t.expected_json ?? 'null');
      if (!Array.isArray(args)) return [];
      return [{ name: t.name || t.fn, fn: t.fn, args, expected, hidden: !!t.hidden }];
    } catch { return []; }
  });
  if (!lab.starter_code && !tests.length) return;
  try {
    db.prepare('UPDATE module_lessons SET lab_language = ?, starter_code = ?, lab_tests_json = ?, lab_solution = ? WHERE id = ?')
      .run(lang, lab.starter_code || '', JSON.stringify(tests), lab.reference_solution || null, lessonId);
  } catch { /* the lab still reads fine without a runner */ }
}

// A staged build makes one LLM call per module, so it runs as a background job
// with real progress rather than blocking an HTTP request for minutes.
registerJobHandler('build-course', async ({ userId, input, jobId }) => {
  // Thread the learner's stated modality into the build so lessons lean toward
  // how this person actually learns, not a one-size default.
  let learningStyle = '';
  try { learningStyle = getProfile(userId)?.learning_style || ''; } catch { /* no profile yet */ }
  return buildCourse({
    userId,
    topic: input?.topic,
    level: input?.level,
    learningStyle,
    onProgress: (pct, msg) => setJobProgress(jobId, pct, msg),
  });
});

export default { buildCourse, persistRichCourse };
