/**
 * On-demand translation — M9 of docs/MASTERY_SPEC_V2.md §3.9.
 *
 * Coursera localises a subset of its catalogue into a subset of languages,
 * because human translation costs money per course per language. We generate
 * content, so we can translate ANY course into ANY language on demand — this is
 * one of the few places where being AI-native is a straightforward structural
 * advantage rather than a trade-off.
 *
 * Rules that keep a translation trustworthy:
 *   · The original is never overwritten. Translations are stored alongside, so a
 *     bad translation can't destroy the source of truth.
 *   · Code blocks, identifiers, URLs and numbers are preserved verbatim — a
 *     translated variable name is a broken lesson.
 *   · Nothing is translated twice; existing translations are reused.
 */
import db from '../../db/database.js';
import { complete } from '../llm.js';

export const SYSTEM = `You are translating educational material for a learning platform.

Rules:
- Translate the prose accurately and naturally into the requested language, as a subject-matter teacher would write it — not word-for-word.
- Preserve Markdown structure exactly: headings, lists, emphasis, tables, links.
- NEVER translate: code inside fenced blocks or backticks, identifiers, function/variable names, URLs, file paths, mathematical notation, or numbers.
- Keep technical terms that are conventionally used untranslated in the target language (e.g. widely-used English terms in programming) rather than inventing local coinages.
- Return only the translated text with the same structure. Do not add commentary.`;

const textSchema = {
  type: 'object',
  additionalProperties: false,
  properties: { text: { type: 'string' } },
  required: ['text'],
};

/** Translate one string. Returns null if it can't be done. */
export async function translateText({ userId = 'user-1', text, language }) {
  if (!text || !String(text).trim() || !language) return null;
  const out = await complete({
    userId, agentCode: 'RE',
    schema: textSchema,
    maxTokens: 8000,
    system: SYSTEM,
    messages: `Target language: ${language}\n\n---\n${text}`,
  });
  return out?.json?.text || null;
}

/** Cached lookup — a lesson is never translated into the same language twice. */
export function getTranslation(targetType, targetId, language) {
  return db.prepare('SELECT * FROM translations WHERE target_type = ? AND target_id = ? AND language = ?')
    .get(targetType, targetId, language) || null;
}

export function saveTranslation(targetType, targetId, language, fields) {
  const id = `tr-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(`INSERT INTO translations (id, target_type, target_id, language, title, body_md)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(target_type, target_id, language)
              DO UPDATE SET title = excluded.title, body_md = excluded.body_md, created_at = datetime('now')`)
    .run(id, targetType, targetId, language, fields.title || null, fields.body_md || null);
  return getTranslation(targetType, targetId, language);
}

/** Translate a lesson, reusing an existing translation when there is one. */
export async function translateLesson({ userId = 'user-1', lessonId, language }) {
  const cached = getTranslation('lesson', lessonId, language);
  if (cached) return { ...cached, cached: true };

  const lesson = db.prepare('SELECT id, title, body_md FROM module_lessons WHERE id = ?').get(lessonId);
  if (!lesson) return null;

  const [title, body] = await Promise.all([
    translateText({ userId, text: lesson.title, language }),
    lesson.body_md ? translateText({ userId, text: lesson.body_md, language }) : Promise.resolve(null),
  ]);
  if (!title && !body) return null;

  return { ...saveTranslation('lesson', lessonId, language, { title: title || lesson.title, body_md: body }), cached: false };
}

/** How much of a course exists in a given language. */
export function courseTranslationStatus(slug, language) {
  const total = db.prepare(`SELECT COUNT(*) c FROM module_lessons l JOIN course_modules m ON m.id = l.module_id WHERE m.course_slug = ?`).get(slug).c;
  const done = db.prepare(`SELECT COUNT(*) c FROM translations t
                           JOIN module_lessons l ON l.id = t.target_id
                           JOIN course_modules m ON m.id = l.module_id
                           WHERE t.target_type = 'lesson' AND t.language = ? AND m.course_slug = ?`).get(language, slug).c;
  return { total, translated: done, percent: total ? Math.round((done / total) * 100) : 0 };
}

export default { translateText, translateLesson, getTranslation, saveTranslation, courseTranslationStatus };
