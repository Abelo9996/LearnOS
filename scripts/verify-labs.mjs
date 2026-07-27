#!/usr/bin/env node
/**
 * Verifies M8 executable labs (docs/MASTERY_SPEC_V2.md §5):
 *   V18 execution    code actually runs and its output is returned
 *   V19 grading      score == % of declared cases passed, per language
 *   V20 containment  infinite loops are killed; a missing runtime is reported
 *   V21 secrecy      hidden cases never leak their expected value
 *
 *   node scripts/verify-labs.mjs
 */
import { runLab, runLabWithTests, availableLanguages } from '../ai/assessment/labRunner.js';

const results = [];
const check = (id, name, pass, detail = '') => { results.push({ id, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}${detail ? ` — ${detail}` : ''}`); };

const runtimes = await availableLanguages();
console.log(`Runtimes: ${Object.entries(runtimes).map(([k, v]) => `${k}=${v.available ? 'yes' : 'no'}`).join(', ')}\n`);

const TESTS = [
  { name: 'adds two numbers', fn: 'add', args: [2, 3], expected: 5 },
  { name: 'handles negatives', fn: 'add', args: [-2, 3], expected: 1 },
  { name: 'handles zero', fn: 'add', args: [0, 0], expected: 0 },
  { name: 'hidden case', fn: 'add', args: [10, 5], expected: 15, hidden: true },
];

const SOURCES = {
  javascript: {
    correct: 'function add(a,b){ return a+b }\nconsole.log("hello from a lab")',
    partial: 'function add(a,b){ return a>0&&b>0 ? a+b : 0 }',
    loop:    'function add(a,b){ while(true){} }',
    broken:  'function add(a,b){ return a+ }',
  },
  python: {
    correct: 'def add(a, b):\n    print("hello from a lab")\n    return a + b\n',
    partial: 'def add(a, b):\n    return a + b if a > 0 and b > 0 else 0\n',
    loop:    'def add(a, b):\n    while True:\n        pass\n',
    broken:  'def add(a, b)\n    return a + b\n',
  },
};

for (const [lang, src] of Object.entries(SOURCES)) {
  if (!runtimes[lang]?.available) {
    check(`V18-${lang}`, `${lang} runtime available`, false, runtimes[lang]?.reason || 'not installed');
    continue;
  }
  console.log(`── ${lang} ──`);

  // V18: it actually runs and returns output
  const hello = await runLab({ source: lang === 'python' ? 'print("it ran")' : 'console.log("it ran")', language: lang });
  check(`V18a-${lang}`, 'code runs and stdout is captured', hello.ok && /it ran/.test(hello.stdout), JSON.stringify(hello.stdout.trim()));
  check(`V18b-${lang}`, 'output carries no terminal escape codes', !/\[/.test(hello.stdout));

  // V19: grading is exactly % of cases passed
  const full = await runLabWithTests({ source: src.correct, language: lang, tests: TESTS });
  check(`V19a-${lang}`, 'a correct solution scores 100 and passes', full.tests.score === 100 && full.tests.passed === true, `score=${full.tests.score}`);
  check(`V19b-${lang}`, "the learner's own print output is shown", /hello from a lab/.test(full.stdout), JSON.stringify((full.stdout || '').trim().slice(0, 40)));

  const part = await runLabWithTests({ source: src.partial, language: lang, tests: TESTS });
  check(`V19c-${lang}`, 'score equals the fraction of cases passed',
    part.tests.score === Math.round((part.tests.passedCount / part.tests.total) * 100),
    `${part.tests.passedCount}/${part.tests.total} = ${part.tests.score}%`);
  check(`V19d-${lang}`, 'a partial solution does not pass', part.tests.passed === false);

  // V20: containment
  const loop = await runLabWithTests({ source: src.loop, language: lang, tests: TESTS, timeoutMs: 1200 });
  check(`V20a-${lang}`, 'an infinite loop is stopped, not left running', loop.tests.score === 0, `score=${loop.tests.score}`);
  const broken = await runLab({ source: src.broken, language: lang });
  check(`V20b-${lang}`, 'a syntax error is reported, not crashed', broken.ok === false && (!!broken.stderr || !!broken.error));

  // V21: hidden cases stay hidden
  check(`V21-${lang}`, 'hidden cases never leak their expected value',
    full.tests.cases.filter(c => c.hidden).every(c => !('expected' in c) && !('actual' in c)));
}

// Unsupported language must be refused, not attempted.
const bad = await runLab({ source: 'echo hi', language: 'bash' });
check('V20c', 'an unsupported language is refused', bad.ok === false && /unsupported/i.test(bad.error || ''));
const empty = await runLab({ source: '   ', language: 'javascript' });
check('V20d', 'an empty submission is refused before spawning anything', empty.ok === false && /nothing to run/i.test(empty.error || ''));

const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} lab checks passed.`);
process.exit(failed ? 1 : 0);
