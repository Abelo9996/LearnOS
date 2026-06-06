/**
 * User profile, settings, API keys, agent routing, and progress.
 */
import { Router } from 'express';
import db from '../db/database.js';
import { encryptSecret, decryptSecret, maskSecret } from '../ai/crypto.js';

const router = Router();

// ── Profile ──────────────────────────────────────────────────────────────

router.get('/profile', (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, avatar_hue, level, xp, xp_to_next, streak, best_streak, plan, created_at, updated_at, last_activity_date FROM users WHERE id = ?').get(req.userId);
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
  const keys = db.prepare('SELECT id, provider, model, is_active FROM api_keys WHERE user_id = ?').all(req.userId);
  const routing = db.prepare('SELECT agent_code, model FROM agent_routing WHERE user_id = ?').all(req.userId);
  res.json({ user, settings, apiKeys: keys, agentRouting: routing });
});

router.patch('/profile', (req, res) => {
  const { name, email, level, xp, streak, best_streak, plan } = req.body;
  const fields = [];
  const vals = [];
  if (name !== undefined)       { fields.push('name = ?');        vals.push(name); }
  if (email !== undefined)      { fields.push('email = ?');       vals.push(email); }
  if (level !== undefined)      { fields.push('level = ?');       vals.push(level); }
  if (xp !== undefined)         { fields.push('xp = ?');          vals.push(xp); }
  if (streak !== undefined)     { fields.push('streak = ?');      vals.push(streak); }
  if (best_streak !== undefined){ fields.push('best_streak = ?');  vals.push(best_streak); }
  if (plan !== undefined)       { fields.push('plan = ?');        vals.push(plan); }
  if (fields.length === 0) return res.status(400).json({ error: true, message: 'No fields to update' });

  fields.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(req.userId);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true, user: db.prepare('SELECT id, name, email, role, avatar_hue, level, xp, xp_to_next, streak, best_streak, plan, created_at, updated_at, last_activity_date FROM users WHERE id = ?').get(req.userId) });
});

// ── Settings ─────────────────────────────────────────────────────────────

router.get('/settings', (req, res) => {
  const s = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
  res.json(s);
});

router.patch('/settings', (req, res) => {
  const { theme, density, font_size, local_only } = req.body;
  const fields = [];
  const vals = [];
  if (theme !== undefined)    { fields.push('theme = ?');     vals.push(theme); }
  if (density !== undefined)  { fields.push('density = ?');   vals.push(density); }
  if (font_size !== undefined){ fields.push('font_size = ?'); vals.push(font_size); }
  if (local_only !== undefined){ fields.push('local_only = ?'); vals.push(local_only ? 1 : 0); }
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
    .run(id, req.userId, provider, encryptSecret(encrypted_key), model || 'claude-haiku-4-5');
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
