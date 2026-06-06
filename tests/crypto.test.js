import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, maskSecret, isEncrypted } from '../ai/crypto.js';

describe('crypto', () => {
  it('round-trips a secret', () => {
    const plain = 'sk-ant-abc123-very-secret-value';
    const blob = encryptSecret(plain);
    expect(isEncrypted(blob)).toBe(true);
    expect(blob.startsWith('v1.')).toBe(true);
    expect(decryptSecret(blob)).toBe(plain);
  });

  it('returns null on empty input', () => {
    expect(encryptSecret('')).toBe(null);
    expect(encryptSecret(null)).toBe(null);
  });

  it('passes through legacy plaintext values', () => {
    // Decrypting something that wasn't encrypted with this scheme returns it
    // unchanged — this is the documented "legacy seed placeholder" passthrough.
    expect(decryptSecret('sk-legacy-plaintext')).toBe('sk-legacy-plaintext');
    expect(isEncrypted('sk-legacy-plaintext')).toBe(false);
  });

  it('returns null on tampered ciphertext', () => {
    const blob = encryptSecret('hello world this needs enough bytes');
    // Flip the entire auth-tag section to garbage so verification cannot pass.
    const parts = blob.split('.');
    parts[3] = Buffer.alloc(16, 0xff).toString('base64');
    expect(decryptSecret(parts.join('.'))).toBe(null);
  });

  it('masks secrets for display', () => {
    expect(maskSecret('sk-ant-abc123XYZ')).toMatch(/^sk-…[A-Za-z0-9]{4}$/);
    expect(maskSecret('short')).toBe('••••');
    expect(maskSecret('')).toBe('');
  });
});
