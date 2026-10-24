/**
 * Minimal in-process async job runner (PLAT-06).
 * Long agent work (roadmap generation, node-content assembly) is enqueued and
 * processed in the background so HTTP requests return a jobId immediately.
 * Scale path: swap the in-process worker for a real queue when moving off SQLite.
 */
import db from '../db/database.js';

const handlers = new Map();

export function registerJobHandler(kind, fn) { handlers.set(kind, fn); }

export function enqueueJob(userId, kind, input) {
  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.prepare('INSERT INTO agent_jobs (id, user_id, kind, input_json, status) VALUES (?, ?, ?, ?, ?)')
    .run(id, userId, kind, JSON.stringify(input ?? {}), 'queued');
  setImmediate(drain);
  return id;
}

export function getJob(id, userId) {
  const j = db.prepare('SELECT * FROM agent_jobs WHERE id = ? AND user_id = ?').get(id, userId);
  if (!j) return null;
  return { id: j.id, kind: j.kind, status: j.status, error: j.error, created_at: j.created_at, updated_at: j.updated_at, result: parse(j.result_json), progress: j.progress ?? null, progress_msg: j.progress_msg ?? null };
}

// Long multi-stage jobs (e.g. staged course generation) report progress so the
// UI can show real movement instead of an indefinite spinner.
export function setJobProgress(jobId, pct, msg) {
  try {
    db.prepare("UPDATE agent_jobs SET progress = ?, progress_msg = ?, updated_at = datetime('now') WHERE id = ?")
      .run(typeof pct === 'number' ? Math.max(0, Math.min(1, pct)) : null, msg || null, jobId);
  } catch { /* progress is best-effort, never fails the job */ }
}

// Two lanes. Course builds take minutes and run one at a time; everything
// else (grading a submission, finding resources, analysing a session) is
// short and must not wait behind them: a single serial queue left a learner's
// assignment ungraded for the ten minutes a course build took.
const HEAVY = ['build-course', 'enrich-course', 'build-pathway-course', 'plan-specialization'];
const LANES = {
  heavy: { limit: 1, active: 0, where: `kind IN (${HEAVY.map(() => '?').join(',')})` },
  light: { limit: 3, active: 0, where: `kind NOT IN (${HEAVY.map(() => '?').join(',')})` },
};

function drain() {
  for (const lane of Object.values(LANES)) {
    while (lane.active < lane.limit) {
      const job = db.prepare(`SELECT * FROM agent_jobs WHERE status = 'queued' AND ${lane.where} ORDER BY created_at LIMIT 1`).get(...HEAVY);
      if (!job) break;
      // Claim it before anything awaits, so a second drain cannot take it too.
      db.prepare("UPDATE agent_jobs SET status = 'running', updated_at = datetime('now') WHERE id = ?").run(job.id);
      lane.active++;
      run(job).finally(() => { lane.active--; setImmediate(drain); });
    }
  }
}

async function run(job) {
  try {
    const fn = handlers.get(job.kind);
    if (!fn) throw new Error(`No handler registered for job kind: ${job.kind}`);
    const result = await fn({ userId: job.user_id, input: parse(job.input_json), jobId: job.id });
    db.prepare("UPDATE agent_jobs SET status = 'done', result_json = ?, updated_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(result ?? {}), job.id);
  } catch (e) {
    db.prepare("UPDATE agent_jobs SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?")
      .run(e?.message || String(e), job.id);
  }
}

// Re-pick any jobs left 'queued'/'running' from a previous process on boot.
export function resumeJobs() {
  db.prepare("UPDATE agent_jobs SET status = 'queued' WHERE status = 'running'").run();
  setImmediate(drain);
}

function parse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
