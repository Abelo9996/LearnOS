/**
 * Runs the code examples in a generated lesson and reports which ones fail.
 *
 * A lesson that teaches with code is only as good as its code. Generated
 * examples used to ship unrun: a class missing a method, a numpy call with the
 * wrong argument order, an example whose printed "output" it could never print.
 * Each runnable block (Python and JavaScript) is executed in the lab runner's
 * sandbox; failures go back to the reviser with the real traceback.
 *
 * Blocks that cannot run here for reasons that are not the lesson's fault (a
 * library this machine does not have, code that waits for input, a plotting
 * window) are reported as skipped, never as failures.
 */
import { runLab } from '../assessment/labRunner.js';

const RUNNABLE = {
  python: 'python', py: 'python', python3: 'python',
  javascript: 'javascript', js: 'javascript', node: 'javascript',
};

/** Fenced code blocks in Markdown, with their language and position. */
export function extractCodeBlocks(md) {
  const out = [];
  // Code inside a callout carries the blockquote's "> " prefix on every line.
  const lines = String(md || '').split('\n').map(l => l.replace(/^\s*(?:>\s?)+/, ''));
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(/^\s*```([\w+-]*)\s*$/);
    if (!open) continue;
    const lang = (open[1] || '').toLowerCase();
    const start = i;
    const code = [];
    i++;
    while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { code.push(lines[i]); i++; }
    out.push({ lang, code: code.join('\n'), line: start + 1 });
  }
  return out;
}

const MISSING_MODULE = /ModuleNotFoundError|No module named|Cannot find module|ERR_MODULE_NOT_FOUND/;
const NEEDS_INPUT = /\binput\s*\(|readline\(|process\.stdin|sys\.stdin/;

/**
 * Run every runnable example in a lesson.
 * @returns {Promise<{ran:number, failed:Array<{line,lang,error}>, skipped:Array<{line,lang,reason}>}>}
 */
export async function runLessonExamples(md, { timeoutMs = 10_000, maxBlocks = 8 } = {}) {
  const blocks = extractCodeBlocks(md).filter(b => RUNNABLE[b.lang] && b.code.trim());
  const failed = [];
  const skipped = [];
  let ran = 0;
  // A lesson's blocks share one session, like a notebook: the reader's Run
  // button executes them in the same Python runtime, so a later block may use
  // what an earlier one defined. Each block is checked with the earlier blocks
  // of its language (the ones that ran cleanly) in front of it.
  const session = { python: [], javascript: [] };
  for (const b of blocks.slice(0, maxBlocks)) {
    const language = RUNNABLE[b.lang];
    if (NEEDS_INPUT.test(b.code)) { skipped.push({ line: b.line, lang: language, reason: 'reads input' }); continue; }
    const prelude = session[language].join('\n\n');
    let source = prelude ? `${prelude}\n\n${b.code}` : b.code;
    // Plots should render off-screen rather than try to open a window.
    if (language === 'python' && /matplotlib/.test(source)) source = `import matplotlib\nmatplotlib.use("Agg")\n${source}`;
    const r = await runLab({ source, language, timeoutMs });
    const text = `${r.stderr || ''}\n${r.error || ''}`.trim();
    if (r.ok) { ran++; session[language].push(b.code); continue; }
    if (MISSING_MODULE.test(text)) { skipped.push({ line: b.line, lang: language, reason: 'library not installed here' }); continue; }
    if (r.error && /not installed|Install Python|Install Node/i.test(r.error)) { skipped.push({ line: b.line, lang: language, reason: 'runtime not available' }); continue; }
    ran++;
    failed.push({
      line: b.line,
      lang: language,
      error: r.timedOut ? `Timed out after ${Math.round(timeoutMs / 1000)}s` : lastLines(text, 12) || `exit code ${r.exitCode}`,
    });
  }
  return { ran, failed, skipped };
}

function lastLines(s, n) {
  return String(s || '').trim().split('\n').slice(-n).join('\n');
}

export default { extractCodeBlocks, runLessonExamples };
