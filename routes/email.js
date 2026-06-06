/**
 * Email helper (§3.13).
 * Uses Resend if RESEND_API_KEY is set; otherwise logs to console (dev mode).
 */
export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
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
