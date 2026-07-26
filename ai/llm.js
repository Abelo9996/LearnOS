/**
 * LearnOS LLM provider abstraction.
 * Single entry point `complete()` for every agent call:
 *   - resolves the OpenRouter API key: per-user BYOK key (Settings → API Keys)
 *     first, else the OPENROUTER_API_KEY env key
 *   - resolves the model from agent_routing (or a default)
 *   - returns { text, json, usage, cost } and logs every run to agent_runs
 *
 * Provider = OpenRouter (https://openrouter.ai), an OpenAI-compatible gateway.
 * One key unlocks every major model (Anthropic, OpenAI, Google, Meta, …) by
 * slug, so users pick whatever balance of quality/cost they want.
 */
import db, { logAgentRun, bumpUsage } from '../db/database.js';
import { decryptSecret } from './crypto.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Model slug used when no per-agent routing is configured. Any OpenRouter slug
// works — see https://openrouter.ai/models. Cheap + capable by default.
const DEFAULT_MODEL = process.env.LEARNOS_DEFAULT_MODEL || 'anthropic/claude-haiku-4.5';

// Optional env-provided key so a self-hoster can drop one key in and go without
// touching the UI. A per-user key added in Settings always takes precedence.
const ENV_KEY = process.env.OPENROUTER_API_KEY || process.env.LEARNOS_OPENROUTER_KEY || null;

export function resolveModel(userId, agentCode, explicit) {
  if (explicit) return explicit;
  if (userId && agentCode) {
    const row = db.prepare('SELECT model FROM agent_routing WHERE user_id = ? AND agent_code = ?').get(userId, agentCode);
    if (row?.model) return row.model;
  }
  return DEFAULT_MODEL;
}

// A usable key is a non-empty token that isn't an obvious seed placeholder.
// OpenRouter keys look like `sk-or-v1-…`; we stay lenient so any real key works.
function looksUsable(key) {
  return typeof key === 'string' && key.length >= 16 && !/REPLACE|PLACEHOLDER|xxxx/i.test(key);
}

// BYOK (an active OpenRouter key from Settings) takes precedence; else the env key.
function resolveKey(userId) {
  if (userId) {
    const row = db.prepare(
      "SELECT encrypted_key FROM api_keys WHERE user_id = ? AND provider = 'openrouter' AND is_active = 1 ORDER BY created_at DESC LIMIT 1"
    ).get(userId);
    if (row?.encrypted_key) {
      const key = decryptSecret(row.encrypted_key);
      if (looksUsable(key)) return { apiKey: key, managed: false };
    }
  }
  if (ENV_KEY && looksUsable(ENV_KEY)) return { apiKey: ENV_KEY, managed: true };
  return null;
}

// Pull a JSON object out of a model response that may be wrapped in prose or
// ```json fences — different models format structured output differently.
function parseJson(text) {
  if (!text) return null;

  // Try the raw response FIRST. Structured-output models return bare JSON, and
  // when a string field carries Markdown containing ``` code fences, pulling the
  // "fenced" region out instead would slice the object apart and lose the whole
  // response — which silently emptied every generated lesson body.
  try { return JSON.parse(text.trim()); } catch { /* not bare JSON — keep going */ }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
  }

  // Last resort: widest {...} span in the raw text (not the fenced fragment).
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* ignore */ }
  }
  return null;
}

/**
 * complete — the one call every agent goes through.
 * @param {object} opts
 *   userId, agentCode — for key/model resolution + logging
 *   system            — stable system prompt
 *   messages          — string or OpenAI-style message array
 *   model             — explicit model override (OpenRouter slug)
 *   schema            — JSON schema → structured output (returns .json)
 *   maxTokens
 * @returns {Promise<{text, json, usage, model, managed, cost, runId, stopReason}>}
 */
export async function complete(opts = {}) {
  const {
    userId = null, agentCode = null, system, messages,
    model: explicitModel, schema = null, maxTokens = 8192,
  } = opts;

  const model = resolveModel(userId, agentCode, explicitModel);
  const creds = resolveKey(userId);
  if (!creds) {
    const err = new Error('No OpenRouter API key available. Add one in Settings → API Keys, or set OPENROUTER_API_KEY for the server.');
    err.code = 'NO_KEY';
    throw err;
  }

  // Build OpenAI-compatible chat messages: system prompt first, then the turns.
  const chat = [];
  let systemText = system ? String(system) : '';
  if (schema) {
    // Belt-and-suspenders across models: ask for raw JSON in-prompt AND send a
    // response_format below. Models with native structured output honor the
    // latter; others still return clean JSON thanks to the instruction.
    systemText += `${systemText ? '\n\n' : ''}Respond with ONLY a single valid JSON object matching this JSON schema. No markdown, no code fences, no commentary:\n${JSON.stringify(schema)}`;
  }
  if (systemText) chat.push({ role: 'system', content: systemText });
  if (Array.isArray(messages)) {
    for (const m of messages) chat.push({ role: m.role || 'user', content: String(m.content ?? '') });
  } else {
    chat.push({ role: 'user', content: String(messages ?? '') });
  }

  const body = {
    model,
    messages: chat,
    max_tokens: maxTokens,
    usage: { include: true }, // ask OpenRouter to return real USD cost + token counts
  };
  if (schema) {
    body.response_format = { type: 'json_schema', json_schema: { name: 'result', strict: false, schema } };
  }

  const started = Date.now();
  const runId = `run-${started}-${Math.random().toString(36).slice(2, 8)}`;
  let data;
  // Hard timeout. The job runner drains serially behind a single `running`
  // flag, so one hung provider request would stall EVERY queued job (roadmap
  // generation, grading, research) indefinitely with no error surfaced.
  const controller = new AbortController();
  const timeoutMs = parseInt(process.env.LEARNOS_LLM_TIMEOUT_MS || '', 10) || 120_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3001',
        'X-Title': 'LearnOS',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      throw new Error(`OpenRouter ${resp.status}: ${detail.slice(0, 500)}`);
    }
    data = await resp.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  } catch (e) {
    const aborted = e?.name === 'AbortError';
    const err = aborted
      ? Object.assign(new Error(`Model request timed out after ${Math.round(timeoutMs / 1000)}s (model: ${model}). Try a faster model in Settings → Agents.`), { code: 'TIMEOUT' })
      : e;
    record({ runId, userId, agentCode, model, managed: creds.managed, usage: null, latency: Date.now() - started, status: 'error', error: err?.message || String(err), cost: 0 });
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const latency = Date.now() - started;
  const choice = data.choices?.[0] || {};
  const text = choice.message?.content || '';
  const usage = data.usage || {};
  const cost = typeof usage.cost === 'number' ? usage.cost : 0;
  const json = schema ? parseJson(text) : null;

  record({ runId, userId, agentCode, model, managed: creds.managed, usage, latency, status: 'ok', error: null, cost });
  return { text, json, usage, model, managed: creds.managed, cost, runId, stopReason: choice.finish_reason };
}

function record(r) {
  try {
    const inTok = r.usage?.prompt_tokens || 0;
    const outTok = r.usage?.completion_tokens || 0;
    const cacheRead = r.usage?.prompt_tokens_details?.cached_tokens || 0;
    logAgentRun({
      id: r.runId, user_id: r.userId, agent_code: r.agentCode, model: r.model,
      provider: 'openrouter', managed: r.managed ? 1 : 0,
      input_tokens: inTok, output_tokens: outTok,
      cache_read_tokens: cacheRead, cache_write_tokens: 0,
      cost_usd: r.cost || 0, latency_ms: r.latency || 0, status: r.status, error: r.error,
    });
    if (r.userId) bumpUsage(r.userId, inTok + outTok, r.cost || 0);
  } catch { /* never let logging break a call */ }
}

// True when a server-wide OpenRouter key is configured via env.
export function hasManagedKey() { return !!(ENV_KEY && looksUsable(ENV_KEY)); }
