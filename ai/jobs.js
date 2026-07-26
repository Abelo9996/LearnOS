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

let running = false;
async function drain() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const job = db.prepare("SELECT * FROM agent_jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1").get();
      if (!job) break;
      db.prepare("UPDATE agent_jobs SET status = 'running', updated_at = datetime('now') WHERE id = ?").run(job.id);
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
  } finally {
    running = false;
  }
}

// Re-pick any jobs left 'queued'/'running' from a previous process on boot.
export function resumeJobs() {
  db.prepare("UPDATE agent_jobs SET status = 'queued' WHERE status = 'running'").run();
  setImmediate(drain);
}

function parse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
