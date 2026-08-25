/**
 * AS — Assessment agent (G3). Generates real, node-aware assignments tailored
 * to a learner's current module and difficulty. Falls back to the static
 * ASSIGNMENT_LIBRARY on the frontend if the agent fails (no key, etc.).
 */
import db, { logActivity, awardXP } from '../../db/database.js';
import { complete } from '../llm.js';
import { registerJobHandler } from '../jobs.js';
import {
  normalizeSteps, gradeMcqStep, gradeCodeStep, composeGrade, CODE_LANGS,
} from '../assessment/stepGrader.js';

const ASSIGNMENT_KINDS = ['coding', 'project', 'homework', 'quiz', 'analysis'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const assignmentSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title:        { type: 'string' },
    course:       { type: 'string' },
    kind:         { type: 'string', enum: ASSIGNMENT_KINDS },
    priority:     { type: 'string', enum: ['low', 'med', 'high'] },
    estimated_minutes: { type: 'integer' },
    description:  { type: 'string' },
    tasks:        { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'course', 'kind', 'priority', 'estimated_minutes', 'description', 'tasks'],
};

const SYSTEM = `You are the Assessment agent for LearnOS. Given a module title, its learning objectives,
the course it belongs to, and a difficulty, generate a single real assignment.

Strict rules:
- The assignment MUST test the module's actual objectives — not a generic placeholder.
- 'kind' must match what was requested.
- 'tasks' is a concrete, ordered checklist of 4-7 specific actions the learner should perform.
  Each task is one sentence. No filler like "complete the assignment" or "submit your work".
- 'description' is 2-4 sentences explaining what the assignment is and what the learner will produce.
- 'estimated_minutes' is realistic: quiz=20-40, homework=60-120, coding=90-180, project=180-360, analysis=60-120.
- 'priority' reflects how central this is to the module's mastery (high for core, low for review).
Return only the structured object.`;

// ── Interactive, multi-step assignments (Phase 1) ────────────────────────────
// The generator no longer produces "write a 1000-word essay" work. It produces
// an ordered list of auto-gradeable STEPS: concept-check MCQs, runnable coding
// tasks judged against real test cases, and at most one short focused answer.
// Each step carries everything the grader and the UI need.
const stepsAssignmentSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title:             { type: 'string' },
    kind:              { type: 'string', enum: ASSIGNMENT_KINDS },
    priority:          { type: 'string', enum: ['low', 'med', 'high'] },
    estimated_minutes: { type: 'integer' },
    description:       { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type:        { type: 'string', enum: ['mcq', 'code', 'short'] },
          prompt:      { type: 'string' },
          weight:      { type: 'integer', minimum: 1, maximum: 3 },
          // mcq
          choices:     { type: 'array', items: { type: 'string' } },
          answer_idx:  { type: 'integer' },
          explanation: { type: 'string' },
          // code
          language:    { type: 'string', enum: CODE_LANGS },
          starter_code:{ type: 'string' },
          tests:       { type: 'array', items: {
            type: 'object', additionalProperties: false,
            properties: { name: { type: 'string' }, fn: { type: 'string' }, args: { type: 'array' }, expected: {} },
          } },
          hidden_tests:{ type: 'array', items: {
            type: 'object', additionalProperties: false,
            properties: { name: { type: 'string' }, fn: { type: 'string' }, args: { type: 'array' }, expected: {} },
          } },
          // short
          guidance:    { type: 'string' },
          min_words:   { type: 'integer' },
        },
        required: ['type', 'prompt'],
      },
    },
  },
  required: ['title', 'kind', 'priority', 'estimated_minutes', 'description', 'steps'],
};

const STEPS_SYSTEM = `You are the Assessment agent for LearnOS. Build a single HANDS-ON, auto-graded assignment
that makes the learner DO things and get immediate, real feedback — never a wall-of-text essay.

Output an ordered list of 4–7 "steps". Each step is one of:
- "mcq": a concept check. 3–4 "choices", exactly one correct via "answer_idx" (0-based), and a one-sentence "explanation".
- "code": a runnable coding task the learner solves in an editor and RUNS. It is graded automatically against real test cases.
- "short": a focused free-response answer of AT MOST 2–4 sentences. Put what a correct answer must contain in "guidance". Use AT MOST ONE short step, and NEVER ask for essays, reports, or word counts above ~120.

Design rules:
- Prefer interactive, auto-graded steps (mcq + code). Every step must be checkable — no "reflect on…" or "write about…" busywork.
- Scaffold: start easier, build up. Give code steps clear, minimal "starter_code" (function signature / a TODO), not a blank box.
- Ground every step in the module's actual objectives and the provided resources.
- Give each step a "weight" of 1 (minor), 2 (normal), or 3 (core).

CODE step rules (pick ONE language appropriate to the course):
- For python or javascript: write FUNCTION tests. The learner implements a named function. Each test = { "name", "fn": "<function name>", "args": [ ... ], "expected": <value> }. "starter_code" must define that function's signature with a TODO body.
- For cpp, c, java, or go: write I/O tests. The program reads from stdin and prints the answer to stdout. Each test = { "name", "args": ["<exact stdin>"], "expected": "<exact expected stdout>" }. "starter_code" must be a compilable skeleton that reads input.
- Provide 2–4 visible "tests" AND 1–3 "hidden_tests" (same format) so the learner can't hard-code outputs.
- Keep tests deterministic and exact — no randomness, no floating-point equality traps (use integers or exact strings).
- Only use code steps when the topic is genuinely programmatic. For non-programmatic topics, use mcq + one short step.

Also return a short "description" (2–3 sentences on what the learner will build/practice), a realistic "estimated_minutes", a "priority", and a "kind".
Return only the structured object.`;

const quizSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          q:       { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correct: { type: 'integer' },
          why:     { type: 'string' },
        },
        required: ['q', 'options', 'correct', 'why'],
      },
    },
  },
  required: ['title', 'questions'],
};

const QUIZ_SYSTEM = `You are the Assessment agent for LearnOS. Generate a short multiple-choice quiz (3-5 questions)
that tests a learner on the module's objectives. Each question has 4 options. Exactly one is correct
(index 0-3). "why" explains the correct answer in one sentence.
Cover different objectives across questions; do not repeat the same idea twice.
Return only the structured object.`;

export async function generateQuiz({ userId, nodeId }) {
  let node = null, objectives = [];
  if (nodeId) {
    node = db.prepare('SELECT id, title FROM roadmap_nodes WHERE id = ?').get(nodeId);
    if (node) objectives = db.prepare('SELECT text FROM node_objectives WHERE node_id = ? ORDER BY order_idx').all(node.id).map(o => o.text);
  }
  const objText = objectives.length ? objectives.map(o => `- ${o}`).join('\n') : '(infer reasonable objectives from the title)';
  const out = await complete({
    userId, agentCode: 'AS',
    schema: quizSchema, maxTokens: 1500,
    system: QUIZ_SYSTEM,
    messages: `Module: ${node?.title || 'General module'}\nObjectives:\n${objText}\nGenerate a 3-5 question quiz.`,
  });
  const q = out.json;
  if (!q || !q.questions || q.questions.length === 0) throw new Error('Assessment agent returned an invalid quiz');
  return q;
}

export async function generateAssignment({ userId, nodeId, kind, difficulty }) {
  const k = ASSIGNMENT_KINDS.includes(kind) ? kind : 'homework';

  // Pull node + objectives + roadmap title + the learner's current mastery +
  // the module's verified online resources, so the assignment is grounded in
  // real sources AND calibrated to where the learner actually is.
  let node = null, objectives = [], course = 'General', mastery = null, resources = [];
  if (nodeId) {
    node = db.prepare('SELECT id, title, roadmap_id, mastery FROM roadmap_nodes WHERE id = ?').get(nodeId);
    if (node) {
      mastery = node.mastery;
      objectives = db.prepare('SELECT text FROM node_objectives WHERE node_id = ? ORDER BY order_idx').all(node.id).map(o => o.text);
      const rm = db.prepare('SELECT title FROM roadmaps WHERE id = ?').get(node.roadmap_id);
      if (rm) course = rm.title;
      resources = db.prepare("SELECT title, url, source, summary, kind FROM node_resources WHERE node_id = ? AND status = 'verified' ORDER BY created_at DESC LIMIT 6").all(node.id);
    }
  }

  // Difficulty adapts to mastery when not explicitly forced: a learner at 20%
  // gets a scaffolded, foundational task; a learner at 85% gets a stretch.
  let d = DIFFICULTIES.includes(difficulty) ? difficulty : null;
  if (!d) d = mastery == null ? 'medium' : mastery < 0.4 ? 'easy' : mastery < 0.75 ? 'medium' : 'hard';
  const masteryNote = mastery == null ? '' :
    `\nLearner's current mastery of this module: ${Math.round(mastery * 100)}%. Calibrate the challenge accordingly — ${mastery < 0.4 ? 'scaffold heavily, focus on fundamentals and confidence' : mastery < 0.75 ? 'reinforce and apply the core skills' : 'push toward synthesis, edge cases and independent design'}.`;
  const resourceNote = resources.length
    ? `\n\nGround the assignment in these vetted resources for the module — reference them where useful and have the learner apply what they cover:\n${resources.map(r => `- [${r.kind}] ${r.title} (${r.source || ''}) — ${r.summary || r.url}`).join('\n')}`
    : '';

  const objText = objectives.length ? objectives.map(o => `- ${o}`).join('\n') : '(no objectives specified — infer reasonable ones from the title)';
  const out = await complete({
    userId, agentCode: 'AS',
    schema: stepsAssignmentSchema,
    maxTokens: 5000,
    system: STEPS_SYSTEM,
    messages: `Module: ${node?.title || 'General module'}
Course: ${course}
Difficulty: ${d}
Assignment kind: ${k}
Learning objectives:
${objText}${masteryNote}${resourceNote}

Build the interactive assignment.`,
  });

  const a = out.json;
  const steps = normalizeSteps(a?.steps);
  if (!a || !a.title || steps.length === 0) {
    throw new Error('Assessment agent returned an invalid assignment');
  }
  // Derive the flat task list from the steps so the list view, back-compat
  // legacy renderer, and the "N requirements" counts all keep working.
  const tasks = steps.map(s => stepTaskLabel(s));
  return {
    title: a.title,
    course,
    kind: a.kind || k,
    priority: ['low', 'med', 'high'].includes(a.priority) ? a.priority : 'med',
    estimated_minutes: Number.isInteger(a.estimated_minutes) ? a.estimated_minutes : 90,
    description: a.description || `Interactive assignment on ${node?.title || course}.`,
    tasks,
    steps,
  };
}

// One-line label for a step, used for the flat task list / rubric rows.
function stepTaskLabel(s) {
  const first = String(s.prompt || '').split('\n')[0].trim();
  const tag = s.type === 'mcq' ? 'Concept check' : s.type === 'code' ? `Code (${s.language})` : 'Short answer';
  return first.length > 90 ? `${tag}: ${first.slice(0, 87)}…` : `${tag}: ${first}`;
}

// ── LLM-based grading (§3.5) ─────────────────────────────────────────────────

const gradeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overall_grade: { type: 'integer', minimum: 0, maximum: 100 },
    per_criterion: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          criterion: { type: 'string' },
          score:     { type: 'integer', minimum: 0, maximum: 100 },
          why:       { type: 'string' },
        },
        required: ['criterion', 'score', 'why'],
      },
    },
    feedback_md: { type: 'string' },
  },
  required: ['overall_grade', 'per_criterion', 'feedback_md'],
};

const GRADE_SYSTEM = `You are the Assessment agent for LearnOS grading a learner's assignment submission.
Evaluate the submission against the assignment's objectives and tasks.
Be fair and constructive — point out what was done well AND what could improve.
The grade should reflect genuine mastery, not effort alone.`;

export async function gradeSubmission({ submissionId }) {
  const sub = db.prepare('SELECT * FROM assignment_submissions WHERE id = ?').get(submissionId);
  if (!sub) return { ok: false, reason: 'not_found' };
  if (sub.grade != null) { return { ok: true, reason: 'already_graded' }; }

  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(sub.assignment_id);
  const tasks = assignment?.tasks ? JSON.parse(assignment.tasks) : [];
  const tasksText = tasks.length ? tasks.map((t, i) => `  ${i + 1}. ${t}`).join('\n') : '(no specific tasks)';

  // Writes the grade to the submission AND back onto the assignment row, so the
  // list, the "Graded" tab, the average-grade stat and the pending counts all
  // update. Previously only the submission was written, so every graded
  // assignment still displayed as "Not started" forever.
  const applyGrade = (gradeVal, feedbackMd, rubric) => {
    db.prepare('UPDATE assignment_submissions SET grade = ?, feedback_md = ?, rubric_json = ? WHERE id = ?')
      .run(gradeVal, feedbackMd, JSON.stringify(rubric), submissionId);
    if (sub.assignment_id) {
      db.prepare("UPDATE assignments SET status = 'graded', grade = ?, progress = 1 WHERE id = ? AND user_id = ?")
        .run(gradeVal, sub.assignment_id, sub.user_id);
    }
    try {
      logActivity(sub.user_id, {
        kind: 'assignment_graded',
        text: `Graded: ${assignment?.title || 'Assignment'} — ${gradeVal}%`,
        sub: assignment?.course || 'Assignment',
        xp: 50, agent: 'AS',
      });
      awardXP(sub.user_id, 50);
    } catch { /* grading must not fail on logging */ }
  };

  let out = null;
  try {
    out = await complete({
      userId: sub.user_id,
      agentCode: 'AS',
      schema: gradeSchema,
      maxTokens: 2048,
      system: GRADE_SYSTEM,
      messages: `Assignment: ${assignment?.title || 'Unknown'}
Description: ${assignment?.description || 'N/A'}
Tasks:
${tasksText}

---
Learner's submission:
${sub.body_md}

---
Grade this submission. Return overall_grade (0-100), per_criterion scores, and feedback_md (markdown).`,
    });
  } catch (e) {
    // complete() THROWS when no key is configured, so the heuristic fallback
    // below used to be unreachable — submissions sat ungraded forever with the
    // UI stuck on "Grading in progress…". Fall through to the heuristic.
    out = null;
  }

  const result = out?.json;
  if (!result || result.overall_grade == null) {
    // Fallback heuristic grading
    const bodyLen = sub.body_md.length;
    const taskCount = tasks.length;
    const checkedCount = tasks.filter(t => sub.body_md.toLowerCase().includes(t.toLowerCase().slice(0, 15))).length;
    const pct = taskCount > 0 ? Math.round((checkedCount / taskCount) * 40 + 60) : Math.min(100, 60 + Math.floor(bodyLen / 100));
    const fallbackGrade = Math.min(100, Math.max(0, pct));
    applyGrade(
      fallbackGrade,
      `**Auto-graded (no AI key):** ${fallbackGrade}%\n\nYour submission was evaluated heuristically. Add an OpenRouter key in Settings for detailed AI feedback.`,
      [{ criterion: 'Overall', score: fallbackGrade, why: 'Heuristic grading — add an AI key for detailed feedback' }],
    );
    return { ok: true, fallback: true, grade: fallbackGrade };
  }

  applyGrade(result.overall_grade, result.feedback_md, result.per_criterion);
  return { ok: true, grade: result.overall_grade };
}

registerJobHandler('grade-assignment', async ({ input }) => gradeSubmission({ submissionId: input.submissionId }));

// ── Step-based grading (Phase 1) ─────────────────────────────────────────────
// MCQ and code steps are graded deterministically (code via the real lab
// runner); short/written steps are graded by one batched LLM call. The overall
// grade is a weight-normalised average, so it reflects genuine per-step
// performance rather than one holistic guess. Works even with no AI key: the
// auto-graded steps still score, and text steps fall back to a length heuristic.

const stepsTextGradeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    grades: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          step_id:  { type: 'string' },
          score:    { type: 'integer', minimum: 0, maximum: 100 },
          feedback: { type: 'string' },
        },
        required: ['step_id', 'score', 'feedback'],
      },
    },
  },
  required: ['grades'],
};

function persistAssignmentGrade(sub, assignment, gradeVal, feedbackMd, rubric, stepsResult) {
  db.prepare('UPDATE assignment_submissions SET grade = ?, feedback_md = ?, rubric_json = ?, steps_result_json = ? WHERE id = ?')
    .run(gradeVal, feedbackMd, JSON.stringify(rubric || []), JSON.stringify(stepsResult || {}), sub.id);
  if (sub.assignment_id) {
    db.prepare("UPDATE assignments SET status = 'graded', grade = ?, progress = 1 WHERE id = ? AND user_id = ?")
      .run(gradeVal, sub.assignment_id, sub.user_id);
  }
  try {
    logActivity(sub.user_id, {
      kind: 'assignment_graded',
      text: `Graded: ${assignment?.title || 'Assignment'} — ${gradeVal}%`,
      sub: assignment?.course || 'Assignment', xp: 50, agent: 'AS',
    });
    awardXP(sub.user_id, 50);
  } catch { /* grading must not fail on logging */ }
}

export async function gradeStepSubmission({ submissionId }) {
  const sub = db.prepare('SELECT * FROM assignment_submissions WHERE id = ?').get(submissionId);
  if (!sub) return { ok: false, reason: 'not_found' };
  if (sub.grade != null) return { ok: true, reason: 'already_graded' };

  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(sub.assignment_id);
  const steps = normalizeSteps(parseJson(assignment?.steps_json, []));
  if (!steps.length) {
    // Not a step assignment — defer to the legacy essay grader.
    return gradeSubmission({ submissionId });
  }
  const answers = parseJson(sub.answers_json, {}) || {};
  const results = {};

  // 1) Deterministic steps.
  for (const s of steps) {
    const ans = answers[s.id] || {};
    if (s.type === 'mcq') {
      results[s.id] = gradeMcqStep(s, ans.selected_idx);
    } else if (s.type === 'code') {
      try {
        results[s.id] = await gradeCodeStep(s, ans.code, { includeHidden: true });
      } catch (e) {
        results[s.id] = { type: 'code', score: 0, passed: false, error: e?.message || 'Run failed', autograded: true, cases: [] };
      }
    }
  }

  // 2) Text steps (short/written) — one batched LLM call, heuristic fallback.
  const textSteps = steps.filter(s => s.type === 'short' || s.type === 'written');
  if (textSteps.length) {
    let graded = null;
    try {
      const payload = textSteps.map(s => {
        const text = (answers[s.id]?.text || '').trim();
        return `Step ${s.id} (weight ${s.weight}):\nQuestion: ${s.prompt}\nWhat a correct answer must contain: ${s.guidance || '(use the question)'}\nLearner's answer: ${text || '(blank)'}`;
      }).join('\n\n---\n\n');
      const out = await complete({
        userId: sub.user_id, agentCode: 'AS', schema: stepsTextGradeSchema, maxTokens: 1600,
        system: `You are grading short free-response answers in an assignment for the course "${assignment?.course || ''}".
Grade EACH step independently 0–100 against what a correct answer must contain. Reward correctness and specificity, not length.
A blank or off-topic answer scores low. Give one or two sentences of concrete feedback per step. Return a grade for every step_id provided.`,
        messages: payload,
      });
      graded = out?.json?.grades || null;
    } catch { graded = null; }

    const byId = new Map((graded || []).map(g => [g.step_id, g]));
    for (const s of textSteps) {
      const g = byId.get(s.id);
      if (g && Number.isFinite(g.score)) {
        results[s.id] = { type: s.type, score: Math.max(0, Math.min(100, g.score)), passed: g.score >= 60, feedback: g.feedback || '', autograded: false };
      } else {
        // Heuristic: did they write a substantive answer of about the asked length?
        const words = (answers[s.id]?.text || '').trim().split(/\s+/).filter(Boolean).length;
        const ratio = s.min_words ? Math.min(1, words / s.min_words) : (words > 0 ? 1 : 0);
        const score = Math.round(ratio * (words > 0 ? 70 : 0));
        results[s.id] = { type: s.type, score, passed: score >= 60, feedback: 'Auto-graded without an AI key — add an OpenRouter key in Settings for real feedback.', autograded: false };
      }
    }
  }

  const overall = composeGrade(steps, results);
  const rubric = steps.map(s => ({
    criterion: stepTaskLabel(s),
    score: results[s.id]?.score ?? 0,
    why: stepWhy(s, results[s.id]),
  }));
  const feedbackMd = buildStepFeedback(steps, results, overall);

  persistAssignmentGrade(sub, assignment, overall, feedbackMd, rubric, results);
  return { ok: true, grade: overall };
}

function stepWhy(s, r) {
  if (!r) return 'Not attempted.';
  if (s.type === 'mcq') return r.passed ? 'Correct.' : `Incorrect${Number.isInteger(r.correctIdx) ? ` — the right choice was #${r.correctIdx + 1}` : ''}.`;
  if (s.type === 'code') return r.total ? `${r.passedCount}/${r.total} test cases passed${r.error ? ` · ${r.error}` : ''}.` : (r.passed ? 'Ran cleanly.' : (r.error || 'Did not run.'));
  return r.feedback || (r.passed ? 'Solid answer.' : 'Answer was thin or off-target.');
}

function buildStepFeedback(steps, results, overall) {
  const lines = [`## Result: ${overall}%`, ''];
  steps.forEach((s, i) => {
    const r = results[s.id] || {};
    const mark = r.passed ? '✅' : (r.score >= 60 ? '🟡' : '❌');
    lines.push(`**${i + 1}. ${mark} ${stepTaskLabel(s)} — ${r.score ?? 0}%**`);
    lines.push(stepWhy(s, r));
    lines.push('');
  });
  return lines.join('\n');
}

function parseJson(s, fallback) { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } }

registerJobHandler('grade-assignment-steps', async ({ input }) => gradeStepSubmission({ submissionId: input.submissionId }));
