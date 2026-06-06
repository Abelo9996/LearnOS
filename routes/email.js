/**
 * Email helper (§3.13).
 * Uses Resend if RESEND_API_KEY is set.
 * In dev (NODE_ENV !== 'production'), logs to logs/email.log as fallback.
 * In prod without key, throws EMAIL_NOT_CONFIGURED.
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOG_DIR = join(__dirname, '..', 'logs');
const EMAIL_LOG = join(LOG_DIR, 'email.log');

function writeEmailLog(entry) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
    fs.appendFileSync(EMAIL_LOG, line);
  } catch { /* best-effort */ }
}

export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      const err = new Error('Email service is not configured');
      err.code = 'EMAIL_NOT_CONFIGURED';
      throw err;
    }
    // Dev mode: log the email to file
    writeEmailLog({ to, subject, body: html.replace(/<[^>]+>/g, '').slice(0, 500) });
    console.log(`[EMAIL DEV] To: ${to} | Subject: ${subject}`);
    return { ok: true, dev: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'LearnOS <noreply@learnos.dev>',
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Email send failed: ${res.status} ${body}`);
  }

  return res.json();
}
