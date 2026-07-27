#!/usr/bin/env node
/**
 * Verifies M9 reach (docs/MASTERY_SPEC_V2.md §5):
 *   V31 mobile nav     every screen is reachable on a phone
 *   V32 no overflow    no screen scrolls sideways at 390px
 *   V33 translation    caching, storage alongside the original, honest failure
 *   V34 safety         a translation never overwrites the source content
 *
 * The mobile checks drive a real browser; the translation checks are written so
 * that they pass whether or not an LLM is reachable — a translation feature that
 * silently corrupts content when the provider is down would be worse than one
 * that simply isn't available.
 *
 *   node scripts/verify-reach.mjs [baseUrl] [frontendUrl]
 */
import db from '../db/database.js';
import { getTranslation, saveTranslation, courseTranslationStatus } from '../ai/quality/translate.js';

const BASE = process.argv[2] || 'http://localhost:3001';
const FRONT = process.argv[3] || 'http://localhost:3000';
const results = [];
const check = (id, name, pass, detail = '') => { results.push({ id, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}${detail ? ` — ${detail}` : ''}`); };
const api = async (path, opts = {}) => {
  const r = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

// ── V31/V32: the app is usable on a phone ───────────────────────────────────
let puppeteer = null;
try { puppeteer = (await import('puppeteer-core')).default; } catch { /* optional */ }
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

if (puppeteer) {
  const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
  try {
    const p = await b.newPage();
    await p.setViewport({ width: 390, height: 844 });
    await p.goto(FRONT, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1500));
    await p.evaluate(() => { const el = [...document.querySelectorAll('button,a')].find(e => /open the app|start learning/i.test(e.textContent)); if (el) el.click(); });
    await new Promise(r => setTimeout(r, 2400));

    const nav = await p.evaluate(() => ({
      present: !!document.querySelector('nav[aria-label="Main"]'),
      tabs: [...document.querySelectorAll('nav[aria-label="Main"] button')].length,
    }));
    check('V31a', 'a phone gets a navigation bar (the sidebar is hidden)', nav.present, `${nav.tabs} tabs`);

    const screens = ['Dashboard', 'Roadmaps', 'Courses', 'Assignments', 'Review'];
    const overflow = [];
    for (const s of screens) {
      await p.evaluate((name) => { const btn = [...document.querySelectorAll('nav[aria-label="Main"] button')].find(x => x.textContent.includes(name)); if (btn) btn.click(); }, s);
      await new Promise(r => setTimeout(r, 1500));
      const o = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, v: window.innerWidth }));
      if (o.w > o.v + 2) overflow.push(`${s}(${o.w}>${o.v})`);
    }
    check('V32a', 'no primary screen scrolls sideways at 390px', overflow.length === 0, overflow.join(', ') || `${screens.length} screens clean`);

    // Everything else must still be reachable via "More".
    await p.evaluate(() => { const btn = [...document.querySelectorAll('nav[aria-label="Main"] button')].find(x => /More/i.test(x.textContent)); if (btn) btn.click(); });
    await new Promise(r => setTimeout(r, 700));
    const more = await p.evaluate(() => {
      const g = document.querySelector('.keep-grid');
      return { items: g ? g.querySelectorAll('button').length : 0, cols: g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0 };
    });
    check('V31b', 'secondary destinations are reachable via More', more.items >= 5, `${more.items} items`);
    check('V31c', 'the More sheet stays a compact grid on mobile', more.cols === 3, `${more.cols} columns`);

    // Desktop must be unaffected by the mobile work.
    await p.setViewport({ width: 1400, height: 900 });
    await new Promise(r => setTimeout(r, 1200));
    const desktop = await p.evaluate(() => ({
      mobileNav: !!document.querySelector('nav[aria-label="Main"]'),
      sidebar: [...document.querySelectorAll('*')].some(e => /LEARN/.test(e.textContent || '') && e.getBoundingClientRect().left < 60 && e.getBoundingClientRect().width > 100),
    }));
    check('V31d', 'the phone bar disappears again on desktop', desktop.mobileNav === false);
    check('V31e', 'the sidebar returns on desktop', desktop.sidebar === true);
  } finally { await b.close(); }
} else {
  check('V31a', 'browser available for mobile checks', false, 'puppeteer-core not installed');
}

// ── V33/V34: translation ────────────────────────────────────────────────────
const lesson = db.prepare("SELECT id, title, body_md FROM module_lessons WHERE body_md IS NOT NULL AND LENGTH(body_md) > 100 LIMIT 1").get();
if (!lesson) {
  check('V33a', 'a lesson exists to translate', false, 'none found');
} else {
  db.prepare("DELETE FROM translations WHERE target_id = ?").run(lesson.id);

  const noLang = await api(`/api/content/lesson/${lesson.id}/translation`);
  check('V33a', 'a missing language is refused', noLang.status === 400);
  const noLesson = await api('/api/content/lesson/does-not-exist/translation?language=Spanish');
  check('V33b', 'an unknown lesson 404s', noLesson.status === 404);

  // Seed a translation directly so caching/serving is testable without an LLM.
  saveTranslation('lesson', lesson.id, 'Spanish', { title: 'Título traducido', body_md: '# Contenido traducido\n\nTexto.' });
  const served = await api(`/api/content/lesson/${lesson.id}/translation?language=Spanish`);
  check('V33c', 'an existing translation is served from cache', served.status === 200 && served.body.cached === true && served.body.translation.title === 'Título traducido');

  // Re-saving the same target/language updates rather than duplicating.
  saveTranslation('lesson', lesson.id, 'Spanish', { title: 'Título v2', body_md: 'v2' });
  const rows = db.prepare("SELECT COUNT(*) c FROM translations WHERE target_id = ? AND language = 'Spanish'").get(lesson.id).c;
  check('V33d', 're-translating updates in place rather than duplicating', rows === 1, `${rows} row(s)`);

  // V34: the original must be untouched.
  const after = db.prepare('SELECT title, body_md FROM module_lessons WHERE id = ?').get(lesson.id);
  check('V34a', 'the original lesson title is unchanged', after.title === lesson.title);
  check('V34b', 'the original lesson body is unchanged', after.body_md === lesson.body_md);

  const status = courseTranslationStatus(
    db.prepare('SELECT course_slug FROM course_modules WHERE id = (SELECT module_id FROM module_lessons WHERE id = ?)').get(lesson.id).course_slug,
    'Spanish');
  check('V33e', 'course translation coverage is reportable', status.total > 0 && status.translated >= 1, `${status.translated}/${status.total} (${status.percent}%)`);

  const missing = await api(`/api/content/lesson/${lesson.id}/translation?language=Klingon`);
  check('V33f', 'an untranslated language either translates or fails honestly',
    missing.status === 200 || (missing.status >= 400 && !!missing.body.message),
    `status=${missing.status}`);

  db.prepare("DELETE FROM translations WHERE target_id = ?").run(lesson.id);
}

const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} reach checks passed.`);
process.exit(failed ? 1 : 0);
