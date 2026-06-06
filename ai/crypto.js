/**
 * AES-256-GCM encryption for secrets at rest (PLAT-04).
 * Key from env LEARNOS_ENC_KEY (32-byte base64 or hex). Dev fallback derives
 * from JWT_SECRET via scrypt — NOT for production.
 */
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey() {
  const raw = process.env.LEARNOS_ENC_KEY;
  if (raw) {
    for (const enc of ['base64', 'hex']) {
      try { const b = Buffer.from(raw, enc); if (b.length === 32) return b; } catch {}
    }
  }
  const secret = process.env.JWT_SECRET || 'learnos-dev-secret-change-in-prod';
  return crypto.scryptSync(secret, 'learnos-key-encryption', 32);
}

const KEY = getKey();

export function encryptSecret(plaintext) {
  if (plaintext == null || plaintext === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64')}.${ct.toString('base64')}.${tag.toString('base64')}`;
}

export function decryptSecret(blob) {
  if (!blob || typeof blob !== 'string') return null;
  // Legacy/non-encrypted values (e.g. seed placeholders) pass through unchanged.
  if (!blob.startsWith('v1.')) return blob;
  try {
    const [, ivB64, ctB64, tagB64] = blob.split('.');
    const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function maskSecret(plaintext) {
  if (!plaintext) return '';
  const s = String(plaintext);
  return s.length <= 8 ? '••••' : `${s.slice(0, 3)}…${s.slice(-4)}`;
}

export function isEncrypted(blob) {
  return typeof blob === 'string' && blob.startsWith('v1.');
}
