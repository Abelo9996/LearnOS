import React from 'react';
import { I } from '../components/Icons';
import { Card, Btn, ProgressBar, Tag, Avatar, Kbd, PageScroll, SectionHead } from '../components/UI';
import { useUser } from '../UserContext.jsx';
import API from '../api.js';
import { useToast, useModal } from '../App';
import MarkdownText from '../components/Markdown';

// Extract a YouTube video id so lecture videos can be embedded inline.
function youtubeId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
const LESSON_KIND = {
  video:    { label: 'Lecture video', color: 'oklch(0.7 0.19 25)',  icon: 'cap' },
  paper:    { label: 'Paper',         color: 'oklch(0.72 0.18 295)', icon: 'search' },
  book:     { label: 'Book',          color: 'oklch(0.76 0.15 85)',  icon: 'book' },
  blog:     { label: 'Blog',          color: 'oklch(0.72 0.16 330)', icon: 'rss' },
  article:  { label: 'Article',       color: 'oklch(0.74 0.16 155)', icon: 'book' },
  website:  { label: 'Website',       color: 'oklch(0.72 0.15 220)', icon: 'graph' },
  docs:     { label: 'Docs',          color: 'oklch(0.74 0.16 200)', icon: 'book' },
  repo:     { label: 'Repository',    color: 'oklch(0.68 0.02 270)', icon: 'fork' },
  reading:  { label: 'Reading',       color: 'var(--brand)',         icon: 'book' },
  exercise: { label: 'Exercise',      color: 'oklch(0.74 0.18 25)',  icon: 'check' },
  project:  { label: 'Project',       color: 'var(--brand-3)',       icon: 'spark' },
};

export default function Courses() {
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
  const [contributors, setContributors] = React.useState([]);
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
  // The server returns { total, completed: <count>, completedIds: [...] } —
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

  // Keep the catalog row and the open detail in sync after verify/unverify.
  const applyVerified = (slug, verified) => {
    setSelectedCourse(prev => (prev && prev.slug === slug ? { ...prev, verified } : prev));
    setCourses(prev => prev.map(x => (x.slug === slug ? { ...x, verified } : x)));
  };

  // Load courses + user's starred/enrolled state
  React.useEffect(() => {
    const loadAll = async () => {
      try {
        const [rows, starredRows, leaders] = await Promise.all([
          API.getCourses(),
          API.getStarred().catch(() => []),
          API.getLeaderboard().catch(() => []),
        ]);
        setContributors((leaders || []).filter(l => !l.me).slice(0, 5));
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

    // Rich lesson reader — embeds lecture videos, renders resource cards by kind,
    // markdown readings, with prev/next navigation across the whole course.
    if (selectedLesson) {
      const lesson = selectedLesson;
      const flat = courseModules.flatMap(m => (m.lessons || []).map(l => ({ ...l, _module: m.title })));
      const idx = flat.findIndex(l => l.id === lesson.id);
      const prev = idx > 0 ? flat[idx - 1] : null;
      const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;
      const meta = LESSON_KIND[lesson.kind] || LESSON_KIND.reading;
      const vid = youtubeId(lesson.url);
      const isDone = completedIds.includes(lesson.id);
      const complete = async (advance) => {
        try {
          if (!isDone) {
            await API.markLessonComplete(c.slug, lesson.id);
            const p = await API.getCourseProgress(c.slug).catch(() => null);
            if (p) setProgress(p);
            toast('Lesson complete · +10 XP', 'success');
          }
          if (advance && next) setSelectedLesson(next);
        } catch (e) { toast(e.message || 'Could not mark complete', 'error'); }
      };
      return (
        <PageScroll>
          <button onClick={() => setSelectedLesson(null)} className="ui-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 0, color: 'var(--muted)', fontSize: 12, marginBottom: 14, cursor: 'pointer' }}>
            {React.cloneElement(I.chevronL, { size: 14 })} {c.title}
          </button>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {/* Embedded lecture video */}
            {vid && (
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#000' }}>
                <iframe title={lesson.title} src={`https://www.youtube-nocookie.com/embed/${vid}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
              </div>
            )}
            <div style={{ padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: `color-mix(in oklch, ${meta.color} 16%, transparent)`, color: meta.color, border: `1px solid color-mix(in oklch, ${meta.color} 35%, transparent)` }}>
                  {React.cloneElement(I[meta.icon] || I.book, { size: 12 })} {meta.label}
                </span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{lesson._module}</span>
                {isDone && <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--good)', fontWeight: 600 }}>✓ Completed</span>}
              </div>
              <h1 className="display" style={{ fontSize: 27, color: 'var(--ink)', margin: '4px 0 18px' }}>{lesson.title}</h1>

              {/* Non-video external resource → rich open card */}
              {lesson.url && !vid && (
                <a href={lesson.url} target="_blank" rel="noopener noreferrer" className="hover-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, marginBottom: 18, borderRadius: 12, background: 'var(--surface)', border: `1px solid color-mix(in oklch, ${meta.color} 30%, var(--border))`, textDecoration: 'none', color: 'var(--ink)' }}>
                  <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 10, background: `color-mix(in oklch, ${meta.color} 16%, transparent)`, color: meta.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid color-mix(in oklch, ${meta.color} 35%, transparent)` }}>{React.cloneElement(I[meta.icon] || I.book, { size: 20 })}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Open this {meta.label.toLowerCase()}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(() => { try { return new URL(lesson.url).hostname.replace(/^www\./, ''); } catch { return lesson.url; } })()}</div>
                  </div>
                  <span style={{ color: meta.color, flexShrink: 0 }}>{React.cloneElement(I.open || I.arrowR, { size: 16 })}</span>
                </a>
              )}

              {lesson.body_md ? (
                <div style={{ fontSize: 14.5, lineHeight: 1.75 }}><MarkdownText text={lesson.body_md} /></div>
              ) : (!lesson.url && <div style={{ color: 'var(--muted)', fontSize: 14 }}>No lesson content yet.</div>)}

              {/* Footer: prev / complete+next */}
              <div style={{ marginTop: 26, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Btn variant="ghost" disabled={!prev} onClick={() => prev && setSelectedLesson(prev)} icon={React.cloneElement(I.chevronL, { size: 14 })}>Previous</Btn>
                <div style={{ flex: 1 }} />
                {enrolled[c.slug] ? (
                  <Btn variant="primary" onClick={() => complete(true)} iconRight={next ? React.cloneElement(I.arrowR, { size: 14 }) : undefined}>
                    {isDone ? (next ? 'Next lesson' : 'Done') : (next ? 'Complete & continue' : 'Mark complete')}
                  </Btn>
                ) : (
                  <Btn variant="outline" disabled={!next} onClick={() => next && setSelectedLesson(next)} iconRight={React.cloneElement(I.arrowR, { size: 14 })}>Next</Btn>
                )}
              </div>
            </div>
          </Card>
        </PageScroll>
      );
    }

    return (
      <PageScroll>
        <button onClick={() => setSelectedCourse(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 0, color: 'var(--muted)', fontSize: 12, marginBottom: 16, cursor: 'pointer' }}>
          {React.cloneElement(I.chevronL, { size: 14 })} Back to Courses
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 16 }}>
          <div>
            <Card pad={false} style={{ overflow: 'hidden' }}>
              <div className="viz-placeholder" style={{ height: 280, position: 'relative' }}>
                {c.thumbnail_url ? (
                  <img src={c.thumbnail_url} alt={c.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <CoverViz kind={['nodes', 'mesh', 'cube', 'speech', 'web', 'lattice'][c.slug.charCodeAt(0) % 6]} />
                )}
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h1 className="display" style={{ fontSize: 32, color: 'var(--ink)', margin: 0 }}>{c.title}</h1>
                      {c.verified ? (
                        <span style={{ color: 'var(--brand-3)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>{React.cloneElement(I.check, { size: 14 })} Verified</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--muted)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>Unverified</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar name={c.author} size={28} />
                      <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{c.author}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {isAdmin && (
                      c.verified ? (
                        <Btn variant="outline" size="sm" disabled={verifying} onClick={async () => {
                          setVerifying(true); try { await API.unverifyCourse(c.slug); applyVerified(c.slug, 0); toast('Course unverified', 'info'); } catch (e) { toast(e.message || 'Could not unverify', 'error'); } finally { setVerifying(false); }
                        }} style={{ color: 'var(--bad)', borderColor: 'oklch(0.7 0.2 25 / 0.5)' }}>{verifying ? '…' : 'Unverify'}</Btn>
                      ) : (
                        <Btn variant="primary" size="sm" disabled={verifying} onClick={async () => {
                          setVerifying(true); try { await API.verifyCourse(c.slug); applyVerified(c.slug, 1); toast('Course verified ✓', 'success'); } catch (e) { toast(e.message || 'Could not verify', 'error'); } finally { setVerifying(false); }
                        }}>{verifying ? '…' : 'Verify course'}</Btn>
                      )
                    )}
                    {((isAuthor || isAdmin) && courseModules.length > 0) && (
                      <Btn variant="ghost" size="sm" onClick={() => toast('Course editor: use the module list below to manage lessons', 'info')}>Edit course</Btn>
                    )}
                    <Btn variant={enrolled[c.slug] ? 'outline' : 'primary'} size="md" onClick={() => enroll(c.slug, c.title)}>
                      {enrolled[c.slug] ? 'Enrolled ✓' : 'Enroll Now'}
                    </Btn>
                    <Btn variant="ghost" icon={starred[c.slug] ? I.starFilled : I.star} onClick={() => toggleStar(c.slug)} />
                  </div>
                </div>
                <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.7, marginTop: 16 }}>{c.blurb}</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {(c.tags || []).map(t => <Tag key={t}>{t}</Tag>)}
                </div>
                {/* Progress bar for enrolled users */}
                {enrolled[c.slug] && totalLessons > 0 && (
                  <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className="cap">Your progress</span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--brand)' }}>{completedLessons}/{totalLessons} lessons</span>
                    </div>
                    <ProgressBar value={progressPct} height={6} />
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>{Math.round(progressPct * 100)}% complete</div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 24, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div><span style={{ fontSize: 11, color: 'var(--muted)' }}>Duration</span><div className="display" style={{ fontSize: 16 }}>{c.hours}h</div></div>
                  <div><span style={{ fontSize: 11, color: 'var(--muted)' }}>Rating</span><div className="display" style={{ fontSize: 16 }}>{c.rating} ★</div></div>
                  <div><span style={{ fontSize: 11, color: 'var(--muted)' }}>Stars</span><div className="display" style={{ fontSize: 16 }}>{(c.stars/1000).toFixed(1)}k</div></div>
                  <div><span style={{ fontSize: 11, color: 'var(--muted)' }}>Forks</span><div className="display" style={{ fontSize: 16 }}>{c.forks >= 1000 ? `${(c.forks/1000).toFixed(1)}k` : c.forks}</div></div>
                </div>
              </div>
            </Card>

            {/* Modules & Lessons from API */}
            <Card style={{ padding: 18, marginTop: 16 }}>
              {modulesLoading ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading modules…</div>
              ) : courseModules.length === 0 ? (
                <>
                  <SectionHead title="Syllabus" />
                  <div style={{ padding: '12px 0', color: 'var(--muted)', fontSize: 13 }}>
                    This course has no modules yet. {(isAuthor || isAdmin) ? 'Add modules to start building lessons.' : 'Check back later.'}
                  </div>
                </>
              ) : (
                <>
                  <SectionHead title="Syllabus" subtitle={`${courseModules.length} module${courseModules.length === 1 ? '' : 's'} · ${totalLessons} lesson${totalLessons === 1 ? '' : 's'}`} />
                  {courseModules.map((mod, mi) => (
                    <div key={mod.id} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: mi === 0 ? 0 : '1px solid var(--border)' }}>
                        <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--brand)', flexShrink: 0 }}>{mi + 1}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600 }}>{mod.title}</div>
                          {mod.summary && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{mod.summary}</div>}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{mod.estimated_minutes || 45} min</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{mod.lessons?.length || 0} lessons</span>
                      </div>
                      {/* Lessons list */}
                      {mod.lessons?.map((lesson, li) => {
                        const isCompleted = completedIds.includes(lesson.id);
                        return (
                          <div key={lesson.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0 8px 38px', borderTop: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => { if (enrolled[c.slug]) setSelectedLesson(lesson); else toast('Enroll in this course to open its lessons', 'info'); }}>
                            <span style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${isCompleted ? 'var(--good)' : 'var(--border)'}`, background: isCompleted ? 'var(--good)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: isCompleted ? 'oklch(0.16 0.02 270)' : 'transparent', fontSize: 10 }}>
                              {isCompleted && '✓'}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12.5, color: isCompleted ? 'var(--muted)' : 'var(--ink-2)', textDecoration: isCompleted ? 'line-through' : 'none' }}>{lesson.title}</div>
                            </div>
                            <Tag tone={lesson.kind === 'exercise' ? 'accent' : lesson.kind === 'video' ? 'cyan' : 'neutral'}>{lesson.kind}</Tag>
                            {enrolled[c.slug] && <Btn variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedLesson(lesson); }}>Open</Btn>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </>
              )}
            </Card>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <TopContributorsCard contributors={contributors} />
          </div>
        </div>
      </PageScroll>
    );
  }

  return (
    <PageScroll>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 16 }}>
        <div>
          <div style={{ marginBottom: 24 }}>
            <Tag tone="accent" style={{ marginBottom: 12 }}>{I.spark} Community · Open-source · AI-Powered</Tag>
            <h1 className="display" style={{ fontSize: 50, lineHeight: 1.0, color: 'var(--ink)', margin: '12px 0 8px', letterSpacing: '-0.025em', fontWeight: 700 }}>
              Explore <span className="gradient-text">Courses</span>
            </h1>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>Community-authored, forkable AI-powered courses. Learn together, improve together.</div>
          </div>
          {/* Enrolled vs Explore vs Starred — separate, not blended (#24) */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 16, marginBottom: 14, flexWrap: 'wrap' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', height: 34, borderRadius: 8, cursor: 'pointer',
                background: tab === t.id ? 'var(--accent-soft)' : 'var(--surface)',
                border: `1px solid ${tab === t.id ? 'var(--accent-line)' : 'var(--border)'}`,
                color: tab === t.id ? 'oklch(0.82 0.18 295)' : 'var(--ink-2)', fontSize: 12.5, fontWeight: 600,
              }}>{t.label}<span className="mono" style={{ fontSize: 10.5, opacity: 0.7 }}>{t.n}</span></button>
            ))}
            <div style={{ flex: 1 }} />
            <Btn variant="primary" icon={I.spark} onClick={() => openModal(<GenerateCourseModal onDone={async (slug) => {
              closeModal();
              const rows = await API.getCourses();
              const parsed = (rows || []).map(c => ({ ...c, tags: typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : (c.tags || []) }));
              setCourses(parsed);
              setEnrolled(prev => ({ ...prev, [slug]: true }));
              const created = parsed.find(c => c.slug === slug);
              if (created) setSelectedCourse(created);
            }} />)}>Generate with AI</Btn>
            <Btn variant="outline" icon={I.plus} onClick={() => openModal(<CreateCourseModal onCreated={async () => { closeModal(); const rows = await API.getCourses(); setCourses((rows||[]).map(c => ({...c, tags: typeof c.tags === 'string' ? JSON.parse(c.tags||'[]') : (c.tags||[])}))); toast('Course created!', 'success'); }} />)}>Create Course</Btn>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 14 }}>
            <span style={{ color: 'var(--muted)' }}>{I.search}</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses, topics, or authors…" style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--ink)' }} />
            <Kbd>⌘K</Kbd>
            {search && <Btn variant="ghost" size="sm" onClick={() => setSearch('')}>✕</Btn>}
          </div>
          {/* Sort + verified + tag filters (#25) */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            {[{ id: 'trending', label: 'Trending' }, { id: 'rating', label: 'Top rated' }, { id: 'az', label: 'A–Z' }].map(s => (
              <FilterPill key={s.id} label={s.label} active={sort === s.id} onClick={() => setSort(s.id)} />
            ))}
            <span style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px' }} />
            <FilterPill label="✓ Verified" active={verifiedOnly} onClick={() => setVerifiedOnly(v => !v)} />
            {allTags.map(t => (
              <FilterPill key={t} label={t} active={tagFilter === t} onClick={() => setTagFilter(tagFilter === t ? null : t)} />
            ))}
          </div>
          <CourseStats courses={courses} enrolled={enrolled} />
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>Loading courses…</div>
          ) : filtered.length === 0 ? (
            <Card style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 16, color: 'var(--muted)', marginBottom: 12 }}>
                {tab === 'enrolled' ? "You haven't enrolled in any courses yet — browse and enroll to see them here."
                  : tab === 'starred' ? "No starred courses yet — tap the ★ on any course to save it."
                  : search ? `No courses match "${search}"`
                  : 'No courses found.'}
              </div>
              {tab === 'browse' && search && <Btn variant="outline" onClick={() => setSearch('')}>Clear search</Btn>}
              {tab !== 'browse' && <Btn variant="outline" onClick={() => setTab('browse')}>Browse courses</Btn>}
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
              {filtered.map((c) => <CourseCard key={c.slug} c={c} starred={!!starred[c.slug]} enrolled={!!enrolled[c.slug]} onToggleStar={() => toggleStar(c.slug)} onEnroll={() => enroll(c.slug, c.title)} onSelect={() => setSelectedCourse(c)} toast={toast} />)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FeaturedThisWeek courses={courses} onSelect={setSelectedCourse} />
          <TopContributorsCard contributors={contributors} />
        </div>
      </div>
    </PageScroll>
  );
}

function FilterPill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', height: 34, borderRadius: 8,
      background: active ? 'var(--accent-soft)' : 'var(--surface)',
      border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
      color: active ? 'oklch(0.82 0.18 295)' : 'var(--ink-2)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', transition: 'all var(--dur-fast)',
    }}>{label}</button>
  );
}

function CourseStats({ courses = [], enrolled = {} }) {
  const total = courses.length;
  const verified = courses.filter(c => c.verified).length;
  const enrolledCount = courses.filter(c => enrolled[c.slug]).length;
  return (
    <Card style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'center' }}>
      <Stat icon={I.book}   color="var(--brand)"        value={total || '—'}      label="Courses Available" delta="Open source" />
      <Stat icon={I.check}  color="var(--brand-3)"      value={verified}          label="LearnOS-Verified"  delta="issue certificates" />
      <Stat icon={I.people} color="oklch(0.78 0.16 85)" value={enrolledCount}     label="You're Enrolled In" delta="across the catalog" />
    </Card>
  );
}

function Stat({ icon, color, value, label, delta }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 40, height: 40, borderRadius: 9, background: `color-mix(in oklch, ${color} 18%, transparent)`, color, border: `1px solid color-mix(in oklch, ${color} 35%, transparent)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <div>
        <div className="display" style={{ fontSize: 18, color: 'var(--ink)' }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--good)', marginTop: 1 }}>{delta}</div>
      </div>
    </div>
  );
}

function CourseCard({ c, starred, enrolled, onToggleStar, onEnroll, onSelect, toast }) {
  return (
    <Card pad={false} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ aspectRatio: '16 / 9', borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }} onClick={onSelect}>
        <CoverViz kind={['nodes', 'mesh', 'cube', 'speech', 'web', 'lattice'][c.slug.charCodeAt(0) % 6]} />
        <span style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 6, background: 'oklch(0.16 0.02 270 / 0.7)', backdropFilter: 'blur(6px)', color: 'var(--brand)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>{c.version}</span>
        <button style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 7, background: 'oklch(0.16 0.02 270 / 0.7)', backdropFilter: 'blur(6px)', border: '1px solid oklch(1 0 0 / 0.1)', color: starred ? 'oklch(0.78 0.16 85)' : 'var(--ink-2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { e.stopPropagation(); onToggleStar(); }}>
          {React.cloneElement(starred ? I.starFilled : I.star, { size: 14 })}
        </button>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div className="display" style={{ fontSize: 15, cursor: 'pointer' }} onClick={onSelect}>{c.title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{c.blurb}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
          <Avatar name={c.author} size={20} />
          <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{c.author}</span>
          {c.verified && <span style={{ color: 'var(--brand-3)' }}>{React.cloneElement(I.check, { size: 13 })}</span>}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <CountChip icon={I.starFilled} n={`${c.rating} (${(c.stars/1000).toFixed(1)}k)`} color="oklch(0.78 0.16 85)" />
          <CountChip icon={I.fork} n={c.forks >= 1000 ? `${(c.forks/1000).toFixed(1)}k` : c.forks} />
          <CountChip icon={I.clock} n={`${c.hours}h`} />
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
          {(c.tags || []).map((t) => <Tag key={t}>{t}</Tag>)}
        </div>
        <Btn variant={enrolled ? 'outline' : 'primary'} size="sm" full onClick={onEnroll}>
          {enrolled ? 'Enrolled ✓' : 'Enroll'}
        </Btn>
      </div>
    </Card>
  );
}

function CountChip({ icon, n, color }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>
      <span style={{ color: color || 'var(--muted)' }}>{React.cloneElement(icon, { size: 12 })}</span>
      {n}
    </span>
  );
}

function CoverViz({ kind }) {
  const W = 320, H = 180;
  if (kind === 'nodes') {
    const nodes = Array.from({ length: 28 }, (_, i) => ({ x: ((Math.sin(i * 12.3) + 1) / 2) * 0.9 + 0.05, y: ((Math.cos(i * 7.7) + 1) / 2) * 0.9 + 0.05, r: 1.5 + ((i * 31) % 3) }));
    return (<svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      {nodes.map((n, i) => nodes.slice(i + 1, i + 4).map((m, j) => (<line key={`${i}-${j}`} x1={n.x * W} y1={n.y * H} x2={m.x * W} y2={m.y * H} stroke="oklch(0.74 0.21 295 / 0.4)" strokeWidth="0.6"/>)))}
      {nodes.map((n, i) => (<circle key={i} cx={n.x * W} cy={n.y * H} r={n.r * 1.3} fill={i % 2 === 0 ? 'oklch(0.78 0.16 195)' : 'oklch(0.74 0.21 295)'} opacity={0.85} />))}
    </svg>);
  }
  if (kind === 'mesh') {
    return (<svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      {Array.from({ length: 8 }).map((_, r) => Array.from({ length: 14 }).map((_, c) => { const x = (c / 13) * W; const y = 40 + r * 16 + Math.sin(c * 0.5 + r) * 8; return <circle key={`${r}-${c}`} cx={x} cy={y} r="1.5" fill="oklch(0.74 0.21 295)" opacity={0.4 + r * 0.07}/>; }))}
      <path d="M0 90 Q80 60 160 90 T320 90" stroke="oklch(0.78 0.16 195)" strokeWidth="2" fill="none"/>
    </svg>);
  }
  if (kind === 'cube') {
    return (<svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      {Array.from({ length: 8 }).map((_, i) => (<line key={`a${i}`} x1={20 + i * 36} y1={20} x2={20 + i * 36 + 90} y2={H - 20} stroke="oklch(0.78 0.16 195 / 0.3)" strokeWidth="0.7"/>))}
      {Array.from({ length: 6 }).map((_, i) => (<line key={`b${i}`} x1={20} y1={20 + i * 26} x2={W - 20} y2={20 + i * 26 - 60} stroke="oklch(0.74 0.21 295 / 0.3)" strokeWidth="0.7"/>))}
      <polygon points="120,60 180,40 240,60 180,80" fill="oklch(0.74 0.21 295 / 0.6)" stroke="oklch(0.78 0.16 195)" strokeWidth="1"/>
    </svg>);
  }
  if (kind === 'speech') {
    return (<svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <rect x="50" y="50" width="100" height="50" rx="10" fill="oklch(0.74 0.21 295 / 0.5)" stroke="oklch(0.78 0.16 195)"/>
      <rect x="170" y="90" width="100" height="50" rx="10" fill="oklch(0.78 0.16 195 / 0.5)" stroke="oklch(0.74 0.21 295)"/>
    </svg>);
  }
  if (kind === 'lattice') {
    const pts = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) pts.push([20 + c * 38, 30 + r * 28]);
    return (<svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      {pts.map((p, i) => (<g key={i}><circle cx={p[0]} cy={p[1]} r="3" fill="oklch(0.78 0.16 195)"/>{i % 8 < 7 && <line x1={p[0]} y1={p[1]} x2={pts[i+1]?.[0]} y2={pts[i+1]?.[1]} stroke="oklch(0.74 0.21 295 / 0.5)"/>}</g>))}
    </svg>);
  }
  return (<svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
    <circle cx={W/2} cy={H/2} r="40" fill="none" stroke="oklch(0.78 0.16 195 / 0.4)"/>
    <circle cx={W/2} cy={H/2} r="60" fill="none" stroke="oklch(0.74 0.21 295 / 0.3)"/>
    {Array.from({ length: 12 }).map((_, i) => { const a = (i / 12) * Math.PI * 2; return <line key={i} x1={W/2} y1={H/2} x2={W/2 + Math.cos(a) * 70} y2={H/2 + Math.sin(a) * 70} stroke="oklch(0.78 0.16 195 / 0.4)" strokeWidth="0.7"/>; })}
  </svg>);
}

function FeaturedThisWeek({ courses = [], onSelect }) {
  // Real "featured" = the top-rated courses in the catalog.
  const featured = [...courses].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4);
  if (featured.length === 0) return null;
  return (
    <Card pad={false} style={{ padding: 16 }}>
      <SectionHead title="Top rated" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {featured.map((c) => (
          <div key={c.slug} style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }} onClick={() => onSelect && onSelect(c)}>
            <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }} className="viz-placeholder"><CoverViz kind={['nodes','mesh','cube','speech','web','lattice'][c.slug.charCodeAt(0) % 6]} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{c.title}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{c.author}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 10.5, color: 'oklch(0.78 0.16 85)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>{React.cloneElement(I.starFilled, { size: 10 })} {c.rating}</span>
                {c.verified && <span style={{ fontSize: 10.5, color: 'var(--brand-3)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>{React.cloneElement(I.check, { size: 10 })} Verified</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TopContributorsCard({ contributors = [] }) {
  if (contributors.length === 0) return null;
  return (
    <Card pad={false} style={{ padding: 16 }}>
      <SectionHead title="Top Contributors" subtitle="From the community" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {contributors.map((c, i) => (
          <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={c.name} size={28} />
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--ink)', fontWeight: 500 }}>
              {c.name}
              {i === 0 && <span style={{ marginLeft: 6, color: 'oklch(0.78 0.16 85)' }}>{React.cloneElement(I.bolt, { size: 12 })}</span>}
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--brand)' }}>{c.contributions} contributions</div>
          </div>
        ))}
      </div>
    </Card>
  );
}


// AI course generator — the Curriculum agent designs a full Coursera-grade
// course (readings, verified resources, per-module assignments, capstone).
function GenerateCourseModal({ onDone }) {
  const { add: toast } = useToast();
  const [topic, setTopic] = React.useState('');
  const [level, setLevel] = React.useState('intermediate');
  const [phase, setPhase] = React.useState('form'); // form | generating | error
  const [errMsg, setErrMsg] = React.useState('');
  const inp = { width: '100%', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13.5 };
  const suggestions = ['Reinforcement Learning', 'Distributed Systems', 'Real Analysis', 'Modern React', 'Quantum Computing', 'Financial Modeling'];

  const go = async () => {
    if (!topic.trim()) return;
    setPhase('generating');
    try {
      const res = await API.generateCourseAI({ topic: topic.trim(), level });
      toast(`Course generated · ${res.modules} modules · ${res.resources} resources`, 'success');
      onDone && onDone(res.slug);
    } catch (e) {
      setErrMsg(e.code === 'NO_KEY' || /key/i.test(e.message || '')
        ? 'Add an OpenRouter key in Settings → API Keys to generate courses.'
        : (e.message || 'Course generation failed — try again.'));
      setPhase('error');
    }
  };

  if (phase === 'generating') {
    return (
      <div style={{ minWidth: 440, padding: '32px 8px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', gap: 6, marginBottom: 16 }}>
          {[0, 1, 2].map(i => <span key={i} style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--brand)', animation: `ldot 1s ease-in-out ${i * 0.15}s infinite` }} />)}
        </div>
        <div className="display" style={{ fontSize: 19, color: 'var(--ink)' }}>Designing your course…</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6, maxWidth: 380, margin: '8px auto 0' }}>
          The Curriculum agent is writing modules and readings, the Research agent is finding and verifying lecture videos, papers and articles, and the Assessment agent is authoring assignments. This can take up to a minute.
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
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>A full, Coursera-grade course — readings, lecture videos, papers, assignments and a capstone — built for your topic.</div>
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
            <button key={l} onClick={() => setLevel(l)} className="ui-btn" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, textTransform: 'capitalize', cursor: 'pointer', background: level === l ? 'var(--accent-soft)' : 'var(--surface)', border: `1px solid ${level === l ? 'var(--accent-line)' : 'var(--border)'}`, color: level === l ? 'oklch(0.82 0.18 295)' : 'var(--ink-2)', fontSize: 13 }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <Btn variant="primary" icon={I.spark} disabled={!topic.trim()} onClick={go}>Generate course</Btn>
      </div>
    </div>
  );
}

function CreateCourseModal({ onCreated }) {
  const { add: toast } = useToast();
  const [title, setTitle] = React.useState('');
  const [blurb, setBlurb] = React.useState('');
  const [author, setAuthor] = React.useState('');
  const [roadmaps, setRoadmaps] = React.useState([]);
  const [sourceRoadmap, setSourceRoadmap] = React.useState('');
  const [thumbnailUrl, setThumbnailUrl] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  React.useEffect(() => {
    API.getRoadmaps().then(rows => {
      setRoadmaps(rows || []);
      API.getUserProfile?.().then(p => { if (p?.user?.name) setAuthor(p.user.name); }).catch(() => {});
    }).catch(() => {});
  }, []);
  const [hours, setHours] = React.useState(10);
  const [tags, setTags] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const inp = { width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 };
  return (
    <div style={{ minWidth: 440 }}>
      <h3 className="display" style={{ fontSize: 22, marginBottom: 6 }}>Create a Course</h3>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Bundle your roadmaps and sessions into a shareable course for the community.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="cap" style={{ display:'block', marginBottom:4 }}>Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Introduction to Machine Learning" style={inp} /></div>
        <div><label className="cap" style={{ display:'block', marginBottom:4 }}>Description</label><textarea value={blurb} onChange={e => setBlurb(e.target.value)} placeholder="What will learners master in this course?" rows={3} style={{...inp, resize:'vertical'}} /></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div><label className="cap" style={{ display:'block', marginBottom:4 }}>Author</label><input value={author} onChange={e => setAuthor(e.target.value)} style={inp} /></div>
          <div><label className="cap" style={{ display:'block', marginBottom:4 }}>Hours</label><input type="number" value={hours} onChange={e => setHours(e.target.value)} min={1} style={inp} /></div>
        </div>
        <div><label className="cap" style={{ display:'block', marginBottom:4 }}>Tags (comma-separated)</label><input value={tags} onChange={e => setTags(e.target.value)} placeholder="python, ml, beginner" style={inp} /></div>
        {/* Thumbnail upload (§3.3) */}
        <div>
          <label className="cap" style={{ display:'block', marginBottom:4 }}>Thumbnail (optional)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--brand)', color: 'oklch(0.16 0.02 270)', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {uploading ? 'Uploading…' : '📷 Upload image'}
              <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                setUploading(true);
                try { const res = await API.uploadFile(file); setThumbnailUrl(res.url); toast('Thumbnail uploaded!', 'success'); }
                catch (err) { toast(err.message || 'Upload failed', 'error'); }
                finally { setUploading(false); e.target.value = ''; }
              }} />
            </label>
            <input value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)} placeholder="Or paste image URL…" style={{ ...inp, flex: 1 }} />
          </div>
          {thumbnailUrl && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={thumbnailUrl} alt="thumbnail" style={{ height: 48, borderRadius: 6, border: '1px solid var(--border)' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
              <button onClick={() => setThumbnailUrl('')} style={{ background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}>Remove</button>
            </div>
          )}
        </div>
        <div>
          <label className="cap" style={{ display:'block', marginBottom:4 }}>Bundle from a roadmap (optional)</label>
          <select value={sourceRoadmap} onChange={e => setSourceRoadmap(e.target.value)} style={inp}>
            <option value="">Start empty</option>
            {roadmaps.map(rm => <option key={rm.id} value={rm.id}>{rm.title} ({rm.total_modules || 0} modules)</option>)}
          </select>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Its modules become the course syllabus.</div>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
          <Btn variant="primary" disabled={!title.trim() || creating} onClick={async () => {
            setCreating(true);
            try {
              const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
              const courseTags = tags.split(',').map(t => t.trim()).filter(Boolean);
              let syllabus = [];
              if (sourceRoadmap) {
                const full = await API.getRoadmap(sourceRoadmap).catch(() => null);
                if (full?.nodes) {
                  syllabus = full.nodes.map(n => ({ title: n.title, objectives: n.objectives || [], estimated_minutes: 45 }));
                }
              }
              await API.createCourse({ slug, title, blurb, author: author || 'You', hours, tags: JSON.stringify(courseTags), syllabus: JSON.stringify(syllabus), thumbnail_url: thumbnailUrl || undefined });
              toast(sourceRoadmap ? `Course bundled from roadmap · ${syllabus.length} modules` : 'Course created', 'success');
              onCreated(slug);
            } catch(e) {
              toast('Could not create course', 'error');
            } finally { setCreating(false); }
          }}>{creating ? 'Creating…' : 'Create Course'}</Btn>
        </div>
      </div>
    </div>
  );
}

