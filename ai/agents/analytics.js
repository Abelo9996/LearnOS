/**
 * AN — Analytics agent (P9). Runs after session completion to:
 *   1. Score each learning objective from the conversation transcript
 *   2. Produce a written session summary
 *   3. Seed extra spaced-review cards for weak objectives
 *   4. Enqueue an RE proposal for additional resources on weak objectives
 *
 * Falls back to deterministic, heuristic analysis (no LLM) so the loop still
 * runs without a key — the user just gets a less-polished summary.
 */
import db from '../../db/database.js';
import { complete } from '../llm.js';
import { enqueueJob, registerJobHandler } from '../jobs.js';

const analysisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    objectives: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          objective: { type: 'string' },
          mastery:   { type: 'number' },
          evidence:  { type: 'string' },
        },
        required: ['objective', 'mastery', 'evidence'],
      },
    },
    weak_areas: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'objectives', 'weak_areas'],
};

const SYSTEM = `You are the Analytics agent for LearnOS. You're given a session transcript and the module's
learning objectives. For each objective:
- Score the learner's mastery from 0.0 (no engagement) to 1.0 (fully demonstrated understanding)
- Quote a one-sentence piece of evidence from the conversation (if any)
Identify objectives with mastery < 0.5 as 'weak_areas'.
Write a 3-5 sentence summary of what the learner accomplished and what to revisit.
Return only the structured object.`;

export async function analyzeSession({ userId, sessionId }) {
  const sess = db.prepare('SELECT id, title, roadmap_node_id, course FROM sessions WHERE id = ? AND user_id = ?').get(sessionId, userId);
  if (!sess) return { ok: false, reason: 'session_not_found' };

  const messages = db.prepare('SELECT role, body FROM session_messages WHERE session_id = ? ORDER BY created_at').all(sess.id);
  const objectives = sess.roadmap_node_id
    ? db.prepare('SELECT text FROM node_objectives WHERE node_id = ? ORDER BY order_idx').all(sess.roadmap_node_id).map(o => o.text)
    : [];

  // Try LLM. Fall back to heuristic if NO_KEY or transcript is too short.
  let analysis = null;
  const transcript = messages.map(m => `${m.role === 'user' ? 'Learner' : 'Tutor'}: ${(m.body || '').slice(0, 400)}`).join('\n');
  if (transcript.length > 60 && objectives.length > 0) {
    try {
      const out = await complete({
        userId, agentCode: 'AN', schema: analysisSchema, maxTokens: 1500,
        system: SYSTEM,
        messages: `Module: ${sess.title}\nLearning objectives:\n${objectives.map(o => '- ' + o).join('\n')}\n\nTranscript:\n${transcript}\n\nProduce the analysis.`,
      });
      if (out.json && out.json.summary) analysis = out.json;
    } catch {}
  }

  if (!analysis) {
    // Heuristic: count user questions, average length, mention frequency per objective.
    const userMsgs = messages.filter(m => m.role === 'user');
    const userText = userMsgs.map(m => (m.body || '').toLowerCase()).join(' ');
    const objScores = objectives.map(o => {
      const keywords = o.toLowerCase().split(/\s+/).filter(w => w.length > 4).slice(0, 4);
      const hits = keywords.filter(k => userText.includes(k)).length;
      const mastery = Math.min(1, 0.4 + (hits / Math.max(1, keywords.length)) * 0.5 + (userMsgs.length > 5 ? 0.1 : 0));
      return { objective: o, mastery, evidence: hits > 0 ? `Learner mentioned related concepts ${hits} time(s).` : 'Limited engagement with this objective.' };
    });
    const weak = objScores.filter(o => o.mastery < 0.55).map(o => o.objective);
    analysis = {
      summary: `You exchanged ${userMsgs.length} question${userMsgs.length === 1 ? '' : 's'} with the Tutor across ${messages.length} message${messages.length === 1 ? '' : 's'}.${weak.length ? ` Areas to revisit: ${weak.slice(0,2).join('; ')}.` : ' Coverage across all objectives looks solid.'} The module's mastery has been updated and the next module unlocked.`,
      objectives: objScores,
      weak_areas: weak,
    };
  }

  // Side effects:
  // 1. Persist objective mastery (we already store node mastery on the node;
  //    this is the per-objective view we'd surface in dashboards later).
  // 2. Seed extra flashcards for weak areas.
  for (const w of analysis.weak_areas.slice(0, 3)) {
    const dupe = db.prepare('SELECT 1 FROM flashcards WHERE user_id = ? AND deck = ? AND back = ?').get(userId, sess.title, w);
    if (!dupe) {
      db.prepare('INSERT INTO flashcards (id, user_id, deck, front, back) VALUES (?, ?, ?, ?, ?)')
        .run(`c-an-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, userId, sess.title, `Revisit: ${w}`, w);
    }
  }
  // 3. If we have weak areas, enqueue RE to propose more resources for the node.
  if (sess.roadmap_node_id && analysis.weak_areas.length > 0) {
    enqueueJob(userId, 'propose-resources', {
      node_id: sess.roadmap_node_id, roadmap_id: null,
      title: sess.title, objectives: analysis.weak_areas,
    });
  }

  return { ok: true, ...analysis };
}

// ── AN-driven roadmap re-planning (§3.6) ─────────────────────────────────────
// After analysis, if a user has 2+ sessions on the same node with combined
// mastery < 0.5, enqueue a CR job to insert a remedial node.
async function checkAndReplan({ userId, sessionId, analysis }) {
  const sess = db.prepare('SELECT roadmap_node_id, roadmap_id FROM sessions WHERE id = ?').get(sessionId);
  if (!sess?.roadmap_node_id) return;

  const nodeId = sess.roadmap_node_id;
  const weakAreas = analysis?.weak_areas || [];
  if (weakAreas.length === 0) return;

  // Check: 2+ sessions on this node with combined mastery < 0.5
  const recentSessions = db.prepare(
    "SELECT mastery_score FROM sessions WHERE user_id = ? AND roadmap_node_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 3"
  ).all(userId, nodeId);

  if (recentSessions.length < 2) return;

  const avgMastery = recentSessions.reduce((s, r) => s + (r.mastery_score || 0), 0) / recentSessions.length;
  if (avgMastery >= 0.5) return;

  // Rate limit: don't replan more than once per node per week
  const lastReplanned = db.prepare("SELECT last_replanned_at FROM roadmap_nodes WHERE id = ?").get(nodeId)?.last_replanned_at;
  if (lastReplanned && new Date(lastReplanned) > new Date(Date.now() - 604800000)) return;

  // Enqueue CR replan job
  enqueueJob(userId, 'replan-node', { nodeId, roadmapId: sess.roadmap_id, weakAreas });
}

// Wrap the analyzeSession to include re-planning check
const originalAnalyzeSession = analyzeSession;
async function analyzeSessionWithReplan({ userId, sessionId }) {
  const result = await originalAnalyzeSession({ userId, sessionId });
  if (result.ok) {
    try { await checkAndReplan({ userId, sessionId, analysis: result }); } catch (e) { console.log('Replan check error:', e.message); }
  }
  return result;
}

registerJobHandler('analyze-session', async ({ userId, input }) => analyzeSessionWithReplan({ userId, sessionId: input.sessionId }));
