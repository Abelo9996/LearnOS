/**
 * Module assessment, written from the lessons the learner actually read, then
 * checked mechanically before it ships.
 *
 *   quiz     every item is tied to one lesson objective; an independent
 *            examiner answers each item WITHOUT the key, and items it answers
 *            differently are dropped (or kept as disputed if too few survive)
 *   lab      written with a reference solution; the solution is run against
 *            the tests, failing tests are dropped, a starter that already
 *            passes everything is flagged, and a lab with fewer than two
 *            working tests gets one repair attempt before it is shipped as a
 *            plain (ungraded-by-code) exercise rather than a broken one
 *   graded   a rubric-graded assignment drawn from the module's objectives
 *
 * The first builder wrote assessments from the module title alone ("the
 * teaching content already exists", but it was never passed in), so quizzes
 * asked about things no lesson taught and labs had no tests that could pass.
 */
import { complete } from '../llm.js';
import { runLabWithTests } from '../assessment/labRunner.js';

const testSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    fn: { type: 'string' },
    args_json: { type: 'string' },
    expected_json: { type: 'string' },
    hidden: { type: 'boolean' },
  },
  required: ['name', 'fn', 'args_json', 'expected_json', 'hidden'],
};

const labSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    minutes: { type: 'integer' },
    language: { type: 'string', enum: ['javascript', 'python', 'cpp', 'c', 'java', 'go', 'none'] },
    starter_code: { type: 'string' },
    reference_solution: { type: 'string' },
    tests: { type: 'array', items: testSchema },
  },
  required: ['title', 'description', 'steps', 'minutes', 'language', 'starter_code', 'reference_solution', 'tests'],
};

export const assessmentSchema = {
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
          objective: { type: 'string' },
        },
        required: ['question', 'choices', 'answer_idx', 'explanation', 'difficulty', 'skill', 'objective'],
      },
    },
    lab: labSchema,
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

export const ASSESSMENT_SYSTEM = `You are the assessment designer for one module of a LearnOS course. You are given the module's lessons in full. Assess what those lessons taught, nothing else.

Produce:
- "quiz_items": 10 multiple-choice questions, 4 choices each, exactly one defensibly correct. Name in "objective" which lesson objective each item tests, and cover every objective. Prefer questions that require applying an idea (a small calculation, predicting an outcome, spotting the bug, choosing the right method for a situation) over recalling a definition; at most 2 pure-recall items. Distractors are the mistakes a real learner makes, not jokes. "explanation" says why the answer is right AND why the most tempting wrong choice is wrong. Do not put the answer in the question's wording, do not use "all of the above". In explanations, refer to choices by what they say, never by position or letter ("the first choice", "option B"): choices are shuffled before the learner sees them. Write math in LaTeX ($\\theta_1$, $\\frac{\\pi}{2}$) in questions, choices and explanations.
- "lab": a hands-on exercise that makes the learner build or compute the module's central idea, in 4-8 concrete steps.
  If the course has code, make it RUNNABLE and auto-graded in the course's language:
  · javascript/python: "starter_code" defines the required function(s) with the signature, a docstring and a TODO body (it must NOT already solve the task). "reference_solution" is the same code fully solved. Each test: "fn" = function name, "args_json" = a JSON ARRAY of arguments (e.g. "[[1,2],[3,4]]"), "expected_json" = the JSON return value (e.g. "5.0"). Return plain JSON values (numbers, strings, lists, dicts, booleans), not numpy arrays or objects, and round floats to 4 decimals in the function so equality is exact. 5-8 tests including edge cases, 2 of them hidden.
  · cpp/c/java/go: "starter_code" is a complete compilable program skeleton with a TODO that reads stdin and prints to stdout (Java class must be Main). "reference_solution" is the solved program. "fn" = "main", "args_json" = a JSON array with exactly ONE string (the stdin), "expected_json" = a JSON string of the exact stdout.
  Labs run on the learner's own machine: the lab code and its tests must not read files or download data (pass data in as arguments), and Python labs may import only the standard library plus the libraries listed in the brief as installed.
  If the course has no code, set "language" to "none", "starter_code", "reference_solution" to "" and "tests" to [], and make the steps a concrete exercise with a clear deliverable.
- "graded": the assignment that counts: a realistic task applying the whole module, 4-7 tasks, and a 3-5 criterion rubric whose weights sum to 1, each criterion with what excellent, adequate and poor work look like.

"minutes" are honest estimates for the stated level.`;

const EXAMINER_SYSTEM = `You are an independent examiner. Answer each multiple-choice question yourself. You are NOT given the answer key. For each question give the index (0-based) of the one correct choice, or -1 if no choice is correct or more than one is defensible.`;

const examinerSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { n: { type: 'integer' }, answer_idx: { type: 'integer' } },
        required: ['n', 'answer_idx'],
      },
    },
  },
  required: ['answers'],
};

const POSITIONAL = /\b(first|second|third|fourth|last)\s+(choice|option|answer)\b|\b(option|choice)\s+[A-D1-4]\b|\([a-d]\)/i;

/**
 * Shuffle an item's choices deterministically (seeded by the question text), so
 * the correct answer is not always in the same slot. Models put it first far
 * more often than chance: a whole generated quiz had every answer at index 0.
 * An item whose explanation points at choices by position is left alone.
 */
export function shuffleChoices(q) {
  if (POSITIONAL.test(q.explanation || '')) return q;
  let h = 2166136261;
  for (const c of q.question) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const order = q.choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    const j = h % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, choices: order.map(i => q.choices[i]), answer_idx: order.indexOf(q.answer_idx) };
}

/** Normalize quiz items and drop malformed ones. */
export function cleanQuizItems(items) {
  return (Array.isArray(items) ? items : []).filter((q) => {
    if (!q || !q.question || !Array.isArray(q.choices)) return false;
    const choices = q.choices.map(c => String(c).trim()).filter(Boolean);
    if (choices.length < 3 || new Set(choices.map(c => c.toLowerCase())).size !== choices.length) return false;
    if (!Number.isInteger(q.answer_idx) || q.answer_idx < 0 || q.answer_idx >= choices.length) return false;
    if (/all of the above|none of the above/i.test(choices.join(' '))) return false;
    q.choices = choices;
    return true;
  }).map(shuffleChoices);
}

/** An independent model answers every item without the key; disagreements are dropped. */
export async function examineQuiz({ userId, items, context }) {
  if (!items.length) return { items, disputed: 0, checked: false };
  let answers = null;
  try {
    const out = (await complete({
      userId, agentCode: 'RV',
      schema: examinerSchema,
      maxTokens: 14000,
      system: EXAMINER_SYSTEM,
      messages: `Subject: ${context}\n\n${items.map((q, n) => `Question ${n}: ${q.question}\n${q.choices.map((c, i) => `  ${i}. ${c}`).join('\n')}`).join('\n\n')}`,
    })).json;
    answers = new Map((out?.answers || []).map(a => [a.n, a.answer_idx]));
  } catch {
    return { items, disputed: 0, checked: false };
  }
  const agreed = [];
  const disputed = [];
  items.forEach((q, n) => {
    const a = answers.get(n);
    if (a === q.answer_idx) agreed.push({ ...q, verification_status: 'confirmed' });
    else disputed.push({ ...q, verification_status: 'disputed', verification_note: a == null ? 'Examiner gave no answer.' : a < 0 ? 'Examiner found no single correct choice.' : `Examiner chose option ${a}, not the stored answer ${q.answer_idx}.` });
  });
  // Keep a usable quiz: fall back to disputed items (marked as such) only when
  // too few agreed ones survive.
  const kept = agreed.length >= 6 ? agreed : [...agreed, ...disputed.slice(0, 6 - agreed.length)];
  return { items: kept, disputed: disputed.length, checked: true };
}

function decodeTests(tests) {
  return (Array.isArray(tests) ? tests : []).flatMap((t) => {
    if (!t || typeof t.fn !== 'string') return [];
    try {
      const args = JSON.parse(t.args_json ?? '[]');
      const expected = JSON.parse(t.expected_json ?? 'null');
      if (!Array.isArray(args)) return [];
      return [{ ...t, args, expected }];
    } catch { return []; }
  });
}

const RUNNABLE = new Set(['javascript', 'python', 'cpp', 'c', 'java', 'go']);

/**
 * Do two values have the same shape (type, length, keys), whatever the
 * numbers inside? An author cannot compute a simulation's exact output in
 * their head, so a different number is no evidence of a broken lab; a list
 * where they promised a single number is.
 */
export function sameShape(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameShape(x, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && sameShape(a[k], b[k]));
  }
  return typeof a === typeof b;
}

/**
 * Prove a lab works, by construction.
 *
 * A model writing a lab states expected outputs it has not computed, and a
 * cheap one routinely contradicts its own solution (a function returning a list
 * of sample means, tested against a single number). So expected values are not
 * trusted: the reference solution is run on every test input, twice, and what
 * it returns becomes the expected value. Inputs whose output changes between
 * runs (unseeded randomness) or that crash are dropped. When most stated
 * expectations disagree with the solution, the lab is flagged as suspect for a
 * repair pass, since either the solution or the task description is wrong.
 * Finally the starter must fail at least one test, or the lab is trivial.
 */
export async function validateLab(lab) {
  if (!lab || !RUNNABLE.has(lab.language)) return { lab, report: { runnable: false } };
  const declared = decodeTests(lab.tests);
  if (!lab.reference_solution || !declared.length) return { lab, report: { runnable: true, ok: false, reason: 'no reference solution or tests' } };

  // Run the reference with every case visible so its actual output comes back.
  const probe = declared.map(t => ({ ...t, hidden: false }));
  const [r1, r2] = [
    await runLabWithTests({ source: lab.reference_solution, language: lab.language, tests: probe }),
    await runLabWithTests({ source: lab.reference_solution, language: lab.language, tests: probe }),
  ];
  const c1 = r1.tests?.cases || [];
  const c2 = r2.tests?.cases || [];
  const report = { runnable: true, declared: declared.length };
  if (!r1.tests?.ok) {
    report.error = r1.tests?.error || r1.error || String(r1.stderr || '').slice(-400) || 'reference solution did not run';
    return { lab, report: { ...report, passingOnReference: 0, ok: false, reason: report.error }, failures: [] };
  }

  const kept = [];
  let disagreed = 0, unstable = 0, crashed = 0;
  declared.forEach((t, i) => {
    const a = c1[i], b = c2[i];
    if (!a || a.error || a.actual === undefined || typeof a.actual === 'string' && /^<.*object at 0x/.test(a.actual)) { crashed++; return; }
    if (JSON.stringify(a.actual) !== JSON.stringify(b?.actual)) { unstable++; return; }
    // Only a different shape counts against the lab (see sameShape).
    if (!a.passed && !sameShape(t.expected, a.actual)) disagreed++;
    kept.push({ ...lab.tests[i], expected_json: JSON.stringify(a.actual) });
  });
  Object.assign(report, { passingOnReference: kept.length, disagreed, unstable, crashed });
  const failures = c1.filter(c => !c.passed).slice(0, 4).map(c => ({ name: c.name, expected: c.expected, actual: c.actual, error: c.error }));

  if (kept.length < 2) return { lab, report: { ...report, ok: false, reason: 'fewer than two test inputs give a stable result on the reference solution', failures }, failures };
  // Most of the author's own expectations contradict the solution: something
  // about this lab is wrong, even though it is now self-consistent.
  const suspect = disagreed > kept.length / 2;

  const fixed = { ...lab, tests: kept };
  if (lab.starter_code) {
    const st = await runLabWithTests({ source: lab.starter_code, language: lab.language, tests: decodeTests(kept) });
    report.starterPasses = st.tests?.passedCount ?? 0;
    report.trivial = report.starterPasses === kept.length;
  }
  return { lab: fixed, report: { ...report, suspect, ok: !report.trivial && !suspect, failures: suspect ? failures : undefined }, failures };
}

/** Write and check one module's assessment. */
export async function writeAssessment({ userId, ctx, lessons }) {
  const lessonText = lessons.map((l, i) => `## Lesson ${i + 1}: ${l.title}\nObjectives: ${(l.objectives || []).join('; ')}\n\n${l.body_md}`).join('\n\n').slice(0, 60_000);
  const brief = [
    `Course: ${ctx.courseTitle} (${ctx.level})`,
    ctx.codeLanguage && ctx.codeLanguage !== 'none' ? `Course language: ${ctx.codeLanguage}` : 'This course has no programming.',
    ctx.notation ? `Course notation: ${ctx.notation}` : null,
    `Module ${ctx.moduleIndex + 1}: ${ctx.moduleTitle}`,
    `Module objectives: ${(ctx.moduleObjectives || []).join('; ')}`,
    ctx.codeLanguage === 'python' ? `Python libraries installed on the learner's machine (labs may import only these and the standard library): ${(ctx.pythonLibraries || []).join(', ') || 'none, standard library only'}` : null,
  ].filter(Boolean).join('\n');

  const res = await complete({
    userId, agentCode: 'AS',
    schema: assessmentSchema,
    maxTokens: 12000, reasoning: 'off',
    system: ASSESSMENT_SYSTEM,
    messages: `${brief}\n\n--- THE MODULE'S LESSONS ---\n${lessonText}\n\nWrite the quiz, the lab and the graded assignment.`,
  });
  const out = res.json || {};
  const report = {};

  // Quiz: clean, then the independent examiner.
  const exam = await examineQuiz({ userId, items: cleanQuizItems(out.quiz_items), context: `${ctx.courseTitle}, ${ctx.moduleTitle}` });
  out.quiz_items = exam.items;
  report.quiz = { kept: exam.items.length, disputed: exam.disputed, examined: exam.checked };

  // Lab: run the reference solution; one repair attempt if it does not hold up.
  let checked = await validateLab(out.lab);
  if (checked.report.runnable && !checked.report.ok) {
    try {
      const fixed = (await complete({
        userId, agentCode: 'AS',
        schema: labSchema,
        maxTokens: 8000, reasoning: 'off',
        system: `${ASSESSMENT_SYSTEM}\n\nYou are fixing ONLY the lab. Its reference solution was run on its test inputs and the result did not hold up (it crashed, gave unstable results, contradicted the expected values, or the starter already solved it). Return a corrected lab: a task, a reference solution and test inputs that agree, deterministic results (seed any randomness inside the function), and a starter that does not already solve it.`,
        messages: `${brief}\n\n--- LAB ---\n${JSON.stringify(out.lab)}\n\n--- WHAT HAPPENED WHEN THE REFERENCE SOLUTION WAS RUN ---\n${checked.report.trivial ? 'The starter code already passes every test.' : checked.report.reason || 'Most expected values disagree with what the reference solution returns.'}\n${JSON.stringify(checked.failures || []).slice(0, 3000)}`,
      })).json;
      if (fixed) {
        const again = await validateLab(fixed);
        report.labRepaired = true;
        if (again.report.ok || (!checked.report.passingOnReference && again.report.passingOnReference)) checked = again;
      }
    } catch { /* keep the first attempt's verdict */ }
  }
  if (checked.report.runnable && !checked.report.ok) {
    // Better an honest written exercise than a "run tests" button that can never pass.
    checked.lab = { ...checked.lab, language: 'none', starter_code: checked.lab.starter_code || '', tests: [] };
    checked.report.downgraded = true;
  }
  out.lab = checked.lab;
  report.lab = checked.report;
  return { ...out, report };
}

export default { writeAssessment, validateLab, examineQuiz, cleanQuizItems, assessmentSchema, ASSESSMENT_SYSTEM };
