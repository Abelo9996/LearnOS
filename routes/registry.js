/**
 * Registry client — LearnOS's side of the community.
 *
 * The registry is a CONVENIENCE, never a dependency. Every route here fails
 * softly and says so: if the service is unreachable, misconfigured, or switched
 * off entirely, the rest of LearnOS carries on exactly as before. Nothing in
 * the app should ever block on it.
 *
 * Calls are proxied through the server rather than made from the browser so
 * that the publisher token never has to live in frontend code, and so the
 * registry URL is configurable in one place.
 */
import { Router } from 'express';
import db, { logActivity, notify } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { isPublicUrl } from '../middleware/url-safety.js';

const router = Router();
router.use(requireAuth);

const DEFAULT_REGISTRY = process.env.LEARNOS_REGISTRY_URL || 'http://localhost:4100';
const TIMEOUT_MS = 12_000;

/** Registry settings live in user_settings so they persist and stay editable. */
function getConfig(userId) {
  const row = db.prepare('SELECT registry_url, registry_handle, registry_token, registry_enabled FROM user_settings WHERE user_id = ?').get(userId) || {};
  return {
    url: (row.registry_url || DEFAULT_REGISTRY).replace(/\/+$/, ''),
    handle: row.registry_handle || null,
    token: row.registry_token || null,
    // Opt-out is explicit and respected everywhere: a self-hosted app should be
    // able to talk to nothing at all.
    enabled: row.registry_enabled == null ? 1 : row.registry_enabled,
  };
}

/**
 * The registry is a remote host the user can point anywhere, so it goes through
 * the same SSRF policy as any other user-supplied URL — with an explicit
 * carve-out for loopback, because the expected default IS a local service.
 */
function assertUsableUrl(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error('Registry URL is not a valid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Registry URL must be http or https');
  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
  if (!isLoopback && !isPublicUrl(url)) throw new Error('Registry URL must be a public address or localhost');
  return u.toString().replace(/\/+$/, '');
}

async function call(url, path, { method = 'GET', body } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/api/registry${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {
      throw new Error('The registry returned something unexpected — is that URL really a LearnOS registry?');
    }
    if (!res.ok) {
      const err = new Error(data?.message || `Registry error (${res.status})`);
      err.code = data?.code || null;
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The registry did not respond in time.');
    if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(e.message)) {
      throw new Error('Cannot reach the registry. Course sharing by file still works offline.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/registry/config — what this instance is pointed at. */
router.get('/config', (req, res) => {
  const c = getConfig(req.userId);
  res.json({
    ok: true,
    url: c.url,
    handle: c.handle,
    enabled: !!c.enabled,
    // The token authorises updates and unlisting; it must never leave the server.
    hasToken: !!c.token,
    isDefault: c.url === DEFAULT_REGISTRY.replace(/\/+$/, ''),
  });
});

/** PATCH /api/registry/config — point elsewhere, or switch it off entirely. */
router.patch('/config', (req, res) => {
  const { url, handle, enabled } = req.body || {};
  const fields = [];
  const vals = [];
  try {
    if (url !== undefined) { fields.push('registry_url = ?'); vals.push(url ? assertUsableUrl(url) : null); }
  } catch (e) {
    return res.status(400).json({ error: true, message: e.message });
  }
  if (handle !== undefined) {
    const h = String(handle || '').trim().toLowerCase();
    if (h && !/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(h)) {
      return res.status(400).json({ error: true, message: 'Handle must be 3-32 characters: lowercase letters, numbers and dashes.' });
    }
    fields.push('registry_handle = ?'); vals.push(h || null);
    // Handle and token are one credential. Keeping a token for a handle we no
    // longer claim would be a secret we can never use and never see.
    if (!h) { fields.push('registry_token = ?'); vals.push(null); }
  }
  if (enabled !== undefined) { fields.push('registry_enabled = ?'); vals.push(enabled ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ error: true, message: 'Nothing to update' });

  vals.push(req.userId);
  db.prepare(`UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = ?`).run(...vals);
  res.json({ ok: true, ...getConfig(req.userId), token: undefined });
});

/** GET /api/registry/browse — proxied search, so the UI has one origin. */
router.get('/browse', async (req, res) => {
  const c = getConfig(req.userId);
  if (!c.enabled) return res.status(409).json({ error: true, code: 'DISABLED', message: 'Community sharing is switched off for this instance.' });
  try {
    const qs = new URLSearchParams(
      Object.entries({ q: req.query.q, level: req.query.level, sort: req.query.sort, limit: req.query.limit })
        .filter(([, v]) => v)
    ).toString();
    res.json(await call(c.url, `/courses${qs ? `?${qs}` : ''}`));
  } catch (e) {
    res.status(502).json({ error: true, message: e.message });
  }
});

/** GET /api/registry/browse/:id — detail before importing. */
router.get('/browse/:id', async (req, res) => {
  const c = getConfig(req.userId);
  if (!c.enabled) return res.status(409).json({ error: true, code: 'DISABLED', message: 'Community sharing is switched off for this instance.' });
  try {
    res.json(await call(c.url, `/courses/${encodeURIComponent(req.params.id)}`));
  } catch (e) {
    res.status(502).json({ error: true, message: e.message });
  }
});

/**
 * POST /api/registry/import/:id — fetch a published bundle and hand it back.
 *
 * The bundle is NOT written here: it is returned so the existing import path in
 * routes/share.js does the writing, which means community imports go through
 * exactly the same validation as a file someone dropped in by hand.
 */
router.post('/import/:id', async (req, res) => {
  const c = getConfig(req.userId);
  if (!c.enabled) return res.status(409).json({ error: true, code: 'DISABLED', message: 'Community sharing is switched off for this instance.' });
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let bundle;
    try {
      const r = await fetch(`${c.url}/api/registry/courses/${encodeURIComponent(req.params.id)}/download`, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`Registry returned ${r.status}`);
      bundle = await r.json();
    } finally { clearTimeout(timer); }
    res.json({ ok: true, bundle });
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'The registry did not respond in time.' : (e.message || 'Download failed');
    res.status(502).json({ error: true, message: msg });
  }
});

/**
 * POST /api/registry/publish/:slug — publish one of this user's courses.
 *
 * Exports through the same bundle builder the file export uses, so what gets
 * published is exactly what a file download would contain.
 */
router.post('/publish/:slug', async (req, res) => {
  const c = getConfig(req.userId);
  if (!c.enabled) return res.status(409).json({ error: true, code: 'DISABLED', message: 'Community sharing is switched off for this instance.' });

  const handle = String(req.body?.handle || c.handle || '').trim().toLowerCase();
  if (!handle) return res.status(400).json({ error: true, code: 'NO_HANDLE', message: 'Choose a publisher handle first.' });

  const course = db.prepare('SELECT slug, title FROM courses WHERE slug = ?').get(req.params.slug);
  if (!course) return res.status(404).json({ error: true, message: 'Course not found' });

  try {
    const { buildBundle } = await import('./share.js');
    const bundle = buildBundle(course.slug);
    if (!bundle) return res.status(404).json({ error: true, message: 'Course not found' });

    const out = await call(c.url, '/publish', {
      method: 'POST',
      body: { handle, token: c.token || undefined, bundle },
    });

    // A token is issued exactly once, when the handle is claimed. Store it now
    // or the publisher permanently loses the ability to update their own work.
    if (out.token) {
      db.prepare('UPDATE user_settings SET registry_handle = ?, registry_token = ? WHERE user_id = ?')
        .run(handle, out.token, req.userId);
    } else if (handle !== c.handle) {
      db.prepare('UPDATE user_settings SET registry_handle = ? WHERE user_id = ?').run(handle, req.userId);
    }

    try {
      logActivity(req.userId, {
        kind: 'session',
        text: `${out.updated ? 'Updated' : 'Published'} to community: ${course.title}`,
        sub: `${out.course.modules} modules · ${out.course.lessons} lessons · as @${handle}`,
        agent: 'CR',
      });
      notify(req.userId, {
        kind: 'milestone',
        title: `${out.updated ? 'Updated' : 'Published'} — ${course.title}`,
        body: `Live on the community registry as @${handle}. ${out.course.lessons} lessons, ${out.course.quizItems} questions.`,
        actionScreen: 'share',
      });
    } catch {}

    res.json({ ok: true, ...out, token: undefined, tokenSaved: !!out.token });
  } catch (e) {
    res.status(e.status === 403 ? 403 : 502).json({ error: true, code: e.code || null, message: e.message });
  }
});

export default router;
