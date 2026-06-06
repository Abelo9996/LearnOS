import { describe, it, expect } from 'vitest';
import { isPublicUrl } from '../middleware/url-safety.js';

describe('isPublicUrl', () => {
  it('accepts public https URLs', () => {
    expect(isPublicUrl('https://example.com/path')).toBe(true);
    expect(isPublicUrl('http://example.com')).toBe(true);
  });

  it('rejects non-http protocols', () => {
    expect(isPublicUrl('javascript:alert(1)')).toBe(false);
    expect(isPublicUrl('file:///etc/passwd')).toBe(false);
    expect(isPublicUrl('data:text/html,<script>')).toBe(false);
    expect(isPublicUrl('ftp://example.com')).toBe(false);
  });

  it('rejects literal IPv4 addresses', () => {
    expect(isPublicUrl('http://127.0.0.1/')).toBe(false);
    expect(isPublicUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isPublicUrl('http://192.168.1.1/')).toBe(false);
    expect(isPublicUrl('http://10.0.0.1/')).toBe(false);
    expect(isPublicUrl('http://172.16.0.1/')).toBe(false);
  });

  it('rejects localhost-like hostnames', () => {
    expect(isPublicUrl('http://localhost/')).toBe(false);
    expect(isPublicUrl('http://api.internal/')).toBe(false);
    expect(isPublicUrl('http://printer.local/')).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isPublicUrl('not a url')).toBe(false);
    expect(isPublicUrl('')).toBe(false);
    expect(isPublicUrl(null)).toBe(false);
    expect(isPublicUrl(undefined)).toBe(false);
  });
});
