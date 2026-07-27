/**
 * Code-test sandbox worker.
 *
 * Runs a learner's submission in a WORKER THREAD rather than the main one. That
 * buys two things node:vm alone cannot:
 *   1. a separate V8 isolate, so the submission has no reference to the server's
 *      objects, modules or scope;
 *   2. a hard kill — the parent can terminate() this thread, which stops async
 *      hangs and event-loop starvation, not just synchronous infinite loops.
 *
 * Test cases arrive as DATA ({fn, args, expected}); nothing model-authored is
 * ever executed. Only the learner's own code runs.
 */
import { parentPort, workerData } from 'node:worker_threads';
import vm from 'node:vm';

const { source, tests, timeoutMs } = workerData;

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
const safe = (v) => { try { return JSON.parse(JSON.stringify(v)); } catch { return String(v); } };

let context;
try {
  // A null-prototype context: no require, no process, no globals from here.
  context = vm.createContext(Object.create(null));
  vm.runInContext(String(source), context, { timeout: timeoutMs });
} catch (e) {
  parentPort.postMessage({ ok: false, error: `Your code failed to run: ${e?.message || e}` });
  process.exit(0);
}

let passedCount = 0;
const cases = tests.map((t) => {
  const label = t.name || t.fn;
  try {
    if (typeof context[t.fn] !== 'function') {
      return { name: label, hidden: !!t.hidden, passed: false, error: `Expected a function named "${t.fn}"` };
    }
    const actual = vm.runInContext(
      `globalThis.__r = ${t.fn}(...${JSON.stringify(t.args ?? [])}); globalThis.__r`,
      context, { timeout: timeoutMs });
    const ok = deepEqual(actual, t.expected);
    if (ok) passedCount++;
    return t.hidden
      ? { name: label, hidden: true, passed: ok }
      : { name: label, hidden: false, passed: ok, expected: t.expected, actual: safe(actual) };
  } catch (e) {
    return { name: label, hidden: !!t.hidden, passed: false, error: e?.message || String(e) };
  }
});

parentPort.postMessage({ ok: true, error: null, passedCount, cases });
