/**
 * LearnOS Database Layer
 * SQLite via better-sqlite3 — synchronous, fast, zero-config.
 * Handles connection, schema creation, and provides a shared db instance.
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', 'db', 'learnos.db');
const SCHEMA_PATH = join(__dirname, 'schema.sql');
const SEED_PATH = join(__dirname, 'seed.sql');

// Ensure db directory exists
const dbDir = dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema if tables don't exist
function initSchema() {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
}

// Example content (roadmaps, courses, community, …) seeds by default so a fresh
// clone shows a populated workspace. Set LEARNOS_SEED=0 for a true zero-seed run:
// an empty database that boots into honest cold-start empty states with no
// founder-supplied example data.
const SEED_ENABLED = !['0', 'false', 'no', 'off'].includes(String(process.env.LEARNOS_SEED ?? '').toLowerCase());

// Agent registry = app CONFIG, not example content — the 7 agents must exist for
// the Agents page and routing to work even in zero-seed mode. Idempotent, always
// run. status_text is intentionally empty: real per-agent status isn't tracked,
// so we never fabricate a live telemetry string here. is_active reflects which
// agents are actually wired to a code path (CE/Certification has none yet).
function ensureAgentStatus() {
  const AGENTS = [
    ['TU', 'Tutor',         'Teaches concepts, answers questions, explains deeply.', '--agent-tu', 'cap',    1],
    ['PR', 'Profiling',     'Understands you — your goals, pace, background.',        '--agent-pr', 'user',   1],
    ['CR', 'Curriculum',    'Creates personalized roadmaps and learning paths.',     '--agent-cr', 'graph',  1],
    ['AS', 'Assessment',    'Generates quizzes and evaluates mastery.',              '--agent-as', 'check',  1],
    ['RE', 'Research',      'Finds, summarizes, and cites the best resources.',      '--agent-re', 'search', 1],
    ['AN', 'Analytics',     'Tracks progress and surfaces insights.',                '--agent-an', 'chart',  1],
    ['CE', 'Certification', 'Issues verifiable certificates and badges.',            '--agent-ce', 'ribbon', 0],
  ];
  const stmt = db.prepare("INSERT OR IGNORE INTO agent_status (agent_code, display_name, short_desc, color, icon, status_text, is_active) VALUES (?, ?, ?, ?, ?, '', ?)");
  for (const [code, name, desc, color, icon, active] of AGENTS) stmt.run(code, name, desc, color, icon, active);
}

// Seed example content if tables are empty (and seeding is enabled).
function seedIfEmpty() {
  if (!SEED_ENABLED) return;
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (count.c === 0) {
    const seed = fs.readFileSync(SEED_PATH, 'utf-8');
    db.exec(seed);
  }
}

initSchema();

// Migration: add auth columns to existing DBs (silently ignored if already present)
try { db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'"); } catch {}
try { db.exec("CREATE TABLE IF NOT EXISTS revoked_tokens (jti TEXT PRIMARY KEY, expires_at TEXT NOT NULL)"); } catch {}

// Community tables must exist before the example seed (which now populates them
// from db/seed.sql) runs.
try {
  db.exec("CREATE TABLE IF NOT EXISTS community_threads (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, body TEXT, tag TEXT DEFAULT 'question', votes INTEGER DEFAULT 0, replies_count INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))");
  db.exec("CREATE TABLE IF NOT EXISTS community_replies (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES community_threads(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))");
  db.exec("CREATE TABLE IF NOT EXISTS community_votes (user_id TEXT NOT NULL REFERENCES users(id), thread_id TEXT NOT NULL REFERENCES community_threads(id) ON DELETE CASCADE, value INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (user_id, thread_id))");
  db.exec("CREATE INDEX IF NOT EXISTS idx_comm_threads_user ON community_threads(user_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_comm_replies_thread ON community_replies(thread_id)");
} catch (e) { console.log('Community migration:', e.message); }

// Course syllabus tables must also exist before the seed, which now ships real
// modules + lessons for the catalog courses.
try {
  db.exec(`CREATE TABLE IF NOT EXISTS course_modules (
    id TEXT PRIMARY KEY,
    course_slug TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    order_idx INTEGER DEFAULT 0,
    estimated_minutes INTEGER DEFAULT 45,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS module_lessons (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body_md TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'reading',
    order_idx INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
} catch (e) { console.log('Course module pre-migration:', e.message); }
// Resource lessons carry the external URL directly so the lesson viewer can
// embed videos / render rich resource cards instead of parsing markdown.
try { db.exec("ALTER TABLE module_lessons ADD COLUMN url TEXT"); } catch {}

// ── M1: Coursera-grade content model (docs/MASTERY_SPEC_V2.md §3.1) ──────────
// Coursera puts a time estimate on *every* item ("Video: 8 min", "Quiz: 30 min")
// and separates ungraded practice from graded, attempt-limited assessment. These
// columns make our lessons carry the same metadata so a syllabus can be honest
// about what it costs and what actually counts.
try { db.exec("ALTER TABLE module_lessons ADD COLUMN estimated_minutes INTEGER"); } catch {}
try { db.exec("ALTER TABLE module_lessons ADD COLUMN is_graded INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE module_lessons ADD COLUMN is_optional INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE module_lessons ADD COLUMN pass_threshold REAL"); } catch {}
try { db.exec("ALTER TABLE module_lessons ADD COLUMN max_attempts INTEGER"); } catch {}

// Module objectives become first-class (they only existed on roadmap nodes), so
// every module can state measurable outcomes the way Coursera modules do.
try { db.exec("ALTER TABLE course_modules ADD COLUMN objectives TEXT"); } catch {}

// Course-level framing: what you can DO after, what you need first, skills tracked.
try { db.exec("ALTER TABLE courses ADD COLUMN outcomes TEXT"); } catch {}
try { db.exec("ALTER TABLE courses ADD COLUMN prerequisites TEXT"); } catch {}
try { db.exec("ALTER TABLE courses ADD COLUMN skills TEXT"); } catch {}
try { db.exec("ALTER TABLE courses ADD COLUMN level TEXT"); } catch {}

// Assessment config for assignments: auto-graded programming test cases, the
// pass bar, and how many attempts a learner gets.
try { db.exec("ALTER TABLE assignments ADD COLUMN tests_json TEXT"); } catch {}
try { db.exec("ALTER TABLE assignments ADD COLUMN rubric_json TEXT"); } catch {}
try { db.exec("ALTER TABLE assignments ADD COLUMN pass_threshold REAL"); } catch {}
try { db.exec("ALTER TABLE assignments ADD COLUMN max_attempts INTEGER"); } catch {}

// ── M10: retention (spec §3.7) ──────────────────────────────────────────────
// Passing an assessment once is not mastery. Coursera does not solve this
// either — a certificate records that you could do something in March, not that
// you can do it in September. We track when a node was last practised so
// retention can decay, and link auto-generated review cards back to the item
// that caught the gap.
try { db.exec("ALTER TABLE roadmap_nodes ADD COLUMN last_practiced_at TEXT"); } catch {}
try { db.exec("ALTER TABLE flashcards ADD COLUMN source_item_id TEXT"); } catch {}
try { db.exec("ALTER TABLE flashcards ADD COLUMN source_module_id TEXT"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_flashcards_source ON flashcards(source_item_id)"); } catch {}

// ── M8: executable labs (spec §3.6) ─────────────────────────────────────────
// Hands-on practice is the most-valued part of a Coursera program and was the
// thing we most obviously faked — our labs were instructions to go do something
// elsewhere. A lab now carries runnable starter code and its own test cases.
try { db.exec("ALTER TABLE module_lessons ADD COLUMN lab_language TEXT"); } catch {}
try { db.exec("ALTER TABLE module_lessons ADD COLUMN starter_code TEXT"); } catch {}
try { db.exec("ALTER TABLE module_lessons ADD COLUMN lab_tests_json TEXT"); } catch {}

// ── M7: factual grounding & accuracy (spec §3.5) ────────────────────────────
// We now generate content at volume, and depth floors measure quantity, not
// truth. A course of 116 confidently-wrong lessons is worse than 6 shallow
// correct ones, and correctness is the one axis where expert-authored material
// decisively beats generated material. Every quiz item therefore carries a
// verification state, and anything disputed or reported is kept out of graded
// assessment until it is resolved.
try { db.exec("ALTER TABLE quiz_items ADD COLUMN verification_status TEXT DEFAULT 'unverified'"); } catch {}
try { db.exec("ALTER TABLE quiz_items ADD COLUMN verification_note TEXT"); } catch {}
try { db.exec("ALTER TABLE quiz_items ADD COLUMN verified_at TEXT"); } catch {}
// Which verified sources a generated lesson was grounded in, so a learner can
// check the claim rather than trusting it.
try { db.exec("ALTER TABLE module_lessons ADD COLUMN sources_json TEXT"); } catch {}

// Learner-reported errors. The person doing the course is the last line of
// defence against a plausible-sounding mistake.
try {
  db.exec(`CREATE TABLE IF NOT EXISTS content_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    target_type TEXT NOT NULL,      -- 'quiz_item' | 'lesson'
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL,           -- 'wrong_answer' | 'factual_error' | 'unclear' | 'dead_link' | 'other'
    detail TEXT,
    status TEXT NOT NULL DEFAULT 'open',   -- open | resolved | dismissed
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_content_reports_target ON content_reports(target_type, target_id)");
} catch (e) { console.log('content_reports migration:', e.message); }

// ── M4: specialization roadmaps (spec §3.3) ─────────────────────────────────
// A Coursera Specialization sequences 3-6 whole COURSES into one credential.
// Ours must do the same: a roadmap is a pathway from the learner's measured
// starting point (A) to their stated goal (B), whose nodes can be entire courses
// rather than single modules.
try { db.exec("ALTER TABLE roadmaps ADD COLUMN kind TEXT DEFAULT 'course'"); } catch {}
try { db.exec("ALTER TABLE roadmaps ADD COLUMN goal TEXT"); } catch {}
try { db.exec("ALTER TABLE roadmaps ADD COLUMN placement_json TEXT"); } catch {}
try { db.exec("ALTER TABLE roadmap_nodes ADD COLUMN node_kind TEXT DEFAULT 'module'"); } catch {}
try { db.exec("ALTER TABLE roadmap_nodes ADD COLUMN skills TEXT"); } catch {}
try { db.exec("ALTER TABLE roadmap_nodes ADD COLUMN course_topic TEXT"); } catch {}
try { db.exec("ALTER TABLE roadmap_nodes ADD COLUMN build_status TEXT"); } catch {}

// ── M3: two-tier assessment (spec §3.2) ─────────────────────────────────────
// Coursera separates ungraded practice (unlimited attempts, explanations shown)
// from graded assessment (attempt-limited, pass threshold, counts toward
// progression). quiz_attempts needs to know which it was, which module/lesson it
// belonged to, which attempt number it is, and whether it passed.
try { db.exec("ALTER TABLE quiz_attempts ADD COLUMN module_id TEXT"); } catch {}
try { db.exec("ALTER TABLE quiz_attempts ADD COLUMN lesson_id TEXT"); } catch {}
try { db.exec("ALTER TABLE quiz_attempts ADD COLUMN course_slug TEXT"); } catch {}
try { db.exec("ALTER TABLE quiz_attempts ADD COLUMN mode TEXT DEFAULT 'practice'"); } catch {}
try { db.exec("ALTER TABLE quiz_attempts ADD COLUMN attempt_no INTEGER DEFAULT 1"); } catch {}
try { db.exec("ALTER TABLE quiz_attempts ADD COLUMN passed INTEGER DEFAULT 0"); } catch {}

// Staged course generation is long-running (one LLM call per module), so jobs
// report incremental progress instead of looking hung.
try { db.exec("ALTER TABLE agent_jobs ADD COLUMN progress REAL"); } catch {}
try { db.exec("ALTER TABLE agent_jobs ADD COLUMN progress_msg TEXT"); } catch {}

// Item bank — questions persist per module/skill so retakes aren't identical and
// spaced review can draw from the same pool.
try {
  db.exec(`CREATE TABLE IF NOT EXISTS quiz_items (
    id TEXT PRIMARY KEY,
    course_slug TEXT,
    module_id TEXT,
    lesson_id TEXT,
    node_id TEXT,
    question TEXT NOT NULL,
    choices_json TEXT NOT NULL,
    answer_idx INTEGER NOT NULL,
    explanation TEXT,
    difficulty TEXT DEFAULT 'medium',
    skill TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_quiz_items_module ON quiz_items(module_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_quiz_items_course ON quiz_items(course_slug)");
} catch (e) { console.log('quiz_items migration:', e.message); }

// In-lesson retrieval practice — Coursera poses questions mid-lecture and answers
// them in the next video; we attach them to the lesson at a position.
try {
  db.exec(`CREATE TABLE IF NOT EXISTS lesson_checkpoints (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    question TEXT NOT NULL,
    choices_json TEXT,
    answer_idx INTEGER,
    explanation TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_lesson_checkpoints ON lesson_checkpoints(lesson_id)");
} catch (e) { console.log('lesson_checkpoints migration:', e.message); }

ensureAgentStatus();  // app config — always present, even in zero-seed mode
seedIfEmpty();         // example content (roadmaps, courses, demo members, community) from seed.sql

// Demo community members + their threads/replies now live in db/seed.sql as
// real database rows (applied by seedIfEmpty above) — no hardcoded seed arrays.

// ── Migration: Streak tracking ───────────────────────────────────────────────
try { db.exec("ALTER TABLE users ADD COLUMN last_activity_date TEXT"); } catch {}

// ── Migration: AI platform layer (Phase 1) ──────────────────────────────────
try {
  db.exec(`CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    agent_code TEXT,
    model TEXT,
    provider TEXT DEFAULT 'anthropic',
    managed INTEGER DEFAULT 1,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_write_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ok',
    error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_agent_runs_user ON agent_runs(user_id, created_at)");
  db.exec(`CREATE TABLE IF NOT EXISTS agent_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    input_json TEXT,
    status TEXT DEFAULT 'queued',
    result_json TEXT,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_agent_jobs_status ON agent_jobs(status, created_at)");
  db.exec(`CREATE TABLE IF NOT EXISTS usage_counters (
    user_id TEXT NOT NULL,
    period TEXT NOT NULL,
    tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    requests INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, period)
  )`);
} catch (e) { console.log('AI platform migration:', e.message); }

// ── Migration: Phase 2 — profiles & curriculum ──────────────────────────────
try {
  db.exec(`CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    goal TEXT,
    background TEXT,
    level TEXT DEFAULT 'beginner',
    time_per_week INTEGER DEFAULT 5,
    learning_style TEXT,
    motivations TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS node_objectives (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    roadmap_id TEXT,
    text TEXT NOT NULL,
    order_idx INTEGER DEFAULT 0
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_node_objectives ON node_objectives(node_id)");
  try { db.exec("ALTER TABLE roadmaps ADD COLUMN course_slug TEXT"); } catch {}
} catch (e) { console.log('Phase 2 migration:', e.message); }

// ── Backfill: give shell roadmaps real nodes (#2) ────────────────────────────
// rm-data-sci and rm-genai were seeded with module counts but no actual nodes,
// so switching to them showed an empty graph and Resume did nothing. Populate
// them with topic DAGs (idempotent — only runs when a roadmap has zero nodes).
function backfillRoadmap(roadmapId, nodes, edges) {
  try {
    const exists = db.prepare('SELECT 1 FROM roadmaps WHERE id = ?').get(roadmapId);
    if (!exists) return;
    const nodeCount = db.prepare('SELECT COUNT(*) c FROM roadmap_nodes WHERE roadmap_id = ?').get(roadmapId).c;
    if (nodeCount > 0) return;
    const tx = db.transaction(() => {
      for (const n of nodes) {
        db.prepare('INSERT INTO roadmap_nodes (id, roadmap_id, title, col, row_idx, mastery, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(n.id, roadmapId, n.title, n.col, n.row, n.mastery, n.status);
        (n.objectives || []).forEach((o, i) =>
          db.prepare('INSERT INTO node_objectives (id, node_id, roadmap_id, text, order_idx) VALUES (?, ?, ?, ?, ?)')
            .run(`${n.id}-o${i}`, n.id, roadmapId, o, i));
      }
      for (const [a, b] of edges) {
        db.prepare('INSERT INTO roadmap_edges (roadmap_id, from_node, to_node) VALUES (?, ?, ?)').run(roadmapId, a, b);
      }
      const done = nodes.filter(n => n.status === 'done').length;
      db.prepare('UPDATE roadmaps SET total_modules = ?, completed_modules = ? WHERE id = ?').run(nodes.length, done, roadmapId);
    });
    tx();
    console.log(`Backfilled roadmap ${roadmapId} with ${nodes.length} nodes`);
  } catch (e) { console.log('Roadmap backfill', roadmapId, e.message); }
}
backfillRoadmap('rm-data-sci', [
  { id: 'ds1', title: 'Descriptive statistics', col: 0, row: 0, mastery: 1.0,  status: 'done',   objectives: ['Summarize data with mean, median, variance', 'Read and build histograms & box plots'] },
  { id: 'ds2', title: 'Probability basics',     col: 1, row: 0, mastery: 1.0,  status: 'done',   objectives: ['Apply conditional probability & Bayes', 'Reason about independence'] },
  { id: 'ds3', title: 'Distributions',          col: 1, row: 1, mastery: 0.9,  status: 'done',   objectives: ['Recognize normal, binomial, Poisson', 'Use the central limit theorem'] },
  { id: 'ds4', title: 'Data wrangling',         col: 2, row: 0, mastery: 0.85, status: 'done',   objectives: ['Clean and reshape tabular data', 'Handle missing values'] },
  { id: 'ds5', title: 'Exploratory analysis',   col: 2, row: 1, mastery: 0.8,  status: 'done',   objectives: ['Find patterns with visualization', 'Quantify correlation'] },
  { id: 'ds6', title: 'Hypothesis Testing',     col: 3, row: 0, mastery: 0.45, status: 'active', objectives: ['Frame null & alternative hypotheses', 'Interpret p-values and significance'] },
  { id: 'ds7', title: 'Regression analysis',    col: 3, row: 1, mastery: 0.2,  status: 'next',   objectives: ['Fit and read linear regression', 'Check model assumptions'] },
  { id: 'ds8', title: 'A/B testing',            col: 4, row: 0, mastery: 0,    status: 'locked', objectives: ['Design a controlled experiment', 'Compute required sample size'] },
  { id: 'ds9', title: 'Intro to ML',            col: 4, row: 1, mastery: 0,    status: 'locked', objectives: ['Distinguish supervised vs unsupervised', 'Train your first model'] },
], [['ds1','ds2'],['ds2','ds3'],['ds2','ds4'],['ds3','ds5'],['ds4','ds5'],['ds5','ds6'],['ds5','ds7'],['ds6','ds8'],['ds7','ds8'],['ds7','ds9']]);
backfillRoadmap('rm-genai', [
  { id: 'ga1', title: 'LLM fundamentals',          col: 0, row: 0, mastery: 1.0,  status: 'done',   objectives: ['Explain how transformers predict tokens', 'Describe context windows'] },
  { id: 'ga2', title: 'Tokenization & embeddings', col: 1, row: 0, mastery: 0.9,  status: 'done',   objectives: ['Understand tokens vs words', 'Use embeddings for similarity'] },
  { id: 'ga3', title: 'Prompt Engineering',        col: 1, row: 1, mastery: 0.32, status: 'active', objectives: ['Write clear, structured prompts', 'Control output with system prompts'] },
  { id: 'ga4', title: 'Few-shot & chain-of-thought',col: 2, row: 0, mastery: 0.1, status: 'next',   objectives: ['Use examples to steer behavior', 'Elicit step-by-step reasoning'] },
  { id: 'ga5', title: 'RAG basics',                col: 2, row: 1, mastery: 0,    status: 'locked', objectives: ['Retrieve context for grounding', 'Reduce hallucination with sources'] },
  { id: 'ga6', title: 'Vector databases',          col: 3, row: 0, mastery: 0,    status: 'locked', objectives: ['Index and query embeddings', 'Tune retrieval quality'] },
  { id: 'ga7', title: 'Agents & tools',            col: 3, row: 1, mastery: 0,    status: 'locked', objectives: ['Give a model tools to call', 'Orchestrate multi-step tasks'] },
  { id: 'ga8', title: 'Fine-tuning',               col: 4, row: 0, mastery: 0,    status: 'locked', objectives: ['Know when to fine-tune vs prompt', 'Prepare a training dataset'] },
], [['ga1','ga2'],['ga2','ga3'],['ga3','ga4'],['ga3','ga5'],['ga4','ga6'],['ga5','ga6'],['ga5','ga7'],['ga6','ga8'],['ga7','ga8']]);

// Clean up roadmaps created by the now-removed fork feature (#3).
try { db.prepare("DELETE FROM roadmaps WHERE id LIKE 'rm-fork-%'").run(); } catch {}

// ── Migration: Community media + references (#23) ────────────────────────────
try {
  try { db.exec("ALTER TABLE community_threads ADD COLUMN image_url TEXT"); } catch {}
  try { db.exec("ALTER TABLE community_threads ADD COLUMN ref_type TEXT"); } catch {} // 'course' | 'roadmap'
  try { db.exec("ALTER TABLE community_threads ADD COLUMN ref_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE community_threads ADD COLUMN ref_label TEXT"); } catch {}
} catch (e) { console.log('Community media migration:', e.message); }

// ── Migration: Richer assignments (#11) ──────────────────────────────────────
// Assignments can be coding projects, homeworks, quizzes, or analyses, each with
// a description and a concrete task checklist.
try {
  try { db.exec("ALTER TABLE assignments ADD COLUMN kind TEXT DEFAULT 'homework'"); } catch {}
  try { db.exec("ALTER TABLE assignments ADD COLUMN description TEXT"); } catch {}
  try { db.exec("ALTER TABLE assignments ADD COLUMN tasks TEXT DEFAULT '[]'"); } catch {}
} catch (e) { console.log('Assignment detail migration:', e.message); }

// ── Migration: node_resources (G2.A) ─────────────────────────────────────────
// External, verified learning content attached to a roadmap node — YT videos,
// articles, papers, docs, repos. RE agent proposes (status='proposed');
// the verifier job confirms reachability and flips to 'verified'.
try {
  db.exec(`CREATE TABLE IF NOT EXISTS node_resources (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    roadmap_id TEXT,
    kind TEXT NOT NULL DEFAULT 'article',
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT,
    summary TEXT,
    status TEXT NOT NULL DEFAULT 'proposed',
    verified_at TEXT,
    verified_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_node_resources_node ON node_resources(node_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_node_resources_status ON node_resources(status)");
} catch (e) { console.log('node_resources migration:', e.message); }

// Seed verified resources for the modules a learner is likely to open first.
// These are stable, well-known URLs — kept few-per-node on purpose. Idempotent.
function seedNodeResources(rows) {
  for (const r of rows) {
    try {
      const exists = db.prepare('SELECT 1 FROM node_resources WHERE node_id = ? AND url = ?').get(r.node_id, r.url);
      if (exists) continue;
      db.prepare(`INSERT INTO node_resources (id, node_id, roadmap_id, kind, title, url, source, summary, status, verified_at, verified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'verified', datetime('now'), 'seed')`)
        .run(`nr-${Math.random().toString(36).slice(2, 10)}`, r.node_id, r.roadmap_id, r.kind, r.title, r.url, r.source, r.summary || null);
    } catch (e) { /* skip */ }
  }
}
seedNodeResources([
  // Generative AI Mastery — Prompt Engineering (ga3, the "active" module)
  { node_id: 'ga3', roadmap_id: 'rm-genai', kind: 'docs',    title: 'Anthropic — Prompt engineering overview', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview', source: 'docs.anthropic.com', summary: 'Canonical guide to writing structured prompts.' },
  { node_id: 'ga3', roadmap_id: 'rm-genai', kind: 'docs',    title: 'OpenAI — Prompt engineering guide',        url: 'https://platform.openai.com/docs/guides/prompt-engineering', source: 'platform.openai.com', summary: 'Patterns and examples across major prompt styles.' },
  { node_id: 'ga3', roadmap_id: 'rm-genai', kind: 'article', title: 'Lilian Weng — Prompt Engineering',          url: 'https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/', source: 'lilianweng.github.io', summary: 'Survey of prompting techniques with citations.' },
  { node_id: 'ga3', roadmap_id: 'rm-genai', kind: 'video',   title: 'Andrej Karpathy — Intro to LLMs',           url: 'https://www.youtube.com/watch?v=zjkBMFhNj_g', source: 'YouTube', summary: 'One-hour primer covering how prompts steer models.' },
  // LLM fundamentals (ga1)
  { node_id: 'ga1', roadmap_id: 'rm-genai', kind: 'paper',   title: 'Attention Is All You Need (Vaswani et al.)', url: 'https://arxiv.org/abs/1706.03762', source: 'arXiv', summary: 'The transformer paper. The base architecture of modern LLMs.' },
  { node_id: 'ga1', roadmap_id: 'rm-genai', kind: 'video',   title: '3Blue1Brown — But what is a GPT?',           url: 'https://www.youtube.com/watch?v=wjZofJX0v4M', source: 'YouTube', summary: 'Visual explainer for transformers and attention.' },
  { node_id: 'ga1', roadmap_id: 'rm-genai', kind: 'article', title: 'Jay Alammar — The Illustrated Transformer',  url: 'https://jalammar.github.io/illustrated-transformer/', source: 'jalammar.github.io', summary: 'Diagrams of every step inside a transformer block.' },
  // Tokenization & embeddings (ga2)
  // Was platform.openai.com/tokenizer — now behind auth and unreachable, caught
  // by the V10 integrity check. Seed URLs must be stable, not just plausible.
  { node_id: 'ga2', roadmap_id: 'rm-genai', kind: 'article', title: 'Byte pair encoding',  url: 'https://en.wikipedia.org/wiki/Byte_pair_encoding', source: 'Wikipedia', summary: 'How subword tokenization actually works.' },
  { node_id: 'ga2', roadmap_id: 'rm-genai', kind: 'video',   title: 'Andrej Karpathy — Let’s build the GPT tokenizer', url: 'https://www.youtube.com/watch?v=zduSFxRajkE', source: 'YouTube', summary: 'Building BPE from scratch.' },
  { node_id: 'ga2', roadmap_id: 'rm-genai', kind: 'article', title: 'Hugging Face — Word embeddings', url: 'https://huggingface.co/learn/nlp-course/chapter1/4', source: 'huggingface.co', summary: 'How embeddings represent meaning as vectors.' },
  // Few-shot & chain-of-thought (ga4)
  { node_id: 'ga4', roadmap_id: 'rm-genai', kind: 'paper',   title: 'Chain-of-Thought Prompting (Wei et al.)',  url: 'https://arxiv.org/abs/2201.11903', source: 'arXiv', summary: 'The original CoT prompting paper.' },
  { node_id: 'ga4', roadmap_id: 'rm-genai', kind: 'paper',   title: 'Language Models are Few-Shot Learners (GPT-3)', url: 'https://arxiv.org/abs/2005.14165', source: 'arXiv', summary: 'Foundational few-shot prompting results.' },
  // RAG basics (ga5)
  { node_id: 'ga5', roadmap_id: 'rm-genai', kind: 'paper',   title: 'Retrieval-Augmented Generation (Lewis et al.)', url: 'https://arxiv.org/abs/2005.11401', source: 'arXiv', summary: 'The paper that named RAG.' },
  { node_id: 'ga5', roadmap_id: 'rm-genai', kind: 'docs',    title: 'LangChain — RAG overview', url: 'https://python.langchain.com/docs/tutorials/rag/', source: 'langchain.com', summary: 'End-to-end RAG implementation walkthrough.' },
  // Data Science roadmap — Hypothesis testing (ds6, active)
  { node_id: 'ds6', roadmap_id: 'rm-data-sci', kind: 'video',   title: 'StatQuest — Hypothesis testing',         url: 'https://www.youtube.com/watch?v=0oc49DyA3hU', source: 'YouTube', summary: 'Friendly intro to null/alternative hypotheses.' },
  { node_id: 'ds6', roadmap_id: 'rm-data-sci', kind: 'article', title: 'Khan Academy — Hypothesis testing',      url: 'https://www.khanacademy.org/math/statistics-probability/significance-tests-one-sample', source: 'khanacademy.org', summary: 'Walk-through with worked problems.' },
  { node_id: 'ds6', roadmap_id: 'rm-data-sci', kind: 'docs',    title: 'SciPy — Statistical tests reference',    url: 'https://docs.scipy.org/doc/scipy/reference/stats.html', source: 'docs.scipy.org', summary: 'Run t-tests, chi-square, ANOVA in Python.' },
  { node_id: 'ds7', roadmap_id: 'rm-data-sci', kind: 'video',   title: 'StatQuest — Linear regression',          url: 'https://www.youtube.com/watch?v=nk2CQITm_eo', source: 'YouTube', summary: 'Fitting and interpreting linear models.' },
  // exp-platform.com no longer resolves; replaced with a stable canonical reference.
  { node_id: 'ds8', roadmap_id: 'rm-data-sci', kind: 'article', title: 'A/B testing', url: 'https://en.wikipedia.org/wiki/A/B_testing', source: 'Wikipedia', summary: 'Controlled online experiments and their common pitfalls.' },
]);

// ── Migration: node_lessons (P10) ────────────────────────────────────────────
// Each node has an optional concept body (Markdown) — the actual lesson text a
// learner reads before opening a tutor session.
try {
  db.exec(`CREATE TABLE IF NOT EXISTS node_lessons (
    node_id TEXT PRIMARY KEY,
    body_md TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
} catch (e) { console.log('node_lessons migration:', e.message); }

function seedNodeLesson(nodeId, body) {
  try {
    const exists = db.prepare('SELECT 1 FROM node_lessons WHERE node_id = ?').get(nodeId);
    if (exists) return;
    db.prepare('INSERT INTO node_lessons (node_id, body_md) VALUES (?, ?)').run(nodeId, body);
  } catch {}
}
seedNodeLesson('ga3', `## Prompt Engineering

Prompt engineering is the practice of designing inputs to large language models so that you reliably get useful outputs. The model is fixed — your only real lever is how you talk to it.

### Why it matters
Two prompts that look superficially similar can produce dramatically different responses. Small structural choices (giving examples, framing the role, asking for step-by-step reasoning) often beat large changes in word choice.

### The five techniques that move the needle most
1. **Be specific about the output format.** "Return JSON with keys A, B, C" is far more reliable than "give me the result."
2. **Use a system prompt for stable instructions.** Anything that doesn't change between requests belongs there — role, constraints, style.
3. **Give examples (few-shot).** Two or three well-chosen examples are usually worth more than a paragraph of instructions.
4. **Ask for reasoning before the answer.** "Think step-by-step, then give the final answer" reduces silent errors on tasks with logical structure.
5. **Iterate on actual failures.** Don't optimize for the first input you tried — collect 10 failures and tune the prompt to handle them.

### Common pitfalls
- **Over-instruction:** 800-word system prompts often perform *worse* than crisp 150-word ones.
- **Confusing the model:** if you mix the system prompt's tone with examples that contradict it, behavior gets unstable.
- **Forgetting context windows:** every token costs latency and dollars; trim aggressively.

Once you have the basics down, the next step is **few-shot + chain-of-thought**, where you combine examples with explicit reasoning steps. That's the next module.`);

seedNodeLesson('ds6', `## Hypothesis testing

Hypothesis testing is the formal procedure for deciding whether a pattern you see in data is real, or could plausibly have come from random noise.

### The structure
Every test has the same shape:
1. State a **null hypothesis** (H₀) — the boring explanation, usually "no effect" or "no difference."
2. State an **alternative hypothesis** (H₁) — what you'd believe if you reject H₀.
3. Pick a **test statistic** that captures the effect you care about.
4. Compute a **p-value** — the probability of seeing data this extreme if H₀ were true.
5. Compare to your significance threshold (often 0.05). If p < threshold, reject H₀.

### What the p-value actually means
A p-value is **not** the probability that H₀ is true. It's the probability of the *data* given H₀ is true. Small p-value → "this data would be very surprising under H₀, so H₀ is probably wrong."

### Common pitfalls
- **p-hacking:** running many tests until one is "significant." If you run 20 tests at p < 0.05, you expect one false positive by chance.
- **Confusing statistical significance with practical significance.** A tiny effect can be highly significant with enough data — and still be useless.
- **Misreading two-tailed vs one-tailed tests.** Pick before looking at the data.

### When to use which test
- Comparing means of two groups → **t-test** (or Mann-Whitney if non-normal)
- Comparing proportions → **chi-squared**
- Comparing variances or multiple groups → **ANOVA**

Next up: regression analysis, which generalizes "is there a difference?" to "how much does X explain Y?"`);

seedNodeLesson('ga1', `## LLM fundamentals

Large language models are neural networks trained to predict the next token in a sequence. That's it — that's the entire core task.

### How the magic happens
- The model sees a long sequence of tokens and learns to predict what comes next.
- At inference time you give it a prompt; it predicts a probability distribution over the next token, samples one, appends it, and repeats.
- The architecture that made this work at scale is the **Transformer**, which uses a mechanism called *attention* to let each token "look at" every other token in the context.

### What "context window" means
The context window is the maximum number of tokens the model can see at once — both your input and its accumulated output. Past this limit, earlier content falls off and the model effectively forgets it.

### What models can and can't do
**Can:** translate, summarize, classify, generate code, follow detailed instructions, reason about text.
**Can't natively:** access the internet, remember between separate conversations, do exact arithmetic on long numbers, know facts after their training cutoff.

### Why prompts matter so much
Because the entire interaction is "predict the next token given everything before it," **the framing of your prompt directly shapes what the model treats as likely**. This is why we'll spend the next several modules on prompt engineering, few-shot examples, and chain-of-thought.`);

// ── Migration: Certificate verification (#21) ────────────────────────────────
// Certificates are only "verified" credentials when earned on a LearnOS-verified
// course/roadmap. Unverified completions are kept as records but flagged.
try {
  try { db.exec("ALTER TABLE certificates ADD COLUMN verified INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE certificates ADD COLUMN course_slug TEXT"); } catch {}
} catch (e) { console.log('Certificate verification migration:', e.message); }

// ── Migration: onboarded_at on user_settings ──────────────────────────────────
try { db.exec("ALTER TABLE user_settings ADD COLUMN onboarded_at TEXT"); } catch {}

// ── Migration: course_modules + module_lessons (§3.2) ─────────────────────────
try {
  db.exec(`CREATE TABLE IF NOT EXISTS course_modules (
    id TEXT PRIMARY KEY,
    course_slug TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    order_idx INTEGER DEFAULT 0,
    estimated_minutes INTEGER DEFAULT 45,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS module_lessons (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body_md TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'reading',
    order_idx INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_course_modules_slug ON course_modules(course_slug)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_module_lessons_mid ON module_lessons(module_id)");
  try { db.exec("ALTER TABLE courses ADD COLUMN migrated_modules INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE courses ADD COLUMN thumbnail_url TEXT"); } catch {}
} catch (e) { console.log('course_modules migration:', e.message); }

// ── Migration: enrollment_progress (§3.2/3.4) ────────────────────────────────
try {
  db.exec(`CREATE TABLE IF NOT EXISTS enrollment_progress (
    user_id TEXT NOT NULL,
    course_slug TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    completed_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, course_slug, lesson_id)
  )`);
} catch (e) { console.log('enrollment_progress migration:', e.message); }

// ── Migration: assignment_submissions (§3.5) ──────────────────────────────────
try {
  db.exec(`CREATE TABLE IF NOT EXISTS assignment_submissions (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    body_md TEXT NOT NULL,
    submitted_at TEXT DEFAULT (datetime('now')),
    grade INTEGER,
    feedback_md TEXT,
    rubric_json TEXT
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_asgn_sub_user ON assignment_submissions(user_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_asgn_sub_aid ON assignment_submissions(assignment_id)");
} catch (e) { console.log('assignment_submissions migration:', e.message); }

// ── Migration: schedule reminder_sent_at (§3.8) ───────────────────────────────
try { db.exec("ALTER TABLE schedule_events ADD COLUMN reminder_sent_at TEXT"); } catch {}

// ── Migration: course verification columns (§3.9) ─────────────────────────────
try { db.exec("ALTER TABLE courses ADD COLUMN verified_by TEXT"); } catch {}
try { db.exec("ALTER TABLE courses ADD COLUMN verified_at TEXT"); } catch {}

// ── Migration: whiteboard_strokes (§3.10) ─────────────────────────────────────
try {
  db.exec(`CREATE TABLE IF NOT EXISTS whiteboard_strokes (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    stroke_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_wb_strokes_session ON whiteboard_strokes(session_id)");
} catch (e) { console.log('whiteboard_strokes migration:', e.message); }

// ── Migration: roadmap node editing columns (§3.11) ───────────────────────────
try { db.exec("ALTER TABLE roadmap_nodes ADD COLUMN last_replanned_at TEXT"); } catch {}
// Quiz attempts — real, scored, persisted quiz results (feeds XP, activity, mastery).
try {
  db.exec(`CREATE TABLE IF NOT EXISTS quiz_attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    node_id TEXT,
    title TEXT,
    total INTEGER NOT NULL,
    correct INTEGER NOT NULL,
    score INTEGER NOT NULL,
    questions_json TEXT,
    answers_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id, created_at)");
} catch (e) { console.log('quiz_attempts migration:', e.message); }
// `source` marks AN-inserted remedial nodes. The replan path INSERTed into it
// while the column did not exist, so every re-plan threw (swallowed) and the
// "Suggested by AN" highlight could never appear.
try { db.exec("ALTER TABLE roadmap_nodes ADD COLUMN source TEXT"); } catch {}
// Links a roadmap node to the course whose module teaches it, so a roadmap can
// be a real course pathway from mastery A→B.
try { db.exec("ALTER TABLE roadmap_nodes ADD COLUMN course_slug TEXT"); } catch {}

// ── Migration: profile customization (§3.12) ──────────────────────────────────
try { db.exec("ALTER TABLE users ADD COLUMN bio TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN links_json TEXT"); } catch {}
try { db.exec("ALTER TABLE roadmaps ADD COLUMN is_public INTEGER DEFAULT 0"); } catch {}

// ── Migration: email verification + password reset (§3.13) ────────────────────
try { db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0"); } catch {}
try {
  db.exec(`CREATE TABLE IF NOT EXISTS email_verifications (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS password_resets (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
} catch (e) { console.log('email/pw-reset migration:', e.message); }

// ── Migration: backfill course_modules from syllabus JSON ─────────────────────
try {
  // Check if syllabus column exists (it may not in older DBs)
  const cols = db.prepare("PRAGMA table_info(courses)").all();
  const hasSyllabus = cols.some(c => c.name === 'syllabus');
  if (!hasSyllabus) {
    db.exec("ALTER TABLE courses ADD COLUMN syllabus TEXT");
  }
  const coursesToMigrate = db.prepare("SELECT slug, syllabus FROM courses WHERE (migrated_modules = 0 OR migrated_modules IS NULL) AND syllabus IS NOT NULL AND syllabus != '' AND syllabus != '[]'").all();
  for (const c of coursesToMigrate) {
    try {
      const syllabus = JSON.parse(c.syllabus);
      if (!Array.isArray(syllabus) || syllabus.length === 0) {
        db.prepare("UPDATE courses SET migrated_modules = 1 WHERE slug = ?").run(c.slug);
        continue;
      }
      const tx = db.transaction(() => {
        syllabus.forEach((mod, mi) => {
          const mid = `cm-${c.slug}-${mi}-${Date.now()}`;
          const modTitle = typeof mod === 'string' ? mod : (mod.title || mod.name || `Module ${mi + 1}`);
          const modSummary = typeof mod === 'object' ? (mod.summary || mod.description || null) : null;
          db.prepare('INSERT OR IGNORE INTO course_modules (id, course_slug, title, summary, order_idx) VALUES (?, ?, ?, ?, ?)')
            .run(mid, c.slug, modTitle, modSummary, mi);
          // Create a default empty lesson per module
          const lid = `ml-${mid}-default`;
          db.prepare("INSERT OR IGNORE INTO module_lessons (id, module_id, title, body_md, kind, order_idx) VALUES (?, ?, ?, '', 'reading', 0)")
            .run(lid, mid, `${modTitle} — Reading`);
        });
        db.prepare("UPDATE courses SET migrated_modules = 1 WHERE slug = ?").run(c.slug);
      });
      tx();
    } catch (e) { console.log('Syllabus backfill error for', c.slug, e.message); }
  }
} catch (e) { console.log('Syllabus backfill migration:', e.message); }

// ── Migration: course_versions ────────────────────────────────────────────────
try {
  db.exec(`CREATE TABLE IF NOT EXISTS course_versions (
    course_slug TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    label TEXT,
    notes_json TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (course_slug, version)
  )`);
} catch (e) { console.log('course_versions migration:', e.message); }

// ── Migration: mastery_events ─────────────────────────────────────────────────
try {
  db.exec(`CREATE TABLE IF NOT EXISTS mastery_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    roadmap_id TEXT,
    event_type TEXT NOT NULL,
    mastery_before REAL DEFAULT 0,
    mastery_after REAL DEFAULT 0,
    delta REAL DEFAULT 0,
    source TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_mastery_events_node ON mastery_events(node_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_mastery_events_user ON mastery_events(user_id, created_at)");
} catch (e) { console.log('mastery_events migration:', e.message); }

// ── Migration: password_resets used_at ────────────────────────────────────────
try { db.exec("ALTER TABLE password_resets ADD COLUMN used_at TEXT"); } catch {}

// ── XP award helper ──────────────────────────────────────────────────────────
// Called by various routes when user earns XP
db.prepare(`
  UPDATE users SET xp = xp + ?, level = CASE WHEN xp + ? >= xp_to_next THEN level + 1 ELSE level END, xp_to_next = CASE WHEN xp + ? >= xp_to_next THEN xp_to_next + 500 ELSE xp_to_next END, updated_at = CURRENT_TIMESTAMP WHERE id = ?
`).run; // prepared for later use via function below

// Append a row to the personal activity feed (#25 — Feed integration).
// Every meaningful user action funnels through here so the Feed reflects real work.
export function logActivity(userId, { kind, text, sub = null, xp = 0, agent = null }) {
  if (!userId || !kind || !text) return;
  const id = `al-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.prepare('INSERT INTO activity_log (id, user_id, kind, text, sub, xp, agent) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, userId, kind, text, sub, xp, agent);
  return id;
}

// We export a helper function for awarding XP.
// Pass { silent: true } when the caller already logs a descriptive activity row
// (avoids a duplicate generic "Earned N XP" entry in the feed).
export function awardXP(userId, amount, opts = {}) {
  // Get current user state
  const user = db.prepare('SELECT xp, xp_to_next, level FROM users WHERE id = ?').get(userId);
  if (!user) return;
  let newXP = user.xp + amount;
  let newLevel = user.level;
  let newXPToNext = user.xp_to_next;
  while (newXP >= newXPToNext) {
    newXP -= newXPToNext;
    newLevel++;
    newXPToNext = 500 + (newLevel - 1) * 100; // Scaling XP requirement
  }
  db.prepare('UPDATE users SET xp = ?, level = ?, xp_to_next = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newXP, newLevel, newXPToNext, userId);
  // Log activity (unless the caller is logging its own descriptive entry)
  if (!opts.silent) {
    logActivity(userId, { kind: 'xp', text: `Earned ${amount} XP`, xp: amount });
  }
}

// ── Streak update helper ─────────────────────────────────────────────────────
export function updateStreak(userId) {
  const user = db.prepare('SELECT streak, best_streak, last_activity_date FROM users WHERE id = ?').get(userId);
  if (!user) return;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (user.last_activity_date === today) return; // Already counted today
  let newStreak = (user.last_activity_date === yesterday) ? user.streak + 1 : 1;
  const newBest = Math.max(user.best_streak, newStreak);
  db.prepare('UPDATE users SET streak = ?, best_streak = ?, last_activity_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newStreak, newBest, today, userId);

  // Award streak XP bonus
  if (newStreak > 1) {
    awardXP(userId, newStreak * 5); // 5 XP per streak day
  }

  // Award streak badges
  const badges = db.prepare("SELECT COUNT(*) as c FROM badges WHERE user_id = ? AND label LIKE '%streak%'").get(userId).c;
  if (newStreak === 7 && badges === 0) {
    db.prepare('INSERT INTO badges (id, user_id, label, glyph) VALUES (?, ?, ?, ?)').run(`b-str-${userId}`, userId, '7-day streak', 'flame');
  }
  if (newStreak === 30) {
    const has30 = db.prepare("SELECT COUNT(*) as c FROM badges WHERE user_id = ? AND label = '30-day streak'").get(userId).c;
    if (!has30) db.prepare('INSERT INTO badges (id, user_id, label, glyph) VALUES (?, ?, ?, ?)').run(`b-str30-${userId}`, userId, '30-day streak', 'flame');
  }
}

// Award a badge once per (user, label). Returns true if newly awarded so callers
// can toast/log. Badges were previously seeded-only and never earned.
export function awardBadge(userId, label, glyph = 'star') {
  const has = db.prepare('SELECT 1 FROM badges WHERE user_id = ? AND label = ?').get(userId, label);
  if (has) return false;
  db.prepare('INSERT INTO badges (id, user_id, label, glyph) VALUES (?, ?, ?, ?)')
    .run(`b-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, userId, label, glyph);
  return true;
}

// ── AI platform: agent-run logging + managed-tier usage metering ─────────────
export function logAgentRun(r) {
  db.prepare(`INSERT INTO agent_runs
    (id, user_id, agent_code, model, provider, managed, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, latency_ms, status, error)
    VALUES (@id, @user_id, @agent_code, @model, @provider, @managed, @input_tokens, @output_tokens, @cache_read_tokens, @cache_write_tokens, @cost_usd, @latency_ms, @status, @error)`)
    .run({
      id: r.id, user_id: r.user_id ?? null, agent_code: r.agent_code ?? null,
      model: r.model ?? null, provider: r.provider ?? 'anthropic', managed: r.managed ?? 1,
      input_tokens: r.input_tokens ?? 0, output_tokens: r.output_tokens ?? 0,
      cache_read_tokens: r.cache_read_tokens ?? 0, cache_write_tokens: r.cache_write_tokens ?? 0,
      cost_usd: r.cost_usd ?? 0, latency_ms: r.latency_ms ?? 0,
      status: r.status ?? 'ok', error: r.error ?? null,
    });
}

export function bumpUsage(userId, tokens, cost) {
  const period = new Date().toISOString().slice(0, 7);
  db.prepare(`INSERT INTO usage_counters (user_id, period, tokens, cost_usd, requests)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(user_id, period) DO UPDATE SET
      tokens = tokens + excluded.tokens,
      cost_usd = cost_usd + excluded.cost_usd,
      requests = requests + 1`)
    .run(userId, period, tokens, cost);
}

export default db;
