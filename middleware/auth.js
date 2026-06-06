import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db/database.js';

// S-01: In production, LEARNOS_JWT_SECRET must be set (server.js exits if missing).
// In dev, we fall back to a per-boot random secret (sessions don't survive restarts).
const SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: LEARNOS_JWT_SECRET is not set');
    process.exit(1);
  }
  const devSecret = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  LEARNOS_JWT_SECRET not set — using per-boot random secret (dev only). Tokens won\'t survive restarts.');
  return devSecret;
})();

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: true, message: 'Missing token' });
  }

  let payload;
  try {
    payload = jwt.verify(header.slice(7), SECRET);
  } catch {
    return res.status(401).json({ error: true, message: 'Invalid or expired token' });
  }

  const revoked = db.prepare('SELECT jti FROM revoked_tokens WHERE jti = ?').get(payload.jti);
  if (revoked) {
    return res.status(401).json({ error: true, message: 'Token revoked' });
  }

  const user = db.prepare('SELECT id, role, plan FROM users WHERE id = ?').get(payload.sub);
  if (!user) {
    return res.status(401).json({ error: true, message: 'User not found' });
  }

  req.userId = user.id;
  req.userRole = user.role;
  req.jti = payload.jti;
  req.tokenExp = payload.exp;
  next();
}

export function signToken(userId) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, jti }, SECRET, { expiresIn: '7d' });
  return { token, jti };
}
