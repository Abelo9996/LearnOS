/**
 * LearnOS Server
 * Express 5 + SQLite backend with full API for the dashboard.
 * Serves the built React frontend and provides REST APIs.
 */
import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import userRoutes from './routes/users.js';
import roadmapRoutes from './routes/roadmaps.js';
import nodeRoutes from './routes/nodes.js';
import sessionRoutes from './routes/sessions.js';
import assignmentRoutes from './routes/assignments.js';
import flashcardRoutes from './routes/flashcards.js';
import courseRoutes from './routes/courses.js';
import scheduleRoutes from './routes/schedule.js';
import activityRoutes from './routes/activity.js';
import certificateRoutes from './routes/certificates.js';
import badgeRoutes from './routes/badges.js';
import starredRoutes from './routes/starred.js';
import { requestLogger, errorHandler, notFound } from './middleware/logger.js';
import { requireAuth } from './middleware/auth.js';
import db, { awardXP, updateStreak } from './db/database.js';
import communityRoutes from './routes/community.js';
import aiRoutes from './routes/ai.js';
import jobRoutes from './routes/jobs.js';
import profileRoutes from './routes/profile.js';
import { resumeJobs } from './ai/jobs.js';
import uploadRoutes from './routes/uploads.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || 3001;
const distPath = join(__dirname, 'dist');
const isProd = process.env.NODE_ENV === 'production';

const app = express();

// ── S-06: Helmet / CSP ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

// ── S-04: CORS — restrict to APP_URL in prod, open in dev ─────────────────────
app.use((req, res, next) => {
  const origin = isProd
    ? (process.env.APP_URL || '')
    : (process.headers?.origin || '*');
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── S-02: Rate limiting ───────────────────────────────────────────────────────
// General API rate limit: 100 req / 15 min / IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
});
app.use('/api/', generalLimiter);

// AI endpoints rate limit: 30 req / 1 min / user
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, code: 'RATE_LIMITED', message: 'AI rate limit exceeded, please slow down' },
});
app.use('/api/ai/', aiLimiter);

// Uploads rate limit: 10 req / 1 min / user
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, code: 'RATE_LIMITED', message: 'Upload rate limit exceeded' },
});
app.use('/api/uploads', uploadLimiter);

// ── Static assets ─────────────────────────────────────────────────────────────
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { maxAge: '1h' }));
}

// ── Uploads static serving (§3.3) ─────────────────────────────────────────────
const uploadsPath = join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
app.use('/uploads', express.static(uploadsPath, { maxAge: '7d' }));

// ── Public routes (no auth) ───────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/api/info',   (_req, res) => res.json({ name: 'LearnOS', version: '1.0.0', status: 'running' }));

// ── Local-user middleware — resolves the single implicit user (no login) ──────
app.use('/api', requireAuth);

// Current user (single local user — replaces the old /api/auth/me).
app.get('/api/me', (req, res) => {
  const u = db.prepare(
    'SELECT id, name, email, role, avatar_hue, avatar_url, bio, links_json, level, xp, xp_to_next, streak, best_streak FROM users WHERE id = ?'
  ).get(req.userId);
  if (!u) return res.status(404).json({ error: true, message: 'Local user not found' });
  res.json(u);
});

// ── Uploads (§3.3) ────────────────────────────────────────────────────────────
app.use('/api/uploads', uploadRoutes);

// ── Daily activity stats (F-04) ───────────────────────────────────────────────
// Spec contract is GET /api/stats/daily; /api/daily-stats kept as alias for
// backward-compat with the frontend api.js method that already shipped.
function dailyStatsHandler(req, res) {
  try {
    const uid = req.userId;
    const win = Math.min(parseInt(req.query.window) || 14, 90);
    const rows = db.prepare(
      "SELECT date(created_at) as date, COALESCE(SUM(xp), 0) as xp," +
      " COUNT(CASE WHEN kind = 'session' THEN 1 END) as sessions," +
      " COUNT(CASE WHEN kind = 'assignment_graded' THEN 1 END) as assignments_graded" +
      " FROM activity_log" +
      " WHERE user_id = ? AND created_at >= date('now', ?)" +
      " GROUP BY date(created_at)" +
      " ORDER BY date(created_at)"
    ).all(uid, '-' + win + ' days');
    const map = new Map(rows.map(r => [r.date, r]));
    const result = [];
    for (let i = win - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      const r = map.get(d) || { date: d, xp: 0, sessions: 0, assignments_graded: 0 };
      result.push(r);
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
}
app.get('/api/daily-stats', dailyStatsHandler);
app.get('/api/stats/daily', dailyStatsHandler);

// ── Stats/dashboard ───────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const uid = req.userId;
  updateStreak(uid);
  const user              = db.prepare('SELECT level, xp, xp_to_next, streak, best_streak FROM users WHERE id = ?').get(uid);
  const totalSessions     = db.prepare('SELECT COUNT(*) as c FROM sessions WHERE user_id = ?').get(uid).c;
  const completedSessions = db.prepare("SELECT COUNT(*) as c FROM sessions WHERE user_id = ? AND status = 'completed'").get(uid).c;
  const pendingAssignments= db.prepare("SELECT COUNT(*) as c FROM assignments WHERE user_id = ? AND status != 'graded'").get(uid).c;
  const dueFlashcards     = db.prepare("SELECT COUNT(*) as c FROM flashcards WHERE user_id = ? AND (next_review IS NULL OR next_review <= date('now'))").get(uid).c;
  const avgMastery        = db.prepare("SELECT AVG(mastery) as m FROM roadmaps WHERE user_id = ? AND status = 'active'").get(uid);
  res.json({
    level:              user.level,
    xp:                 user.xp,
    xpToNext:           user.xp_to_next,
    streak:             user.streak,
    bestStreak:         user.best_streak,
    totalSessions,
    completedSessions,
    pendingAssignments,
    dueFlashcards,
    mastery:            avgMastery ? Math.round(avgMastery.m * 100) : 0,
  });
});

// ── Most-recent active session (F-01) ─────────────────────────────────────────
app.get('/api/sessions/active', (req, res) => {
  const uid = req.userId;
  const row = db.prepare("SELECT * FROM sessions WHERE user_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1").get(uid);
  if (!row) return res.status(404).json({ error: true, code: 'NO_ACTIVE_SESSION', message: 'No active session found' });
  res.json(row);
});

// ── Protected API routes ──────────────────────────────────────────────────────
app.use('/api/users/starred', starredRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/roadmaps',      roadmapRoutes);
app.use('/api/nodes',         nodeRoutes);
app.use('/api/sessions',      sessionRoutes);
app.use('/api/assignments',   assignmentRoutes);
app.use('/api/flashcards',    flashcardRoutes);
app.use('/api/schedule',      scheduleRoutes);
app.use('/api/activity',      activityRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/certificates',  certificateRoutes);
app.use('/api/badges',        badgeRoutes);
app.use('/api/community',     communityRoutes);
app.use('/api/ai',            aiRoutes);
app.use('/api/jobs',          jobRoutes);
app.use('/api/profile',       profileRoutes);

// ── SPA catch-all ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const { pathname } = new URL(req.url, 'http://localhost');
  if (!pathname.startsWith('/api/') && !pathname.includes('.')) {
    res.sendFile(join(distPath, 'index.html'));
  } else {
    next();
  }
});

// ── Error handling ─────────────────────────────────────────────────────────────
app.use(errorHandler);
app.use(notFound);

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  resumeJobs();
  console.log('\n  ✅ LearnOS running at http://localhost:' + PORT);
  const keyed = !!(process.env.OPENROUTER_API_KEY || process.env.LEARNOS_OPENROUTER_KEY);
  console.log(keyed
    ? '  OpenRouter key detected — AI features are live.\n'
    : '  Tip: set OPENROUTER_API_KEY (or add one in Settings → API Keys) to enable AI features.\n');
});
