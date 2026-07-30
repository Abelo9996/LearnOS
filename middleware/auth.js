import db from '../db/database.js';

/**
 * LearnOS is a single-user, self-hosted tool — there is no login or registration.
 * Every request runs as one implicit local user. `requireAuth` used to enforce a
 * JWT; it now simply resolves that local user and attaches it to the request, so
 * every existing `WHERE user_id = ?` query keeps working unchanged.
 */
const LOCAL_USER_ID = process.env.LEARNOS_LOCAL_USER || 'user-1';

// Ensure the local user (and its settings row) exists once at boot. There is
// no seed data — every install starts from scratch with a fresh level-1 user.
function ensureLocalUser() {
  const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(LOCAL_USER_ID);
  if (!exists) {
    db.prepare(
      "INSERT INTO users (id, name, email, role, level, xp, xp_to_next, streak, best_streak) VALUES (?, 'You', 'you@localhost', 'user', 1, 0, 500, 0, 0)"
    ).run(LOCAL_USER_ID);
  }
  db.prepare(
    "INSERT OR IGNORE INTO user_settings (user_id, theme, density, font_size, local_only) VALUES (?, 'dark', 'regular', 14, 0)"
  ).run(LOCAL_USER_ID);
  // Per-agent model routing is app config (the Settings page lists agents from
  // it), so default rows must exist even on a from-scratch database.
  const routing = db.prepare('INSERT OR IGNORE INTO agent_routing (user_id, agent_code, model) VALUES (?, ?, ?)');
  routing.run(LOCAL_USER_ID, 'TU', 'anthropic/claude-sonnet-4.6');
  for (const code of ['PR', 'CR', 'AS', 'RE', 'AN', 'CE']) {
    routing.run(LOCAL_USER_ID, code, 'anthropic/claude-haiku-4.5');
  }
}
ensureLocalUser();

export function requireAuth(req, _res, next) {
  req.userId = LOCAL_USER_ID;
  req.userRole = 'user';
  next();
}
