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
import db, { logActivity, notify } from '../../db/database.js';
import { complete } from '../llm.js';
import { checkUrlReachable, checkUrlMatchesClaim } from './research.js';
import { validateCourseDepth, FLOORS } from '../quality/depthFloors.js';
import { registerJobHandler, setJobProgress } from '../jobs.js';

const LEVELS = ['beginner', 'intermediate', 'advanced'];

// How many modules are written at once. Modules are independent given the
// blueprint, so this is pure wall-clock win; kept modest to stay well inside
// provider rate limits.
const MODULE_CONCURRENCY = 4;

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

If a "Pathway context" is provided (the specialization this course belongs to and the learner's end goal), anchor the whole course to it: module topics, examples and terminology must serve that goal. An "OOP" course inside a C++ pathway is a C++ OOP course — never drift to a different language or domain.

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
        // A lab the learner can actually RUN, when the topic admits code.
        language: { type: 'string', enum: ['javascript', 'python', 'none'] },
        starter_code: { type: 'string' },
        tests: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              fn: { type: 'string' },
              // Args and expected values are arbitrary JSON, but a schema of `{}`
              // (or an array with no item type) is rejected outright by strict
              // providers — "Empty schema that accepts any JSON value is not
              // supported" — which failed the WHOLE assessment call and silently
              // cost every module its quiz items. Carrying them as JSON strings
              // keeps the schema concrete and portable.
              args_json: { type: 'string' },
              expected_json: { type: 'string' },
              hidden: { type: 'boolean' },
            },
            required: ['name', 'fn', 'args_json', 'expected_json', 'hidden'],
          },
        },
      },
      required: ['title', 'description', 'steps', 'minutes', 'language', 'starter_code', 'tests'],
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
- "readings": 3-4 original lessons that actually TEACH. Each body_md must be at least 450 words (${FLOORS.readingChars}+ characters) of real instruction in Markdown. Do not summarize — teach. Never use placeholder text.
- "resources": 5-7 REAL, canonical external resources at long-stable URLs — and AT LEAST 2 must be kind "video" (YouTube lecture videos: MIT OCW, Stanford, 3Blue1Brown, StatQuest, freeCodeCamp, Computerphile, conference talks — only videos famous enough that you are certain of the exact URL). Diversify the rest across papers (arXiv), canonical books, high-signal blogs, docs and key repos. NEVER invent a URL — omit anything you are not confident exists; a verifier drops dead links, and a module with no surviving resources is a failure.

Readings must be VISUALLY STRUCTURED, never a wall of text:
- A ### heading every 150-250 words; no paragraph longer than 4 sentences.
- At least one fenced code block per reading: a worked, runnable example for code topics, or a text diagram (flow, tree, timeline, before/after) for non-code topics.
- At least one Markdown table per reading (comparison, decision guide, or summary — | Col | Col | rows).
- Bold the key terms on first use. End every reading with a "**Key takeaways**" bullet list of 3-5 points.

If the course context names a target language, tool, or domain (e.g. a C++ pathway), EVERY example, code block, and idiom must use that language/tool — never substitute another one.

"minutes" fields are honest time estimates for a learner at the stated level.`;

const ASSESSMENT_SYSTEM = `You are the Assessment agent for LearnOS writing the ASSESSMENT for one module of a course. The teaching content already exists; you are writing what proves the learner absorbed it.

Produce ALL THREE:
- "quiz_items": exactly 10 practice questions with 4 choices each, the correct "answer_idx" (0-based), and an "explanation" that teaches why the answer is right and why the tempting distractor is wrong. Vary difficulty across easy/medium/hard. Tag each with the "skill" it tests.
- "lab": a hands-on exercise the learner actually performs, with 4-8 concrete steps. This is the "doing" half of the module.
  Whenever the topic admits code, make the lab RUNNABLE: set "language" to "javascript" or "python", give "starter_code" that defines the required function(s) with a clear TODO body the learner completes, and 3-6 "tests" that check the finished function. Mark 1-2 tests hidden. Each test is {name, fn, args_json, expected_json, hidden} where "args_json" is a JSON ARRAY of the call arguments (e.g. "[2, 3]") and "expected_json" is the JSON value the function must return (e.g. "5" or "[1,2]") — both as JSON-encoded STRINGS, and describing a value, never prose. If the topic genuinely has no code (a design or writing exercise), set "language" to "none", "starter_code" to "" and "tests" to [].
- "graded": the assessment that counts, with a 4-7 step task list and a 3-5 criterion rubric whose weights sum to 1.

"minutes" fields are honest time estimates. Returning fewer than 10 quiz items, or omitting the lab or the graded assessment, is a failure.`;

// ── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Build a full course through the staged pipeline.
 * @param {function(number,string)} onProgress called with (0..1, message)
 */
export async function buildCourse({ userId, topic, level, pathwayContext, onProgress = () => {} }) {
  const lvl = LEVELS.includes(level) ? level : 'intermediate';

  onProgress(0.02, 'Designing the course blueprint…');
  const ctxLine = pathwayContext ? `\nPathway context: ${pathwayContext}` : '';
  const bp = (await complete({
    userId, agentCode: 'CR',
    schema: blueprintSchema,
    maxTokens: 4000,
    system: BLUEPRINT_SYSTEM,
    messages: `Topic: ${topic}\nTarget level: ${lvl}${ctxLine}\nDesign the blueprint.`,
  })).json;

  if (!bp || !bp.title || !Array.isArray(bp.modules) || !bp.modules.length) {
    throw new Error('Curriculum agent returned an invalid blueprint');
  }

  // Stage 2 — two calls per module. This is where the depth comes from, and it
  // is also the whole cost of a build, so modules are written CONCURRENTLY.
  // Sequentially a 9-module course took ~13 minutes; the modules don't depend on
  // each other's output (only on the blueprint), so a bounded pool cuts that to
  // a few minutes without hammering the provider.
  const failures = [];
  const N = bp.modules.length;
  let finished = 0;

  const buildModule = async (m, i) => {
    const context = [
      `Course: ${bp.title} (${lvl})`,
      pathwayContext ? `Pathway context: ${pathwayContext}` : null,
      `Course outcomes: ${(bp.outcomes || []).join('; ')}`,
      `This module (${i + 1} of ${N}): ${m.title}`,
      `Module summary: ${m.summary}`,
      `Module objectives: ${(m.objectives || []).join('; ')}`,
      i > 0 ? `Already covered: ${bp.modules.slice(0, i).map(x => x.title).join('; ')}` : 'This is the first module.',
    ].filter(Boolean).join('\n');

    const tick = (msg) => onProgress(0.05 + 0.85 * (finished / N), msg);
    try {
      tick(`Writing module ${i + 1}/${N}: ${m.title}`);
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

      finished++;
      tick(`Finished ${finished}/${N} modules`);
      return { ...m, ...teaching, ...assessment };
    } catch (e) {
      // One weak module must not sink the course, but the failure must be
      // visible — silently pushing an empty module is how a "successful" build
      // shipped 1 lesson across 8 modules.
      console.warn(`[courseBuilder] module ${i + 1} (${m.title}) failed: ${e?.message || e}`);
      failures.push({ module: m.title, stage: 'teaching', error: e?.message || String(e) });
      finished++;
      tick(`Finished ${finished}/${N} modules`);
      return { ...m, readings: [], quiz_items: [], lab: null, graded: null, resources: [] };
    }
  };

  // Order is preserved regardless of completion order — a course's modules must
  // stay in their taught sequence.
  const modules = await mapWithConcurrency(bp.modules, MODULE_CONCURRENCY, buildModule);

  onProgress(0.92, 'Verifying external resources…');
  await topUpResources({ userId, bp, modules, level: lvl, onProgress });

  const persisted = await persistRichCourse(userId, { ...bp, modules }, lvl);

  onProgress(0.99, 'Checking depth floors…');
  const depth = validateCourseDepth(persisted.slug);
  onProgress(1, depth.ok ? 'Course ready' : `Course ready (${depth.violations.length} depth warnings)`);

  return { ...persisted, failures, depth: { ok: depth.ok, violations: depth.violations.length, stats: depth.stats } };
}

// ── Enrichment ───────────────────────────────────────────────────────────────
// Deepens an EXISTING course in place rather than regenerating it. This is how a
// thin course — the hand-written seed courses, an imported one, anything that
// predates the depth model — is brought up to the floors without losing what it
// already has or changing its slug.

const expandSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    body_md: { type: 'string' },
    minutes: { type: 'integer' },
  },
  required: ['body_md', 'minutes'],
};

const extendSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
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
  },
  required: ['modules'],
};

export async function enrichCourse({ userId, slug, onProgress = () => {} }) {
  const course = db.prepare('SELECT slug, title, blurb, hours, level, tags FROM courses WHERE slug = ?').get(slug);
  if (!course) throw new Error(`Course not found: ${slug}`);
  const lvl = LEVELS.includes(course.level) ? course.level : 'intermediate';

  let modules = db.prepare('SELECT id, title, summary, objectives, order_idx FROM course_modules WHERE course_slug = ? ORDER BY order_idx').all(slug);
  const isCapstone = (m) => /-capstone$/.test(m.id) || /^capstone\b/i.test(m.title || '');
  const teaching = modules.filter(m => !isCapstone(m));

  // 1. Too few modules → extend the syllabus, continuing what's already there.
  const needed = FLOORS.modulesPerCourse - teaching.length;
  if (needed > 0) {
    onProgress(0.05, `Extending the syllabus by ${needed} module${needed === 1 ? '' : 's'}…`);
    try {
      const ext = (await complete({
        userId, agentCode: 'CR', schema: extendSchema, maxTokens: 2500,
        system: `You are the Curriculum agent extending an EXISTING course. Propose exactly ${needed} additional modules that continue the course beyond what it already covers — deeper, more applied, or the natural next topics. Do not repeat existing modules. Each needs a title, a 1-2 sentence summary and 3-5 measurable objectives.`,
        messages: `Course: ${course.title} (${lvl})\n${course.blurb || ''}\nExisting modules:\n${teaching.map((m, i) => `${i + 1}. ${m.title}`).join('\n')}\n\nPropose ${needed} more.`,
      })).json;
      let idx = modules.length;
      for (const m of (ext?.modules || []).slice(0, needed)) {
        const mid = `cm-${slug}-x${idx}`;
        db.prepare('INSERT INTO course_modules (id, course_slug, title, summary, order_idx, estimated_minutes, objectives) VALUES (?, ?, ?, ?, ?, 0, ?)')
          .run(mid, slug, m.title, m.summary || null, idx, JSON.stringify(m.objectives || []));
        idx++;
      }
    } catch (e) {
      console.warn(`[enrich] extending ${slug} failed: ${e?.message || e}`);
    }
    modules = db.prepare('SELECT id, title, summary, objectives, order_idx FROM course_modules WHERE course_slug = ? ORDER BY order_idx').all(slug);
  }

  const targets = modules.filter(m => !isCapstone(m));
  let done = 0;

  await mapWithConcurrency(targets, MODULE_CONCURRENCY, async (m) => {
    const objectives = (() => { try { return JSON.parse(m.objectives || '[]'); } catch { return []; } })();
    const lessons = db.prepare('SELECT id, kind, url, is_graded FROM module_lessons WHERE module_id = ?').all(m.id);
    const items = db.prepare('SELECT COUNT(*) c FROM quiz_items WHERE module_id = ?').get(m.id).c;

    const readings = lessons.filter(l => l.kind === 'reading').length;
    const hasLab = lessons.some(l => ['lab', 'exercise', 'programming', 'project'].includes(l.kind));
    const hasGraded = lessons.some(l => l.is_graded);
    const resources = lessons.filter(l => l.url && !['lab', 'exercise', 'programming', 'project'].includes(l.kind)).length;

    const context = [
      `Course: ${course.title} (${lvl})`,
      `Module: ${m.title}`,
      `Module summary: ${m.summary || ''}`,
      `Module objectives: ${objectives.join('; ')}`,
    ].join('\n');

    // Fill only what's missing, and append — never destroy existing content.
    // IDs must be unique BY CONSTRUCTION, not derived from a positional counter:
    // enrichment is re-runnable, and a count-based id collides with rows a
    // previous pass already inserted (which aborted whole modules mid-run).
    let order = lessons.length;
    const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const add = (title, body, kind, opts = {}) => {
      const mins = Math.max(1, Number(opts.minutes) || 10);
      const id = `ml-${m.id}-e${uid()}`;
      db.prepare(`INSERT INTO module_lessons (id, module_id, title, body_md, kind, order_idx, url, estimated_minutes, is_graded, pass_threshold, max_attempts)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, m.id, title, body || '', kind, order, opts.url || null, mins,
          opts.graded ? 1 : 0, opts.graded ? 0.8 : null, opts.graded ? 3 : null);
      order++;
      return id;
    };

    if (readings < 3 || resources < FLOORS.resourcesPerModule) {
      try {
        const t = (await complete({
          userId, agentCode: 'CR', schema: readingsSchema, maxTokens: 8000,
          system: READINGS_SYSTEM,
          messages: `${context}\n\nThis module currently has ${readings} reading(s) and ${resources} working resource(s). Write the readings and resources it is missing.`,
        })).json;
        for (const r of (t?.readings || []).slice(0, Math.max(0, 3 - readings))) {
          if (r?.body_md) add(r.title || m.title, r.body_md, 'reading', { minutes: r.minutes || 12 });
        }
        const reach = await verifyReachable(t?.resources, m.title);
        const existing = new Set(lessons.map(l => l.url).filter(Boolean));
        for (const r of (t?.resources || [])) {
          if (!reach.has(r.url) || existing.has(r.url)) continue;
          add(r.title, `${r.summary || ''}\n\n_Source: ${r.source || safeHost(r.url)}_`, r.kind || 'article', { url: r.url, minutes: r.minutes || 15 });
          existing.add(r.url);
        }
      } catch (e) { console.warn(`[enrich] readings for ${m.title}: ${e?.message || e}`); }
    }

    if (items < FLOORS.quizItemsPerModule || !hasLab || !hasGraded) {
      try {
        const a = (await complete({
          userId, agentCode: 'AS', schema: assessmentSchema, maxTokens: 6000,
          system: ASSESSMENT_SYSTEM,
          messages: `${context}\n\nThis module currently has ${items} quiz item(s)${hasLab ? '' : ', no lab'}${hasGraded ? '' : ', no graded assessment'}. Write what it is missing.`,
        })).json || {};

        const valid = (a.quiz_items || []).filter(q => q?.question && Array.isArray(q.choices) && q.choices.length >= 2);
        if (items < FLOORS.quizItemsPerModule && valid.length) {
          const quizLesson = lessons.find(l => l.kind === 'practice_quiz')?.id
            || add(`Practice quiz · ${m.title}`, `Check your understanding of **${m.title}**. Unlimited attempts, every answer explained.`, 'practice_quiz', { minutes: Math.max(5, Math.round(valid.length * 1.5)) });
          valid.forEach((q, k) => {
            try {
              db.prepare(`INSERT INTO quiz_items (id, course_slug, module_id, lesson_id, question, choices_json, answer_idx, explanation, difficulty, skill)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(`qi-${m.id}-e${uid()}${k}`, slug, m.id, quizLesson, q.question, JSON.stringify(q.choices),
                  Math.max(0, Math.min(q.choices.length - 1, Number(q.answer_idx) || 0)), q.explanation || null, q.difficulty || 'medium', q.skill || null);
            } catch { /* skip malformed */ }
          });
        }
        if (!hasLab && a.lab?.title) {
          const lid = add(a.lab.title, `# ${a.lab.title}\n\n${a.lab.description || ''}\n\n## Steps\n\n${(a.lab.steps || []).map((s, k) => `${k + 1}. ${s}`).join('\n')}`, 'lab', { minutes: a.lab.minutes || 45 });
          attachLabCode(lid, a.lab);
        }
        if (!hasGraded && a.graded?.title && Array.isArray(a.graded.tasks) && a.graded.tasks.length) {
          const g = a.graded;
          add(g.title, `# ${g.title}\n\n${g.description || ''}\n\n## Your tasks\n\n${g.tasks.map((t, k) => `${k + 1}. ${t}`).join('\n')}`, 'graded_quiz', { minutes: g.minutes || 60, graded: true });
          try {
            db.prepare(`INSERT OR REPLACE INTO assignments (id, user_id, title, course, status, progress, priority, estimated_minutes, kind, description, tasks, due_date, rubric_json, pass_threshold, max_attempts)
                        VALUES (?, ?, ?, ?, 'todo', 0, 'med', ?, ?, ?, ?, ?, ?, 0.8, 3)`)
              .run(`as-${m.id}`, userId, g.title, course.title, g.minutes || 60, g.kind || 'homework', g.description || '',
                JSON.stringify(g.tasks), new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0], JSON.stringify(g.rubric || []));
          } catch { /* assignment is a bonus, lesson already exists */ }
        }
      } catch (e) { console.warn(`[enrich] assessment for ${m.title}: ${e?.message || e}`); }
    }

    // Existing readings that are below the floor must be EXPANDED, not just
    // supplemented — otherwise a deepened course still serves its original
    // 400-character stubs alongside the new material.
    const thin = db.prepare("SELECT id, title, body_md FROM module_lessons WHERE module_id = ? AND kind = 'reading' AND LENGTH(COALESCE(body_md,'')) < ?").all(m.id, FLOORS.readingChars);
    for (const t of thin) {
      try {
        const ex = (await complete({
          userId, agentCode: 'CR', schema: expandSchema, maxTokens: 4000,
          system: `You are the Curriculum agent rewriting a lesson that is too thin to teach anything. Expand it into at least 450 words (${FLOORS.readingChars}+ characters) of real instruction in Markdown: headings, worked intuition, a concrete example or derivation, common pitfalls, and why it matters. Keep the original's topic and any correct claims; deepen it, don't replace the subject.`,
          messages: `${context}\n\nCurrent lesson "${t.title}":\n${t.body_md || ''}\n\nRewrite it in full.`,
        })).json;
        if (ex?.body_md && ex.body_md.length > (t.body_md || '').length) {
          db.prepare('UPDATE module_lessons SET body_md = ?, estimated_minutes = ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(ex.body_md, Math.max(1, Number(ex.minutes) || 12), t.id);
        }
      } catch (e) { console.warn(`[enrich] expanding "${t.title}": ${e?.message || e}`); }
    }

    // Resource top-up, same as a fresh build: models cite URLs that don't exist,
    // so a module can finish enrichment with nothing that survived verification.
    const haveRes = db.prepare("SELECT COUNT(*) c FROM module_lessons WHERE module_id = ? AND url IS NOT NULL AND url != '' AND kind NOT IN ('lab','exercise','programming','project')").get(m.id).c;
    if (haveRes < FLOORS.resourcesPerModule) {
      try {
        const extra = (await complete({
          userId, agentCode: 'RE', schema: topUpSchema, maxTokens: 2000,
          system: TOPUP_SYSTEM,
          messages: `Course: ${course.title} (${lvl})\nModule: ${m.title}\nObjectives: ${objectives.join('; ')}\n\nSuggest resources with URLs you are confident exist.`,
        })).json;
        const reach = await verifyReachable(extra?.resources, m.title);
        const known = new Set(db.prepare('SELECT url FROM module_lessons WHERE module_id = ? AND url IS NOT NULL').all(m.id).map(r => r.url));
        for (const r of (extra?.resources || [])) {
          if (!reach.has(r.url) || known.has(r.url)) continue;
          add(r.title, `${r.summary || ''}\n\n_Source: ${r.source || safeHost(r.url)}_`, r.kind || 'article', { url: r.url, minutes: r.minutes || 15 });
          known.add(r.url);
        }
      } catch (e) { console.warn(`[enrich] resource top-up for ${m.title}: ${e?.message || e}`); }
    }

    const mins = db.prepare('SELECT COALESCE(SUM(estimated_minutes),0) s FROM module_lessons WHERE module_id = ?').get(m.id).s;
    db.prepare('UPDATE course_modules SET estimated_minutes = ? WHERE id = ?').run(mins, m.id);

    done++;
    onProgress(0.1 + 0.85 * (done / targets.length), `Deepened ${done}/${targets.length} modules`);
  });

  // Hours must stay honest after enrichment.
  const total = db.prepare(`SELECT COALESCE(SUM(l.estimated_minutes),0) s FROM module_lessons l JOIN course_modules m ON m.id = l.module_id WHERE m.course_slug = ?`).get(slug).s;
  if (total > 0) db.prepare('UPDATE courses SET hours = ? WHERE slug = ?').run(Math.max(1, Math.round(total / 60)), slug);

  const depth = validateCourseDepth(slug);
  onProgress(1, depth.ok ? 'Course now meets the depth floors' : `Deepened (${depth.violations.length} floors still unmet)`);
  try { logActivity(userId, { kind: 'session', text: `Deepened course: ${course.title}`, sub: `${depth.stats.lessons} lessons · ${depth.stats.quizItems} quiz items`, agent: 'CR' }); } catch {}

  return { slug, title: course.title, depth: { ok: depth.ok, violations: depth.violations.length, stats: depth.stats } };
}

registerJobHandler('enrich-course', async ({ userId, input, jobId }) =>
  enrichCourse({ userId, slug: input?.slug, onProgress: (p, m) => setJobProgress(jobId, p, m) }));

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
// the model most often hallucinates — so verified-video count gets its own
// floor and its own dedicated top-up ask.
const VIDEOS_PER_MODULE = 2;

async function topUpResources({ userId, bp, modules, level, onProgress }) {
  await mapWithConcurrency(modules, MODULE_CONCURRENCY, async (m) => {
    const have = await verifyReachable(m.resources, m.title);
    m.resources = (m.resources || []).filter(r => have.has(r.url));

    if (m.resources.length < FLOORS.resourcesPerModule) {
      onProgress(0.92, `Finding working resources for “${m.title}”…`);
      try {
        const extra = (await complete({
          userId, agentCode: 'RE',
          schema: topUpSchema,
          maxTokens: 2000,
          system: TOPUP_SYSTEM,
          messages: `Course: ${bp.title} (${level})\nModule: ${m.title}\nSummary: ${m.summary || ''}\nObjectives: ${(m.objectives || []).join('; ')}\n\nSuggest resources with URLs you are confident exist.`,
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
    if (videos < VIDEOS_PER_MODULE) {
      onProgress(0.94, `Finding lecture videos for “${m.title}”…`);
      try {
        const extra = (await complete({
          userId, agentCode: 'RE',
          schema: topUpSchema,
          maxTokens: 2000,
          system: TOPUP_SYSTEM,
          messages: `Course: ${bp.title} (${level})\nModule: ${m.title}\nObjectives: ${(m.objectives || []).join('; ')}\n\nSuggest 6-8 LECTURE VIDEOS ONLY (kind "video", YouTube) covering this module. Only include videos famous enough that you are certain of the exact URL — well-known channels: MIT OpenCourseWare, Stanford, 3Blue1Brown, StatQuest, freeCodeCamp, Computerphile, Fireship, CppCon, conference keynotes. A verifier checks each video actually exists.`,
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
  });
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

    // 1+2. Readings interleaved with verified external resources. All-text-then-
    // all-links read like a wall of prose with an appendix; alternating a lecture
    // video or article after each reading paces the module like a real course.
    // Videos come first in the rotation so each module leads with one early.
    const readings = (m.readings || []).filter(r => r && r.body_md);
    const extRes = (m.resources || [])
      .filter(r => r && r.url && reachable.has(r.url))
      .sort((a, b) => (b.kind === 'video' ? 1 : 0) - (a.kind === 'video' ? 1 : 0));
    const steps = Math.max(readings.length, extRes.length);
    for (let k = 0; k < steps; k++) {
      const rd = readings[k];
      if (rd) addLesson(rd.title || m.title, rd.body_md, 'reading', { minutes: rd.minutes || 12 });
      const r = extRes[k];
      if (r) {
        const body = `${r.summary || ''}\n\n_Source: ${r.source || safeHost(r.url)}_`;
        addLesson(r.title, body, r.kind || 'article', { url: r.url, minutes: r.minutes || 15 });
        resourceCount++;
      }
    }

    // 3. Hands-on lab — the "doing" half, runnable where the topic allows it.
    if (m.lab && m.lab.title) {
      const steps = (m.lab.steps || []).map((s, k) => `${k + 1}. ${s}`).join('\n');
      const lid = addLesson(m.lab.title, `# ${m.lab.title}\n\n${m.lab.description || ''}\n\n## Steps\n\n${steps}`, 'lab',
        { minutes: m.lab.minutes || 45 });
      attachLabCode(lid, m.lab);
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

  // A build takes minutes; the learner has almost certainly gone elsewhere, so
  // finishing is exactly the kind of thing a notification is for.
  try {
    notify(userId, {
      kind: 'job', priority: 'normal',
      title: `Course ready — ${c.title}`,
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

// Attach runnable code to a lab lesson, but only when it is actually runnable:
// a language we support, starter code to edit, and tests shaped as data.
function attachLabCode(lessonId, lab) {
  if (!lessonId || !lab) return;
  const lang = lab.language;
  if (lang !== 'javascript' && lang !== 'python') return;
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
    db.prepare('UPDATE module_lessons SET lab_language = ?, starter_code = ?, lab_tests_json = ? WHERE id = ?')
      .run(lang, lab.starter_code || '', JSON.stringify(tests), lessonId);
  } catch { /* the lab still reads fine without a runner */ }
}

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
