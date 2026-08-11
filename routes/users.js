/**
 * User profile, settings, API keys, agent routing, and progress.
 */
import { Router } from 'express';
import db from '../db/database.js';
import { encryptSecret, decryptSecret, maskSecret } from '../ai/crypto.js';

const router = Router();

// ── Profile ──────────────────────────────────────────────────────────────

const USER_PROFILE_COLUMNS = 'id, name, email, role, avatar_hue, avatar_url, bio, links_json, level, xp, xp_to_next, streak, best_streak, plan, created_at, updated_at, last_activity_date';

router.get('/profile', (req, res) => {
  const user = db.prepare(`SELECT ${USER_PROFILE_COLUMNS} FROM users WHERE id = ?`).get(req.userId);
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
  const keys = db.prepare('SELECT id, provider, model, is_active FROM api_keys WHERE user_id = ?').all(req.userId);
  const routing = db.prepare('SELECT agent_code, model FROM agent_routing WHERE user_id = ?').all(req.userId);
  // Flatten the user object so the frontend can read `name`/`email`/`bio`/etc. directly off the profile.
  res.json({ ...user, user, settings, apiKeys: keys, agentRouting: routing });
});

router.patch('/profile', (req, res) => {
  const { name, email, level, xp, streak, best_streak, plan, avatar_url, bio, links_json } = req.body;
  const fields = [];
  const vals = [];
  if (name !== undefined)        { fields.push('name = ?');         vals.push(String(name).slice(0, 80)); }
  if (email !== undefined)       { fields.push('email = ?');        vals.push(email); }
  if (level !== undefined)       { fields.push('level = ?');        vals.push(level); }
  if (xp !== undefined)          { fields.push('xp = ?');           vals.push(xp); }
  if (streak !== undefined)      { fields.push('streak = ?');       vals.push(streak); }
  if (best_streak !== undefined) { fields.push('best_streak = ?');  vals.push(best_streak); }
  if (plan !== undefined)        { fields.push('plan = ?');         vals.push(plan); }
  if (avatar_url !== undefined)  {
    // Only allow same-origin /uploads/* paths or http(s) URLs; reject everything else.
    const v = avatar_url == null ? null : String(avatar_url);
    if (v && !(v.startsWith('/uploads/') || /^https?:\/\//i.test(v))) {
      return res.status(400).json({ error: true, message: 'avatar_url must be an uploaded path or http(s) URL' });
    }
    fields.push('avatar_url = ?'); vals.push(v);
  }
  if (bio !== undefined) {
    fields.push('bio = ?'); vals.push(bio == null ? null : String(bio).slice(0, 500));
  }
  if (links_json !== undefined) {
    // Validate JSON shape: array of {label, url}, max 6
    let parsed = links_json;
    try {
      if (typeof links_json === 'string') parsed = JSON.parse(links_json);
    } catch {
      return res.status(400).json({ error: true, message: 'links_json must be valid JSON' });
    }
    if (parsed !== null && !Array.isArray(parsed)) {
      return res.status(400).json({ error: true, message: 'links_json must be an array' });
    }
    if (Array.isArray(parsed)) {
      parsed = parsed.slice(0, 6).filter(l => l && typeof l.url === 'string' && /^https?:\/\//i.test(l.url))
        .map(l => ({ label: String(l.label || '').slice(0, 40), url: String(l.url).slice(0, 300) }));
    }
    fields.push('links_json = ?'); vals.push(parsed == null ? null : JSON.stringify(parsed));
  }
  if (fields.length === 0) return res.status(400).json({ error: true, message: 'No fields to update' });

  fields.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(req.userId);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true, user: db.prepare(`SELECT ${USER_PROFILE_COLUMNS} FROM users WHERE id = ?`).get(req.userId) });
});

// ── Settings ─────────────────────────────────────────────────────────────

router.get('/settings', (req, res) => {
  const s = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
  res.json(s);
});

router.patch('/settings', (req, res) => {
  const { theme, density, font_size, local_only, onboarded_at } = req.body;
  const fields = [];
  const vals = [];
  if (theme !== undefined)    { fields.push('theme = ?');     vals.push(theme); }
  if (density !== undefined)  { fields.push('density = ?');   vals.push(density); }
  if (font_size !== undefined){ fields.push('font_size = ?'); vals.push(font_size); }
  if (local_only !== undefined){ fields.push('local_only = ?'); vals.push(local_only ? 1 : 0); }
  // Onboarding completion — the client writes this at the end of the wizard.
  // It was missing from the whitelist, so the PATCH 400'd and the flag never
  // persisted, re-showing onboarding whenever the user had no roadmaps.
  if (onboarded_at !== undefined) { fields.push('onboarded_at = ?'); vals.push(onboarded_at); }
  if (fields.length === 0) return res.status(400).json({ error: true, message: 'No fields to update' });

  fields.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(req.userId);
  db.prepare(`UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = ?`).run(...vals);
  res.json({ ok: true, settings: db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId) });
});

// ── API Keys ─────────────────────────────────────────────────────────────

router.get('/apikeys', (req, res) => {
  const keys = db.prepare('SELECT id, provider, encrypted_key, model, is_active FROM api_keys WHERE user_id = ?').all(req.userId);
  // Never return the real key — decrypt then mask for display only.
  res.json(keys.map(k => ({ ...k, encrypted_key: maskSecret(decryptSecret(k.encrypted_key)) })));
});

router.post('/apikeys', (req, res) => {
  const { provider, encrypted_key, model } = req.body;
  if (!provider || !encrypted_key) return res.status(400).json({ error: true, message: 'provider and encrypted_key required' });
  const id = `ak-${Date.now()}`;
  // Encrypt at rest (PLAT-04). `encrypted_key` here is the raw key from the client.
  db.prepare('INSERT INTO api_keys (id, user_id, provider, encrypted_key, model, is_active) VALUES (?, ?, ?, ?, ?, 1)')
    .run(id, req.userId, provider, encryptSecret(encrypted_key), model || 'anthropic/claude-haiku-4.5');
  const k = db.prepare('SELECT id, provider, model, is_active FROM api_keys WHERE id = ?').get(id);
  res.json({ ok: true, key: { ...k, encrypted_key: maskSecret(encrypted_key) } });
});

router.delete('/apikeys/:id', (req, res) => {
  db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

router.patch('/apikeys/:id', (req, res) => {
  const { model, is_active } = req.body;
  const fields = [];
  const vals = [];
  if (model !== undefined)     { fields.push('model = ?');     vals.push(model); }
  if (is_active !== undefined) { fields.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
  if (fields.length === 0) return res.status(400).json({ error: true, message: 'No fields to update' });
  fields.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(req.params.id, req.userId);
  db.prepare(`UPDATE api_keys SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...vals);
  res.json({ ok: true });
});

// ── Agent Routing ────────────────────────────────────────────────────────

router.get('/agent-routing', (req, res) => {
  const agents = db.prepare('SELECT a.agent_code, a.model, s.display_name, s.short_desc, s.color, s.icon FROM agent_routing a JOIN agent_status s ON a.agent_code = s.agent_code WHERE a.user_id = ?').all(req.userId);
  res.json(agents);
});

router.patch('/agent-routing/:code', (req, res) => {
  const { model } = req.body;
  if (!model) return res.status(400).json({ error: true, message: 'model required' });
  db.prepare('INSERT OR REPLACE INTO agent_routing (user_id, agent_code, model) VALUES (?, ?, ?)')
    .run(req.userId, req.params.code, model);
  res.json({ ok: true });
});

/**
 * PATCH /agent-routing — point several agents at one model in a single write.
 *
 * Most people run every agent on the same model and only split them up later,
 * if at all. Doing that one row at a time meant seven separate requests and
 * seven chances to end up half-applied; this is one transaction, so the routing
 * table is never left in a state nobody asked for.
 *
 * `codes` omitted means every agent the user has.
 */
router.patch('/agent-routing', (req, res) => {
  const { model, codes } = req.body || {};
  if (!model || typeof model !== 'string') {
    return res.status(400).json({ error: true, message: 'model required' });
  }

  const known = db.prepare('SELECT agent_code FROM agent_routing WHERE user_id = ?')
    .all(req.userId).map(r => r.agent_code);

  let targets = known;
  if (codes !== undefined) {
    if (!Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({ error: true, message: 'codes must be a non-empty array, or omitted to mean every agent' });
    }
    // Only touch agents that actually exist — an unknown code is a caller bug,
    // not a licence to invent a routing row.
    targets = codes.filter(c => known.includes(c));
    if (!targets.length) return res.status(400).json({ error: true, message: 'no such agents' });
  }

  const stmt = db.prepare('INSERT OR REPLACE INTO agent_routing (user_id, agent_code, model) VALUES (?, ?, ?)');
  db.transaction(() => { for (const c of targets) stmt.run(req.userId, c, model); })();

  res.json({ ok: true, updated: targets.length, agents: targets, model });
});

// ── Agent Status ─────────────────────────────────────────────────────────

router.get('/agents', (req, res) => {
  const agents = db.prepare('SELECT * FROM agent_status ORDER BY display_name').all();
  res.json(agents);
});


// ── Enrollments ──────────────────────────────────────────────────────────────

router.get('/enrollments', (req, res) => {
  const rows = db.prepare('SELECT e.*, c.title, c.blurb, c.author, c.hours, c.rating, c.tags FROM enrollments e JOIN courses c ON c.slug = e.course_slug WHERE e.user_id = ? ORDER BY e.enrolled_at DESC').all(req.userId);
  res.json(rows);
});
export default router;
