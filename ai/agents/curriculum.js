/**
 * CR — Curriculum agent (CR-1/2). Turns a goal + profile into a real, persisted
 * roadmap: an ordered DAG of concept nodes with objectives, prereqs → edges.
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

const SYSTEM = `You are the Curriculum agent for LearnOS. Given a learning goal and learner profile,
design a mastery roadmap: an ordered DAG of 8-14 concept nodes from fundamentals to advanced.

Rules:
- Each node has: id ("n1","n2",...), a concise title, col (0-based prerequisite depth — first nodes are col 0),
  row (0-based lane for parallel topics within a column), 2-4 specific objectives, and prereqs (ids of nodes
  that must be mastered first; reference earlier nodes only).
- col-0 nodes have empty prereqs. Increase col with depth. Make titles specific to the goal and calibrated to
  the learner's level. Return only the structured object.`;

export async function generateRoadmap({ userId, goal, profile }) {
  const prof = profile || getProfile(userId) || { level: 'beginner', time_per_week: 5 };
  let spec = null, source = 'ai';
  try {
    const out = await complete({
      userId, agentCode: 'CR', schema: roadmapSchema, maxTokens: 4096,
      system: SYSTEM,
      messages: `Goal: ${goal}\nLearner level: ${prof.level}\nTime per week: ${prof.time_per_week || '?'} hours\nDesign the roadmap.`,
    });
    spec = validateSpec(out.json) ? out.json : null;
  } catch {
    spec = null;
  }
  if (!spec) { spec = templateSpec(goal, prof); source = 'template'; }
  const roadmapId = persistRoadmap(userId, spec, source, goal);
  return { roadmapId, source, nodeCount: spec.nodes.length, title: spec.title };
}

function validateSpec(s) {
  return !!s && typeof s.title === 'string' && Array.isArray(s.nodes) && s.nodes.length >= 3
    && s.nodes.every(n => n && n.id && n.title && Number.isInteger(n.col));
}

export function persistRoadmap(userId, spec, source, goal) {
  const roadmapId = `rm-gen-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const nodes = spec.nodes;
  const gid = {};
  nodes.forEach(n => { gid[n.id] = `${roadmapId}:${n.id}`; });
  const authored = source === 'ai'
    ? 'AI Curriculum agent'
    : 'offline template — add an API key for AI-generated roadmaps';
  const colors = ['#7c3aed', '#06b6d4', '#10b981', '#e0476a'];
  const color = colors[Math.abs(hash(goal || spec.title)) % colors.length];
  const col0 = nodes.filter(n => (n.col || 0) === 0);

  const run = db.transaction(() => {
    db.prepare(`INSERT INTO roadmaps (id, user_id, title, subtitle, authored_by, mastery, total_modules, completed_modules, status, color, icon, next_module, modules_left)
      VALUES (?, ?, ?, ?, ?, 0, ?, 0, 'active', ?, 'box', ?, ?)`)
      .run(roadmapId, userId, spec.title, spec.subtitle || '', authored, nodes.length, color, col0[0]?.title || nodes[0]?.title || '', nodes.length);

    nodes.forEach(n => {
      const status = (n.col || 0) === 0 ? 'next' : 'locked';
      db.prepare('INSERT INTO roadmap_nodes (id, roadmap_id, title, col, row_idx, mastery, status) VALUES (?, ?, ?, ?, ?, 0, ?)')
        .run(gid[n.id], roadmapId, n.title, n.col || 0, n.row || 0, status);
      (n.objectives || []).forEach((o, oi) => {
        db.prepare('INSERT INTO node_objectives (id, node_id, roadmap_id, text, order_idx) VALUES (?, ?, ?, ?, ?)')
          .run(`obj-${roadmapId}-${n.id}-${oi}`, gid[n.id], roadmapId, o, oi);
      });
    });
    if (col0[0]) db.prepare("UPDATE roadmap_nodes SET status='active' WHERE id=?").run(gid[col0[0].id]);

    nodes.forEach(n => (n.prereqs || []).forEach(p => {
      if (gid[p]) db.prepare('INSERT OR IGNORE INTO roadmap_edges (roadmap_id, from_node, to_node) VALUES (?, ?, ?)').run(roadmapId, gid[p], gid[n.id]);
    }));
  });
  run();
  return roadmapId;
}

function hash(s) { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

// Deterministic, goal-flavored fallback — real structure, no LLM, clearly labeled.
function templateSpec(goal, prof) {
  const topic = cleanTopic(goal);
  const stages = [
    { col: 0, subs: ['Core concepts', 'Key terminology'] },
    { col: 1, subs: ['Fundamental techniques', 'Common patterns'] },
    { col: 2, subs: ['Hands-on practice', 'Worked examples'] },
    { col: 3, subs: ['Advanced techniques', 'Edge cases'] },
    { col: 4, subs: ['Capstone project'] },
  ];
  const nodes = []; let n = 1; let prev = [];
  for (const st of stages) {
    const here = [];
    st.subs.forEach((sub, r) => {
      const id = `n${n++}`;
      nodes.push({
        id, title: `${sub} of ${topic}`, col: st.col, row: r,
        objectives: [`Understand ${sub.toLowerCase()} in ${topic}`, `Apply ${sub.toLowerCase()} in a short exercise`],
        prereqs: prev.slice(0, 2),
      });
      here.push(id);
    });
    prev = here;
  }
  return { title: titleCase(topic), subtitle: `A roadmap to master ${topic}, from foundations to a capstone.`, nodes };
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

    // Insert remedial node at the same col as the failing node (which got shifted +1)
    db.prepare("INSERT INTO roadmap_nodes (id, roadmap_id, title, col, row_idx, mastery, status) VALUES (?, ?, ?, ?, 0, 0, 'next')")
      .run(remedialId, roadmapId, remedialSpec.title, node.col, 0);

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
