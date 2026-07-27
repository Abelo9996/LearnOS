/**
 * Grading engine — M3 of docs/MASTERY_SPEC_V2.md §3.2.
 *
 * Two tiers, matching how Coursera actually works:
 *   practice — ungraded, unlimited attempts, every answer explained
 *   graded   — attempt-limited, pass threshold, counts toward mastery/progression
 *
 * Quiz grading is deterministic (answers come from our own item bank, so no LLM
 * is involved and a score is reproducible). Programming assignments are graded
 * by running the learner's function against declared input/expected cases.
 */
import { Worker } from 'node:worker_threads';

export const DEFAULT_PASS_THRESHOLD = 0.8;
export const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Score a quiz attempt against the item bank.
 * @param {Array} items   bank rows: {id, question, choices, answer_idx, explanation}
 * @param {Array} answers learner's chosen indices, positionally aligned with items
 * @param {'practice'|'graded'} mode
 */
export function gradeQuiz(items, answers, mode = 'practice', passThreshold = DEFAULT_PASS_THRESHOLD) {
  const total = items.length;
  let correct = 0;
  const results = items.map((it, i) => {
    const chosen = Number.isInteger(answers?.[i]) ? answers[i] : null;
    const isCorrect = chosen === it.answer_idx;
    if (isCorrect) correct++;
    return {
      id: it.id,
      question: it.question,
      choices: it.choices,
      chosen,
      answer_idx: it.answer_idx,
      isCorrect,
      // Practice always teaches; graded withholds explanations until it's passed
      // (or attempts run out) so the answer key isn't handed over mid-assessment.
      explanation: mode === 'practice' ? (it.explanation || '') : null,
    };
  });
  const ratio = total ? correct / total : 0;
  return {
    total, correct,
    score: Math.round(ratio * 100),
    ratio,
    passed: mode === 'graded' ? ratio >= passThreshold : null,
    mode,
    results,
  };
}

/**
 * Run a learner's JavaScript submission against declared test cases.
 *
 * Tests are DATA, never code: {name, fn, args, expected}. Only the learner's own
 * source runs, and it runs inside a worker thread — a separate V8 isolate with
 * no reference to the server's scope, which the parent can hard-terminate. That
 * covers async hangs and event-loop starvation, which a bare vm timeout does not.
 *
 * @returns {Promise<{ok, score, ratio, passed, total, passedCount, cases, error}>}
 */
export async function runCodeTests(source, tests, { timeoutMs = 2000, passThreshold = DEFAULT_PASS_THRESHOLD } = {}) {
  const list = Array.isArray(tests) ? tests.filter(t => t && t.fn) : [];
  const fail = (error, total = list.length) => ({ ok: false, error, total, passedCount: 0, score: 0, ratio: 0, passed: false, cases: [] });

  if (!list.length) return fail('No test cases declared', 0);
  if (!source || !String(source).trim()) return fail('Empty submission');

  const workerPath = new URL('./sandbox-worker.js', import.meta.url);
  const result = await new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };

    const worker = new Worker(workerPath, { workerData: { source: String(source), tests: list, timeoutMs } });
    // Hard wall: terminate the thread outright if it overruns. `timeoutMs` is
    // per-case, so the overall budget scales with the number of cases.
    const timer = setTimeout(() => {
      worker.terminate();
      done({ ok: true, error: 'Your code timed out', passedCount: 0, cases: list.map(t => ({ name: t.name || t.fn, hidden: !!t.hidden, passed: false, error: 'Timed out' })) });
    }, timeoutMs * (list.length + 1) + 1000);

    worker.on('message', (msg) => { clearTimeout(timer); done(msg); });
    worker.on('error', (e) => { clearTimeout(timer); done({ ok: false, error: `Your code failed to run: ${e?.message || e}` }); });
    worker.on('exit', () => { clearTimeout(timer); done({ ok: false, error: 'Sandbox exited unexpectedly' }); });
  });

  if (!result.ok) return fail(result.error);

  const passedCount = result.passedCount || 0;
  const ratio = passedCount / list.length;
  return {
    ok: true, error: result.error || null,
    total: list.length, passedCount,
    score: Math.round(ratio * 100),      // V6: score == % of declared tests passed
    ratio,
    passed: ratio >= passThreshold,
    cases: result.cases || [],
  };
}

/** Score a rubric review into a single 0-1 ratio using the criteria weights. */
export function scoreRubric(rubric, scores) {
  const items = Array.isArray(rubric) ? rubric : [];
  if (!items.length) return { ratio: 0, breakdown: [] };
  const totalWeight = items.reduce((s, c) => s + (Number(c.weight) || 0), 0) || 1;
  let acc = 0;
  const breakdown = items.map((c, i) => {
    const raw = Math.max(0, Math.min(4, Number(scores?.[i]?.score ?? 0))); // 0-4 scale
    const w = (Number(c.weight) || 0) / totalWeight;
    acc += (raw / 4) * w;
    return { criterion: c.criterion, weight: w, score: raw, max: 4, justification: scores?.[i]?.justification || '' };
  });
  return { ratio: Math.max(0, Math.min(1, acc)), breakdown };
}

function safe(v) {
  try { return JSON.parse(JSON.stringify(v)); } catch { return String(v); }
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a === 'number' && typeof b === 'number') {
    return Number.isNaN(a) && Number.isNaN(b) ? true : Math.abs(a - b) < 1e-9;
  }
  if (typeof a !== 'object') return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => deepEqual(a[k], b[k]));
}

export default { gradeQuiz, runCodeTests, scoreRubric, DEFAULT_PASS_THRESHOLD, DEFAULT_MAX_ATTEMPTS };
