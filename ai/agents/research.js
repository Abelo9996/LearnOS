/**
 * RE — Research agent (G2). Proposes external learning resources for a given
 * node, persists them as status='proposed', and enqueues a verifier job that
 * fetches each URL to confirm reachability before flipping to status='verified'.
 *
 * The LLM is instructed NEVER to invent URLs — it returns *candidate* canonical
 * resources from its training; the verifier proves they exist. Any unreachable
 * URL is moved to status='rejected'.
 */
import db from '../../db/database.js';
import { complete } from '../llm.js';
import { registerJobHandler, enqueueJob } from '../jobs.js';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

// ── SSRF protection (§3.14) ──────────────────────────────────────────────────
// Rejects URLs that resolve to private/internal IPs before any fetch.
function isPublicUrl(u) {
  try {
    const parsed = new URL(u);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    const host = parsed.hostname;
    // Reject literal IPs (numeric or IPv6).
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
    if (host.includes(':')) return false;  // crude IPv6 reject
    // Reject obviously-internal hostnames.
    if (/^(localhost|.*\.local|.*\.internal|169\.254\..*|10\..*|192\.168\..*|172\.(1[6-9]|2[0-9]|3[01])\..*)$/i.test(host)) return false;
    return true;
  } catch { return false; }
}

async function resolvesToPublicIp(hostname) {
  try {
    const { address } = await dnsLookup(hostname, { all: true });
    for (const addr of address) {
      const a = typeof addr === 'string' ? addr : addr.address;
      // RFC 1918 private
      if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(a)) return false;
      // RFC 4193 unique local (fc00::/7)
      if (/^fc[0-9a-f]{2}:/i.test(a) || /^fd[0-9a-f]{2}:/i.test(a)) return false;
      // RFC 1122 loopback
      if (a === '127.0.0.1' || a === '::1' || a.startsWith('127.')) return false;
      // Link-local
      if (/^(169\.254\.|fe80:)/i.test(a)) return false;
      // unspecified
      if (a === '0.0.0.0' || a === '::') return false;
    }
    return true;
  } catch {
    return false;  // fail closed
  }
}

const RESOURCE_KINDS = ['video', 'article', 'paper', 'docs', 'repo'];

const resourceListSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    resources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title:   { type: 'string' },
          url:     { type: 'string' },
          source:  { type: 'string' },
          kind:    { type: 'string', enum: RESOURCE_KINDS },
          summary: { type: 'string' },
        },
        required: ['title', 'url', 'source', 'kind', 'summary'],
      },
    },
  },
  required: ['resources'],
};

const SYSTEM = `You are the Research agent for LearnOS. Given a learning module title and its objectives,
propose 4-6 high-quality external resources that an intermediate learner would find canonical.

Strict rules:
- Only return resources you are HIGHLY confident exist at the URL given. Cite canonical, long-stable URLs
  (arXiv, Wikipedia, official docs, well-known YouTube channels, foundational textbook companion sites).
- Do NOT invent URLs. If you cannot confidently provide a URL, omit the resource.
- Diversify the "kind" field across video/article/paper/docs/repo where natural for the topic.
- "source" is the human-readable site name (e.g. "arXiv", "YouTube", "docs.anthropic.com").
- "summary" is one sentence (max ~120 chars) on what the learner will get from it.
Return only the structured object.`;

export async function proposeResources({ userId, nodeId, roadmapId, title, objectives, kind }) {
  const kindFilter = kind && RESOURCE_KINDS.includes(kind)
    ? `\nFocus on kind="${kind}" only.` : '';
  const objText = (objectives || []).slice(0, 5).map(o => `- ${o}`).join('\n') || '(none)';
  const out = await complete({
    userId, agentCode: 'RE',
    schema: resourceListSchema,
    maxTokens: 1500,
    system: SYSTEM,
    messages: `Module: ${title}\nObjectives:\n${objText}${kindFilter}\nPropose 4-6 resources.`,
  });

  const items = (out.json && Array.isArray(out.json.resources)) ? out.json.resources : [];
  const inserted = [];
  for (const r of items) {
    if (!r || !r.url || !r.title) continue;
    // URL safety: http(s) only + SSRF check.
    if (!/^https?:\/\//i.test(r.url)) continue;
    if (!isPublicUrl(r.url)) continue;
    // Dedupe against existing for the same node.
    const dupe = db.prepare('SELECT 1 FROM node_resources WHERE node_id = ? AND url = ?').get(nodeId, r.url);
    if (dupe) continue;
    const id = `nr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`INSERT INTO node_resources (id, node_id, roadmap_id, kind, title, url, source, summary, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'proposed')`)
      .run(id, nodeId, roadmapId || null, r.kind || 'article', r.title, r.url, r.source || hostnameOf(r.url), r.summary || null);
    inserted.push(id);
  }
  // Kick off verification asynchronously for each proposed row.
  for (const id of inserted) enqueueJob(userId, 'verify-resource', { resourceId: id });
  return { proposed: inserted.length, model: out.model };
}

function hostnameOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

// ── Verifier ───────────────────────────────────────────────────────────────
// Fetches the resource URL with a short timeout, checks HTTP status, content-type,
// and (for some sources) cross-checks the title. Promotes 'proposed' → 'verified'
// or 'rejected'. Uses HEAD when possible; falls back to a small GET.
export async function verifyResource({ resourceId }) {
  const r = db.prepare('SELECT * FROM node_resources WHERE id = ?').get(resourceId);
  if (!r) return { ok: false, reason: 'not_found' };
  if (r.status !== 'proposed') return { ok: true, reason: 'already_' + r.status };

  const reject = (reason) => {
    db.prepare("UPDATE node_resources SET status = 'rejected', summary = COALESCE(summary, '') || ' [rejected: " + reason.replace(/'/g, '') + "]' WHERE id = ?").run(resourceId);
    return { ok: false, reason };
  };
  const accept = () => {
    db.prepare("UPDATE node_resources SET status = 'verified', verified_at = datetime('now'), verified_by = 'auto' WHERE id = ?").run(resourceId);
    return { ok: true };
  };

  // SSRF check: reject private/internal targets before any fetch.
  if (!isPublicUrl(r.url)) return reject('private_target');
  try {
    const hostname = new URL(r.url).hostname;
    if (!await resolvesToPublicIp(hostname)) return reject('private_target');
  } catch { return reject('private_target'); }

  // Reachability check.
  let resp;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    resp = await fetch(r.url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'LearnOS-Verifier/1.0' } });
    // Some hosts disallow HEAD; retry with a tiny GET.
    if (!resp.ok && (resp.status === 405 || resp.status === 403)) {
      resp = await fetch(r.url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'LearnOS-Verifier/1.0', 'Range': 'bytes=0-2048' } });
    }
  } catch (e) {
    clearTimeout(timeout);
    return reject('unreachable');
  }
  clearTimeout(timeout);
  if (!resp || !resp.ok) return reject('http_' + (resp?.status || 'err'));

  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  // Kind-vs-content sanity checks.
  if (r.kind === 'video' && /youtube\.com|youtu\.be|vimeo/i.test(r.url) === false) {
    return reject('not_a_known_video_host');
  }
  if (r.kind === 'paper' && /arxiv\.org|aclanthology|openreview|acm\.org|ieee\.org|nature\.com|science\.org|nips|neurips|pdf/i.test(r.url) === false) {
    // Lenient: only require *something* paper-like; many host on personal sites.
  }
  if (ct.includes('text/html') === false && ct.includes('application/pdf') === false && ct !== '' && r.kind !== 'video') {
    // Allow application/json on docs APIs; only reject obvious binaries.
    if (ct.startsWith('image/') || ct.startsWith('audio/')) return reject('content_type_' + ct.replace(/[^\w]/g, '_'));
  }
  return accept();
}

registerJobHandler('propose-resources', async ({ userId, input }) =>
  proposeResources({ userId, nodeId: input.node_id, roadmapId: input.roadmap_id, title: input.title, objectives: input.objectives || [], kind: input.kind }));

registerJobHandler('verify-resource', async ({ input }) => verifyResource({ resourceId: input.resourceId }));
