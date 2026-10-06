/**
 * Judge0 execution backend.
 *
 * The local lab runner (labRunner.js) runs the user's own code in a child
 * process; it is fine for the single-user trust model but is NOT a security
 * boundary. When JUDGE0_URL is set, code instead runs in Judge0's sandboxed
 * containers (Linux namespaces + cgroups, per-submission CPU/memory/time
 * limits), which IS a real boundary and supports many languages. This is what
 * the docker-compose stack wires up.
 *
 * Submissions use `wait=true` so Judge0 returns the result synchronously, which
 * keeps the job worker simple. Everything here degrades to the local runner if
 * JUDGE0_URL is unset or a request fails.
 */
const RAW_URL = process.env.JUDGE0_URL || '';
const JUDGE0_URL = RAW_URL.replace(/\/+$/, '');
const JUDGE0_TOKEN = process.env.JUDGE0_AUTH_TOKEN || '';

export function judge0Enabled() { return !!JUDGE0_URL; }

// Our language keys -> Judge0 CE language_ids (stable across recent 1.13.x).
const LANG_ID = { c: 50, cpp: 54, java: 62, python: 71, javascript: 63, go: 60 };

export function judge0SupportsLanguage(language) { return language in LANG_ID; }

/**
 * Run one submission through Judge0. Returns the same shape as labRunner's
 * runLab()/spawnStep() so callers can treat it interchangeably.
 */
export async function runViaJudge0({ source, language, stdin = '', timeoutMs = 5000 }) {
  const started = Date.now();
  const base = { language, stdout: '', stderr: '', exitCode: null, timedOut: false };
  const language_id = LANG_ID[language];
  if (!language_id) return { ...base, ok: false, error: `Judge0 has no language id for ${language}`, durationMs: 0 };

  const headers = { 'Content-Type': 'application/json' };
  if (JUDGE0_TOKEN) headers['X-Auth-Token'] = JUDGE0_TOKEN;

  const cpu = Math.max(1, Math.round(timeoutMs / 1000));
  try {
    const resp = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        language_id,
        source_code: String(source),
        stdin: String(stdin || ''),
        cpu_time_limit: cpu,
        wall_time_limit: cpu + 5,
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      return { ...base, ok: false, error: `Judge0 ${resp.status}: ${detail.slice(0, 200)}`, durationMs: Date.now() - started };
    }
    const d = await resp.json();
    // Judge0 status ids: 3 Accepted, 5 Time Limit Exceeded, 6 Compilation Error,
    // 7-12 various runtime errors.
    const statusId = d.status?.id;
    const timedOut = statusId === 5;
    const compileFailed = statusId === 6;
    const ok = statusId === 3;
    const stderr = [d.stderr, d.compile_output, compileFailed ? d.message : '']
      .filter(Boolean).map(String).join('\n');
    return {
      ...base,
      ok,
      stdout: String(d.stdout || ''),
      stderr,
      exitCode: typeof d.exit_code === 'number' ? d.exit_code : (ok ? 0 : 1),
      timedOut,
      durationMs: Date.now() - started,
      compileFailed,
      error: ok ? null
        : timedOut ? 'Ran longer than the limit and was stopped, check for an infinite loop.'
        : compileFailed ? 'Compilation failed, see the output below.'
        : (d.status?.description || 'Run failed'),
    };
  } catch (e) {
    return { ...base, ok: false, error: `Judge0 request failed: ${e?.message || e}`, durationMs: Date.now() - started };
  }
}

export default { judge0Enabled, judge0SupportsLanguage, runViaJudge0 };
