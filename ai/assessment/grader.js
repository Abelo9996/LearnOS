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
import vm from 'node:vm';

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
 * Tests are DATA, never code: {name, fn, args, expected}. We evaluate the
 * learner's own source (which they would otherwise run themselves) in a vm with
 * no require/process access and a hard timeout, then call the named export with
 * the given args and deep-compare the result. Nothing model-authored is executed.
 *
 * Note: node:vm is an isolation convenience, not a hardened security boundary —
 * acceptable here because the code being run is the single local user's own.
 *
 * @returns {{ok, score, ratio, passed, total, passedCount, cases, error}}
 */
export function runCodeTests(source, tests, { timeoutMs = 2000, passThreshold = DEFAULT_PASS_THRESHOLD } = {}) {
  const list = Array.isArray(tests) ? tests.filter(t => t && t.fn) : [];
  if (!list.length) return { ok: false, error: 'No test cases declared', total: 0, passedCount: 0, score: 0, ratio: 0, passed: false, cases: [] };
  if (!source || !String(source).trim()) return { ok: false, error: 'Empty submission', total: list.length, passedCount: 0, score: 0, ratio: 0, passed: false, cases: [] };

  let context;
  try {
    context = vm.createContext(Object.create(null));
    vm.runInContext(String(source), context, { timeout: timeoutMs });
  } catch (e) {
    return { ok: false, error: `Your code failed to run: ${e?.message || e}`, total: list.length, passedCount: 0, score: 0, ratio: 0, passed: false, cases: [] };
  }

  let passedCount = 0;
  const cases = list.map((t) => {
    const label = t.name || t.fn;
    try {
      const fn = context[t.fn];
      if (typeof fn !== 'function') {
        return { name: label, hidden: !!t.hidden, passed: false, error: `Expected a function named "${t.fn}"` };
      }
      const actual = vm.runInContext(
        `globalThis.__r = ${t.fn}(...${JSON.stringify(t.args ?? [])}); globalThis.__r`,
        context, { timeout: timeoutMs });
      const ok = deepEqual(actual, t.expected);
      if (ok) passedCount++;
      // Hidden cases report pass/fail only — never the expected value.
      return t.hidden
        ? { name: label, hidden: true, passed: ok }
        : { name: label, hidden: false, passed: ok, expected: t.expected, actual: safe(actual) };
    } catch (e) {
      return { name: label, hidden: !!t.hidden, passed: false, error: e?.message || String(e) };
    }
  });

  const ratio = passedCount / list.length;
  return {
    ok: true, error: null,
    total: list.length, passedCount,
    score: Math.round(ratio * 100),      // V6: score == % of declared tests passed
    ratio,
    passed: ratio >= passThreshold,
    cases,
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
