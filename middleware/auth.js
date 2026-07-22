import db from '../db/database.js';

/**
 * LearnOS is a single-user, self-hosted tool — there is no login or registration.
 * Every request runs as one implicit local user. `requireAuth` used to enforce a
 * JWT; it now simply resolves that local user and attaches it to the request, so
 * every existing `WHERE user_id = ?` query keeps working unchanged.
 */
const LOCAL_USER_ID = process.env.LEARNOS_LOCAL_USER || 'user-1';

// Ensure the local user (and its settings row) exists once at boot. The seed
// normally creates `user-1`; this covers a fresh DB started without seed data.
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
}
ensureLocalUser();

export function requireAuth(req, _res, next) {
  req.userId = LOCAL_USER_ID;
  req.userRole = 'user';
  next();
}
