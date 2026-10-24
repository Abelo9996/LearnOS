import React from 'react';
import { I } from './Icons';
import { Btn } from './UI';
import API from '../api.js';
import MarkdownText from './Markdown';
import ModuleQuiz from './ModuleQuiz.jsx';
import LabRunner from './LabRunner.jsx';

/**
 * The lesson reader: where a learner spends nearly all of their time.
 *
 *   outline   every module and lesson, what is done, what is optional, where
 *             you are; collapses into a "Contents" drawer on small screens
 *   lesson    one centred reading column; videos play in place; labs and
 *             quizzes run inline and complete themselves when passed
 *   tutor     a side panel that has read this exact lesson and knows what the
 *             learner got wrong; select any passage to ask about it
 *
 * It replaced a single card with Previous / "Complete & continue" and nothing
 * else: no way to see the course from inside a lesson, a tutor you could only
 * reach from a different screen (and that had never seen the lesson), and
 * labs and quizzes that counted as done the moment you clicked a button.
 */

export const LESSON_KIND = {
  video:    { label: 'Video',         color: 'oklch(0.58 0.19 25)',  icon: 'cap' },
  paper:    { label: 'Paper',         color: 'oklch(0.52 0.18 295)', icon: 'search' },
  book:     { label: 'Book',          color: 'oklch(0.55 0.13 75)',  icon: 'book' },
  blog:     { label: 'Article',       color: 'oklch(0.52 0.16 330)', icon: 'rss' },
  article:  { label: 'Article',       color: 'oklch(0.50 0.14 155)', icon: 'book' },
  website:  { label: 'Website',       color: 'oklch(0.50 0.14 220)', icon: 'graph' },
  docs:     { label: 'Docs',          color: 'oklch(0.50 0.14 200)', icon: 'book' },
  repo:     { label: 'Repository',    color: 'oklch(0.48 0.02 270)', icon: 'fork' },
  resources:{ label: 'Further reading', color: 'oklch(0.50 0.06 250)', icon: 'book' },
  reading:  { label: 'Lesson',        color: 'var(--brand)',         icon: 'book' },
  exercise: { label: 'Exercise',      color: 'oklch(0.56 0.18 25)',  icon: 'check' },
  project:  { label: 'Project',       color: 'var(--brand-3)',       icon: 'spark' },
  lab:          { label: 'Lab',           color: 'oklch(0.52 0.15 150)', icon: 'spark' },
  practice_quiz:{ label: 'Practice quiz', color: 'var(--brand-2)',       icon: 'check' },
  graded_quiz:  { label: 'Graded',        color: 'oklch(0.56 0.18 25)',  icon: 'check' },
};

const mins = (n) => (n ? (n >= 60 ? `${Math.round(n / 60)} h` : `${n} min`) : null);

// Extract a YouTube video id so lecture videos play inline. Handles every URL
// shape the generator (and people) actually produce: watch?v=, youtu.be short
// links, /embed/, /v/, /shorts/, /live/, and ids buried behind other query
// params (watch?feature=…&v=ID). Missing forms were silently falling through to
// a "just a link" card instead of embedding, the core of the complaint.
function youtubeId(url) {
  if (!url) return null;
  const s = String(url);
  const path = s.match(/(?:youtube\.com\/(?:embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (path) return path[1];
  try {
    const u = new URL(s);
    if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      const v = u.searchParams.get('v');
      if (v && /^[\w-]{11}$/.test(v)) return v;
    }
  } catch { /* not a URL */ }
  return null;
}

/**
 * What can we actually show in place, rather than sending the learner away?
 *
 * Only sources that publish an embed endpoint are framed, guessing gets you a
 * box showing "refused to connect", which is worse than an honest link. Every
 * frame is sandboxed and referrer-trimmed; anything unrecognised falls through
 * to the link card and the in-app reader below it.
 *
 * The frame hosts here must also be present in the CSP frame-src list in
 * server.js, or the browser blocks them regardless of what this returns.
 */
function embedFor(url) {
  if (!url) return null;
  const yt = youtubeId(url);
  // rel=0 keeps "up next" suggestions within the same channel; modestbranding
  // trims the chrome. Privacy-nocookie domain so watching a lesson doesn't set
  // tracking cookies.
  if (yt) return { kind: 'video', src: `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1`, label: 'Lecture video' };
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '');

  const vimeo = host === 'vimeo.com' && u.pathname.match(/^\/(\d+)/);
  if (vimeo) return { kind: 'video', src: `https://player.vimeo.com/video/${vimeo[1]}`, label: 'Lecture video' };

  // arXiv abstract pages have a matching PDF that frames cleanly.
  const arxiv = (host === 'arxiv.org' || host === 'export.arxiv.org') && u.pathname.match(/^\/abs\/(.+)$/);
  if (arxiv) return { kind: 'doc', src: `https://arxiv.org/pdf/${arxiv[1]}`, label: 'Paper' };

  if (/\.pdf($|\?)/i.test(u.pathname + u.search)) return { kind: 'doc', src: url, label: 'PDF' };

  return null;
}
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

/**
 * Show an external article/doc as a live iframe of the real page, inside the
 * lesson.
 *
 * The old approach fetched the page and re-rendered its text as Markdown, which
 * mangled layout, code and figures and read as broken. This embeds the actual
 * site instead, but only after the server confirms the site permits framing
 * (many send X-Frame-Options), because a blocked frame is a blank grey box.
 * When it can't be framed, fall back to a clean "open it" card rather than
 * showing something broken.
 */
function FramedResource({ lessonId, url, meta }) {
  const [status, setStatus] = React.useState('checking'); // checking | framable | blocked
  React.useEffect(() => {
    let alive = true;
    setStatus('checking');
    API.getFramable(lessonId)
      .then(r => { if (alive) setStatus(r?.framable ? 'framable' : 'blocked'); })
      .catch(() => { if (alive) setStatus('blocked'); });
    return () => { alive = false; };
  }, [lessonId]);

  const openBtn = (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: meta.color, textDecoration: 'none', flexShrink: 0 }}>
      Open in new tab {React.cloneElement(I.open || I.arrowR, { size: 13 })}
    </a>
  );

  if (status === 'checking') {
    return <div style={{ padding: '22px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 12.5 }}>Loading preview…</div>;
  }

  if (status === 'blocked') {
    // The site refuses to be embedded, an honest link beats a broken frame.
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="hover-card"
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, marginBottom: 18, borderRadius: 12, background: 'var(--surface)', border: `1px solid color-mix(in oklch, ${meta.color} 30%, var(--border))`, textDecoration: 'none', color: 'var(--ink)' }}>
        <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 10, background: `color-mix(in oklch, ${meta.color} 16%, transparent)`, color: meta.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid color-mix(in oklch, ${meta.color} 35%, transparent)` }}>{React.cloneElement(I[meta.icon] || I.book, { size: 20 })}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Open this {meta.label.toLowerCase()}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{hostOf(url)} · doesn't allow embedding</div>
        </div>
        <span style={{ color: meta.color, flexShrink: 0 }}>{React.cloneElement(I.open || I.arrowR, { size: 16 })}</span>
      </a>
    );
  }

  return (
    <div style={{ marginBottom: 18, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '9px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: meta.color, display: 'inline-flex' }}>{React.cloneElement(I[meta.icon] || I.book, { size: 14 })}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hostOf(url)}</span>
        {openBtn}
      </div>
      <iframe
        title={`Embedded ${meta.label}`} src={url}
        referrerPolicy="strict-origin-when-cross-origin"
        allow="fullscreen"
        style={{ display: 'block', width: '100%', height: '80vh', minHeight: 480, border: 0, background: '#fff' }} />
    </div>
  );
}

// Lessons that complete themselves when passed, rather than by a click.
const SELF_COMPLETING = { lab: 'Pass the tests to complete this lab.', practice_quiz: 'Score 80% to complete this practice quiz.', graded_quiz: 'Pass the assignment to complete it.', project: 'Pass the project to complete it.' };

function useMedia(query) {
  const [match, setMatch] = React.useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  React.useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

export default function LessonReader({ course, modules, lesson, completedIds, onOpenLesson, onBack, onProgress, onCompleted, toast, openModal, closeModal }) {
  const narrow = useMedia('(max-width: 900px)');
  const [outlineOpen, setOutlineOpen] = React.useState(false);
  const [tutorOpen, setTutorOpen] = React.useState(() => {
    try { return localStorage.getItem('learnos_tutor_open') === '1'; } catch { return false; }
  });
  const [ask, setAsk] = React.useState(null); // a passage handed to the tutor
  const [selection, setSelection] = React.useState(null); // { text, x, y }
  const contentRef = React.useRef(null);
  const scrollRef = React.useRef(null);

  React.useEffect(() => { try { localStorage.setItem('learnos_tutor_open', tutorOpen ? '1' : '0'); } catch {} }, [tutorOpen]);
  React.useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); setSelection(null); setOutlineOpen(false); }, [lesson.id]);

  const flat = React.useMemo(() => modules.flatMap(m => (m.lessons || []).map(l => ({ ...l, _module: m.title, _moduleId: m.id }))), [modules]);
  const idx = flat.findIndex(l => l.id === lesson.id);
  const current = flat[idx] || lesson;
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;
  const meta = LESSON_KIND[current.kind] || LESSON_KIND.reading;
  const embed = embedFor(current.url);
  const isDone = completedIds.includes(current.id);
  const selfCompleting = SELF_COMPLETING[current.kind];

  const required = flat.filter(l => !l.is_optional);
  const doneCount = required.filter(l => completedIds.includes(l.id)).length;

  const markDone = async (advance) => {
    try {
      if (!isDone) {
        const r = await API.markLessonComplete(course.slug, current.id);
        onCompleted && onCompleted();
        if (r?.xp) toast(`Lesson complete · +${r.xp} XP`, 'success');
      }
      if (advance && next) onOpenLesson(next);
    } catch (e) { toast(e.message || 'Could not mark complete', 'error'); }
  };

  // Select a passage, then ask the tutor about exactly that.
  const onMouseUp = () => {
    const sel = window.getSelection();
    const text = sel ? String(sel).trim() : '';
    if (!text || text.length < 3 || text.length > 600 || !contentRef.current?.contains(sel.anchorNode)) { setSelection(null); return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const host = scrollRef.current.getBoundingClientRect();
    setSelection({ text, x: rect.left + rect.width / 2 - host.left, y: rect.top - host.top + scrollRef.current.scrollTop });
  };
  const askAboutSelection = () => {
    setAsk({ text: `Can you explain this part: "${selection.text}"`, at: Date.now() });
    setTutorOpen(true);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const outline = (
    <Outline modules={modules} currentId={current.id} completedIds={completedIds} doneCount={doneCount} total={required.length}
      onOpen={(l) => onOpenLesson(l)} courseTitle={course.title} onBack={onBack} />
  );

  return (
    <div className={`reader${tutorOpen && !narrow ? ' reader-with-tutor' : ''}`}>
      {!narrow && <aside className="reader-outline scroll">{outline}</aside>}

      <div className="reader-main scroll" ref={scrollRef}>
        <div className="reader-topbar">
          {narrow ? (
            <button className="reader-chip" onClick={() => setOutlineOpen(true)}>{React.cloneElement(I.layers, { size: 14 })} Contents · {doneCount}/{required.length}</button>
          ) : (
            <span className="reader-where">{current.is_optional ? 'Optional extra' : `Lesson ${required.findIndex(l => l.id === current.id) + 1} of ${required.length}`}</span>
          )}
          <div style={{ flex: 1 }} />
          <button className={`reader-chip${tutorOpen ? ' on' : ''}`} onClick={() => setTutorOpen(v => !v)} aria-pressed={tutorOpen}>
            {React.cloneElement(I.spark, { size: 14 })} Tutor
          </button>
        </div>

        <article className="reader-article" ref={contentRef} onMouseUp={onMouseUp}>
          <div className="reader-kicker">
            <span style={{ color: meta.color }}>{meta.label}</span>
            <span>·</span>
            <span>{current._module}</span>
            {current.estimated_minutes ? <><span>·</span><span>{mins(current.estimated_minutes)}</span></> : null}
            {current.is_optional ? <><span>·</span><span>Optional</span></> : null}
            {isDone && <span className="reader-done">{React.cloneElement(I.check, { size: 13 })} Done</span>}
          </div>
          <h1 className="reader-title">{current.title}</h1>

          {embed && (
            <div className="reader-embed" style={embed.kind === 'video' ? { aspectRatio: '16 / 9' } : { height: '78vh', minHeight: 420 }}>
              <iframe title={current.title} src={embed.src} referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          )}
          {current.url && !embed && <FramedResource lessonId={current.id} url={current.url} meta={meta} />}

          {current.body_md
            ? <MarkdownText text={current.body_md} prose stripTitle={current.title} />
            : (!current.url && current.kind !== 'lab' && <p style={{ color: 'var(--muted)' }}>This lesson has no text yet.</p>)}

          {current.kind === 'lab' && (
            <LabRunner lessonId={current.id} onResult={(r) => {
              if (r?.lessonCompleted) {
                onCompleted && onCompleted();
                if (r.firstCompletion) toast('Lab passed · lesson complete · +15 XP', 'success');
              }
            }} />
          )}

          {current.kind === 'practice_quiz' && (
            <QuizCallout lesson={current} moduleId={current._moduleId} meta={meta} openModal={openModal} closeModal={closeModal}
              onDone={() => onCompleted && onCompleted()} />
          )}

          {current.is_graded ? (
            <SubmissionPanel assignmentId={`as-${current._moduleId}`} lessonId={current.id}
              onPassed={() => { onCompleted && onCompleted(); toast('Passed · lesson complete · +50 XP', 'success'); }}
              quiz={current.kind === 'graded_quiz' ? (
                <QuizCallout lesson={current} moduleId={current._moduleId} meta={meta} openModal={openModal} closeModal={closeModal}
                  onDone={() => onCompleted && onCompleted()} compact />
              ) : null} />
          ) : null}

          <footer className="reader-footer">
            <Btn variant="ghost" disabled={!prev} onClick={() => prev && onOpenLesson(prev)} icon={React.cloneElement(I.chevronL, { size: 14 })}>Previous</Btn>
            <div style={{ flex: 1, minWidth: 8 }} />
            {selfCompleting && !isDone && <span className="reader-hint">{selfCompleting}</span>}
            {selfCompleting || isDone ? (
              <Btn variant={isDone ? 'primary' : 'outline'} disabled={!next} onClick={() => next && onOpenLesson(next)} iconRight={React.cloneElement(I.arrowR, { size: 14 })}>
                {next ? 'Next' : 'Last lesson'}
              </Btn>
            ) : (
              <Btn variant="primary" onClick={() => markDone(true)} iconRight={next ? React.cloneElement(I.arrowR, { size: 14 }) : undefined}>
                {next ? 'Complete and continue' : 'Mark complete'}
              </Btn>
            )}
          </footer>
        </article>

        {selection && (
          <button className="reader-ask" style={{ left: selection.x, top: selection.y }} onMouseDown={e => e.preventDefault()} onClick={askAboutSelection}>
            {React.cloneElement(I.spark, { size: 13 })} Ask the tutor
          </button>
        )}
      </div>

      {tutorOpen && (
        <aside className={`reader-tutor${narrow ? ' sheet' : ''}`}>
          <TutorPanel lesson={current} ask={ask} onClose={() => setTutorOpen(false)} />
        </aside>
      )}

      {narrow && outlineOpen && (
        <div className="reader-drawer" onClick={() => setOutlineOpen(false)}>
          <div className="reader-drawer-panel scroll" onClick={e => e.stopPropagation()}>{outline}</div>
        </div>
      )}
    </div>
  );
}

function Outline({ modules, currentId, completedIds, doneCount, total, onOpen, courseTitle, onBack }) {
  const currentModule = modules.find(m => (m.lessons || []).some(l => l.id === currentId))?.id;
  const [open, setOpen] = React.useState(() => new Set([currentModule]));
  React.useEffect(() => { setOpen(o => new Set([...o, currentModule])); }, [currentModule]);
  const toggle = (id) => setOpen(o => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  return (
    <nav aria-label="Course contents">
      <button className="outline-course" onClick={onBack}>
        <span className="outline-back">{React.cloneElement(I.chevronL, { size: 13 })} All courses</span>
        <span className="outline-title">{courseTitle}</span>
      </button>
      <div className="outline-progress">
        <div className="outline-bar"><div style={{ width: `${pct}%` }} /></div>
        <span>{doneCount} of {total} lessons · {pct}%</span>
      </div>
      {modules.map((m, mi) => {
        const lessons = m.lessons || [];
        const req = lessons.filter(l => !l.is_optional);
        const done = req.filter(l => completedIds.includes(l.id)).length;
        const isOpen = open.has(m.id);
        return (
          <div key={m.id} className="outline-module">
            <button className="outline-module-head" onClick={() => toggle(m.id)} aria-expanded={isOpen}>
              <span className="outline-num">{/capstone/i.test(m.title) ? '★' : mi + 1}</span>
              <span className="outline-module-title">{m.title.replace(/^Capstone\s*·\s*/i, 'Capstone: ')}</span>
              <span className="outline-count">{done}/{req.length}</span>
            </button>
            {isOpen && (
              <ul>
                {lessons.map(l => {
                  const doneL = completedIds.includes(l.id);
                  const k = LESSON_KIND[l.kind] || LESSON_KIND.reading;
                  return (
                    <li key={l.id}>
                      <button className={`outline-lesson${l.id === currentId ? ' current' : ''}${l.is_optional ? ' optional' : ''}`} onClick={() => onOpen(l)}>
                        <span className={`outline-dot${doneL ? ' done' : ''}`}>{doneL ? React.cloneElement(I.check, { size: 10 }) : null}</span>
                        <span className="outline-lesson-title">{l.title.replace(/^(Practice quiz|Further reading) · .*/, '$1')}</span>
                        <span className="outline-kind">{l.is_optional ? 'optional' : k.label.toLowerCase()}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function QuizCallout({ lesson, moduleId, meta, openModal, closeModal, onDone, compact = false }) {
  const isGraded = lesson.kind === 'graded_quiz';
  if (compact) {
    return (
      <div className="submit-alt">
        Prefer a test? <button onClick={() => moduleId && openModal(
          <ModuleQuiz moduleId={moduleId} mode="graded" title={lesson.title} onClose={closeModal} onDone={onDone} />
        )}>Take the graded quiz instead</button> (limited attempts, 80% to pass).
      </div>
    );
  }
  return (
    <div className="reader-callout" style={{ borderColor: `color-mix(in oklch, ${meta.color} 30%, var(--border))` }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{isGraded ? 'This one counts' : 'Practice, no pressure'}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 5, lineHeight: 1.6 }}>
        {isGraded
          ? 'Limited attempts and 80% to pass. Passing advances your mastery and completes this lesson.'
          : 'Unlimited attempts, and every answer is explained. Score 80% once to complete it.'}
      </div>
      <div style={{ marginTop: 14 }}>
        <Btn variant={isGraded ? 'primary' : 'outline'} disabled={!moduleId}
          onClick={() => moduleId && openModal(
            <ModuleQuiz moduleId={moduleId} mode={isGraded ? 'graded' : 'practice'} title={lesson.title}
              onClose={closeModal} onDone={onDone} />
          )}>
          {isGraded ? 'Start graded assessment' : 'Start practice quiz'}
        </Btn>
      </div>
    </div>
  );
}

/**
 * Hand in written work for a graded assignment or the capstone, and see it
 * graded against the rubric: a score per criterion with the reason, overall
 * feedback, and the chance to revise and resubmit. Passing completes the lesson.
 */
function SubmissionPanel({ assignmentId, lessonId, onPassed, quiz }) {
  const draftKey = `learnos_submission_${assignmentId}`;
  const [state, setState] = React.useState(null); // { status, submission }
  const [text, setText] = React.useState(() => { try { return localStorage.getItem(draftKey) || ''; } catch { return ''; } });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [editing, setEditing] = React.useState(false);
  const poll = React.useRef(null);

  const load = React.useCallback(() => API.getAssignmentSubmission(assignmentId).then(r => { setState(r); return r; }).catch(() => setState({ status: 'none' })), [assignmentId]);
  React.useEffect(() => { load(); return () => clearInterval(poll.current); }, [load]);

  const watch = () => {
    clearInterval(poll.current);
    const started = Date.now();
    poll.current = setInterval(async () => {
      const r = await load();
      if (r?.status === 'graded' || r?.status === 'failed' || Date.now() - started > 240_000) {
        clearInterval(poll.current);
        setBusy(false);
        if (r?.status === 'graded' && r.submission?.grade >= 80) onPassed && onPassed();
      }
    }, 3000);
  };

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setError(null); setEditing(false);
    try {
      await API.submitAssignment(assignmentId, text.trim());
      setState({ status: 'pending' });
      watch();
    } catch (e) { setError(e.message || 'Could not submit.'); setBusy(false); }
  };
  const onEdit = (v) => { setText(v); try { localStorage.setItem(draftKey, v); } catch {} };

  const sub = state?.submission;
  const graded = state?.status === 'graded' && !editing;
  const pending = state?.status === 'pending' || busy;
  const passed = graded && sub.grade >= 80;

  return (
    <section className="submit">
      <div className="submit-head">
        <div>
          <div className="submit-title">Your submission</div>
          <div className="submit-sub">Graded against the rubric; 80% passes and completes this lesson. You can revise and resubmit.</div>
        </div>
        {graded && <div className={`submit-grade ${passed ? 'pass' : 'fail'}`}>{sub.grade}%<span>{passed ? 'passed' : 'not yet'}</span></div>}
      </div>

      {graded ? (
        <>
          {Array.isArray(sub.rubric) && sub.rubric.length > 0 && (
            <table className="submit-rubric">
              <tbody>
                {sub.rubric.map((c, i) => (
                  <tr key={i}><th>{c.criterion}</th><td className="num">{c.score}</td><td>{c.why}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {sub.feedback_md && <div className="submit-feedback"><MarkdownText text={sub.feedback_md} /></div>}
          <Btn variant="outline" size="md" onClick={() => { setText(sub.body_md || text); setEditing(true); }}>Revise and resubmit</Btn>
        </>
      ) : pending ? (
        <div className="submit-pending"><span className="tutor-msg thinking"><span /><span /><span /></span> Grading your work against the rubric. This takes up to a minute.</div>
      ) : (
        <>
          {state?.status === 'failed' && <div className="tutor-error" style={{ margin: '0 0 10px' }}><MarkdownText text={sub.feedback_md} /></div>}
          <textarea className="submit-text" rows={12} value={text} onChange={e => onEdit(e.target.value)}
            placeholder="Write your answer here. Markdown works: headings, lists, $LaTeX$, and ``` code blocks." />
          {error && <div className="tutor-error" style={{ margin: '8px 0 0' }}>{error}</div>}
          <div className="submit-actions">
            <Btn variant="primary" size="md" disabled={!text.trim()} onClick={submit}>Submit for grading</Btn>
            <span className="reader-hint">{text.trim() ? `${text.trim().split(/\s+/).length} words` : 'Your draft is saved as you type.'}</span>
          </div>
        </>
      )}
      {quiz}
    </section>
  );
}

const STARTERS = ['Explain this more simply', 'Give me another worked example', 'Quiz me on this lesson', 'What do people usually get wrong here?'];

function TutorPanel({ lesson, ask, onClose }) {
  const [messages, setMessages] = React.useState(null);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const listRef = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    let alive = true;
    setMessages(null); setError(null);
    API.getLessonTutor(lesson.id).then(r => { if (alive) setMessages(r.messages || []); }).catch(() => { if (alive) setMessages([]); });
    return () => { alive = false; };
  }, [lesson.id]);

  React.useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  const send = async (text) => {
    const t = String(text ?? draft).trim();
    if (!t || busy) return;
    setDraft(''); setError(null); setBusy(true);
    setMessages(m => [...(m || []), { role: 'user', content: t }]);
    try {
      const r = await API.askLessonTutor(lesson.id, t);
      setMessages(m => [...(m || []), { role: 'assistant', content: r.reply }]);
    } catch (e) {
      setMessages(m => (m || []).slice(0, -1));
      setDraft(t);
      setError(e.code === 'NO_KEY'
        ? 'The tutor needs a model. Add an OpenRouter key or use your Claude plan in Settings, API keys.'
        : (e.message || 'The tutor did not answer. Try again.'));
    } finally { setBusy(false); }
  };

  // A passage selected in the lesson arrives here as a ready-to-send question.
  React.useEffect(() => {
    if (!ask) return;
    setDraft(ask.text);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [ask]);

  const clear = async () => {
    await API.clearLessonTutor(lesson.id).catch(() => {});
    setMessages([]);
  };

  return (
    <div className="tutor">
      <div className="tutor-head">
        <div>
          <div className="tutor-name">Tutor</div>
          <div className="tutor-sub">Has read this lesson. Select any passage to ask about it.</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {messages?.length > 0 && <button className="tutor-icon" onClick={clear} title="Start over">Clear</button>}
          <button className="tutor-icon" onClick={onClose} aria-label="Close tutor">{React.cloneElement(I.x, { size: 15 })}</button>
        </div>
      </div>

      <div className="tutor-list scroll" ref={listRef}>
        {messages === null && <div className="tutor-empty">Loading…</div>}
        {messages?.length === 0 && (
          <div className="tutor-empty">
            <p>Ask anything about <strong>{lesson.title}</strong>.</p>
            <div className="tutor-starters">
              {STARTERS.map(s => <button key={s} onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {(messages || []).map((m, i) => (
          <div key={i} className={`tutor-msg ${m.role}`}>
            {m.role === 'assistant' ? <MarkdownText text={m.content} /> : m.content}
          </div>
        ))}
        {busy && <div className="tutor-msg assistant thinking"><span /><span /><span /></div>}
      </div>

      {error && <div className="tutor-error">{error}</div>}
      <form className="tutor-input" onSubmit={e => { e.preventDefault(); send(); }}>
        <textarea ref={inputRef} rows={2} value={draft} placeholder="Ask about this lesson…"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <Btn variant="primary" size="sm" disabled={busy || !draft.trim()} onClick={() => send()}>Send</Btn>
      </form>
    </div>
  );
}
