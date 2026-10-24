import React from 'react';
import { I } from './Icons';
import { Btn } from './UI';
import API from '../api.js';
import { LESSON_KIND } from './LessonReader.jsx';

/**
 * A course's front page: what you will be able to do, where you are, and the
 * one button that takes you to the next thing to learn.
 *
 * It used to lead with marketplace furniture (a 0-star rating, "0.0k" stars,
 * forks, a Verify button, an Edit button that only showed a toast) beside an
 * empty right-hand column, and lessons stayed locked until you clicked Enroll.
 */
const parse = (v) => { if (Array.isArray(v)) return v; try { return JSON.parse(v || '[]'); } catch { return []; } };
const mins = (n) => (!n ? null : n >= 60 ? `${Math.round(n / 6) / 10} h` : `${n} min`);

export default function CourseOverview({ course, modules, loading, completedIds, onOpenLesson, onBack, toast }) {
  const outcomes = parse(course.outcomes);
  const prereqs = parse(course.prerequisites);
  const flat = modules.flatMap(m => (m.lessons || []).map(l => ({ ...l, _module: m.title })));
  const required = flat.filter(l => !l.is_optional);
  const done = required.filter(l => completedIds.includes(l.id)).length;
  const nextLesson = required.find(l => !completedIds.includes(l.id));
  const started = done > 0;
  const pct = required.length ? Math.round((done / required.length) * 100) : 0;

  // A build that lost modules is not a finished course; say so and offer to fix it.
  const [depth, setDepth] = React.useState(null);
  const [building, setBuilding] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    API.get(`/courses/${course.slug}/depth`).then(d => { if (alive) setDepth(d); }).catch(() => {});
    return () => { alive = false; };
  }, [course.slug, modules.length]);
  const emptyModules = modules.filter(m => !/capstone/i.test(m.title) && (m.lessons || []).filter(l => l.kind === 'reading').length === 0);
  const finish = async () => {
    setBuilding(true);
    try {
      await API.post(`/courses/${course.slug}/enrich`, {});
      toast('Finishing the course in the background. You will get a notification when it is done.', 'success');
    } catch (e) {
      toast(e.message || 'Could not start the build', 'error');
      setBuilding(false);
    }
  };

  const [openMods, setOpenMods] = React.useState(() => new Set());
  React.useEffect(() => {
    const first = modules.find(m => (m.lessons || []).some(l => l.id === nextLesson?.id)) || modules[0];
    if (first) setOpenMods(new Set([first.id]));
  }, [modules.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="scroll" style={{ height: '100%' }}>
      <div className="course-page">
        <button className="reader-chip" onClick={onBack} style={{ marginBottom: 18 }}>{React.cloneElement(I.chevronL, { size: 14 })} All courses</button>

        <header className="course-hero">
          <div className="course-kicker">
            {[course.level, `${modules.length} modules`, course.hours ? `about ${course.hours} h` : null].filter(Boolean).join(' · ')}
          </div>
          <h1 className="course-title">{course.title}</h1>
          {course.blurb && <p className="course-blurb">{course.blurb}</p>}

          <div className="course-cta">
            <Btn variant="primary" size="lg" disabled={!nextLesson && !flat.length} onClick={() => onOpenLesson(nextLesson || flat[0])}
              iconRight={React.cloneElement(I.arrowR, { size: 15 })}>
              {!nextLesson && flat.length ? 'Review the course' : started ? 'Continue' : 'Start the course'}
            </Btn>
            {nextLesson && <span className="course-next">{started ? 'Up next' : 'First'}: <strong>{nextLesson.title}</strong></span>}
          </div>
          {required.length > 0 && (
            <div className="course-progress">
              <div className="outline-bar"><div style={{ width: `${pct}%` }} /></div>
              <span>{done} of {required.length} lessons · {pct}%</span>
            </div>
          )}
        </header>

        {emptyModules.length > 0 && !loading && (
          <div className="course-warning">
            <div>
              <strong>This course was not fully built.</strong> {emptyModules.length} of {modules.length} modules have no lessons yet
              {depth?.violations?.length ? `, and ${depth.violations.length} quality checks failed` : ''}.
            </div>
            <Btn variant="outline" size="sm" disabled={building} onClick={finish}>{building ? 'Building…' : 'Finish building'}</Btn>
          </div>
        )}

        {(outcomes.length > 0 || prereqs.length > 0) && (
          <section className="course-about">
            {outcomes.length > 0 && (
              <div>
                <h2>What you will be able to do</h2>
                <ul className="course-outcomes">{outcomes.map((o, i) => <li key={i}>{React.cloneElement(I.check, { size: 14 })}<span>{o}</span></li>)}</ul>
              </div>
            )}
            {prereqs.length > 0 && (
              <div>
                <h2>Before you start</h2>
                <ul className="course-prereqs">{prereqs.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="course-h2">Syllabus</h2>
          {loading && <div className="course-muted">Loading the syllabus…</div>}
          {!loading && modules.length === 0 && <div className="course-muted">This course has no modules yet.</div>}
          <ol className="syllabus">
            {modules.map((m, mi) => {
              const lessons = m.lessons || [];
              const req = lessons.filter(l => !l.is_optional);
              const d = req.filter(l => completedIds.includes(l.id)).length;
              const isOpen = openMods.has(m.id);
              const capstone = /capstone/i.test(m.title);
              const minutes = req.reduce((n, l) => n + (Number(l.estimated_minutes) || 0), 0);
              return (
                <li key={m.id} className={`syllabus-module${isOpen ? ' open' : ''}`}>
                  <button className="syllabus-head" aria-expanded={isOpen}
                    onClick={() => setOpenMods(s => { const n = new Set(s); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })}>
                    <span className={`syllabus-num${req.length && d === req.length ? ' done' : ''}`}>{req.length && d === req.length ? React.cloneElement(I.check, { size: 13 }) : capstone ? '★' : mi + 1}</span>
                    <span className="syllabus-text">
                      <span className="syllabus-title">{m.title.replace(/^Capstone\s*·\s*/i, 'Capstone: ')}</span>
                      {m.summary && <span className="syllabus-summary">{m.summary}</span>}
                    </span>
                    <span className="syllabus-meta">{req.length ? `${d}/${req.length}` : 'not built'}{minutes ? ` · ${mins(minutes)}` : ''}</span>
                    <span className="syllabus-caret">{React.cloneElement(I.chevronD || I.chevron, { size: 14 })}</span>
                  </button>
                  {isOpen && lessons.length > 0 && (
                    <ul className="syllabus-lessons">
                      {lessons.map(l => {
                        const k = LESSON_KIND[l.kind] || LESSON_KIND.reading;
                        const isDone = completedIds.includes(l.id);
                        return (
                          <li key={l.id}>
                            <button className={`syllabus-lesson${l.is_optional ? ' optional' : ''}`} onClick={() => onOpenLesson(l)}>
                              <span className={`outline-dot${isDone ? ' done' : ''}`}>{isDone ? React.cloneElement(I.check, { size: 10 }) : null}</span>
                              <span className="syllabus-lesson-title">{l.title.replace(/ · .*$/, '')}</span>
                              <span className="syllabus-kind">{l.is_optional ? 'optional' : k.label.toLowerCase()}{mins(l.estimated_minutes) && !l.is_optional ? ` · ${mins(l.estimated_minutes)}` : ''}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
