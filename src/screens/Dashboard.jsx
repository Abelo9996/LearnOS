import React from 'react';
import { I } from '../components/Icons';
import { Btn } from '../components/UI';
import API from '../api.js';
import { useUser } from '../UserContext.jsx';

/**
 * Home: what to do next, nothing else.
 *
 * It used to be six sections of widgets: a stat row, a "learning coach" whose
 * heuristic told a brand-new learner they had "slowed down" at 0% proficiency,
 * roadmap cards, quick actions, agent telemetry and an activity feed. A learner
 * opening the app wants one thing, to pick up where they left off, so that is
 * the first thing on the page; reviews due and open assignments follow.
 */
export default function Dashboard({ setScreen }) {
  const user = useUser();
  const [courses, setCourses] = React.useState(null);
  const [stats, setStats] = React.useState(null);
  const [due, setDue] = React.useState([]);
  const [assignments, setAssignments] = React.useState([]);

  React.useEffect(() => {
    API.getCourses().then(r => setCourses(Array.isArray(r) ? r : [])).catch(() => setCourses([]));
    API.getStats().then(setStats).catch(() => {});
    API.getFlashcardsDue().then(r => setDue(Array.isArray(r) ? r : [])).catch(() => {});
    API.getAssignments().then(r => setAssignments(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const openCourse = (slug) => {
    try { localStorage.setItem('learnos_open_course', slug); } catch {}
    setScreen('courses');
  };

  const first = (user.name || '').split(' ')[0];
  const started = (courses || []).filter(c => c.done_count > 0 && c.done_count < c.lesson_count);
  const current = started[0] || null;
  const notStarted = (courses || []).filter(c => !c.done_count && c.lesson_count > 0);
  const open = assignments.filter(a => a.status !== 'graded');
  const streak = stats?.streak ?? 0;

  return (
    <div className="scroll" style={{ height: '100%' }}>
      <div className="home">
        <header className="home-head">
          <h1 className="home-title">{first ? `Welcome back, ${first}` : 'Welcome back'}</h1>
          {streak > 0 && <span className="home-streak">{React.cloneElement(I.flame, { size: 15 })} {streak} day{streak === 1 ? '' : 's'} in a row</span>}
        </header>

        {courses === null ? (
          <div className="course-muted">Loading…</div>
        ) : courses.length === 0 ? (
          <div className="library-empty">
            <h2>What do you want to learn?</h2>
            <p>Name any subject. LearnOS plans a course for you and writes it lesson by lesson, with worked examples, practice and labs that check your work.</p>
            <Btn variant="primary" size="lg" icon={I.plus} onClick={() => setScreen('courses')}>Create a course</Btn>
          </div>
        ) : (
          <>
            {current ? (
              <button className="home-continue" onClick={() => openCourse(current.slug)}>
                <span className="home-label">Continue</span>
                <span className="home-course">{current.title}</span>
                <span className="home-progress">
                  <span className="outline-bar" style={{ flex: 1, margin: 0 }}><span style={{ display: 'block', height: '100%', width: `${Math.round((current.done_count / current.lesson_count) * 100)}%`, background: 'var(--good)', borderRadius: 'inherit' }} /></span>
                  <span>{current.done_count} of {current.lesson_count} lessons</span>
                </span>
                <span className="home-go">Resume {React.cloneElement(I.arrowR, { size: 15 })}</span>
              </button>
            ) : notStarted[0] ? (
              <button className="home-continue" onClick={() => openCourse(notStarted[0].slug)}>
                <span className="home-label">Start</span>
                <span className="home-course">{notStarted[0].title}</span>
                {notStarted[0].blurb && <span className="home-blurb">{notStarted[0].blurb}</span>}
                <span className="home-go">Begin {React.cloneElement(I.arrowR, { size: 15 })}</span>
              </button>
            ) : null}

            <div className="home-grid">
              <HomeTile title="Review" onClick={() => setScreen('cards')}
                value={due.length ? `${due.length} card${due.length === 1 ? '' : 's'} due` : 'Nothing due'}
                note={due.length ? 'A few minutes of recall keeps what you learned.' : 'Questions you miss in quizzes come back here.'} />
              <HomeTile title="Assignments" onClick={() => setScreen('assignments')}
                value={open.length ? `${open.length} open` : 'All caught up'}
                note={open[0] ? `Next: ${open[0].title}` : 'Graded work from your courses shows up here.'} />
              <HomeTile title="Courses" onClick={() => setScreen('courses')}
                value={`${courses.length} course${courses.length === 1 ? '' : 's'}`}
                note={started.length > 1 ? `${started.length} in progress` : 'Start another subject any time.'} />
            </div>

            {started.length > 1 && (
              <section className="library-section" style={{ marginTop: 28 }}>
                <h2 className="course-h2">Also in progress</h2>
                <div className="home-list">
                  {started.slice(1, 5).map(c => (
                    <button key={c.slug} className="home-row" onClick={() => openCourse(c.slug)}>
                      <span className="home-row-title">{c.title}</span>
                      <span className="home-row-meta">{Math.round((c.done_count / c.lesson_count) * 100)}%</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HomeTile({ title, value, note, onClick }) {
  return (
    <button className="home-tile" onClick={onClick}>
      <span className="home-label">{title}</span>
      <span className="home-tile-value">{value}</span>
      <span className="home-tile-note">{note}</span>
    </button>
  );
}
