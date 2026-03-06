# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 4.x     | ✅ Current          |
| < 4.0   | ❌ Not supported    |

## Reporting a Vulnerability

We take security seriously. If you discover a vulnerability in LearnOS, please report it responsibly.

### How to Report

1. **Email:** Send details to **security@learnos.ai** (or open a private advisory on GitHub)
2. **Do NOT** open a public issue for security vulnerabilities
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

## Security Best Practices for Deployment

### Environment Variables

- **Never** commit `.env` files or API keys to the repository
- Use `.env.example` files as templates (already provided)
- Rotate API keys regularly

### Authentication

- LearnOS uses hashed passwords (SHA-512) — plaintext passwords are never stored
- JWT tokens are used for session management
- OAuth2 (Google) is supported for production deployments

### Database

- SQLite is used for local development only
- For production, use PostgreSQL with proper access controls
- Database files (`*.db`) are gitignored

### API Keys

- OpenAI API keys are stored server-side only, never exposed to the frontend
- All AI service calls are proxied through the backend

### Network

- CORS is configured — review `main.py` before deploying to production
- Use HTTPS in production (enforce via reverse proxy)
- Rate limiting is recommended for public deployments

### Data Privacy

- User data is stored locally by default
- No telemetry or analytics are collected
- Learning data belongs to the learner

## Dependencies

- Run `pip audit` and `npm audit` regularly to check for known vulnerabilities
- Keep dependencies up to date

## Scope

This policy covers the LearnOS repository at [github.com/Abelo9996/LearnOS](https://github.com/Abelo9996/LearnOS).

Third-party services (OpenAI, Google OAuth) are governed by their own security policies.
