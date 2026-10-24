import { describe, it, expect, vi, beforeEach } from 'vitest';

// The quality pipeline is tested offline: the model is a stub, the code runner
// is real (JavaScript examples run under the same Node that runs the tests).
const replies = [];
vi.mock('../ai/llm.js', () => ({
  complete: vi.fn(async (opts) => {
    const next = replies.shift();
    if (typeof next === 'function') return next(opts);
    return next || { text: '', json: null };
  }),
}));

const { cleanLessonText, keySummary, lintLesson, writeLesson } = await import('../ai/agents/lessonWriter.js');
const { extractCodeBlocks, runLessonExamples } = await import('../ai/quality/codeCheck.js');
const { cleanQuizItems, shuffleChoices, validateLab, examineQuiz } = await import('../ai/agents/assessmentWriter.js');

const GOOD_LESSON = [
  'Why does a bigger sample give a steadier average?',
  '',
  '### The idea',
  'x'.repeat(2600),
  '',
  '> [!EXAMPLE]',
  '> Average of 2 and 4 is $3$.',
  '',
  '> [!WARNING]',
  '> A common mistake.',
  '',
  '### Try it',
  '1. Average 1 and 3.',
  '',
  '> [!SOLUTION]',
  '> It is $2$.',
  '',
  '> [!KEY]',
  '> - Averages smooth noise.',
  '> - Bigger samples are steadier.',
].join('\n');

beforeEach(() => { replies.length = 0; });

describe('lesson text cleanup', () => {
  it('unwraps a fenced answer, drops a repeated title and removes dashes', () => {
    const out = cleanLessonText('```markdown\n# Sampling\nIntro \u2014 more.\n```', 'Sampling');
    expect(out).toBe('Intro, more.');
  });

  it('restores a body stored with literal escape sequences', () => {
    expect(cleanLessonText('Line one\\nLine two', 'X')).toBe('Line one\nLine two');
  });

  it('reads the key summary for the next lesson', () => {
    expect(keySummary(GOOD_LESSON)).toBe('- Averages smooth noise. - Bigger samples are steadier.');
  });
});

describe('lesson lint', () => {
  it('passes a lesson with the required teaching parts', () => {
    expect(lintLesson(GOOD_LESSON)).toEqual([]);
  });

  it('flags missing solutions, missing summary and too many diagrams', () => {
    const bad = 'short\n```mermaid\na\n```\n```mermaid\nb\n```\n```mermaid\nc\n```';
    const issues = lintLesson(bad).join(' | ');
    expect(issues).toMatch(/too short/);
    expect(issues).toMatch(/SOLUTION/);
    expect(issues).toMatch(/KEY/);
    expect(issues).toMatch(/3 Mermaid diagrams/);
  });

  it('flags plain-text math but not LaTeX', () => {
    expect(lintLesson(GOOD_LESSON + '\nwith x_1, x_2 and R^T outside math').join(' ')).toMatch(/plain text/);
    expect(lintLesson(GOOD_LESSON + '\nwith $x_1$, $x_2$ and $R^T$')).toEqual([]);
  });
});

describe('lesson code examples', () => {
  it('finds code blocks inside callouts', () => {
    const md = 'a\n```js\nconsole.log(1)\n```\n> [!SOLUTION]\n> ```python\n> print(2)\n> ```';
    const blocks = extractCodeBlocks(md);
    expect(blocks.map(b => [b.lang, b.code])).toEqual([['js', 'console.log(1)'], ['python', 'print(2)']]);
  });

  it('runs blocks in order like a notebook and reports the one that fails', async () => {
    const md = [
      '```javascript', 'const square = (n) => n * n;', 'console.log(square(3));', '```',
      'Then use it:',
      '```javascript', 'console.log(square(4));', '```',
      'And a broken one:',
      '```javascript', 'console.log(cube(2));', '```',
      '```text', 'not run', '```',
    ].join('\n');
    const r = await runLessonExamples(md);
    expect(r.ran).toBe(3);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].error).toMatch(/cube is not defined/);
  });
});

describe('writeLesson', () => {
  it('revises a lesson whose example fails, using the real error', async () => {
    const broken = GOOD_LESSON + '\n\n```javascript\nconsole.log(total);\n```';
    const fixed = GOOD_LESSON + '\n\n```javascript\nconst total = 5;\nconsole.log(total);\n```';
    let revisePrompt = '';
    replies.push(
      { text: broken },
      { json: { pass: true, issues: [] } },
      (opts) => { revisePrompt = opts.messages; return { text: fixed }; },
    );
    const l = await writeLesson({
      userId: 'u',
      ctx: { courseTitle: 'Stats', level: 'beginner', outline: '1. Averages', moduleIndex: 0, moduleTitle: 'Averages', lessonsInModule: 1 },
      plan: { index: 0, title: 'Averages', objectives: ['Compute a mean'], concepts: ['mean'] },
    });
    expect(revisePrompt).toMatch(/total is not defined/);
    expect(l.quality.revisions).toBe(1);
    expect(l.quality.codeFailures).toEqual([]);
    expect(l.body_md).toContain('const total = 5');
  });
});

describe('quiz items', () => {
  const item = (q, answer = 0, explanation = 'Because of the mean.') => ({
    question: q, choices: ['alpha', 'beta', 'gamma', 'delta'], answer_idx: answer, explanation,
    difficulty: 'easy', skill: 's', objective: 'o',
  });

  it('shuffles choices but keeps the same correct answer', () => {
    const qs = Array.from({ length: 12 }, (_, i) => item(`Question number ${i}?`));
    const out = cleanQuizItems(qs);
    expect(out).toHaveLength(12);
    out.forEach(q => expect(q.choices[q.answer_idx]).toBe('alpha'));
    expect(new Set(out.map(q => q.answer_idx)).size).toBeGreaterThan(1);
  });

  it('leaves an item alone when its explanation points at positions', () => {
    const q = item('Which?', 0, 'The first choice is right.');
    expect(shuffleChoices(q)).toBe(q);
  });

  it('drops malformed items', () => {
    const out = cleanQuizItems([
      { ...item('Dup?'), choices: ['a', 'a', 'b', 'c'] },
      { ...item('Range?'), answer_idx: 9 },
      { ...item('Lazy?'), choices: ['a', 'b', 'c', 'All of the above'] },
      item('Fine?'),
    ]);
    expect(out.map(q => q.question)).toEqual(['Fine?']);
  });

  it('keeps items the independent examiner agrees with', async () => {
    const items = cleanQuizItems(Array.from({ length: 8 }, (_, i) => item(`Q${i} about means?`)));
    // The examiner agrees on all but item 2.
    replies.push({ json: { answers: items.map((q, n) => ({ n, answer_idx: n === 2 ? (q.answer_idx + 1) % 4 : q.answer_idx })) } });
    const r = await examineQuiz({ userId: 'u', items, context: 'Stats' });
    expect(r.disputed).toBe(1);
    expect(r.items).toHaveLength(7);
    expect(r.items.every(q => q.verification_status === 'confirmed')).toBe(true);
  });
});

describe('lab validation', () => {
  const lab = {
    title: 'Mean', description: '', steps: [], minutes: 20, language: 'javascript',
    starter_code: 'function mean(xs) {\n  // TODO\n  return 0;\n}',
    reference_solution: 'function mean(xs) {\n  return xs.reduce((a, b) => a + b, 0) / xs.length;\n}',
    tests: [
      { name: 'two', fn: 'mean', args_json: '[[2, 4]]', expected_json: '3', hidden: false },
      { name: 'three', fn: 'mean', args_json: '[[1, 2, 3]]', expected_json: '2', hidden: false },
      { name: 'wrong expectation', fn: 'mean', args_json: '[[1, 1]]', expected_json: '5', hidden: true },
    ],
  };

  it('takes expected values from the reference solution, not from the author', async () => {
    const r = await validateLab(lab);
    expect(r.report.passingOnReference).toBe(3);
    expect(r.report.disagreed).toBe(0); // a wrong number, but the right shape
    expect(r.report.ok).toBe(true);
    expect(r.lab.tests.find(t => t.name === 'wrong expectation').expected_json).toBe('1');
  });

  it('drops inputs whose result changes between runs', async () => {
    const r = await validateLab({ ...lab, reference_solution: 'function mean(xs) { return xs.length > 2 ? Math.random() : xs.reduce((a, b) => a + b, 0) / xs.length; }' });
    expect(r.report.unstable).toBe(1);
    expect(r.lab.tests.map(t => t.name)).toEqual(['two', 'wrong expectation']);
  });

  it('flags a lab whose author expectations mostly contradict its solution', async () => {
    const r = await validateLab({ ...lab, tests: lab.tests.map(t => ({ ...t, expected_json: '[1, 2]' })) });
    expect(r.report.suspect).toBe(true);
    expect(r.report.ok).toBe(false);
  });

  it('flags a starter that already passes', async () => {
    const r = await validateLab({ ...lab, starter_code: lab.reference_solution });
    expect(r.report.trivial).toBe(true);
    expect(r.report.ok).toBe(false);
  });

  it('fails a lab whose reference solution is broken', async () => {
    const r = await validateLab({ ...lab, reference_solution: 'function mean() { throw new Error("no") }' });
    expect(r.report.ok).toBe(false);
    expect(r.report.passingOnReference).toBe(0);
  });

  it('works for Python labs, including numpy-free float results', async () => {
    const r = await validateLab({
      ...lab, language: 'python',
      starter_code: 'def mean(xs):\n    return 0\n',
      reference_solution: 'def mean(xs):\n    return sum(xs) / len(xs)\n',
    });
    expect(r.report.passingOnReference).toBe(3);
    expect(r.report.ok).toBe(true);
  });
});

describe('lab grading tolerance', () => {
  it('passes a correct Python answer computed in full precision', async () => {
    const { runLabWithTests } = await import('../ai/assessment/labRunner.js');
    const src = 'import math\ndef pose(t):\n    return (math.cos(t) * 0.5, math.sin(t) * 0.5)\n';
    const r = await runLabWithTests({ source: src, language: 'python', tests: [
      { name: 'quarter turn', fn: 'pose', args: [Math.PI / 2], expected: [0, 0.5] },
      { name: 'rounded', fn: 'pose', args: [1], expected: [0.2702, 0.4207] },
      { name: 'wrong', fn: 'pose', args: [0], expected: [1, 0] },
    ] });
    expect(r.tests.cases.map(c => c.passed)).toEqual([true, true, false]);
  });

  it('passes a JavaScript float within rounding of the expected value', async () => {
    const { runLabWithTests } = await import('../ai/assessment/labRunner.js');
    const r = await runLabWithTests({ source: 'function third(x) { return x / 3; }', language: 'javascript', tests: [
      { name: 'one third', fn: 'third', args: [1], expected: 0.3333 },
      { name: 'not close', fn: 'third', args: [1], expected: 0.34 },
    ] });
    expect(r.tests.cases.map(c => c.passed)).toEqual([true, false]);
  });
});

describe('lint: practice problems stay visible', () => {
  it('flags a problem statement hidden inside its solution callout', () => {
    const hidden = GOOD_LESSON.replace('> [!SOLUTION]\n> It is $2$.', '> [!SOLUTION]\n> **Problem 1:** Average 1 and 3.\n> It is $2$.');
    expect(lintLesson(hidden).join(' ')).toMatch(/problem is hidden/);
    expect(lintLesson(GOOD_LESSON)).toEqual([]);
  });
});

describe('shown output', () => {
  it('flags an output block that is not what the code prints', async () => {
    const md = [
      '```javascript', 'console.log(2 + 2);', '```', '', '```text', '5', '```',
      'Next:', '```javascript', 'console.log([1, 2].length);', '```', '```output', '2', '```',
    ].join('\n');
    const r = await runLessonExamples(md);
    expect(r.ran).toBe(2);
    expect(r.mismatched).toHaveLength(1);
    expect(r.mismatched[0].printed).toBe('4');
  });
});
