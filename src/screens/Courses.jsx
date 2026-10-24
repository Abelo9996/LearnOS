import React from 'react';
import { I } from '../components/Icons';
import { Card, Btn, ProgressBar, Tag, Avatar, Kbd, PageScroll, SectionHead } from '../components/UI';
import { useUser } from '../UserContext.jsx';
import API from '../api.js';
import { useToast, useModal } from '../App';
import MarkdownText from '../components/Markdown';
import ModuleQuiz from '../components/ModuleQuiz.jsx';
import LessonReader, { LESSON_KIND } from '../components/LessonReader.jsx';
import CourseOverview from '../components/CourseOverview.jsx';

// "12 min" the way Coursera labels every item.
const mins = (n) => (n ? (n >= 60 ? `${Math.round(n / 60)} h` : `${n} min`) : null);

export default function Courses({ setScreen }) {
  const { add: toast } = useToast();
  const { open: openModal, close: closeModal } = useModal();
  const user = useUser();
  const [courses, setCourses]   = React.useState([]);
  const [loading, setLoading]   = React.useState(true);
  const [search, setSearch]     = React.useState('');
  const [sort, setSort]         = React.useState('trending'); // trending | rating | az
  const [verifiedOnly, setVerifiedOnly] = React.useState(false);
  const [tagFilter, setTagFilter] = React.useState(null);
  const [starred, setStarred]   = React.useState({});   // slug → bool
  const [enrolled, setEnrolled] = React.useState({});   // slug → bool
  const [selectedCourse, setSelectedCourse] = React.useState(null);

  // Course-detail state. These MUST live at the top level of the component:
  // declaring them inside `if (selectedCourse)` violated the Rules of Hooks and
  // crashed the whole app ("Rendered more hooks than during the previous
  // render") the moment a course card was clicked.
  const [courseModules, setCourseModules] = React.useState([]);
  const [modulesLoading, setModulesLoading] = React.useState(false);
  const [progress, setProgress] = React.useState(null);
  const [verifying, setVerifying] = React.useState(false);
  const [selectedLesson, setSelectedLesson] = React.useState(null);
  // The server returns { total, completed: <count>, completedIds: [...] } -
  // `completed` is a NUMBER, so treating it as an array silently broke progress
  // and threw on .includes().
  const completedIds = progress?.completedIds || [];

  const detailSlug = selectedCourse?.slug;
  React.useEffect(() => {
    if (!detailSlug) return;
    let alive = true;
    setSelectedLesson(null);
    setCourseModules([]);
    setProgress(null);
    setModulesLoading(true);
    API.getCourseModules(detailSlug)
      .then(mods => { if (alive) setCourseModules(mods || []); })
      .catch(() => {})
      .finally(() => { if (alive) setModulesLoading(false); });
    if (enrolled[detailSlug]) {
      API.getCourseProgress(detailSlug).then(p => { if (alive) setProgress(p); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [detailSlug, enrolled[detailSlug]]);

  // Handoff from the roadmap: when a module links to a course, the Roadmap
  // screen stashes the slug in localStorage and switches here. Consume it once
  // the catalog has loaded, then clear it so a later revisit stays on the list.
  const didHandoff = React.useRef(false);
  React.useEffect(() => {
    if (didHandoff.current || loading || !courses.length) return;
    let slug;
    try { slug = localStorage.getItem('learnos_open_course'); } catch { slug = null; }
    if (!slug) { didHandoff.current = true; return; }
    try { localStorage.removeItem('learnos_open_course'); } catch {}
    didHandoff.current = true;
    const hit = courses.find(c => c.slug === slug);
    if (hit) setSelectedCourse(hit);
  }, [loading, courses]);

  // Keep the catalog row and the open detail in sync after verify/unverify.
  const applyVerified = (slug, verified) => {
    setSelectedCourse(prev => (prev && prev.slug === slug ? { ...prev, verified } : prev));
    setCourses(prev => prev.map(x => (x.slug === slug ? { ...x, verified } : x)));
  };

  // Load courses + user's starred/enrolled state
  React.useEffect(() => {
    const loadAll = async () => {
      try {
        const [rows, starredRows] = await Promise.all([
          API.getCourses(),
          API.getStarred().catch(() => []),
        ]);
        const parsed = (rows || []).map(c => ({
          ...c,
          tags: typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : (c.tags || []),
        }));
        setCourses(parsed);

        const starredMap = {};
        const enrolledMap = {};
        (starredRows || []).forEach(s => {
          if (s.item_type === 'course') starredMap[s.item_id] = true;
        });
        // Load enrollments separately
        const enrollRes = await API.getEnrollments().catch(() => []);
        (enrollRes || []).forEach(e => { if (e.course_slug) enrolledMap[e.course_slug] = true; });
        setStarred(starredMap);
        setEnrolled(enrolledMap);
      } catch {
        // silently use empty
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const toggleStar = async (slug) => {
    const wasStarred = !!starred[slug];
    setStarred(prev => ({ ...prev, [slug]: !wasStarred }));
    try {
      if (wasStarred) {
        await API.removeStarred('course', slug);
        toast('Removed from starred', 'info');
      } else {
        await API.addStarred('course', slug);
        toast('Added to starred ⭐', 'success');
      }
    } catch {
      setStarred(prev => ({ ...prev, [slug]: wasStarred })); // revert
      toast('Could not update starred', 'error');
    }
  };

  const enroll = async (slug, title) => {
    const wasEnrolled = !!enrolled[slug];
    setEnrolled(prev => ({ ...prev, [slug]: !wasEnrolled }));
    try {
      if (wasEnrolled) {
        await API.unenrollCourse(slug);
        toast(`Unenrolled from "${title}"`, 'info');
      } else {
        await API.enrollCourse(slug);
        toast(`Enrolled in "${title}"`, 'success');
      }
    } catch {
      setEnrolled(prev => ({ ...prev, [slug]: wasEnrolled })); // revert
      toast('Could not update enrollment', 'error');
    }
  };

  const [tab, setTab] = React.useState('browse');
  const tabs = [
    { id: 'browse',   label: 'Browse',   n: courses.length },
    { id: 'enrolled', label: 'Enrolled', n: courses.filter(c => enrolled[c.slug]).length },
    { id: 'starred',  label: 'Starred',  n: courses.filter(c => starred[c.slug]).length },
  ];
  // All tags present across the catalog (for the tag filter pills).
  const allTags = React.useMemo(() => {
    const set = new Set();
    courses.forEach(c => (c.tags || []).forEach(t => set.add(t)));
    return [...set].sort().slice(0, 10);
  }, [courses]);

  const baseFiltered = tab === 'enrolled' ? courses.filter(c => enrolled[c.slug])
    : tab === 'starred' ? courses.filter(c => starred[c.slug])
    : courses;
  let filtered = baseFiltered;
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(c => c.title.toLowerCase().includes(q) || c.author.toLowerCase().includes(q) || (c.blurb || '').toLowerCase().includes(q) || (c.tags || []).some(t => t.toLowerCase().includes(q)));
  }
  if (verifiedOnly) filtered = filtered.filter(c => c.verified);
  if (tagFilter) filtered = filtered.filter(c => (c.tags || []).includes(tagFilter));
  filtered = [...filtered].sort((a, b) =>
    sort === 'rating' ? (b.rating || 0) - (a.rating || 0)
    : sort === 'az' ? a.title.localeCompare(b.title)
    : (b.stars || 0) - (a.stars || 0)); // trending = by stars

  if (selectedCourse) {
    const c = selectedCourse;
    const totalLessons = courseModules.reduce((s, m) => s + (m.lessons?.length || 0), 0);
    const completedLessons = completedIds.length;
    const progressPct = totalLessons > 0 ? completedLessons / totalLessons : 0;
    const isAuthor = user.email === c.author || user.name === c.author;
    // Self-hosted single-user instance: you curate your own catalog. (The old
    // `user.role === 'admin'` check was never true, so verify/edit were dead.)
    const isAdmin = true;

    if (selectedLesson) {
      const refresh = () => API.getCourseProgress(c.slug).then(setProgress).catch(() => {});
      return (
        <LessonReader
          course={c} modules={courseModules} lesson={selectedLesson} completedIds={completedIds}
          onOpenLesson={(l) => setSelectedLesson(l)}
          onBack={() => setSelectedLesson(null)}
          onCompleted={() => {
            // Completing a lesson enrolls you; there is no separate gate to pass first.
            if (!enrolled[c.slug]) setEnrolled(prev => ({ ...prev, [c.slug]: true }));
            refresh();
          }}
          toast={toast} openModal={openModal} closeModal={closeModal} />
      );
    }

    return (
      <CourseOverview course={c} modules={courseModules} loading={modulesLoading} completedIds={completedIds}
        onOpenLesson={(l) => setSelectedLesson(l)} onBack={() => setSelectedCourse(null)} toast={toast} />
    );
  }

  const openGenerator = () => openModal(<GenerateCourseModal onDone={async (slug) => {
    closeModal();
    const rows = await API.getCourses();
    const parsed = (rows || []).map(c => ({ ...c, tags: typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : (c.tags || []) }));
    setCourses(parsed);
    const created = parsed.find(c => c.slug === slug);
    if (created) setSelectedCourse(created);
  }} />);

  const q = search.trim().toLowerCase();
  const shown = q ? courses.filter(c => c.title.toLowerCase().includes(q) || (c.blurb || '').toLowerCase().includes(q)) : courses;
  const inProgress = shown.filter(c => c.done_count > 0 && c.done_count < c.lesson_count);
  const rest = shown.filter(c => !inProgress.includes(c));

  return (
    <div className="scroll" style={{ height: '100%' }}>
      <div className="library">
        <header className="library-head">
          <div>
            <h1 className="library-title">Courses</h1>
            <p className="library-sub">Every course here was written for you, or imported from a file. Pick one up where you left off, or start a new subject.</p>
          </div>
          <div className="library-actions">
            <Btn variant="outline" size="md" onClick={() => setScreen && setScreen('share')}>Import or export</Btn>
            <Btn variant="primary" size="md" icon={I.plus} onClick={openGenerator}>New course</Btn>
          </div>
        </header>

        {courses.length > 6 && (
          <div className="library-search">
            {React.cloneElement(I.search, { size: 15 })}
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your courses" />
          </div>
        )}

        {loading ? (
          <div className="course-muted">Loading your courses…</div>
        ) : courses.length === 0 ? (
          <div className="library-empty">
            <h2>Learn anything, properly.</h2>
            <p>Name a subject and LearnOS writes you a full course: lessons planned in order, worked examples, practice with solutions, labs that check your code, and quizzes checked by an independent examiner.</p>
            <Btn variant="primary" size="lg" icon={I.plus} onClick={openGenerator}>Create your first course</Btn>
          </div>
        ) : (
          <>
            {inProgress.length > 0 && (
              <section className="library-section">
                <h2 className="course-h2">Continue</h2>
                <div className="library-grid">{inProgress.map(c => <CourseCard key={c.slug} c={c} onSelect={() => setSelectedCourse(c)} />)}</div>
              </section>
            )}
            {rest.length > 0 && (
              <section className="library-section">
                {inProgress.length > 0 && <h2 className="course-h2">Library</h2>}
                <div className="library-grid">{rest.map(c => <CourseCard key={c.slug} c={c} onSelect={() => setSelectedCourse(c)} />)}</div>
              </section>
            )}
            {shown.length === 0 && <div className="course-muted">No course matches "{search}".</div>}
          </>
        )}
      </div>
    </div>
  );
}

function CourseCard({ c, onSelect }) {
  const pct = c.lesson_count ? Math.round((c.done_count / c.lesson_count) * 100) : 0;
  const meta = [c.level, c.module_count ? `${c.module_count} modules` : null, c.hours ? `about ${c.hours} h` : null].filter(Boolean).join(' · ');
  return (
    <button className="course-card" onClick={onSelect}>
      <span className="course-card-kicker">{meta}</span>
      <span className="course-card-title">{c.title}</span>
      {c.blurb && <span className="course-card-blurb">{c.blurb}</span>}
      <span className="course-card-foot">
        {c.empty_modules > 0
          ? <span className="course-card-warn">{c.empty_modules} module{c.empty_modules === 1 ? '' : 's'} not built</span>
          : c.done_count > 0
            ? <><span className="outline-bar" style={{ flex: 1, margin: 0 }}><span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--good)', borderRadius: 'inherit' }} /></span><span>{pct}%</span></>
            : <span>{c.lesson_count} lessons</span>}
      </span>
    </button>
  );
}

function GenerateCourseModal({ onDone }) {
  const { add: toast } = useToast();
  const [topic, setTopic] = React.useState('');
  const [level, setLevel] = React.useState('intermediate');
  const [phase, setPhase] = React.useState('form'); // form | generating | error
  const [errMsg, setErrMsg] = React.useState('');
  const [progress, setProgress] = React.useState({ pct: 0, msg: '' });
  const inp = { width: '100%', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13.5 };
  const suggestions = ['Reinforcement Learning', 'Distributed Systems', 'Real Analysis', 'Modern React', 'Quantum Computing', 'Financial Modeling'];

  // Stays true while the modal is mounted, so the poll loop stops cleanly when
  // the modal is closed or the page navigated away instead of leaking.
  const aliveRef = React.useRef(true);

  const keyErr = (msg) => /key/i.test(msg || '')
    ? 'Add an OpenRouter key in Settings → API Keys to build courses.'
    : (msg || 'Course build failed, try again.');

  // Poll a build job to completion, driving the progress bar. Guarded so it
  // stops on unmount rather than setting state on a dead component.
  const pollBuild = async (jobId) => {
    for (;;) {
      await new Promise(r => setTimeout(r, 2000));
      if (!aliveRef.current) return;
      const j = await API.getJob(jobId).catch(() => null);
      if (!aliveRef.current) return;
      if (!j) continue;
      if (typeof j.progress === 'number' || j.progress_msg) {
        setProgress({ pct: j.progress || 0, msg: j.progress_msg || '' });
      }
      if (j.status === 'done') {
        const res = j.result || {};
        toast(`Course built · ${res.modules} modules · ${res.lessons} lessons · ${res.quizItems} quiz items`, 'success');
        onDone && onDone(res.slug);
        return;
      }
      if (j.status === 'failed') { setErrMsg(keyErr(j.error)); setPhase('error'); return; }
    }
  };

  // Resume a build still running from a previous mount: the jobId lived only in
  // the old closure, so re-find it from the server and pick the bar back up
  // instead of showing the form while a build runs in the background.
  React.useEffect(() => {
    aliveRef.current = true;
    API.getActiveCourseBuild().then(info => {
      if (!aliveRef.current || !info || !info.active || !info.jobId) return;
      setPhase('generating');
      setProgress({ pct: info.progress || 0, msg: info.progress_msg || 'Resuming build…' });
      pollBuild(info.jobId);
    }).catch(() => {});
    return () => { aliveRef.current = false; };
  }, []);

  const go = async () => {
    if (!topic.trim()) return;
    aliveRef.current = true;
    setPhase('generating');
    setProgress({ pct: 0, msg: 'Starting the build…' });
    try {
      // Staged build: one LLM call per module, so it runs as a job we poll.
      const { jobId } = await API.buildCourseAI({ topic: topic.trim(), level });
      await pollBuild(jobId);
    } catch (e) {
      setErrMsg(e.code === 'NO_KEY' ? keyErr('key') : keyErr(e.message));
      setPhase('error');
    }
  };

  if (phase === 'generating') {
    return (
      <div style={{ minWidth: 440, padding: '32px 8px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', gap: 6, marginBottom: 16 }}>
          {[0, 1, 2].map(i => <span key={i} style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--brand)', animation: `ldot 1s ease-in-out ${i * 0.15}s infinite` }} />)}
        </div>
        <div className="display" style={{ fontSize: 19, color: 'var(--ink)' }}>Building your course…</div>
        <div style={{ maxWidth: 380, margin: '14px auto 0' }}>
          <ProgressBar value={progress.pct || 0} height={8} />
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--brand)', marginTop: 8, minHeight: 16 }}>
            {progress.msg || 'Starting…'}
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12, lineHeight: 1.6, maxWidth: 400, margin: '12px auto 0' }}>
          Each module is written in full, readings, ten practice questions, a hands-on lab and a graded assessment, then every external resource is reachability-verified. This takes a few minutes and is why the result has real depth.
        </div>
      </div>
    );
  }
  if (phase === 'error') {
    return (
      <div style={{ minWidth: 440, padding: '28px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🔌</div>
        <div className="display" style={{ fontSize: 18, color: 'var(--ink)' }}>Couldn't generate the course</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 20px', lineHeight: 1.6 }}>{errMsg}</div>
        <Btn variant="outline" onClick={() => setPhase('form')}>Back</Btn>
      </div>
    );
  }
  return (
    <div style={{ minWidth: 460, maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h3 className="display" style={{ fontSize: 22, margin: 0 }}>Generate a course with AI</h3>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>A full, Coursera-grade course, readings, lecture videos, papers, assignments and a capstone, built for your topic.</div>
      </div>
      <div>
        <label className="cap" style={{ display: 'block', marginBottom: 6 }}>What do you want a course on?</label>
        <input autoFocus value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') go(); }} placeholder="e.g. Reinforcement learning, from bandits to PPO" style={inp} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {suggestions.map(s => <button key={s} onClick={() => setTopic(s)} className="ui-btn" style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-2)', cursor: 'pointer' }}>{s}</button>)}
        </div>
      </div>
      <div>
        <label className="cap" style={{ display: 'block', marginBottom: 6 }}>Level</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['beginner', 'intermediate', 'advanced'].map(l => (
            <button key={l} onClick={() => setLevel(l)} className="ui-btn" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, textTransform: 'capitalize', cursor: 'pointer', background: level === l ? 'var(--accent-soft)' : 'var(--surface)', border: `1px solid ${level === l ? 'var(--accent-line)' : 'var(--border)'}`, color: level === l ? 'var(--brand-ink)' : 'var(--ink-2)', fontSize: 13 }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <Btn variant="primary" icon={I.spark} disabled={!topic.trim()} onClick={go}>Generate course</Btn>
      </div>
    </div>
  );
}

