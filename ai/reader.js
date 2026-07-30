/**
 * Reader mode — fetches an external article/docs page and extracts its readable
 * text as Markdown so references can be studied inside LearnOS instead of only
 * as outbound links. No headless browser, no heavy parser: a bounded fetch plus
 * a conservative HTML → Markdown reduction. Sites that resist extraction fall
 * back cleanly to the "open original" card in the UI.
 *
 * SSRF-guarded with the same checks the resource verifier uses, and results are
 * cached in reader_cache (per URL) so a lesson is fetched at most once a week.
 */
import db from '../db/database.js';
import { isPublicUrl, resolvesToPublicIp } from './agents/research.js';

const MAX_BYTES = 1_500_000;
const CACHE_DAYS = 7;
const MIN_USEFUL_CHARS = 400; // less than this and the extraction failed in practice

function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', times: '×', middot: '·', copy: '©' };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m);
}

// Reduce an HTML fragment to plain inline text (tags stripped, entities decoded).
function inlineText(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(strong|b)\b[^>]*>/gi, '**')
      .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => '`' + c.replace(/<[^>]+>/g, '').trim() + '`')
      .replace(/<[^>]+>/g, '')
  ).replace(/[ \t]+/g, ' ').trim();
}

/** Extract {title, markdown} from raw HTML. Returns null when nothing useful. */
export function extractReadable(html, url) {
  if (!html) return null;
  // Title: og:title beats <title>.
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const tt = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = decodeEntities((og?.[1] || tt?.[1] || '').trim()).slice(0, 200) || null;

  // Drop everything that is never content.
  let body = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|iframe|form|nav|header|footer|aside|template)\b[\s\S]*?<\/\1>/gi, '');

  // Prefer the semantic content container when one exists.
  const container = body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
    || body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
    || body.match(/<div[^>]+(?:id|class)=["'][^"']*(?:content|article|post|entry)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (container) body = container[1];

  // Walk block-level elements in document order and emit Markdown.
  const out = [];
  const blockRe = /<(h[1-4]|p|li|pre|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = blockRe.exec(body)) !== null) {
    const tag = m[1].toLowerCase();
    if (tag === 'pre') {
      const code = decodeEntities(m[2].replace(/<[^>]+>/g, '')).replace(/^\n+|\n+$/g, '');
      if (code.trim()) out.push('```\n' + code + '\n```');
      continue;
    }
    const text = inlineText(m[2]);
    if (!text || text.length < 3) continue;
    if (tag.startsWith('h')) out.push(`${'#'.repeat(Number(tag[1]) + 1)} ${text}`);
    else if (tag === 'li') out.push(`- ${text}`);
    else if (tag === 'blockquote') out.push(`> ${text}`);
    else out.push(text);
  }

  const markdown = out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  if (markdown.length < MIN_USEFUL_CHARS) return null;
  return { title, markdown: markdown.slice(0, 60_000), source: (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })() };
}

/** Fetch a URL (SSRF-guarded, size-capped) and return extracted readable content. */
export async function fetchReadable(url) {
  const cached = db.prepare("SELECT * FROM reader_cache WHERE url = ? AND fetched_at > datetime('now', ?)").get(url, `-${CACHE_DAYS} days`);
  if (cached) return cached.ok ? { title: cached.title, markdown: cached.content_md, source: cached.source, cached: true } : null;

  const store = (row) => {
    db.prepare(`INSERT OR REPLACE INTO reader_cache (url, title, content_md, source, ok, fetched_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`)
      .run(url, row?.title || null, row?.markdown || null, row?.source || null, row ? 1 : 0);
    return row;
  };

  if (!isPublicUrl(url)) return store(null);
  try {
    const hostname = new URL(url).hostname;
    if (!await resolvesToPublicIp(hostname)) return store(null);
  } catch { return store(null); }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const resp = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'LearnOS-Reader/1.0', 'Accept': 'text/html' } });
    clearTimeout(timeout);
    if (!resp.ok) return store(null);
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('text/html')) return store(null); // PDFs etc. stay external
    const reader = resp.body.getReader();
    const chunks = []; let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); size += value.length;
    }
    reader.cancel().catch(() => {});
    const html = Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf-8');
    return store(extractReadable(html, url));
  } catch {
    clearTimeout(timeout);
    return store(null);
  }
}
