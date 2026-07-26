/**
 * Specialization planner — M4 of docs/MASTERY_SPEC_V2.md §3.3.
 *
 * A Coursera Specialization sequences 3-6 whole courses into one credential.
 * Ours goes further: the pathway starts where the learner *actually* is, not at
 * lesson one. The learner states a goal ("I want to be able to build and ship a
 * backend service"), we decompose it into a course sequence (point B), then a
 * diagnostic measures what they already know (point A) and the pathway starts
 * from there — the part Coursera doesn't do.
 *
 * Courses are planned up front but BUILT on demand, because building all of them
 * eagerly would mean dozens of LLM calls for content the learner may never reach.
 */
import db, { logActivity } from '../../db/database.js';
import { complete } from '../llm.js';
import { registerJobHandler, setJobProgress } from '../jobs.js';
import { buildCourse } from './courseBuilder.js';

const LEVELS = ['beginner', 'intermediate', 'advanced'];

const planSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    subtitle: { type: 'string' },
    target_outcome: { type: 'string' },
    courses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          topic: { type: 'string' },
          level: { type: 'string', enum: LEVELS },
          why: { type: 'string' },
          skills: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'topic', 'level', 'why', 'skills'],
      },
    },
  },
  required: ['title', 'subtitle', 'target_outcome', 'courses'],
};

const PLAN_SYSTEM = `You are the Curriculum agent for LearnOS planning a SPECIALIZATION: a sequence of complete courses that carries a learner from where they are now to a stated goal.

Requirements:
- 3-6 courses in strict dependency order. Each must be a substantial course in its own right, not a module.
- The first course must be reachable from the learner's stated starting point; the last must actually deliver the goal.
- "topic" is what we will hand to the course builder — make it specific and self-contained (it is used without the surrounding context).
- "why" states, in one sentence, why this course is needed at this position in the path.
- "skills": 3-6 named skills this course contributes to the goal. These are what a diagnostic will test, so make them concrete and testable.
- "level" reflects where the learner will be by the time they reach that course, not where they start.

Return only the structured object.`;

const diagnosticSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          question: { type: 'string' },
          choices: { type: 'array', items: { type: 'string' } },
          answer_idx: { type: 'integer' },
          skill: { type: 'string' },
          course_index: { type: 'integer' },
        },
        required: ['question', 'choices', 'answer_idx', 'skill', 'course_index'],
      },
    },
  },
  required: ['questions'],
};

const DIAGNOSTIC_SYSTEM = `You are the Assessment agent writing a PLACEMENT diagnostic for a specialization.

Its only job is to find where the learner should START. For each course in the pathway, write 3 questions that test whether the learner ALREADY has that course's skills well enough to skip it. Questions must be discriminating: someone who genuinely knows the material answers correctly, someone who has only heard the terms does not.

Each question has 4 choices, a 0-based "answer_idx", the "skill" it tests, and "course_index" (0-based) identifying which course in the pathway it belongs to. Return only the structured object.`;

/** Plan a specialization and persist it as a roadmap of course nodes. */
export async function planSpecialization({ userId, goal, level, onProgress = () => {} }) {
  const lvl = LEVELS.includes(level) ? level : 'beginner';
  onProgress(0.1, 'Decomposing your goal into a course pathway…');

  const plan = (await complete({
    userId, agentCode: 'CR',
    schema: planSchema,
    maxTokens: 3000,
    system: PLAN_SYSTEM,
    messages: `Learner goal: ${goal}\nSelf-described current level: ${lvl}\nPlan the specialization.`,
  })).json;

  if (!plan || !Array.isArray(plan.courses) || plan.courses.length < 2) {
    throw new Error('Curriculum agent returned an invalid specialization plan');
  }

  onProgress(0.55, 'Building your pathway…');
  const rmId = `sp-${Date.now().toString(36)}`;
  db.prepare(`INSERT INTO roadmaps (id, user_id, title, subtitle, authored_by, mastery, total_modules, completed_modules, status, next_module, modules_left, kind, goal)
              VALUES (?, ?, ?, ?, 'Curriculum agent', 0, ?, 0, 'active', ?, ?, 'specialization', ?)`)
    .run(rmId, userId, plan.title, plan.subtitle || plan.target_outcome || '', plan.courses.length,
      plan.courses[0]?.title || '', plan.courses.length, goal);

  plan.courses.forEach((c, i) => {
    const nid = `${rmId}-c${i}`;
    db.prepare(`INSERT INTO roadmap_nodes (id, roadmap_id, title, col, row_idx, mastery, status, node_kind, skills, course_topic, build_status)
                VALUES (?, ?, ?, ?, ?, 0, ?, 'course', ?, ?, 'planned')`)
      .run(nid, rmId, c.title, i % 6, Math.floor(i / 6), i === 0 ? 'active' : i === 1 ? 'next' : 'locked',
        JSON.stringify(c.skills || []), c.topic);
    db.prepare('INSERT INTO node_objectives (id, node_id, roadmap_id, text, order_idx) VALUES (?, ?, ?, ?, ?)')
      .run(`no-${nid}-0`, nid, rmId, c.why, 0);
    (c.skills || []).slice(0, 5).forEach((s, k) => {
      try { db.prepare('INSERT INTO node_objectives (id, node_id, roadmap_id, text, order_idx) VALUES (?, ?, ?, ?, ?)').run(`no-${nid}-${k + 1}`, nid, rmId, s, k + 1); } catch {}
    });
    if (i > 0) db.prepare('INSERT OR IGNORE INTO roadmap_edges (roadmap_id, from_node, to_node) VALUES (?, ?, ?)').run(rmId, `${rmId}-c${i - 1}`, nid);
  });

  // Placement diagnostic — this is what makes the pathway start at A, not at 0.
  onProgress(0.75, 'Writing your placement diagnostic…');
  let diagnostic = null;
  try {
    diagnostic = (await complete({
      userId, agentCode: 'AS',
      schema: diagnosticSchema,
      maxTokens: 4000,
      system: DIAGNOSTIC_SYSTEM,
      messages: `Goal: ${goal}\nPathway:\n${plan.courses.map((c, i) => `${i}. ${c.title} — skills: ${(c.skills || []).join(', ')}`).join('\n')}\n\nWrite the placement diagnostic.`,
    })).json;
    if (diagnostic?.questions?.length) {
      db.prepare('UPDATE roadmaps SET placement_json = ? WHERE id = ?').run(JSON.stringify(diagnostic.questions), rmId);
    }
  } catch (e) {
    console.warn(`[specialization] diagnostic failed: ${e?.message || e}`);
  }

  try {
    logActivity(userId, { kind: 'session', text: `Specialization planned: ${plan.title}`, sub: `${plan.courses.length} courses toward "${goal}"`, agent: 'CR' });
  } catch {}

  onProgress(1, 'Pathway ready');
  return {
    roadmap_id: rmId, title: plan.title, goal,
    courses: plan.courses.length,
    diagnosticQuestions: diagnostic?.questions?.length || 0,
    target_outcome: plan.target_outcome,
  };
}

/**
 * Score a placement diagnostic and move the learner to their real starting point.
 * A course whose questions the learner answers well is marked done (they've
 * demonstrated it); the first course they can't demonstrate becomes active.
 */
export function applyPlacement(userId, roadmapId, answers, { skipThreshold = 0.75 } = {}) {
  const rm = db.prepare('SELECT id, placement_json FROM roadmaps WHERE id = ? AND user_id = ?').get(roadmapId, userId);
  if (!rm) return null;
  let questions = [];
  try { questions = JSON.parse(rm.placement_json || '[]'); } catch {}
  if (!questions.length) return null;

  // Per-course score from the questions tagged to that course.
  const byCourse = new Map();
  questions.forEach((q, i) => {
    const idx = Number(q.course_index) || 0;
    const rec = byCourse.get(idx) || { correct: 0, total: 0, skills: new Set() };
    rec.total++;
    if (answers?.[i] === q.answer_idx) rec.correct++;
    else if (q.skill) rec.skills.add(q.skill);
    byCourse.set(idx, rec);
  });

  const nodes = db.prepare("SELECT id, title FROM roadmap_nodes WHERE roadmap_id = ? AND node_kind = 'course' ORDER BY id").all(roadmapId);
  const perCourse = [];
  let startIndex = 0, decided = false;

  nodes.forEach((n, i) => {
    const rec = byCourse.get(i) || { correct: 0, total: 0, skills: new Set() };
    const ratio = rec.total ? rec.correct / rec.total : 0;
    // Only skip a prefix: once the learner fails a course, everything after it
    // must be studied even if they happened to answer a later question well.
    const demonstrated = !decided && rec.total > 0 && ratio >= skipThreshold;
    if (!demonstrated && !decided) { startIndex = i; decided = true; }
    perCourse.push({ index: i, title: n.title, correct: rec.correct, total: rec.total, ratio, demonstrated, gaps: [...rec.skills] });
  });
  if (!decided) startIndex = nodes.length - 1; // demonstrated everything — start at the last course

  nodes.forEach((n, i) => {
    const status = i < startIndex ? 'done' : i === startIndex ? 'active' : i === startIndex + 1 ? 'next' : 'locked';
    const mastery = i < startIndex ? Math.max(0.8, perCourse[i].ratio) : 0;
    db.prepare('UPDATE roadmap_nodes SET status = ?, mastery = ? WHERE id = ?').run(status, mastery, n.id);
  });

  const startNode = nodes[startIndex];
  db.prepare('UPDATE roadmaps SET next_module = ?, completed_modules = ?, modules_left = ? WHERE id = ?')
    .run(startNode?.title || '', startIndex, Math.max(0, nodes.length - startIndex), roadmapId);

  try {
    logActivity(userId, { kind: 'session', text: `Placement complete — starting at "${startNode?.title}"`,
      sub: startIndex > 0 ? `${startIndex} course(s) skipped as already demonstrated` : 'Starting from the beginning', agent: 'AS' });
  } catch {}

  return { startIndex, startNode: startNode?.title || null, skipped: startIndex, perCourse };
}

registerJobHandler('plan-specialization', async ({ userId, input, jobId }) =>
  planSpecialization({ userId, goal: input?.goal, level: input?.level, onProgress: (p, m) => setJobProgress(jobId, p, m) }));

// Build the course sitting behind a specialization node, on demand.
registerJobHandler('build-pathway-course', async ({ userId, input, jobId }) => {
  const node = db.prepare('SELECT id, roadmap_id, title, course_topic, course_slug FROM roadmap_nodes WHERE id = ?').get(input?.node_id);
  if (!node) throw new Error('Node not found');
  if (node.course_slug) return { slug: node.course_slug, alreadyBuilt: true };

  db.prepare("UPDATE roadmap_nodes SET build_status = 'building' WHERE id = ?").run(node.id);
  try {
    const res = await buildCourse({
      userId, topic: node.course_topic || node.title, level: input?.level || 'intermediate',
      onProgress: (p, m) => setJobProgress(jobId, p, m),
    });
    db.prepare("UPDATE roadmap_nodes SET course_slug = ?, build_status = 'built' WHERE id = ?").run(res.slug, node.id);
    return res;
  } catch (e) {
    db.prepare("UPDATE roadmap_nodes SET build_status = 'failed' WHERE id = ?").run(node.id);
    throw e;
  }
});

export default { planSpecialization, applyPlacement };
