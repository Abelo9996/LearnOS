/**
 * S-07: Centralised URL safety guard.
 * Re-exports the same SSRF-resistant URL checker used by the Research agent so
 * every endpoint that accepts a user-supplied URL can guard with one import.
 */

// Synchronous host/protocol check — call before persisting any user URL.
export function isPublicUrl(u) {
  try {
    const parsed = new URL(u);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    const host = parsed.hostname;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false; // literal IPv4
    if (host.includes(':')) return false; // crude IPv6 reject
    if (/^(localhost|.*\.local|.*\.internal|169\.254\..*|10\..*|192\.168\..*|172\.(1[6-9]|2[0-9]|3[01])\..*)$/i.test(host)) return false;
    return true;
  } catch { return false; }
}

// Express middleware factory: enforce isPublicUrl on req.body[field] when present.
// Use as `app.post('/x', requireSafeUrl('thumbnail_url'), handler)`.
export function requireSafeUrl(...fields) {
  return (req, res, next) => {
    for (const f of fields) {
      const v = req.body?.[f];
      if (v == null || v === '') continue;
      if (!isPublicUrl(v)) {
        return res.status(400).json({
          error: true,
          code: 'UNSAFE_URL',
          message: `"${f}" must be a public http(s) URL`,
        });
      }
    }
    next();
  };
}
