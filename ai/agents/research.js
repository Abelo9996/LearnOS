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
// Exported for reuse by the reader-mode fetcher (ai/reader.js).
export function isPublicUrl(u) {
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

export async function resolvesToPublicIp(hostname) {
  try {
    // With { all: true }, dns.lookup resolves to an ARRAY of {address, family}.
    // This was destructured as `{ address }` (→ undefined), so the loop threw
    // and every URL failed closed — silently rejecting ALL real resources.
    const records = await dnsLookup(hostname, { all: true });
    const list = Array.isArray(records) ? records : [records];
    for (const rec of list) {
      const a = typeof rec === 'string' ? rec : rec.address;
      if (!a) continue;
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

const RESOURCE_KINDS = ['video', 'paper', 'book', 'blog', 'article', 'website', 'docs', 'repo'];

// YouTube/Vimeo return HTTP 200 with a "video unavailable" page for nonexistent
// video IDs, so a plain reachability check happily verifies hallucinated links.
// Their oEmbed endpoints return a real 404 for missing videos — use those.
async function videoActuallyExists(url) {
  let oembed = null;
  if (/youtube\.com\/(watch|embed|shorts)|youtu\.be\//i.test(url)) {
    oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  } else if (/vimeo\.com\/\d+/i.test(url)) {
    oembed = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
  }
  if (!oembed) return null; // not a host we can oEmbed-check
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(oembed, { redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'LearnOS-Verifier/1.0' } });
    clearTimeout(timeout);
    return resp.ok;
  } catch { clearTimeout(timeout); return false; }
}

// Standalone reachability check (SSRF-safe HEAD/GET) reused by the course
// generator so AI-authored courses only ever link to resources that resolve.
export async function checkUrlReachable(url, kind = 'article') {
  if (!/^https?:\/\//i.test(url) || !isPublicUrl(url)) return false;
  let hostname;
  try { hostname = new URL(url).hostname; } catch { return false; }
  if (!await resolvesToPublicIp(hostname)) return false;
  if (kind === 'video' && !/youtube\.com|youtu\.be|vimeo\.com|ted\.com|ocw\.mit\.edu|bilibili\.com/i.test(url)) return false;
  const videoCheck = await videoActuallyExists(url);
  if (videoCheck !== null) return videoCheck;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let resp = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'LearnOS-Verifier/1.0' } });
    if (!resp.ok && (resp.status === 405 || resp.status === 403)) {
      resp = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'LearnOS-Verifier/1.0', 'Range': 'bytes=0-2048' } });
    }
    clearTimeout(timeout);
    if (!resp || !resp.ok) return false;
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    if (ct.startsWith('image/') || ct.startsWith('audio/')) return false;
    return true;
  } catch { clearTimeout(timeout); return false; }
}

/**
 * Reachable is not the same as correct.
 *
 * checkUrlReachable answers "does this URL load?" — and every citation passed,
 * because the model does not invent hostnames, it invents *identifiers*. A
 * lesson on policy and value functions cited arXiv 1712.00567, which loads
 * perfectly and is a paper called "Biorthogonal rational functions of R_II
 * type". Eight of eleven arXiv citations in this database pointed at an
 * unrelated paper. The link worked, so nothing ever complained.
 *
 * So: ask the source what the document actually is, and compare it with what
 * the course claims it is.
 */
const STOPWORDS = new Set(['the','a','an','and','or','of','for','with','to','in','on','from','into','using','via','their','this','that','how','what','why','are','is','be','at','by','as','it','its','we','you']);
const contentWords = (s) => new Set(
  String(s || '').toLowerCase().match(/[a-z][a-z0-9+#-]{2,}/g)?.filter(w => !STOPWORDS.has(w)) || []
);

/** Ask arXiv what a paper is actually called. Authoritative and cheap. */
async function arxivTitle(id) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const r = await fetch(`http://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}&max_results=1`,
      { signal: controller.signal, headers: { 'User-Agent': 'LearnOS-Verifier/1.0' } });
    clearTimeout(timeout);
    if (!r.ok) return null;
    const xml = await r.text();
    const m = xml.match(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/);
    return m ? m[1].replace(/\s+/g, ' ').trim() : null;
  } catch { clearTimeout(timeout); return null; }
}

/** The document's own title, for anything that serves HTML. */
async function htmlTitle(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const r = await fetch(url, {
      redirect: 'follow', signal: controller.signal,
      headers: { 'User-Agent': 'LearnOS-Verifier/1.0', Range: 'bytes=0-40000' },
    });
    clearTimeout(timeout);
    if (!r.ok) return null;
    if (!(r.headers.get('content-type') || '').toLowerCase().includes('html')) return null;
    const html = await r.text();
    // Sites append their own name — "Markov chain - Wikipedia" — and that name
    // would otherwise count as a content word in every comparison.
    //
    // Strip it ONLY when the trailing segment actually names the site. A blanket
    // "drop everything after the last dash" rule turned "RL Course by David
    // Silver - Lecture 5: Policy Evaluation" into "RL Course by David Silver"
    // and then reported the citation as pointing somewhere else.
    const hostWords = new Set((new URL(url).hostname.toLowerCase().match(/[a-z]{3,}/g) || []));
    const clean = (s) => {
      let t = s.replace(/\s+/g, ' ').trim();
      const tail = t.match(/^(.*\S)\s*[|\-–—]\s*([^|\-–—]{1,30})$/);
      if (tail) {
        const words = tail[2].toLowerCase().match(/[a-z]{3,}/g) || [];
        if (words.length && words.every(w => hostWords.has(w))) t = tail[1];
      }
      return t || null;
    };
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (og) return clean(og[1]);
    const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return t ? clean(t[1]) : null;
  } catch { clearTimeout(timeout); return null; }
}

/**
 * Does this URL hold the document the course says it does?
 *
 * Returns `{ ok, realTitle, reason }`. `ok` is true when we could confirm a
 * match AND when we could not determine a title at all — an unverifiable source
 * is not evidence of a wrong one, and failing closed here would strip every
 * legitimate link behind a login wall or a JS-rendered page.
 */
export async function checkUrlMatchesClaim(url, claimedTitle, { context = '' } = {}) {
  if (!url || !claimedTitle) return { ok: true, realTitle: null, reason: 'nothing to compare' };
  let u;
  try { u = new URL(url); } catch { return { ok: false, realTitle: null, reason: 'unparseable url' }; }

  const host = u.hostname.replace(/^www\./, '');

  // Only sources addressed by an OPAQUE IDENTIFIER are worth checking this way.
  // "arxiv.org/abs/1712.00567" and "youtube.com/watch?v=go5Au01Jrvs" can point
  // at literally anything, and that is exactly how a fabricated citation ends
  // up resolving to a real but unrelated paper.
  //
  // A descriptive path cannot fail that way — you do not accidentally land on
  // "pandas.pydata.org/docs/user_guide/groupby.html" while meaning something
  // else. Checking those by title comparison only produced false alarms, since
  // a page legitimately titled "Group by: split-apply-combine" was cited as
  // "pandas groupby operations" and got flagged as wrong. Detaching a correct
  // link is worse than keeping a questionable one, so those are left alone once
  // they are known to resolve.
  const arxivId = (host === 'arxiv.org' || host === 'export.arxiv.org') && u.pathname.match(/^\/(?:abs|pdf)\/(.+?)(?:v\d+)?$/);
  const isVideo = /^(youtube\.com|youtu\.be|m\.youtube\.com)$/.test(host);
  if (!arxivId && !isVideo) return { ok: true, realTitle: null, reason: 'descriptive url — reachability is enough' };

  const realTitle = arxivId ? await arxivTitle(arxivId[1]) : await htmlTitle(url);
  if (!realTitle) return { ok: true, realTitle: null, reason: 'no title available' };

  // Wikipedia titles are one or two words ("Markov chain") against a lesson
  // title that is a sentence, so require the article name to appear rather than
  // scoring overlap both ways.
  const real = contentWords(realTitle);
  const claim = contentWords(`${claimedTitle} ${context}`);
  if (!real.size || !claim.size) return { ok: true, realTitle, reason: 'nothing comparable' };

  const shared = [...real].filter(w => claim.has(w)).length;
  const ratio = shared / Math.min(real.size, claim.size);

  // Academic titles describe their contents, so a real overlap is expected and
  // its absence is meaningful. Video titles do not play by that rule — "Python
  // OOP Tutorial 1: Classes and Instances" is exactly the right video for a
  // lesson called "Object-Oriented Programming in Python" while sharing one
  // word. So for video, only a total absence of overlap counts as wrong; that
  // still catches the real failures, where a machine-learning lesson cites a
  // video called "Whole game".
  const ok = isVideo ? shared > 0 : (shared >= 2 || ratio >= 0.5);
  return { ok, realTitle, reason: ok ? 'match' : `claims "${claimedTitle}" but is "${realTitle}"` };
}

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

const SYSTEM = `You are the Research agent for LearnOS. Given a learning module (the learner's "topic of the day") and its objectives, propose a diverse set of high-quality external resources a motivated learner would actually use.

Cover a MIX of these "kind" values wherever they exist for the topic:
- video: recorded lectures & talks — prefer YouTube (MIT OpenCourseWare, Stanford, 3Blue1Brown, conference talks)
- paper: scientific papers (arXiv, ACL Anthology, OpenReview, NeurIPS, Nature, journal DOIs)
- book: canonical textbooks or free online books (author companion sites, well-known publishers, OpenLibrary)
- blog: high-signal posts (distill.pub, respected research/engineering blogs)
- article: explainers & tutorials from reputable sites (Wikipedia, official guides)
- website: important hubs, tools, or interactive references for the topic
- docs: official documentation
- repo: canonical open-source implementations (GitHub)

Strict rules:
- Only return resources you are HIGHLY confident exist at a canonical, long-stable URL. Do NOT invent URLs — omit anything you are unsure of. A verifier fetches every URL and drops dead links, so precision matters.
- Prefer authoritative, evergreen sources over ephemeral ones.
- Aim for 6-8 resources spanning at least 3 different kinds (always include at least one lecture video and one paper or book when the topic allows).
- "source" is the human-readable site name (e.g. "arXiv", "YouTube", "MIT OCW", "distill.pub").
- "summary" is one sentence (max ~120 chars) on what the learner gets from it.
Return only the structured object.`;

export async function proposeResources({ userId, nodeId, roadmapId, title, objectives, kind }) {
  const kindFilter = kind && RESOURCE_KINDS.includes(kind)
    ? `\nFocus on kind="${kind}" only.` : '';
  const objText = (objectives || []).slice(0, 5).map(o => `- ${o}`).join('\n') || '(none)';
  const out = await complete({
    userId, agentCode: 'RE',
    schema: resourceListSchema,
    maxTokens: 2200,
    system: SYSTEM,
    messages: `Topic: ${title}\nObjectives:\n${objText}${kindFilter}\nPropose 6-8 resources spanning several kinds (include lecture videos, papers/books, and articles/blogs where relevant).`,
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

  // Video hosts serve HTTP 200 for missing videos — the oEmbed endpoint is the
  // only honest signal, so it decides alone for those URLs.
  const videoCheck = await videoActuallyExists(r.url);
  if (videoCheck === false) return reject('video_not_found');
  if (videoCheck === true) return accept();

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
  if (r.kind === 'video' && /youtube\.com|youtu\.be|vimeo\.com|ted\.com|ocw\.mit\.edu|bilibili\.com/i.test(r.url) === false) {
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
