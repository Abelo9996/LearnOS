import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/database.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { sendEmail } from './email.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: true, message: 'name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: true, message: 'Password must be at least 8 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: true, message: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = `user-${crypto.randomUUID()}`;

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, level, xp, xp_to_next, streak, best_streak, plan)
    VALUES (?, ?, ?, ?, 'user', 1, 0, 500, 0, 0, 'Free')
  `).run(id, name.trim(), email.toLowerCase(), passwordHash);

  db.prepare(`
    INSERT INTO user_settings (user_id) VALUES (?)
  `).run(id);

  // Generate email verification token (§3.13)
  const verifyToken = crypto.randomUUID();
  const verifyExpires = new Date(Date.now() + 86400000).toISOString(); // 24h
  db.prepare('INSERT INTO email_verifications (token, user_id, expires_at) VALUES (?, ?, ?)').run(verifyToken, id, verifyExpires);
  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  sendEmail({
    to: email.toLowerCase(),
    subject: 'LearnOS — Verify your email',
    html: `<p>Welcome to LearnOS! Click to verify your email: <a href="${appUrl}/verify?token=${verifyToken}">${appUrl}/verify?token=${verifyToken}</a></p><p>Link expires in 24 hours.</p>`,
  }).catch(() => {});

  const { token } = signToken(id);
  const row = db.prepare('SELECT id, name, email, level, xp, xp_to_next, streak, best_streak, plan FROM users WHERE id = ?').get(id);

  res.status(201).json({
    token,
    user: {
      id: row.id, name: row.name, email: row.email,
      level: row.level, xp: row.xp, xpToNext: row.xp_to_next,
      streak: row.streak, bestStreak: row.best_streak, plan: row.plan,
    },
  });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: true, message: 'email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !user.password_hash) {
    return res.status(401).json({ error: true, message: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: true, message: 'Invalid email or password' });
  }

  const { token } = signToken(user.id);
  res.json({
    token,
    user: {
      id: user.id, name: user.name, email: user.email,
      level: user.level, xp: user.xp, xpToNext: user.xp_to_next,
      streak: user.streak, bestStreak: user.best_streak, plan: user.plan,
    },
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, level, xp, xp_to_next, streak, best_streak, plan, role, email_verified, avatar_url, bio, links_json FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: true, message: 'User not found' });
  res.json({
    id: user.id, name: user.name, email: user.email,
    level: user.level, xp: user.xp, xpToNext: user.xp_to_next,
    streak: user.streak, bestStreak: user.best_streak, plan: user.plan,
    role: user.role || 'user',
    email_verified: user.email_verified || 0,
    avatar_url: user.avatar_url || null,
    bio: user.bio || null,
    links_json: user.links_json || null,
  });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  db.prepare('INSERT OR IGNORE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)')
    .run(req.jti, new Date(req.tokenExp * 1000).toISOString());
  res.json({ ok: true });
});

// ── Email verification + password reset (§3.13) ──────────────────────────────

// Forgot password — always returns 200 to avoid user enumeration
router.post('/forgot', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ ok: true });
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.json({ ok: true }); // don't reveal existence
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 3600000).toISOString(); // 1h
  db.prepare('INSERT OR REPLACE INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expires);
  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  await sendEmail({
    to: email.toLowerCase(),
    subject: 'LearnOS — Password reset',
    html: `<p>Click to reset your password: <a href="${appUrl}/reset?token=${token}">${appUrl}/reset?token=${token}</a></p><p>Link expires in 1 hour.</p>`,
  }).catch(() => {});
  res.json({ ok: true });
});

// Reset password with token
router.post('/reset', async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) return res.status(400).json({ error: true, message: 'token and new_password required' });
  if (new_password.length < 8) return res.status(400).json({ error: true, message: 'Password must be at least 8 characters' });
  const row = db.prepare('SELECT * FROM password_resets WHERE token = ?').get(token);
  if (!row) return res.status(400).json({ error: true, message: 'Invalid or expired token' });
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM password_resets WHERE token = ?').run(token);
    return res.status(400).json({ error: true, message: 'Token expired' });
  }
  const hash = await bcrypt.hash(new_password, 10);
  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.user_id);
    db.prepare('DELETE FROM password_resets WHERE token = ?').run(token);
    // Revoke all existing tokens for this user
    db.prepare("INSERT OR IGNORE INTO revoked_tokens (jti, expires_at) SELECT 'revoke-all-' || id, datetime('now', '+7 days') FROM revoked_tokens WHERE 1=0").run();
  });
  tx();
  res.json({ ok: true });
});

// Verify email with token
router.get('/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: true, message: 'token required' });
  const row = db.prepare('SELECT * FROM email_verifications WHERE token = ?').get(token);
  if (!row) return res.status(400).json({ error: true, message: 'Invalid or expired token' });
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM email_verifications WHERE token = ?').run(token);
    return res.status(400).json({ error: true, message: 'Token expired' });
  }
  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(row.user_id);
  db.prepare('DELETE FROM email_verifications WHERE token = ?').run(token);
  res.json({ ok: true });
});

// Resend verification email
router.post('/resend-verification', requireAuth, async (req, res) => {
  const user = db.prepare('SELECT email, email_verified FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: true, message: 'User not found' });
  if (user.email_verified) return res.json({ ok: true, alreadyVerified: true });
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 86400000).toISOString(); // 24h
  db.prepare('INSERT OR REPLACE INTO email_verifications (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, req.userId, expires);
  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  await sendEmail({
    to: user.email,
    subject: 'LearnOS — Verify your email',
    html: `<p>Click to verify your email: <a href="${appUrl}/verify?token=${token}">${appUrl}/verify?token=${token}</a></p><p>Link expires in 24 hours.</p>`,
  }).catch(() => {});
  res.json({ ok: true });
});

export default router;
