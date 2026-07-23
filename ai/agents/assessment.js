/**
 * AS — Assessment agent (G3). Generates real, node-aware assignments tailored
 * to a learner's current module and difficulty. Falls back to the static
 * ASSIGNMENT_LIBRARY on the frontend if the agent fails (no key, etc.).
 */
import db, { logActivity, awardXP } from '../../db/database.js';
import { complete } from '../llm.js';
import { registerJobHandler } from '../jobs.js';

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
  const d = DIFFICULTIES.includes(difficulty) ? difficulty : 'medium';

  // Pull node + objectives + roadmap title for context.
  let node = null, objectives = [], course = 'General';
  if (nodeId) {
    node = db.prepare('SELECT id, title, roadmap_id FROM roadmap_nodes WHERE id = ?').get(nodeId);
    if (node) {
      objectives = db.prepare('SELECT text FROM node_objectives WHERE node_id = ? ORDER BY order_idx').all(node.id).map(o => o.text);
      const rm = db.prepare('SELECT title FROM roadmaps WHERE id = ?').get(node.roadmap_id);
      if (rm) course = rm.title;
    }
  }

  const objText = objectives.length ? objectives.map(o => `- ${o}`).join('\n') : '(no objectives specified — infer reasonable ones from the title)';
  const out = await complete({
    userId, agentCode: 'AS',
    schema: assignmentSchema,
    maxTokens: 1500,
    system: SYSTEM,
    messages: `Module: ${node?.title || 'General module'}
Course: ${course}
Difficulty: ${d}
Assignment kind: ${k}
Learning objectives:
${objText}

Generate the assignment.`,
  });

  const a = out.json;
  if (!a || !a.title || !a.tasks || a.tasks.length === 0) {
    throw new Error('Assessment agent returned an invalid assignment');
  }
  return a;
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
