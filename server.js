/**
 * LearnOS Server
 * Express 5 + SQLite backend with full API for the dashboard.
 * Serves the built React frontend and provides REST APIs.
 */
import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
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

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

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
app.use('/api/auth', authRoutes);

// ── Auth middleware — all routes below require a valid JWT ────────────────────
app.use('/api', requireAuth);

// ── Uploads (§3.3) ────────────────────────────────────────────────────────────
app.use('/api/uploads', uploadRoutes);

// ── Stats/dashboard ───────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const uid = req.userId;
  updateStreak(uid); // Track daily streak
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
app.use('/api/courses', courseRoutes); // course browse + module/lesson CRUD (auth-protected)
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
  resumeJobs(); // re-pick any async jobs left from a previous process
  console.log(`\n  ✅ LearnOS running at http://localhost:${PORT}`);
  console.log(`  Dev login: alex@learnos.dev / learnos123\n`);
});
