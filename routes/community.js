import { Router } from 'express';
import db, { logActivity } from '../db/database.js';
import { isPublicUrl } from '../middleware/url-safety.js';

const router = Router();

// ── Threads ──────────────────────────────────────────────────────────────────

// Get all threads with user vote info
router.get('/threads', (req, res) => {
  const { tag, sort } = req.query;
  let query = `
    SELECT t.*, u.name as author_name,
           COALESCE(v.value, 0) as user_vote
    FROM community_threads t
    LEFT JOIN users u ON u.id = t.user_id
    LEFT JOIN community_votes v ON v.thread_id = t.id AND v.user_id = ?
    WHERE 1=1
  `;
  const params = [req.userId];
  if (tag && tag !== 'all') {
    query += ' AND t.tag = ?';
    params.push(tag);
  }
  query += sort === 'top' ? ' ORDER BY t.votes DESC, t.created_at DESC' : ' ORDER BY t.created_at DESC';
  const threads = db.prepare(query).all(...params);
  res.json(threads);
});

// Get single thread with replies
router.get('/threads/:id', (req, res) => {
  const thread = db.prepare(`
    SELECT t.*, u.name as author_name
    FROM community_threads t
    LEFT JOIN users u ON u.id = t.user_id
    WHERE t.id = ?
  `).get(req.params.id);
  if (!thread) return res.status(404).json({ error: true, message: 'Thread not found' });
  const replies = db.prepare(`
    SELECT r.*, u.name as author_name
    FROM community_replies r
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.thread_id = ? ORDER BY r.created_at ASC
  `).all(req.params.id);
  const userVote = db.prepare('SELECT value FROM community_votes WHERE user_id = ? AND thread_id = ?').get(req.userId, req.params.id);
  res.json({ ...thread, replies, user_vote: userVote?.value || 0 });
});

// Create thread (supports an image attachment + a course/roadmap reference — #23)
router.post('/threads', (req, res) => {
  const { title, body, tag, image_url, ref_type, ref_id, ref_label } = req.body;
  if (!title) return res.status(400).json({ error: true, message: 'title required' });
  // S-07: SSRF guard — image URL must be a public http(s) URL.
  let safeImage = null;
  if (image_url) {
    if (!isPublicUrl(image_url)) {
      return res.status(400).json({ error: true, code: 'UNSAFE_URL', message: 'image_url must be a public http(s) URL' });
    }
    safeImage = image_url;
  }
  const safeRefType = ['course', 'roadmap'].includes(ref_type) ? ref_type : null;
  const id = `t-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  db.prepare('INSERT INTO community_threads (id, user_id, title, body, tag, image_url, ref_type, ref_id, ref_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, title, body || null, tag || 'question', safeImage, safeRefType, safeRefType ? (ref_id || null) : null, safeRefType ? (ref_label || null) : null);
  logActivity(req.userId, { kind: 'session', text: `Started community thread: "${title}"`, sub: 'community', agent: 'TU' });
  const thread = db.prepare('SELECT t.*, u.name as author_name FROM community_threads t LEFT JOIN users u ON u.id = t.user_id WHERE t.id = ?').get(id);
  res.json({ ok: true, thread });
});

// ── Votes ────────────────────────────────────────────────────────────────────

router.post('/threads/:id/vote', (req, res) => {
  const threadId = req.params.id;
  const { value } = req.body; // 1 or -1
  if (value !== 1 && value !== -1) return res.status(400).json({ error: true, message: 'value must be 1 or -1' });

  const existing = db.prepare('SELECT value FROM community_votes WHERE user_id = ? AND thread_id = ?').get(req.userId, threadId);
  let voteDiff = value;

  if (existing) {
    if (existing.value === value) {
      // Remove vote (toggle off)
      db.prepare('DELETE FROM community_votes WHERE user_id = ? AND thread_id = ?').run(req.userId, threadId);
      voteDiff = -value;
    } else {
      // Change vote
      db.prepare('UPDATE community_votes SET value = ? WHERE user_id = ? AND thread_id = ?').run(value, req.userId, threadId);
      voteDiff = value * 2; // e.g. from -1 to +1 = +2
    }
  } else {
    db.prepare('INSERT INTO community_votes (user_id, thread_id, value) VALUES (?, ?, ?)').run(req.userId, threadId, value);
  }

  db.prepare('UPDATE community_threads SET votes = votes + ? WHERE id = ?').run(voteDiff, threadId);
  const thread = db.prepare('SELECT votes FROM community_threads WHERE id = ?').get(threadId);
  res.json({ ok: true, votes: thread.votes });
});

// ── Replies ──────────────────────────────────────────────────────────────────

router.post('/threads/:id/replies', (req, res) => {
  const { body } = req.body;
  if (!body) return res.status(400).json({ error: true, message: 'body required' });
  const id = `r-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  db.prepare('INSERT INTO community_replies (id, thread_id, user_id, body) VALUES (?, ?, ?, ?)')
    .run(id, req.params.id, req.userId, body);
  db.prepare('UPDATE community_threads SET replies_count = replies_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  const reply = db.prepare('SELECT r.*, u.name as author_name FROM community_replies r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = ?').get(id);
  res.json({ ok: true, reply });
});

// ── Leaderboard ──────────────────────────────────────────────────────────────

router.get('/leaderboard', (req, res) => {
  const leaders = db.prepare(`
    SELECT u.name, u.level, u.xp, COUNT(DISTINCT t.id) as thread_count, COUNT(DISTINCT r.id) as reply_count,
           (COUNT(DISTINCT t.id) + COUNT(DISTINCT r.id)) as contributions
    FROM users u
    LEFT JOIN community_threads t ON t.user_id = u.id
    LEFT JOIN community_replies r ON r.user_id = u.id
    GROUP BY u.id
    HAVING contributions > 0
    ORDER BY contributions DESC, u.xp DESC
    LIMIT 20
  `).all();
  // Add rank
  const ranked = leaders.map((l, i) => ({ ...l, rank: i + 1, me: false }));
  // Inject current user
  const me = db.prepare(`
    SELECT u.name, u.level, u.xp, COUNT(DISTINCT t.id) as thread_count, COUNT(DISTINCT r.id) as reply_count,
           (COUNT(DISTINCT t.id) + COUNT(DISTINCT r.id)) as contributions
    FROM users u
    LEFT JOIN community_threads t ON t.user_id = u.id
    LEFT JOIN community_replies r ON r.user_id = u.id
    WHERE u.id = ?
    GROUP BY u.id
  `).get(req.userId);
  if (me) {
    const myRank = ranked.findIndex(r => r.contributions < me.contributions);
    const meEntry = { ...me, rank: myRank === -1 ? ranked.length + 1 : myRank + 1, me: true };
    if (myRank === -1) ranked.push(meEntry); else ranked.splice(myRank, 0, meEntry);
  }
  res.json(ranked);
});

export default router;
