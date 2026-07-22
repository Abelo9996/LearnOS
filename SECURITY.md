# Security Policy

## Reporting a Vulnerability

We take security seriously. If you discover a vulnerability in LearnOS, please report it responsibly.

### How to Report

1. **Open a private security advisory** on GitHub (Security → Advisories → Report a vulnerability), or email the maintainers.
2. **Do NOT** open a public issue for security vulnerabilities.
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment** within 48 hours
- **Assessment** within 7 days
- **Fix or mitigation** as soon as possible, depending on severity
- **Credit** in the release notes (unless you prefer anonymity)

## Security Posture

LearnOS ships with hardening built in:

### Authentication
- Passwords are hashed with **bcrypt** — plaintext passwords are never stored.
- Sessions use **JWT**. In production, `LEARNOS_JWT_SECRET` **must** be set or the server refuses to start; in dev it falls back to a per-boot random secret (tokens don't survive restarts).
- Auth is enforced via middleware on protected routes.

### API Keys
- Anthropic API keys are stored **server-side only** and never exposed to the frontend.
- All AI calls are proxied through the backend LLM layer (`ai/llm.js`), which also meters usage and enforces per-user cost/token caps for managed keys.

### Network & Transport
- **Helmet** sets secure HTTP headers.
- **CORS** is restricted to `APP_URL` in production (open only in dev).
- **Rate limiting** (`express-rate-limit`) protects against abuse.
- Use **HTTPS** in production (terminate at a reverse proxy).

### Input & Request Safety
- **SSRF guard** (`middleware/url-safety.js`) validates outbound fetch targets and blocks private/link-local addresses.
- **File uploads** are validated by **magic bytes** (not just extension) and constrained by type/size.
- User-supplied profile fields (avatar URL, bio, links) are validated and length-limited server-side.

### Data
- **SQLite** is used for storage; database files (`db/*.db*`) are gitignored.
- Secrets live in `.env` (gitignored). Use [`.env.example`](.env.example) as a template and rotate keys regularly.
- No third-party telemetry is collected — learning data belongs to the learner.

## Dependencies

- Run `npm audit` regularly and keep dependencies up to date.

## Scope

This policy covers the LearnOS repository at [github.com/Abelo9996/LearnOS](https://github.com/Abelo9996/LearnOS). Third-party services (e.g. Anthropic) are governed by their own security policies.
