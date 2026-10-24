/**
 * Claude subscription provider: runs the Claude Code CLI (`claude -p`) that the
 * learner is already signed in to, so LearnOS works with a Claude plan and no
 * API key or per-token bill.
 *
 * Selected by model slug: `claude-code/sonnet`, `claude-code/opus`,
 * `claude-code/haiku` (any alias or full model id the CLI accepts works after
 * the slash). Every agent's routing and the "one model for every agent" setting
 * work unchanged.
 *
 * Each call is a single non-interactive turn with no tools, no MCP servers, no
 * settings and no session saved, from an empty temp directory so no project
 * CLAUDE.md is picked up. ANTHROPIC_API_KEY is removed from the child's
 * environment: with it set, the CLI bills the API instead of the plan, which is
 * the opposite of what choosing this provider means.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CLAUDE_CODE_PREFIX = 'claude-code/';
const BIN = process.env.LEARNOS_CLAUDE_BIN || 'claude';
// The subscription has its own rate limits; a course build would otherwise
// start a dozen CLI processes at once.
const MAX_PARALLEL = Math.max(1, parseInt(process.env.LEARNOS_CLAUDE_PARALLEL || '', 10) || 3);

export const CLAUDE_CODE_MODELS = [
  { id: 'claude-code/sonnet', name: 'Claude Sonnet (your Claude plan)', slug: 'sonnet' },
  { id: 'claude-code/opus', name: 'Claude Opus (your Claude plan)', slug: 'opus' },
  { id: 'claude-code/haiku', name: 'Claude Haiku (your Claude plan)', slug: 'haiku' },
];

export function isClaudeCodeModel(model) {
  return typeof model === 'string' && model.startsWith(CLAUDE_CODE_PREFIX);
}

let active = 0;
const waiting = [];
async function slot() {
  if (active < MAX_PARALLEL) { active++; return; }
  await new Promise(resolve => waiting.push(resolve));
  active++;
}
function release() {
  active--;
  const next = waiting.shift();
  if (next) next();
}

function childEnv() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDECODE; // not a nested session of whatever launched LearnOS
  return env;
}

function run(args, { input = '', timeoutMs = 300_000, cwd } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(BIN, args, { cwd, env: childEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      resolve({ code: null, stdout: '', stderr: '', error: e });
      return;
    }
    let stdout = '', stderr = '', done = false;
    const timer = setTimeout(() => { if (!done) child.kill('SIGKILL'); }, timeoutMs);
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', (e) => { done = true; clearTimeout(timer); resolve({ code: null, stdout, stderr, error: e }); });
    child.on('close', (code, signal) => { done = true; clearTimeout(timer); resolve({ code, signal, stdout, stderr }); });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

/** Flatten chat turns into one prompt; the system prompt travels separately. */
function promptFrom(chat) {
  const turns = chat.filter(m => m.role !== 'system');
  if (turns.length === 1) return turns[0].content;
  return turns.map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`).join('\n\n')
    + '\n\nReply to the last User message as the Assistant.';
}

/**
 * One completion through the CLI.
 * @returns {Promise<{text, structured, usage, stopReason}>}
 */
export async function completeViaClaudeCode({ model, systemText, chat, schema, timeoutMs = 300_000 }) {
  const alias = model.slice(CLAUDE_CODE_PREFIX.length) || 'sonnet';
  const args = [
    '-p', '--model', alias, '--output-format', 'json',
    '--tools', '', '--strict-mcp-config', '--setting-sources', '', '--no-session-persistence',
    '--system-prompt', systemText || 'You are a helpful assistant.',
  ];
  if (schema) args.push('--json-schema', JSON.stringify(schema));

  await slot();
  const dir = await mkdtemp(join(tmpdir(), 'learnos-claude-'));
  try {
    const out = await run(args, { input: promptFrom(chat), timeoutMs, cwd: dir });
    if (out.error?.code === 'ENOENT') {
      throw Object.assign(new Error('The Claude Code CLI is not installed. Install it from https://claude.com/claude-code, run `claude` once to sign in, then try again.'), { code: 'NO_CLI' });
    }
    if (out.signal === 'SIGKILL') {
      throw Object.assign(new Error(`Claude Code did not answer within ${Math.round(timeoutMs / 1000)}s.`), { code: 'TIMEOUT' });
    }
    let data;
    try { data = JSON.parse(out.stdout.trim().split('\n').pop()); } catch {
      const hint = /log ?in|auth|credential/i.test(out.stderr + out.stdout) ? ' Run `claude` in a terminal and sign in.' : '';
      throw Object.assign(new Error(`Claude Code returned no result.${hint} ${(out.stderr || out.stdout).slice(0, 300)}`.trim()), { code: hint ? 'NO_KEY' : undefined });
    }
    if (data.is_error) {
      const msg = String(data.result || data.subtype || 'error');
      const auth = /log ?in|auth|credential|subscription/i.test(msg);
      throw Object.assign(new Error(`Claude Code: ${msg.slice(0, 400)}`), { code: auth ? 'NO_KEY' : undefined });
    }
    const u = data.usage || {};
    return {
      text: typeof data.result === 'string' ? data.result : '',
      structured: data.structured_output ?? null,
      usage: {
        prompt_tokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
        completion_tokens: u.output_tokens || 0,
        prompt_tokens_details: { cached_tokens: u.cache_read_input_tokens || 0 },
      },
      stopReason: data.stop_reason === 'max_tokens' ? 'length' : 'stop',
    };
  } finally {
    release();
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Is the CLI installed and signed in? Cached briefly; used by Settings. */
let statusCache = { at: 0, value: null };
export async function claudeCodeStatus({ refresh = false } = {}) {
  if (!refresh && statusCache.value && Date.now() - statusCache.at < 60_000) return statusCache.value;
  const version = await run(['--version'], { timeoutMs: 15_000 });
  let value;
  if (version.error || version.code !== 0) {
    value = { installed: false, loggedIn: false, version: null };
  } else {
    const auth = await run(['auth', 'status'], { timeoutMs: 15_000 });
    let info = {};
    try { info = JSON.parse(auth.stdout); } catch { /* older CLI without auth status */ }
    value = {
      installed: true,
      version: version.stdout.trim().split(/\s+/)[0] || null,
      loggedIn: info.loggedIn ?? null,
      authMethod: info.authMethod || null,
    };
  }
  statusCache = { at: Date.now(), value };
  return value;
}

export default { completeViaClaudeCode, claudeCodeStatus, isClaudeCodeModel, CLAUDE_CODE_MODELS, CLAUDE_CODE_PREFIX };
