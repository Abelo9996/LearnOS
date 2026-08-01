/**
 * CR — Curriculum agent (CR-1/2). Turns a goal + profile into a real, persisted
 * roadmap: a COURSE PATHWAY — an ordered sequence of courses from where the
 * learner is to their goal.
 *
 * This used to emit a DAG of concept nodes laid out in parallel lanes: a concept
 * map. LearnOS does not have concept maps. A learner should never be shown a
 * web of topics and left to choose an entry point; there is one path, and one
 * next thing on it.
 * Tries the LLM; on NO_KEY/error falls back to a deterministic, goal-flavored
 * template (clearly labeled) so the flow stays usable without a key.
 * Runs as the 'generate-roadmap' async job.
 */
import db from '../../db/database.js';
import { complete } from '../llm.js';
import { registerJobHandler } from '../jobs.js';
import { roadmapSchema } from '../schemas.js';
import { getProfile } from './profiling.js';
import { logActivity } from '../../db/database.js';

const SYSTEM = `You are the Curriculum agent for LearnOS. Given a learning goal and learner profile, design a COURSE PATHWAY: an ordered sequence of 5-8 courses that carries the learner from where they are now to their goal.

Rules:
- Strictly sequential. Course 1 must be reachable from the learner's stated starting point; each course after it builds on the one before; the last delivers the goal. There are no parallel tracks and no optional branches.
- This is a path of COURSES, not a map of concepts. Each entry is a substantial course someone could spend hours on, not a single idea or term.
- "title" is what the learner sees. "topic" is a self-contained description handed to the course builder later, so it must make sense on its own without the surrounding path.
- "why" is one sentence explaining why this course sits at this point in the sequence.
- "objectives" are 2-4 things the learner can DO after it.
Calibrate scope to the learner's level and stated background. Return only the structured object.`;

export async function generateRoadmap({ userId, goal, profile }) {
  const prof = profile || getProfile(userId) || { level: 'beginner', time_per_week: 5 };
  let spec = null, source = 'ai';
  try {
    const out = await complete({
      userId, agentCode: 'CR', schema: roadmapSchema, maxTokens: 4096,
      system: SYSTEM,
      // Background and preferred style are collected during onboarding, so they
      // must actually reach the prompt — asking someone about their experience
      // and then ignoring it is worse than not asking at all.
      messages: [
        `Goal: ${goal}`,
        `Learner level: ${prof.level}`,
        `Time per week: ${prof.time_per_week || '?'} hours`,
        prof.background ? `Learner background: ${prof.background}` : null,
        Array.isArray(prof.learning_style) && prof.learning_style.length
          ? `Preferred learning style: ${prof.learning_style.join(', ')}` : null,
        prof.background
          ? 'Pitch the roadmap at someone with that background, and do not re-teach what they already say they know.'
          : null,
        'Design the roadmap.',
      ].filter(Boolean).join('\n'),
    });
    spec = validateSpec(out.json) ? out.json : null;
  } catch {
    spec = null;
  }
  if (!spec) { spec = templateSpec(goal, prof); source = 'template'; }
  const roadmapId = persistRoadmap(userId, spec, source, goal);
  return { roadmapId, source, nodeCount: spec.courses.length, title: spec.title };
}

function validateSpec(s) {
  return !!s && typeof s.title === 'string' && Array.isArray(s.courses) && s.courses.length >= 3
    && s.courses.every(c => c && typeof c.title === 'string' && c.title.trim());
}

export function persistRoadmap(userId, spec, source, goal) {
  const roadmapId = `rm-gen-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const courses = spec.courses;
  const authored = source === 'ai'
    ? 'AI Curriculum agent'
    : 'offline template — add an API key for AI-generated pathways';
  const colors = ['#7c3aed', '#06b6d4', '#10b981', '#e0476a'];
  const color = colors[Math.abs(hash(goal || spec.title)) % colors.length];

  const run = db.transaction(() => {
    db.prepare(`INSERT INTO roadmaps (id, user_id, title, subtitle, authored_by, mastery, total_modules, completed_modules, status, color, icon, next_module, modules_left, kind, goal)
      VALUES (?, ?, ?, ?, ?, 0, ?, 0, 'active', ?, 'box', ?, ?, 'pathway', ?)`)
      .run(roadmapId, userId, spec.title, spec.subtitle || '', authored, courses.length, color,
        courses[0]?.title || '', courses.length, goal || null);

    // Strictly sequential: stage i is position i, one per row, and depends only
    // on stage i-1. col/row are kept because the schema has them, but they now
    // encode ORDER rather than a layout — there is no second lane to be in.
    courses.forEach((c, i) => {
      const nid = `${roadmapId}:c${i}`;
      const status = i === 0 ? 'active' : i === 1 ? 'next' : 'locked';
      db.prepare(`INSERT INTO roadmap_nodes (id, roadmap_id, title, col, row_idx, mastery, status, node_kind, course_topic, build_status)
                  VALUES (?, ?, ?, ?, 0, 0, ?, 'course', ?, 'planned')`)
        .run(nid, roadmapId, c.title, i, status, c.topic || c.title);

      // "why this course is here" leads, then what it makes you able to do.
      const objectives = [c.why, ...(Array.isArray(c.objectives) ? c.objectives : [])].filter(Boolean);
      objectives.forEach((o, oi) => {
        db.prepare('INSERT INTO node_objectives (id, node_id, roadmap_id, text, order_idx) VALUES (?, ?, ?, ?, ?)')
          .run(`obj-${roadmapId}-c${i}-${oi}`, nid, roadmapId, o, oi);
      });

      if (i > 0) {
        db.prepare('INSERT OR IGNORE INTO roadmap_edges (roadmap_id, from_node, to_node) VALUES (?, ?, ?)')
          .run(roadmapId, `${roadmapId}:c${i - 1}`, nid);
      }
    });
  });
  run();
  return roadmapId;
}

function hash(s) { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

// Deterministic, goal-flavored fallback — real structure, no LLM, clearly
// labeled. Like the AI path it produces a strictly linear pathway of courses;
// it previously emitted two parallel nodes per stage, which is a concept map.
function templateSpec(goal, prof) {
  const topic = cleanTopic(goal);
  const level = prof?.level || 'beginner';
  const stages = [
    { title: `Foundations of ${topic}`,        why: 'Establishes the vocabulary and core ideas everything later depends on.',
      objectives: [`Explain the core concepts of ${topic}`, `Recognise the terminology used across ${topic}`] },
    { title: `Core techniques in ${topic}`,    why: 'Moves from knowing what things are to being able to use them.',
      objectives: [`Apply the fundamental techniques of ${topic}`, `Recognise the patterns that recur across problems`] },
    { title: `${titleCase(topic)} in practice`, why: 'Turns understanding into working output on realistic problems.',
      objectives: [`Work through realistic ${topic} problems end to end`, `Debug your own approach when it goes wrong`] },
    { title: `Advanced ${topic}`,              why: 'Covers the harder cases that separate competence from fluency.',
      objectives: [`Handle the edge cases and failure modes of ${topic}`, `Choose between competing approaches and justify it`] },
    { title: `Capstone: build with ${topic}`,  why: 'Proves the whole path by producing something you can show.',
      objectives: [`Plan and build a substantial ${topic} project`, `Evaluate the result and explain your decisions`] },
  ];
  return {
    title: titleCase(topic),
    subtitle: `A ${level}-level pathway through ${topic}, from foundations to a capstone.`,
    courses: stages.map(st => ({ title: st.title, topic: `${st.title} — ${topic}`, why: st.why, objectives: st.objectives })),
  };
}
function cleanTopic(g) { return String(g || 'your topic').replace(/^(learn|master|how to|study|understand)\s+/i, '').trim() || 'your topic'; }
function titleCase(s) { return s.replace(/\b\w/g, c => c.toUpperCase()); }

// Register the async job (CR-2 + PLAT-06).
registerJobHandler('generate-roadmap', async ({ userId, input }) =>
  generateRoadmap({ userId, goal: input.goal, profile: input.profile }));

// ── AN-driven re-planning (§3.6) ─────────────────────────────────────────────
// Inserts a remedial node before a weak node when the learner struggles.
const replanSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    objectives: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'objectives'],
};

const REPLAN_SYSTEM = `You are the Curriculum agent for LearnOS. A learner is struggling with a module.
Design a single remedial ("foundation") node that breaks down the weak objectives into simpler parts.
The remedial node should be placed BEFORE the failing node in the learning path.
Return a title and 2-4 specific learning objectives for the remedial node.`;

registerJobHandler('replan-node', async ({ userId, input }) => {
  const { nodeId, roadmapId, weakAreas } = input;
  const node = db.prepare('SELECT id, title, col, row_idx FROM roadmap_nodes WHERE id = ?').get(nodeId);
  if (!node) return { ok: false, reason: 'node_not_found' };

  // Try LLM for remedial node design
  let remedialSpec = null;
  try {
    const out = await complete({
      userId, agentCode: 'CR', schema: replanSchema, maxTokens: 1024,
      system: REPLAN_SYSTEM,
      messages: `Failing module: ${node.title}\nWeak objectives:\n${weakAreas.map(w => '- ' + w).join('\n')}\n\nDesign a remedial foundation node.`,
    });
    if (out.json && out.json.title) remedialSpec = out.json;
  } catch {}

  if (!remedialSpec) {
    remedialSpec = {
      title: `Foundations: ${node.title}`,
      objectives: weakAreas.slice(0, 3).map(w => `Review and practice: ${w}`),
    };
  }

  // Insert the remedial node
  const remedialId = `rn-remedial-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tx = db.transaction(() => {
    // Shift cols of downstream nodes to make room
    db.prepare('UPDATE roadmap_nodes SET col = col + 1 WHERE roadmap_id = ? AND col >= ?').run(roadmapId, node.col);

    // Insert the remedial stage at the position the failing node just vacated.
    // It is a course node like every other stage — a pathway never mixes a
    // "concept" node in among its courses.
    db.prepare(`INSERT INTO roadmap_nodes (id, roadmap_id, title, col, row_idx, mastery, status, node_kind, course_topic, build_status)
                VALUES (?, ?, ?, ?, 0, 0, 'next', 'course', ?, 'planned')`)
      .run(remedialId, roadmapId, remedialSpec.title, node.col, remedialSpec.title);

    // Add objectives
    (remedialSpec.objectives || []).forEach((o, i) => {
      db.prepare('INSERT INTO node_objectives (id, node_id, roadmap_id, text, order_idx) VALUES (?, ?, ?, ?, ?)')
        .run(`obj-${remedialId}-${i}`, remedialId, roadmapId, o, i);
    });

    // Edge: remedial → failing node
    db.prepare('INSERT OR IGNORE INTO roadmap_edges (roadmap_id, from_node, to_node) VALUES (?, ?, ?)')
      .run(roadmapId, remedialId, nodeId);

    // Edge: remedial inherits prereqs of the failing node
    const prereqs = db.prepare('SELECT from_node FROM roadmap_edges WHERE roadmap_id = ? AND to_node = ?').all(roadmapId, nodeId);
    for (const p of prereqs) {
      db.prepare('INSERT OR IGNORE INTO roadmap_edges (roadmap_id, from_node, to_node) VALUES (?, ?, ?)')
        .run(roadmapId, p.from_node, remedialId);
    }

    // Lock the failing node until remedial is done
    db.prepare("UPDATE roadmap_nodes SET status = 'locked' WHERE id = ? AND roadmap_id = ?").run(nodeId, roadmapId);

    // Mark replanned
    db.prepare("UPDATE roadmap_nodes SET last_replanned_at = datetime('now') WHERE id = ?").run(nodeId);
  });
  tx();

  logActivity(userId, {
    kind: 'session',
    text: `Curriculum agent inserted "${remedialSpec.title}" before "${node.title}" based on your recent sessions.`,
    sub: 'Adaptive roadmap',
    agent: 'AN',
  });

  return { ok: true, remedialId };
});
