#!/usr/bin/env node
/**
 * Verifies M11 pacing & honest credentials (docs/MASTERY_SPEC_V2.md §5):
 *   V27 pacing math    required hours/week is computed from real remaining work
 *   V28 honesty        an unreachable target is called unreachable, not encouraged
 *   V29 validation     bad scopes and dates are refused
 *   V30 credentials    evidence is served and recognition is stated plainly
 *
 *   node scripts/verify-plans.mjs [baseUrl]
 */
import db from '../db/database.js';

const BASE = process.argv[2] || 'http://localhost:3001';
const results = [];
const check = (id, name, pass, detail = '') => { results.push({ id, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}${detail ? ` — ${detail}` : ''}`); };
const api = async (path, opts = {}) => {
  const r = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().split('T')[0];

db.prepare("DELETE FROM learning_plans WHERE user_id = 'user-1'").run();

const course = db.prepare('SELECT slug, title, hours FROM courses ORDER BY hours DESC LIMIT 1').get();
if (!course) { console.log('SKIP — no courses.'); process.exit(0); }
console.log(`Using course: ${course.title} (${course.hours}h)\n`);

// ── V27: the maths reflects real remaining work ─────────────────────────────
const generous = await api('/api/plans', {
  method: 'POST',
  body: JSON.stringify({ scope_type: 'course', scope_id: course.slug, target_date: inDays(365), weekly_hours: 10 }),
});
check('V27a', 'a plan can be created', generous.status === 200 && !!generous.body.plan);
const p = generous.body.plan;
check('V27b', 'remaining hours reflect the course, not a guess', p.remainingHours > 0 && p.remainingHours <= p.totalHours, `${p.remainingHours}/${p.totalHours}h`);
check('V27c', 'required weekly hours are computed', typeof p.requiredWeeklyHours === 'number' && p.requiredWeeklyHours > 0, `${p.requiredWeeklyHours}h/wk`);
check('V27d', 'a comfortable target is not called unrealistic', p.verdict !== 'unrealistic', `verdict=${p.verdict}`);

// ── V28: honesty about an impossible target ─────────────────────────────────
const tight = await api('/api/plans', {
  method: 'POST',
  body: JSON.stringify({ scope_type: 'course', scope_id: course.slug, target_date: inDays(2), weekly_hours: 1 }),
});
const t = tight.body.plan;
check('V28a', 'an unreachable target is flagged, not encouraged', t.verdict === 'unrealistic', `verdict=${t.verdict}`);
check('V28b', 'it says what would actually be required', /h\/week/.test(t.message) && t.requiredWeeklyHours > t.weekly_hours,
  `needs ${t.requiredWeeklyHours}h/wk vs planned ${t.weekly_hours}h/wk`);
check('V28c', 'it offers a concrete alternative date', /move the date/i.test(t.message));

const past = await api('/api/plans', {
  method: 'POST',
  body: JSON.stringify({ scope_type: 'course', scope_id: course.slug, target_date: inDays(-5), weekly_hours: 5 }),
});
check('V28d', 'a target date in the past is reported as missed', past.body.plan?.verdict === 'missed', `verdict=${past.body.plan?.verdict}`);

// Creating a new plan for the same scope supersedes the old one.
const list = await api('/api/plans');
const forCourse = (list.body.plans || []).filter(x => x.scope_id === course.slug);
check('V28e', 'only one active plan per scope', forCourse.length === 1, `${forCourse.length} active`);

// ── V29: validation ─────────────────────────────────────────────────────────
const badScope = await api('/api/plans', { method: 'POST', body: JSON.stringify({ scope_type: 'banana', scope_id: 'x' }) });
check('V29a', 'an unknown scope type is refused', badScope.status === 400);
const missing = await api('/api/plans', { method: 'POST', body: JSON.stringify({ scope_type: 'course', scope_id: 'no-such-course' }) });
check('V29b', 'a non-existent course is refused', missing.status === 404);
const badDate = await api('/api/plans', { method: 'POST', body: JSON.stringify({ scope_type: 'course', scope_id: course.slug, target_date: 'someday' }) });
check('V29c', 'an unparseable target date is refused', badDate.status === 400);

// ── V30: credentials are evidential, never accredited ───────────────────────
let cert = db.prepare("SELECT id FROM certificates WHERE user_id = 'user-1' LIMIT 1").get();
let temporary = false;
if (!cert) {
  db.prepare("INSERT INTO certificates (id, user_id, title, mastery, id_short, issuer) VALUES ('ce-verify-test','user-1','Verification Test',0.9,'LOS-TST-0000','self-attested')").run();
  cert = { id: 'ce-verify-test' }; temporary = true;
}
const ev = await api(`/api/plans/certificate/${cert.id}/evidence`);
check('V30a', 'certificate evidence is served', ev.status === 200 && !!ev.body.certificate);
check('V30b', 'the issuer is stated as self-attested', ev.body.issuer === 'self-attested', `issuer=${ev.body.issuer}`);
check('V30c', 'it states plainly that it is not accredited',
  /not accredited/i.test(ev.body.recognition || '') && /no employer/i.test(ev.body.recognition || ''));
check('V30d', 'it lists the assessments it rests on', Array.isArray(ev.body.assessments), `${ev.body.assessments?.length} assessments`);
check('V30e', 'it reports how many questions were independently verified',
  ev.body.questionVerification && typeof ev.body.questionVerification.confirmed === 'number',
  `${ev.body.questionVerification?.confirmed}/${ev.body.questionVerification?.total} confirmed`);
const missingCert = await api('/api/plans/certificate/nope/evidence');
check('V30f', 'an unknown certificate 404s', missingCert.status === 404);

if (temporary) db.prepare("DELETE FROM certificates WHERE id = 'ce-verify-test'").run();
db.prepare("DELETE FROM learning_plans WHERE user_id = 'user-1'").run();

const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} plan & credential checks passed.`);
process.exit(failed ? 1 : 0);
