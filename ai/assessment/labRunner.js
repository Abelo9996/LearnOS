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
const COMPILE_TIMEOUT = 25000; // compilers (and first-run toolchains) are slow

/**
 * Language definitions. Interpreted languages have only `run`; compiled ones
 * add a `compile` step that produces an artifact inside the temp dir. `file`
 * is the source filename (Java requires it to match the public class name).
 * `install` is the human hint shown when the toolchain is missing.
 */
export const LANGUAGES = {
  javascript: {
    label: 'JavaScript', file: 'main.js',
    run: (dir) => ({ cmd: process.execPath, args: [join(dir, 'main.js')] }),
    hello: 'console.log("ok")',
    install: 'Node.js is required (it runs LearnOS itself, so this should never happen).',
  },
  python: {
    label: 'Python', file: 'main.py',
    run: (dir) => ({ cmd: pythonCmd(), args: ['-I', join(dir, 'main.py')] }),
    hello: 'print("ok")',
    install: 'Install Python 3 from python.org or your package manager.',
  },
  cpp: {
    label: 'C++', file: 'main.cpp',
    compile: (dir) => ({ cmd: 'c++', args: ['-std=c++17', '-O1', '-o', join(dir, 'main'), join(dir, 'main.cpp')] }),
    run: (dir) => ({ cmd: join(dir, 'main'), args: [] }),
    hello: '#include <iostream>\nint main() { std::cout << "ok"; return 0; }',
    install: 'Install a C++ compiler: Xcode Command Line Tools on macOS (xcode-select --install), g++ on Linux.',
  },
  c: {
    label: 'C', file: 'main.c',
    compile: (dir) => ({ cmd: 'cc', args: ['-std=c11', '-O1', '-o', join(dir, 'main'), join(dir, 'main.c')] }),
    run: (dir) => ({ cmd: join(dir, 'main'), args: [] }),
    hello: '#include <stdio.h>\nint main(void) { printf("ok"); return 0; }',
    install: 'Install a C compiler: Xcode Command Line Tools on macOS (xcode-select --install), gcc on Linux.',
  },
  java: {
    label: 'Java', file: 'Main.java',
    // macOS ships a stub javac that errors with "Unable to locate a Java
    // Runtime" when no JDK is installed — that is a missing toolchain, not a
    // failure of the learner's code.
    notInstalledPattern: /Unable to locate a Java Runtime/i,
    compile: (dir) => ({ cmd: 'javac', args: [join(dir, 'Main.java')] }),
    run: (dir) => ({ cmd: 'java', args: ['-cp', dir, 'Main'] }),
    hello: 'public class Main { public static void main(String[] args) { System.out.print("ok"); } }',
    install: 'Install a JDK (e.g. Temurin from adoptium.net, or `brew install openjdk`).',
  },
  go: {
    label: 'Go', file: 'main.go',
    // `go run` compiles and runs in one step — no separate artifact to manage.
    run: (dir) => ({ cmd: 'go', args: ['run', join(dir, 'main.go')] }),
    runTimeoutMs: 20000, // includes compilation on every invocation
    hello: 'package main\n\nimport "fmt"\n\nfunc main() { fmt.Print("ok") }',
    install: 'Install Go from go.dev/dl or `brew install go`.',
  },
};

// Languages whose lab tests are I/O cases (program reads stdin, prints stdout)
// rather than function calls. See runIoTests.
export const IO_TEST_LANGUAGES = new Set(['cpp', 'c', 'java', 'go']);

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
 * Spawn one process step (argv only, never a shell string) with a hard timeout
 * and output caps. Used for both the compile and the run phase.
 */
function spawnStep({ cmd, args, cwd, timeoutMs, stdin = '', label }) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '', timedOut = false, settled = false;
    const started = Date.now();
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };

    const child = spawn(cmd, args, { cwd, windowsHide: true });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);

    child.stdout.on('data', d => { if (stdout.length < MAX_OUTPUT * 2) stdout += d; });
    child.stderr.on('data', d => { if (stderr.length < MAX_OUTPUT * 2) stderr += d; });

    child.on('error', (e) => {
      clearTimeout(timer);
      done({
        ok: false, stdout: '', stderr: '', exitCode: null, timedOut: false, durationMs: Date.now() - started,
        error: e.code === 'ENOENT'
          ? `${label} is not installed or not on PATH on this machine.`
          : `Could not start ${label}: ${e.message}`,
        notInstalled: e.code === 'ENOENT',
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      done({
        ok: !timedOut && code === 0,
        stdout: truncate(stdout),
        stderr: truncate(stderr),
        exitCode: code,
        timedOut,
        durationMs: Date.now() - started,
        error: timedOut ? `Ran longer than ${Math.round(timeoutMs / 1000)}s and was stopped — check for an infinite loop.` : null,
      });
    });

    if (stdin) { try { child.stdin.write(String(stdin)); } catch {} }
    try { child.stdin.end(); } catch {}
  });
}

/**
 * Write the source into `dir` and compile it when the language needs it.
 * Returns { ok, error?, stderr? } — on success the dir is ready to run.
 */
async function prepareDir(dir, source, language) {
  const lang = LANGUAGES[language];
  await writeFile(join(dir, lang.file), String(source), 'utf8');
  if (!lang.compile) return { ok: true };
  const step = lang.compile(dir);
  const out = await spawnStep({ ...step, cwd: dir, timeoutMs: COMPILE_TIMEOUT, label: `${lang.label} compiler (${step.cmd})` });
  if (!out.ok) {
    const stubMissing = lang.notInstalledPattern && lang.notInstalledPattern.test(`${out.stderr}\n${out.stdout}`);
    const notInstalled = out.notInstalled || stubMissing;
    return {
      ok: false,
      notInstalled,
      stderr: out.stderr,
      error: notInstalled
        ? `${lang.label} is not installed on this machine. ${lang.install}`
        : (out.error || `Compilation failed:\n${out.stderr || out.stdout}`),
      compileFailed: !notInstalled && !out.error,
    };
  }
  return { ok: true };
}

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

    const prep = await prepareDir(dir, source, language);
    if (!prep.ok) {
      return {
        ok: false, language, stdout: '', stderr: truncate(prep.stderr || ''), exitCode: null, timedOut: false,
        durationMs: Date.now() - started,
        error: prep.compileFailed ? 'Compilation failed — see the compiler output below.' : prep.error,
      };
    }

    const step = lang.run(dir);
    const out = await spawnStep({ ...step, cwd: dir, timeoutMs: lang.runTimeoutMs || timeoutMs, stdin, label: lang.label });
    return { ...out, language, durationMs: Date.now() - started, error: out.error };
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
  // I/O-tested languages grade by feeding each case's stdin to the compiled
  // program — the plain run happens as case zero, so skip the separate warm-up.
  if (IO_TEST_LANGUAGES.has(language)) {
    return runIoTests({ source, language, tests, timeoutMs });
  }

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

/**
 * Judge-style grading for compiled/system languages: compile once, then run the
 * program once per case with the case's stdin, comparing trimmed stdout to the
 * expected text. Case format reuses the standard test shape — args[0] is the
 * exact stdin, expected is the exact expected stdout.
 */
async function runIoTests({ source, language, tests, timeoutMs = DEFAULT_TIMEOUT }) {
  const lang = LANGUAGES[language];
  const list = Array.isArray(tests) ? tests.filter(t => t && t.expected !== undefined) : [];
  const base = { language, stdout: '', stderr: '', exitCode: null, timedOut: false };

  let dir;
  const started = Date.now();
  try {
    dir = await mkdtemp(join(tmpdir(), 'learnos-lab-'));
    const prep = await prepareDir(dir, source, language);
    if (!prep.ok) {
      return {
        ...base, ok: false, stderr: truncate(prep.stderr || ''), durationMs: Date.now() - started,
        error: prep.compileFailed ? 'Compilation failed — see the compiler output below.' : prep.error,
        tests: list.length ? { ok: false, error: 'Did not compile', total: list.length, passedCount: 0, score: 0, ratio: 0, passed: false, cases: [] } : null,
      };
    }

    const step = lang.run(dir);
    const runTimeout = lang.runTimeoutMs || timeoutMs;

    // The bare run (no stdin, or the first case's stdin) is what the learner
    // sees in the output panel.
    const firstStdin = list.length ? String(list[0].args?.[0] ?? '') : '';
    const firstRun = await spawnStep({ ...step, cwd: dir, timeoutMs: runTimeout, stdin: firstStdin, label: lang.label });
    const runResult = { ...base, ...firstRun, language, durationMs: Date.now() - started };

    if (!list.length) return { ...runResult, tests: null };

    const cases = [];
    let passedCount = 0;
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      const stdin = String(t.args?.[0] ?? '');
      const out = i === 0 ? firstRun : await spawnStep({ ...step, cwd: dir, timeoutMs: runTimeout, stdin, label: lang.label });
      const expected = String(t.expected ?? '').replace(/\r\n/g, '\n').trim();
      const actual = String(out.stdout ?? '').replace(/\r\n/g, '\n').trim();
      const passed = out.ok && actual === expected;
      if (passed) passedCount++;
      const entry = { name: t.name || `case ${i + 1}`, hidden: !!t.hidden, passed };
      if (!passed) {
        if (out.error) entry.error = out.error;
        else if (!out.ok) entry.error = `exited with code ${out.exitCode}${out.stderr ? ` — ${out.stderr.slice(0, 200)}` : ''}`;
      }
      if (!t.hidden) { entry.expected = expected; entry.actual = actual; }
      cases.push(entry);
    }

    const ratio = passedCount / list.length;
    return {
      ...runResult,
      durationMs: Date.now() - started,
      tests: { ok: true, error: null, total: list.length, passedCount, score: Math.round(ratio * 100), ratio, passed: ratio >= 0.8, cases },
    };
  } catch (e) {
    return { ...base, ok: false, error: e?.message || String(e), durationMs: Date.now() - started, tests: null };
  } finally {
    if (dir) rm(dir, { recursive: true, force: true }).catch(() => {});
  }
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

/**
 * Which runtimes actually work on this machine. Each language is probed with a
 * real hello-world through the full compile+run path, so "available" means it
 * genuinely works — not just that a binary exists on PATH. Probes run once and
 * are cached for the process lifetime (toolchains don't appear mid-session,
 * and compiling five hello-worlds per Settings visit would be silly).
 */
let runtimesCache = null;
export async function availableLanguages({ refresh = false } = {}) {
  if (runtimesCache && !refresh) return runtimesCache;
  const out = {};
  await Promise.all(Object.entries(LANGUAGES).map(async ([key, lang]) => {
    const probe = await runLab({ source: lang.hello, language: key, timeoutMs: 20000 });
    out[key] = {
      label: lang.label,
      available: probe.ok && /ok/.test(probe.stdout),
      reason: probe.error || null,
      install: (probe.ok && /ok/.test(probe.stdout)) ? null : lang.install,
    };
  }));
  runtimesCache = out;
  return out;
}

export default { runLab, runLabWithTests, availableLanguages, LANGUAGES };
