/**
 * LearnOS LLM provider abstraction (PLAT-01/02/03/05).
 * Single entry point `complete()` for every agent call:
 *   - resolves managed Anthropic key (env) vs per-user BYOK key
 *   - resolves model from agent_routing (or a managed default)
 *   - prompt-caches the stable agent system prompt
 *   - returns { text, json, usage, cost } and logs every run to agent_runs
 * Anthropic-only for v1; OpenAI/Gemini stubbed behind this interface later.
 */
import Anthropic from '@anthropic-ai/sdk';
import db, { logAgentRun, bumpUsage } from '../db/database.js';
import { decryptSecret } from './crypto.js';

// Pricing per 1M tokens (USD) — keep in sync with the model catalog.
const PRICING = {
  'claude-opus-4-8':   { in: 5, out: 25 },
  'claude-opus-4-7':   { in: 5, out: 25 },
  'claude-opus-4-6':   { in: 5, out: 25 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5':  { in: 1, out: 5 },
};

// Adaptive thinking + effort are supported on Opus 4.x and Sonnet 4.6 only
// (they 400 on Haiku 4.5), so gate those request fields by model.
const THINKING_MODELS = new Set([
  'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6',
]);

const DEFAULT_MODEL = process.env.LEARNOS_DEFAULT_MODEL || 'claude-haiku-4-5';
const MANAGED_KEY = process.env.LEARNOS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY || null;

export function resolveModel(userId, agentCode, explicit) {
  if (explicit) return explicit;
  if (userId && agentCode) {
    const row = db.prepare('SELECT model FROM agent_routing WHERE user_id = ? AND agent_code = ?').get(userId, agentCode);
    if (row?.model) return row.model;
  }
  return DEFAULT_MODEL;
}

// A usable key is `sk-` + plausible length of printable ASCII. This rejects the
// fake seed placeholders (e.g. "sk-ant-…7Z2") so we never hand a malformed key
// to the SDK — those fall through to the managed key or a clean NO_KEY error.
function looksUsable(key) {
  return typeof key === 'string' && /^sk-[\x21-\x7e]{20,}$/.test(key);
}

// BYOK (active anthropic key) takes precedence; else the managed platform key.
function resolveKey(userId) {
  if (userId) {
    const row = db.prepare(
      "SELECT encrypted_key FROM api_keys WHERE user_id = ? AND provider = 'anthropic' AND is_active = 1 ORDER BY created_at DESC LIMIT 1"
    ).get(userId);
    if (row?.encrypted_key) {
      const key = decryptSecret(row.encrypted_key);
      if (looksUsable(key)) return { apiKey: key, managed: false };
    }
  }
  if (MANAGED_KEY) return { apiKey: MANAGED_KEY, managed: true };
  return null;
}

function priceFor(model, usage) {
  const p = PRICING[model] || PRICING[DEFAULT_MODEL] || { in: 1, out: 5 };
  const inTok = usage?.input_tokens || 0;
  const outTok = usage?.output_tokens || 0;
  const cacheRead = usage?.cache_read_input_tokens || 0;   // ~0.1x input
  const cacheWrite = usage?.cache_creation_input_tokens || 0; // ~1.25x input (5m TTL)
  return (inTok * p.in + cacheWrite * p.in * 1.25 + cacheRead * p.in * 0.1 + outTok * p.out) / 1_000_000;
}

/**
 * complete — the one call every agent goes through.
 * @param {object} opts
 *   userId, agentCode — for key/model resolution + logging
 *   system            — stable system prompt (prompt-cached)
 *   messages          — string or Anthropic message array
 *   model             — explicit model override
 *   schema            — JSON schema → structured output (returns .json)
 *   maxTokens, thinking(bool), effort('low'|'medium'|'high'|'max')
 * @returns {Promise<{text, json, usage, model, managed, cost, runId, stopReason}>}
 */
export async function complete(opts = {}) {
  const {
    userId = null, agentCode = null, system, messages,
    model: explicitModel, schema = null,
    maxTokens = 8192, thinking = false, effort = null,
  } = opts;

  const model = resolveModel(userId, agentCode, explicitModel);
  const creds = resolveKey(userId);
  if (!creds) {
    const err = new Error('No Anthropic API key available. Add one in Settings, or set LEARNOS_ANTHROPIC_KEY for the managed default.');
    err.code = 'NO_KEY';
    throw err;
  }

  // S-03: Enforce managed-key usage caps for non-BYOK users
  if (creds.managed && userId) {
    const capTokens = parseInt(process.env.MANAGED_MONTHLY_TOKEN_CAP || '0') || Infinity;
    const capCost = parseFloat(process.env.MANAGED_MONTHLY_COST_CAP || '0') || Infinity;
    if (capTokens < Infinity || capCost < Infinity) {
      const period = new Date().toISOString().slice(0, 7); // YYYY-MM
      const usage = db.prepare('SELECT tokens, cost_usd FROM usage_counters WHERE user_id = ? AND period = ?').get(userId, period);
      const usedTokens = usage?.tokens || 0;
      const usedCost = usage?.cost_usd || 0;
      if (usedTokens >= capTokens || usedCost >= capCost) {
        const err = new Error('Monthly managed-key usage cap exceeded. Add your own Anthropic key in Settings → API Keys to continue.');
        err.code = 'USAGE_CAP_EXCEEDED';
        err.status = 402;
        throw err;
      }
    }
  }

  const client = new Anthropic({ apiKey: creds.apiKey });

  const req = {
    model,
    max_tokens: maxTokens,
    messages: Array.isArray(messages)
      ? messages
      : [{ role: 'user', content: String(messages ?? '') }],
  };
  if (system) {
    // Stable system prompt → cache it (prefix match; min ~2-4K tokens to actually cache).
    req.system = [{ type: 'text', text: String(system), cache_control: { type: 'ephemeral' } }];
  }
  if (schema) {
    req.output_config = { format: { type: 'json_schema', schema } };
  }
  if (thinking && THINKING_MODELS.has(model)) {
    req.thinking = { type: 'adaptive' };
  }
  if (effort && THINKING_MODELS.has(model)) {
    req.output_config = { ...(req.output_config || {}), effort };
  }

  const started = Date.now();
  const runId = `run-${started}-${Math.random().toString(36).slice(2, 8)}`;
  let resp;
  try {
    resp = await client.messages.create(req);
  } catch (e) {
    record({ runId, userId, agentCode, model, managed: creds.managed, usage: null, latency: Date.now() - started, status: 'error', error: e?.message || String(e), cost: 0 });
    throw e;
  }

  const latency = Date.now() - started;
  const usage = resp.usage || {};
  const cost = priceFor(model, usage);

  let text = '';
  for (const block of resp.content || []) if (block.type === 'text') text += block.text;
  let json = null;
  if (schema) { try { json = JSON.parse(text); } catch { json = null; } }

  record({ runId, userId, agentCode, model, managed: creds.managed, usage, latency, status: 'ok', error: null, cost });
  return { text, json, usage, model, managed: creds.managed, cost, runId, stopReason: resp.stop_reason };
}

function record(r) {
  try {
    logAgentRun({
      id: r.runId, user_id: r.userId, agent_code: r.agentCode, model: r.model,
      provider: 'anthropic', managed: r.managed ? 1 : 0,
      input_tokens: r.usage?.input_tokens || 0, output_tokens: r.usage?.output_tokens || 0,
      cache_read_tokens: r.usage?.cache_read_input_tokens || 0,
      cache_write_tokens: r.usage?.cache_creation_input_tokens || 0,
      cost_usd: r.cost || 0, latency_ms: r.latency || 0, status: r.status, error: r.error,
    });
    if (r.managed && r.userId) {
      bumpUsage(r.userId, (r.usage?.input_tokens || 0) + (r.usage?.output_tokens || 0), r.cost || 0);
    }
  } catch { /* never let logging break a call */ }
}

export function hasManagedKey() { return !!MANAGED_KEY; }
