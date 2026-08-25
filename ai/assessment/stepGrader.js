/**
 * Step grading for interactive, multi-step assignments (Phase 1).
 *
 * An assignment is an ordered list of auto-gradeable steps rather than one
 * essay box. This module owns the parts that need no LLM — normalising the
 * step list, and grading MCQ and coding steps deterministically. Coding steps
 * reuse the exact same runner the in-lesson labs use (`runLabWithTests`), so a
 * coding step is judged against real compiled/interpreted test cases, not a
 * model's opinion of the code. Short/written steps are graded by the Assessment
 * agent in assessment.js; everything here is exact arithmetic.
 *
 * Test-case format matches the lab runner exactly:
 *   - I/O languages (cpp, c, java, go): { name, args: [stdin], expected }
 *   - function languages (python, javascript): { name, fn, args: [...], expected }
 */
import { runLabWithTests, LANGUAGES } from './labRunner.js';

export const STEP_TYPES = ['mcq', 'code', 'short', 'written'];
export const CODE_LANGS = Object.keys(LANGUAGES); // python, javascript, cpp, c, java, go

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/**
 * Validate + normalise a raw steps array (from the LLM or a manual create).
 * Drops anything unusable, assigns stable ids, and guarantees the shape the
 * grader and the UI both rely on. Returns [] when nothing survives — the caller
 * treats an empty result as "fall back to the legacy essay assignment".
 */
export function normalizeSteps(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.forEach((s, i) => {
    if (!s || typeof s !== 'object') return;
    const type = STEP_TYPES.includes(s.type) ? s.type : null;
    if (!type) return;
    const prompt = typeof s.prompt === 'string' ? s.prompt.trim() : '';
    if (!prompt) return;
    const id = typeof s.id === 'string' && s.id ? s.id : `s${i + 1}`;
    const weight = Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 1;
    const base = { id, type, prompt, weight };

    if (type === 'mcq') {
      const choices = Array.isArray(s.choices) ? s.choices.filter(c => typeof c === 'string' && c.trim()).map(c => c.trim()) : [];
      if (choices.length < 2) return; // a "choice" of one isn't a question
      let answer_idx = Number.isInteger(s.answer_idx) ? s.answer_idx : 0;
      if (answer_idx < 0 || answer_idx >= choices.length) answer_idx = 0;
      out.push({ ...base, choices, answer_idx, explanation: typeof s.explanation === 'string' ? s.explanation : '' });
      return;
    }

    if (type === 'code') {
      const language = CODE_LANGS.includes(s.language) ? s.language : 'python';
      const tests = sanitizeTests(s.tests, language);
      const hidden_tests = sanitizeTests(s.hidden_tests, language);
      out.push({
        ...base, language,
        starter_code: typeof s.starter_code === 'string' ? s.starter_code : '',
        tests, hidden_tests,
      });
      return;
    }

    // short | written
    out.push({
      ...base,
      guidance: typeof s.guidance === 'string' ? s.guidance : '',
      min_words: Number.isInteger(s.min_words) && s.min_words > 0 ? s.min_words : (type === 'short' ? 20 : 80),
    });
  });
  return out;
}

// Keep only well-formed cases and coerce to the runner's shape.
function sanitizeTests(tests, language) {
  if (!Array.isArray(tests)) return [];
  const io = ['cpp', 'c', 'java', 'go'].includes(language);
  const out = [];
  tests.forEach((t, i) => {
    if (!t || typeof t !== 'object' || t.expected === undefined) return;
    if (io) {
      // stdin-driven: args[0] is the exact stdin.
      const stdin = Array.isArray(t.args) ? String(t.args[0] ?? '') : String(t.stdin ?? '');
      out.push({ name: t.name || `case ${i + 1}`, args: [stdin], expected: String(t.expected) });
    } else {
      if (!t.fn || !Array.isArray(t.args)) return;
      out.push({ name: t.name || `case ${i + 1}`, fn: String(t.fn), args: t.args, expected: t.expected });
    }
  });
  return out;
}

export function stepVisibleTests(step) { return Array.isArray(step?.tests) ? step.tests : []; }
export function stepAllTests(step) {
  return [...(Array.isArray(step?.tests) ? step.tests : []), ...(Array.isArray(step?.hidden_tests) ? step.hidden_tests : [])];
}
export function stepHasTests(step) { return stepAllTests(step).length > 0; }

/** Deterministic MCQ grade. */
export function gradeMcqStep(step, selectedIdx) {
  const idx = Number.isInteger(selectedIdx) ? selectedIdx : -1;
  const passed = idx === step.answer_idx;
  return { type: 'mcq', score: passed ? 100 : 0, passed, selectedIdx: idx, correctIdx: step.answer_idx, autograded: true };
}

/**
 * Run a coding step's source against its tests via the shared lab runner.
 * `includeHidden` is true at grade time (hidden cases count) and false for the
 * live "Run" button (learner only sees the visible cases). When a step declares
 * no tests, a clean run scores full marks and a crash scores zero.
 */
export async function gradeCodeStep(step, source, { includeHidden = false } = {}) {
  const tests = includeHidden ? stepAllTests(step) : stepVisibleTests(step);
  const res = await runLabWithTests({ source: source || step.starter_code || '', language: step.language, tests });
  const t = res.tests;
  const score = t ? (t.score ?? Math.round((t.ratio || 0) * 100)) : (res.ok ? 100 : 0);
  return {
    type: 'code', language: step.language, autograded: true,
    score, passed: t ? !!t.passed : !!res.ok,
    passedCount: t?.passedCount ?? 0, total: t?.total ?? 0,
    stdout: res.stdout ?? '', stderr: res.stderr ?? '', error: res.error || null,
    exitCode: res.exitCode ?? null, durationMs: res.durationMs ?? null,
    cases: Array.isArray(t?.cases) ? t.cases : [],
  };
}

/**
 * Compose the overall grade from per-step results as a weight-normalised
 * average of each step's 0–100 score.
 */
export function composeGrade(steps, resultsById) {
  let wsum = 0, acc = 0;
  for (const s of steps) {
    const r = resultsById[s.id];
    if (!r) continue;
    const w = s.weight > 0 ? s.weight : 1;
    wsum += w;
    acc += w * (Number.isFinite(r.score) ? r.score : 0);
  }
  return wsum > 0 ? Math.round(acc / wsum) : 0;
}
