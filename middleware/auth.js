import jwt from 'jsonwebtoken';
import db from '../db/database.js';

const SECRET = process.env.JWT_SECRET || 'learnos-dev-secret-change-in-prod';

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
