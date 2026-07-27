/**
 * Executable lab runner — M8 of docs/MASTERY_SPEC_V2.md.
 *
 * Hands-on practice is the single most-valued part of a Coursera program, and it
 * is the thing we most obviously faked: our labs were instructions to go and do
 * something elsewhere. This makes a lab something you actually run.
 *
 * TRUST MODEL — read before extending this.
 * LearnOS is self-hosted and single-user. The code executed here is the local
 * user's own, typed by them, on their own machine: running it is equivalent to
 * them saving the file and running it in a terminal, which is what they'd
 * otherwise do. Nothing model-authored is ever executed — generated test cases
 * are DATA ({fn, args, expected}), and generated starter code is only ever run
 * after the user has it in front of them and presses Run.
 *
 * What we still enforce: a hard timeout with process kill, output truncation, no
 * shell interpolation (argv only), and a temp working directory. What we do NOT
 * claim: this is not a container and not a security boundary against hostile
 * code. If LearnOS is ever exposed to untrusted users, this must move to a
 * sandboxed runtime (Pyodide/WASM in the browser, or a container) first.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCodeTests } from './grader.js';

const MAX_OUTPUT = 20000;      // characters of stdout/stderr kept
const DEFAULT_TIMEOUT = 5000;

export const LANGUAGES = {
  javascript: { label: 'JavaScript', ext: 'js', cmd: process.execPath, args: (f) => [f] },
  python:     { label: 'Python',     ext: 'py', cmd: pythonCmd(), args: (f) => ['-I', f] },
};

function pythonCmd() {
  // `python3` on POSIX, `python` on most Windows installs. Resolved lazily at
  // call time so a missing interpreter is reported, not thrown at import.
  return process.platform === 'win32' ? 'python' : 'python3';
}

// Node colourizes inspected values even into a pipe, which would render as
// escape-code garbage in the browser's output panel.
const stripAnsi = (s) => String(s ?? '').replace(/\[[0-9;]*m/g, '');

const truncate = (s) => {
  const t = stripAnsi(s).replace(/\r\n/g, '\n');
  return t.length > MAX_OUTPUT ? `${t.slice(0, MAX_OUTPUT)}\n… output truncated (${t.length - MAX_OUTPUT} more characters)` : t;
};

/**
 * Run a lab submission and return what the learner would see in a terminal.
 * @returns {Promise<{ok, language, stdout, stderr, exitCode, timedOut, durationMs, error}>}
 */
export async function runLab({ source, language = 'javascript', timeoutMs = DEFAULT_TIMEOUT, stdin = '' }) {
  const lang = LANGUAGES[language];
  if (!lang) return { ok: false, error: `Unsupported language: ${language}`, language, stdout: '', stderr: '', exitCode: null, timedOut: false, durationMs: 0 };
  if (!source || !String(source).trim()) return { ok: false, error: 'Nothing to run — write some code first.', language, stdout: '', stderr: '', exitCode: null, timedOut: false, durationMs: 0 };

  let dir;
  const started = Date.now();
  try {
    dir = await mkdtemp(join(tmpdir(), 'learnos-lab-'));
    const file = join(dir, `main.${lang.ext}`);
    await writeFile(file, String(source), 'utf8');

    return await new Promise((resolve) => {
      let stdout = '', stderr = '', timedOut = false, settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };

      // argv only — never a shell string, so nothing in the source or filename
      // can be interpreted as a command.
      const child = spawn(lang.cmd, lang.args(file), { cwd: dir, windowsHide: true });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      child.stdout.on('data', d => { if (stdout.length < MAX_OUTPUT * 2) stdout += d; });
      child.stderr.on('data', d => { if (stderr.length < MAX_OUTPUT * 2) stderr += d; });

      child.on('error', (e) => {
        clearTimeout(timer);
        done({
          ok: false, language, stdout: '', stderr: '', exitCode: null, timedOut: false, durationMs: Date.now() - started,
          error: e.code === 'ENOENT'
            ? `${lang.label} is not installed or not on PATH on this machine.`
            : `Could not start ${lang.label}: ${e.message}`,
        });
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        done({
          ok: !timedOut && code === 0,
          language,
          stdout: truncate(stdout),
          stderr: truncate(stderr),
          exitCode: code,
          timedOut,
          durationMs: Date.now() - started,
          error: timedOut ? `Your code ran longer than ${Math.round(timeoutMs / 1000)}s and was stopped — check for an infinite loop.` : null,
        });
      });

      if (stdin) { try { child.stdin.write(String(stdin)); } catch {} }
      try { child.stdin.end(); } catch {}
    });
  } catch (e) {
    return { ok: false, error: e?.message || String(e), language, stdout: '', stderr: '', exitCode: null, timedOut: false, durationMs: Date.now() - started };
  } finally {
    if (dir) rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Run a lab AND grade it against declared cases, when the lab has them.
 * JavaScript is graded in the existing worker sandbox (isolate + hard kill);
 * Python is graded by appending a data-driven harness that prints a verdict.
 */
export async function runLabWithTests({ source, language = 'javascript', tests, timeoutMs = DEFAULT_TIMEOUT }) {
  const run = await runLab({ source, language, timeoutMs });
  const list = Array.isArray(tests) ? tests.filter(t => t && t.fn) : [];
  if (!list.length) return { ...run, tests: null };

  if (language === 'javascript') {
    const graded = await runCodeTests(source, list, { timeoutMs });
    return { ...run, tests: graded };
  }

  if (language === 'python') {
    const graded = await runPythonTests(source, list, timeoutMs);
    // The learner's print() calls happen while their function runs — i.e. inside
    // the harness, not the bare run. Show that output, or they'd print for
    // debugging and see nothing.
    const stdout = graded.stdout != null && graded.stdout !== '' ? graded.stdout : run.stdout;
    delete graded.stdout;
    return { ...run, stdout, tests: graded };
  }

  return { ...run, tests: null };
}

// Python grading: the learner's module is imported and each case called with
// JSON-encoded args. The harness is fixed code we wrote — the only thing that
// varies is the JSON payload, so no generated string is ever executed.
async function runPythonTests(source, tests, timeoutMs) {
  const payload = JSON.stringify(tests.map(t => ({ name: t.name || t.fn, fn: t.fn, args: t.args ?? [], expected: t.expected, hidden: !!t.hidden })));
  const harness = `
${source}

import json as _json, sys as _sys
_cases = _json.loads(${JSON.stringify(payload)})
_results = []
_passed = 0
for _c in _cases:
    _entry = {"name": _c["name"], "hidden": _c["hidden"]}
    try:
        _fn = globals().get(_c["fn"])
        if not callable(_fn):
            _entry["passed"] = False
            _entry["error"] = 'Expected a function named "%s"' % _c["fn"]
        else:
            _actual = _fn(*_c["args"])
            _ok = _actual == _c["expected"]
            _entry["passed"] = bool(_ok)
            if _ok:
                _passed += 1
            if not _c["hidden"]:
                _entry["expected"] = _c["expected"]
                try:
                    _json.dumps(_actual)
                    _entry["actual"] = _actual
                except Exception:
                    _entry["actual"] = repr(_actual)
    except Exception as _e:
        _entry["passed"] = False
        _entry["error"] = str(_e)
    _results.append(_entry)
_sys.stderr.write("__LEARNOS_TESTS__" + _json.dumps({"passedCount": _passed, "cases": _results}))
`;
  const out = await runLab({ source: harness, language: 'python', timeoutMs: timeoutMs * 2 });
  const marker = (out.stderr || '').indexOf('__LEARNOS_TESTS__');
  if (marker === -1) {
    return { ok: false, error: out.error || 'Tests could not run', total: tests.length, passedCount: 0, score: 0, ratio: 0, passed: false, cases: [] };
  }
  try {
    const parsed = JSON.parse(out.stderr.slice(marker + '__LEARNOS_TESTS__'.length));
    const ratio = parsed.passedCount / tests.length;
    return { ok: true, error: null, total: tests.length, passedCount: parsed.passedCount, score: Math.round(ratio * 100), ratio, passed: ratio >= 0.8, cases: parsed.cases, stdout: out.stdout };
  } catch (e) {
    return { ok: false, error: `Could not read test results: ${e.message}`, total: tests.length, passedCount: 0, score: 0, ratio: 0, passed: false, cases: [] };
  }
}

/** Which runtimes actually work on this machine. */
export async function availableLanguages() {
  const out = {};
  for (const [key, lang] of Object.entries(LANGUAGES)) {
    const probe = await runLab({
      source: key === 'python' ? 'print("ok")' : 'console.log("ok")',
      language: key, timeoutMs: 8000,
    });
    out[key] = { label: lang.label, available: probe.ok && /ok/.test(probe.stdout), reason: probe.error || null };
  }
  return out;
}

export default { runLab, runLabWithTests, availableLanguages, LANGUAGES };
