/**
 * PR — Profiling agent (PR-1/2). Turns a goal + short intake into a learner
 * profile used by every downstream agent. Falls back to the raw answers as a
 * heuristic profile when no LLM key is configured.
 */
import db from '../../db/database.js';
import { complete } from '../llm.js';
import { profileSchema } from '../schemas.js';

const SYSTEM = `You are the Profiling agent for LearnOS. From a learner's goal and short intake
answers, produce a concise structured profile: their background, level (beginner|intermediate|advanced),
realistic hours per week, preferred learning style, and 1-3 motivations. Infer sensibly from sparse input.`;

export async function runIntake({ userId, goal, answers = {} }) {
  let profile = null;
  try {
    const out = await complete({
      userId, agentCode: 'PR', schema: profileSchema, maxTokens: 512,
      system: SYSTEM,
      messages: `Goal: ${goal}\nIntake answers: ${JSON.stringify(answers)}\nProduce the learner profile.`,
    });
    profile = out.json;
  } catch {
    profile = null; // NO_KEY or model error → heuristic below
  }
  if (!profile) profile = heuristicProfile(answers);
  persistProfile(userId, goal, profile);
  return profile;
}

function heuristicProfile(a) {
  return {
    background: a.background || '',
    level: ['beginner', 'intermediate', 'advanced'].includes(a.level) ? a.level : 'beginner',
    time_per_week: Number(a.time_per_week) || 5,
    // Onboarding sends learning_style as an ARRAY of chips, while profileSchema
    // (and therefore the LLM path) declares it a string. This heuristic branch
    // passed the array straight through to SQLite, which flattens arrays into
    // extra bind parameters — so intake died with "Too many parameter values
    // were provided" for every learner without an API key, i.e. every genuine
    // first run. Normalise to the string form the schema promises.
    learning_style: styleToText(a.learning_style),
    motivations: Array.isArray(a.motivations) ? a.motivations : (a.motivation ? [a.motivation] : []),
  };
}

/** Accepts the array the UI sends or the string the model returns. */
function styleToText(v) {
  if (Array.isArray(v)) return v.filter(Boolean).join(', ') || 'hands-on';
  if (typeof v === 'string' && v.trim()) return v.trim();
  return 'hands-on';
}

export function persistProfile(userId, goal, p) {
  // better-sqlite3 treats an array argument as a LIST of bind parameters rather
  // than a single value, so an array reaching .run() silently changes the
  // parameter count and throws "Too many/Too few parameter values were
  // provided" — an error that names nothing useful. Coercing here means no
  // caller can reproduce that, whatever shape the model or the UI sends.
  const text = (v, fb = '') => {
    if (v == null) return fb;
    if (Array.isArray(v)) return v.filter(Boolean).join(', ') || fb;
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  db.prepare(`INSERT INTO user_profiles (user_id, goal, background, level, time_per_week, learning_style, motivations, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      goal=excluded.goal, background=excluded.background, level=excluded.level,
      time_per_week=excluded.time_per_week, learning_style=excluded.learning_style,
      motivations=excluded.motivations, updated_at=datetime('now')`)
    .run(
      String(userId),
      goal == null ? null : String(goal),
      text(p.background),
      text(p.level, 'beginner'),
      Number(p.time_per_week) || 5,
      text(p.learning_style, 'hands-on'),
      JSON.stringify(Array.isArray(p.motivations) ? p.motivations : []),
    );
}

export function getProfile(userId) {
  const r = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
  if (!r) return null;
  let motivations = []; try { motivations = JSON.parse(r.motivations || '[]'); } catch {}
  return { ...r, motivations };
}
