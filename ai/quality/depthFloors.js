// Depth floors — the mechanism that makes "thorough" enforceable.
//
// Measured against Coursera (docs/MASTERY_SPEC_V2.md §1): a single reference
// course ships 42 videos, 9 practice quizzes, 2 graded programming assignments
// and 18 hands-on labs across 3 modules. Our seed courses shipped ~2 lessons per
// module averaging 370 characters. These floors are the contract that closes that
// gap: generated content is validated against them and thin sections are
// regenerated rather than shipped.
//
// Floors are deliberately *minimums*, not targets. Passing means "not
// embarrassing"; good content clears them comfortably.

import db from '../../db/database.js';

export const FLOORS = {
  modulesPerCourse:       6,     // Coursera courses run 3–8 modules; a full pathway needs breadth
  lessonsPerModule:       6,     // reference module: ~14 videos + quizzes + labs
  readingChars:        1500,     // our old median was 451 — a paragraph, not a lesson
  quizItemsPerModule:     8,     // reference: 10–30 questions per graded quiz
  gradedPerModule:        1,     // something that actually counts
  practicalPerModule:     1,     // lab / exercise / programming — "doing", not watching
  resourcesPerModule:     2,     // verified, embeddable, free
  timeHonestyTolerance: 0.20,    // Σ item minutes vs declared course hours (±20%)
};

// Lesson kinds that count as hands-on practice rather than passive consumption.
const PRACTICAL_KINDS = new Set(['lab', 'exercise', 'programming', 'project']);
const PASSIVE_KINDS   = new Set(['reading', 'video', 'article', 'paper', 'blog', 'book', 'docs', 'website', 'repo']);

/**
 * Validate one course against the depth floors.
 * @returns {{ok: boolean, slug: string, violations: Array<{code,scope,message,actual,floor}>, stats: object}}
 */
export function validateCourseDepth(slug, floors = FLOORS) {
  const violations = [];
  const course = db.prepare('SELECT slug, title, hours FROM courses WHERE slug = ?').get(slug);
  if (!course) return { ok: false, slug, violations: [{ code: 'NO_COURSE', scope: slug, message: 'Course not found', actual: 0, floor: 1 }], stats: {} };

  const modules = db.prepare('SELECT id, title, estimated_minutes FROM course_modules WHERE course_slug = ? ORDER BY order_idx').all(slug);

  const fail = (code, scope, message, actual, floor) => violations.push({ code, scope, message, actual, floor });

  if (modules.length < floors.modulesPerCourse) {
    fail('MODULES', course.title, `only ${modules.length} modules`, modules.length, floors.modulesPerCourse);
  }

  let totalMinutes = 0, totalLessons = 0, totalReadingChars = 0, totalItems = 0;

  for (const m of modules) {
    const lessons = db.prepare('SELECT id, title, kind, body_md, url, estimated_minutes, is_graded FROM module_lessons WHERE module_id = ?').all(m.id);
    totalLessons += lessons.length;

    if (lessons.length < floors.lessonsPerModule) {
      fail('LESSONS', m.title, `only ${lessons.length} lessons`, lessons.length, floors.lessonsPerModule);
    }

    // Readings must be substantial, not a stub paragraph.
    for (const l of lessons) {
      const mins = Number(l.estimated_minutes) || 0;
      totalMinutes += mins;
      if (l.kind === 'reading') {
        const len = (l.body_md || '').length;
        totalReadingChars += len;
        if (len < floors.readingChars) {
          fail('READING_THIN', `${m.title} › ${l.title}`, `reading is ${len} chars`, len, floors.readingChars);
        }
      }
    }

    const graded    = lessons.filter(l => l.is_graded).length;
    const practical = lessons.filter(l => PRACTICAL_KINDS.has(l.kind)).length;
    const resources = lessons.filter(l => l.url && !PRACTICAL_KINDS.has(l.kind)).length;
    const items     = db.prepare('SELECT COUNT(*) c FROM quiz_items WHERE module_id = ?').get(m.id).c;
    totalItems += items;

    if (graded    < floors.gradedPerModule)    fail('GRADED',    m.title, `${graded} graded items`,   graded,    floors.gradedPerModule);
    if (practical < floors.practicalPerModule) fail('PRACTICAL', m.title, `${practical} hands-on items`, practical, floors.practicalPerModule);
    if (resources < floors.resourcesPerModule) fail('RESOURCES', m.title, `${resources} verified resources`, resources, floors.resourcesPerModule);
    if (items     < floors.quizItemsPerModule) fail('QUIZ_ITEMS', m.title, `${items} quiz items in bank`, items, floors.quizItemsPerModule);
  }

  // V2 — time honesty: declared hours should match the sum of per-item estimates.
  const declaredMinutes = (Number(course.hours) || 0) * 60;
  if (declaredMinutes > 0 && totalMinutes > 0) {
    const drift = Math.abs(totalMinutes - declaredMinutes) / declaredMinutes;
    if (drift > floors.timeHonestyTolerance) {
      fail('TIME_DISHONEST', course.title,
        `items sum to ${Math.round(totalMinutes / 60)}h but course claims ${course.hours}h`,
        Math.round(totalMinutes), Math.round(declaredMinutes));
    }
  } else if (declaredMinutes > 0 && totalMinutes === 0) {
    fail('TIME_MISSING', course.title, 'no per-item time estimates', 0, declaredMinutes);
  }

  return {
    ok: violations.length === 0,
    slug,
    violations,
    stats: {
      modules: modules.length,
      lessons: totalLessons,
      quizItems: totalItems,
      declaredHours: course.hours,
      itemMinutes: totalMinutes,
      avgReadingChars: totalReadingChars && totalLessons ? Math.round(totalReadingChars / Math.max(1, modules.length)) : 0,
    },
  };
}

/** Validate every course; returns results sorted worst-first. */
export function validateAllCourses(floors = FLOORS) {
  const slugs = db.prepare('SELECT slug FROM courses').all().map(r => r.slug);
  return slugs.map(s => validateCourseDepth(s, floors))
    .sort((a, b) => b.violations.length - a.violations.length);
}

/** Human-readable report for CLI / job logs. */
export function formatReport(results) {
  const lines = [];
  for (const r of results) {
    const s = r.stats || {};
    lines.push(`${r.ok ? 'PASS' : 'FAIL'}  ${r.slug}  (${s.modules ?? 0} modules, ${s.lessons ?? 0} lessons, ${s.quizItems ?? 0} items)`);
    for (const v of r.violations) lines.push(`        ${v.code.padEnd(14)} ${v.scope} — ${v.message} (floor ${v.floor})`);
  }
  const failed = results.filter(r => !r.ok).length;
  lines.push(`\n${results.length - failed}/${results.length} courses meet the depth floors.`);
  return lines.join('\n');
}

export default { FLOORS, validateCourseDepth, validateAllCourses, formatReport };
