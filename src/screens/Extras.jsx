import React from 'react';
import { I } from '../components/Icons';
import { Card, Btn, ProgressBar, Ring, MiniBars, Tag, Avatar, AgentChip, PageScroll, PageHeader, SectionHead } from '../components/UI';
import { AGENTS } from '../data/data';
import API, { timeAgo, fmtDate, dueLabel } from '../api.js';
import { useToast, useModal } from '../App';

const SECT_MARGIN = 16;

// ── helpers ───────────────────────────────────────────────────────────────────

function useApi(fetcher, deps = []) {
  const [data, setData]       = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const load = React.useCallback(() => {
    setLoading(true);
    fetcher().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, deps);  // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { load(); }, [load]);
  return { data, loading, reload: load };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCHEDULE
   ═══════════════════════════════════════════════════════════════════════════ */
export function Schedule({ setScreen }) {
  const { add: toast } = useToast();
  const { open: openModal, close: closeModal } = useModal();
  const { data: rawEvents, loading, reload } = useApi(() => API.getSchedule());

  // A schedule block type maps to the app screen that runs it (#18).
  const launchScreen = { session: 'session', review: 'cards', assign: 'assignments', read: 'courses', project: 'assignments', live: 'session' };
  const launchEvent = (ev) => {
    const dest = launchScreen[ev.kind];
    if (dest && setScreen) { closeModal(); toast(`Opening ${ev.title}…`, 'success'); setScreen(dest); }
    else toast('This block type has no linked activity', 'info');
  };

  const HOURS = Array.from({ length: 10 }, (_, i) => 8 + i);
  const colorByKind = { session: 'var(--brand)', review: 'var(--brand-3)', assign: 'oklch(0.74 0.18 25)', read: 'oklch(0.74 0.17 220)', live: 'var(--good)', project: 'oklch(0.78 0.16 85)' };
  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  // Compute current-week labels
  const days = React.useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return `${dayNames[i]} ${d.getDate()}`;
    });
  }, []);

  // Map DB events → calendar items
  const items = React.useMemo(() => {
    if (!rawEvents) return [];
    return rawEvents.map(e => ({
      id:    e.id,
      title: e.title,
      kind:  e.event_type || 'session',
      agent: e.agent || 'TU',
      day:   e.day_of_week,
      start: e.start_hour,
      len:   e.duration_hours,
    }));
  }, [rawEvents]);

  // Open modal for creating a new event at a specific day/hour
  const handleCellClick = (dayIdx, hour) => {
    openEventModal(null, dayIdx, hour);
  };

  // Open modal for editing an existing event
  const handleEventClick = (ev, e) => {
    e.stopPropagation();
    openEventModal(ev, ev.day, ev.start);
  };

  const openEventModal = (existing, dayIdx, hour) => {
    const isEdit = !!existing;
    const formRef = { current: {} };
    openModal(
      <div style={{ minWidth: 420 }}>
        <h3 className="display" style={{ fontSize: 22, marginBottom: 16 }}>{isEdit ? 'Edit Time Block' : 'New Time Block'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="cap" style={{ display: 'block', marginBottom: 4 }}>Title</label>
            <input id="sched-title" defaultValue={existing?.title || ''} placeholder="e.g. Study Session" style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="cap" style={{ display: 'block', marginBottom: 4 }}>Type</label>
              <select id="sched-type" defaultValue={existing?.kind || 'session'} style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 }}>
                {Object.keys(colorByKind).map(k => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="cap" style={{ display: 'block', marginBottom: 4 }}>Day</label>
              <select id="sched-day" defaultValue={String(dayIdx)} style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 }}>
                {dayNames.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="cap" style={{ display: 'block', marginBottom: 4 }}>Start</label>
              <select id="sched-start" defaultValue={existing ? `${String(Math.floor(existing.start)).padStart(2,'0')}:00` : `${String(hour).padStart(2,'0')}:00`} style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 }}>
                {HOURS.map(h => <option key={h} value={`${String(h).padStart(2,'0')}:00`}>{h % 12 === 0 ? 12 : h % 12}:00{h < 12 ? 'a' : 'p'}</option>)}
              </select>
            </div>
            <div>
              <label className="cap" style={{ display: 'block', marginBottom: 4 }}>Duration</label>
              <select id="sched-dur" defaultValue={existing ? String(Math.round(existing.len * 60)) : '60'} style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 }}>
                {[15,30,45,60,90,120].map(m => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label className="cap" style={{ marginRight: 4 }}>Agent</label>
            <select id="sched-agent" defaultValue={existing?.agent || 'TU'} style={{ flex: 1, padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 }}>
              {Object.entries(AGENTS).map(([code, a]) => <option key={code} value={code}>{a.name}</option>)}
            </select>
          </div>
          {isEdit && existing && launchScreen[existing.kind] && (
            <Btn variant="primary" size="md" full icon={I.play} onClick={() => launchEvent(existing)} style={{ marginBottom: 4 }}>
              Start now → {{ session: 'Session', review: 'Spaced review', assign: 'Assignments', read: 'Courses', project: 'Assignments', live: 'Session' }[existing.kind]}
            </Btn>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Btn variant={isEdit ? 'outline' : 'primary'} size="md" full onClick={async () => {
              const title = document.getElementById('sched-title').value.trim() || 'New Block';
              const event_type = document.getElementById('sched-type').value;
              const day_of_week = parseInt(document.getElementById('sched-day').value);
              const startStr = document.getElementById('sched-start').value;
              const [h, m] = startStr.split(':').map(Number);
              const start_hour = h + m / 60;
              const duration_hours = parseInt(document.getElementById('sched-dur').value) / 60;
              const agent = document.getElementById('sched-agent').value;

              if (isEdit && existing?.id) {
                await API.patchScheduleEvent(existing.id, { title, event_type, day_of_week, start_hour, duration_hours, agent }).catch(() => {});
                toast('Time block updated', 'success');
              } else {
                await API.createScheduleEvent({ title, event_type, agent, day_of_week, start_hour, duration_hours }).catch(() => {});
                toast('Time block created', 'success');
              }
              closeModal();
              reload();
            }}>{isEdit ? 'Save Changes' : 'Create Block'}</Btn>
            {isEdit && existing?.id && (
              <Btn variant="outline" size="md" onClick={async () => {
                await API.deleteScheduleEvent(existing.id).catch(() => {});
                toast('Time block removed', 'info');
                closeModal();
                reload();
              }} style={{ color: 'var(--bad)', borderColor: 'oklch(0.7 0.2 25 / 0.5)' }}>Delete</Btn>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <PageScroll>
      <PageHeader eyebrow={`Week · ${days[0]} – ${days[6]}`} title="Schedule" subtitle="Click any cell to add an event. Click an existing event to edit or delete it."
        actions={<><Btn variant="primary" size="md" icon={I.plus} onClick={() => handleCellClick(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1, 9)}>New block</Btn></>} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: SECT_MARGIN }}>
        <Card pad={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
            <div />
            {days.map((d, i) => {
              const isToday = (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) === i;
              return (
                <div key={d} style={{ padding: '12px 8px', textAlign: 'center', borderLeft: '1px solid var(--border)', background: isToday ? 'var(--accent-soft)' : 'transparent' }}>
                  <div className="cap" style={{ color: isToday ? 'oklch(0.82 0.18 295)' : 'var(--muted)' }}>{d.split(' ')[0]}</div>
                  <div className="display" style={{ fontSize: 18, color: isToday ? 'oklch(0.82 0.18 295)' : 'var(--ink)', marginTop: 2 }}>{d.split(' ')[1]}</div>
                </div>
              );
            })}
          </div>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Loading schedule…</div>
          ) : (
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)' }}>
              <div style={{ borderRight: '1px solid var(--border)' }}>
                {HOURS.map((h) => (
                  <div key={h} style={{ height: 60, padding: '2px 8px 0', textAlign: 'right' }}>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'a' : 'p'}</span>
                  </div>
                ))}
              </div>
              {days.map((_, day) => (
                <div key={day} style={{ position: 'relative', borderLeft: '1px solid var(--border)' }}>
                  {HOURS.map((h) => (
                    <div key={h}
                      onClick={() => handleCellClick(day, h)}
                      style={{ height: 60, borderTop: h === HOURS[0] ? 'none' : '1px dashed var(--border)', cursor: 'pointer', transition: 'background var(--dur-fast)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    />
                  ))}
                  {items.filter(i => i.day === day).map((ev, idx) => {
                    const top    = (ev.start - HOURS[0]) * 60;
                    const height = Math.max(ev.len * 60 - 4, 20);
                    const c      = colorByKind[ev.kind] || 'var(--brand)';
                    return (
                      <div key={idx} onClick={(e) => handleEventClick(ev, e)} style={{
                        position: 'absolute', top: top + 2, left: 4, right: 4, height, borderRadius: 8,
                        background: `color-mix(in oklch, ${c} 22%, var(--surface))`, border: `1px solid color-mix(in oklch, ${c} 60%, transparent)`,
                        padding: 8, display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer', overflow: 'hidden', zIndex: 1,
                        transition: 'box-shadow var(--dur-fast), transform var(--dur-fast)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-line)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 4, height: 14, background: c, borderRadius: 2 }} />
                          <AgentChip code={ev.agent} size={16} glow={false} />
                          <span className="mono" style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 'auto' }}>✎</span>
                        </div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>{ev.title}</div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{String(Math.floor(ev.start)).padStart(2,'0')}:00 · {Math.round(ev.len * 60)}m</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card style={{ padding: 14 }}>
            <SectionHead title="This week" />
            {[{ l: 'Sessions', v: items.filter(e => e.kind === 'session').length }, { l: 'Reviews', v: items.filter(e => e.kind === 'review').length }, { l: 'Total blocks', v: items.length }].map((s) => (
              <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{s.l}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.v}</span>
              </div>
            ))}
          </Card>
          <Card style={{ padding: 14 }}>
            <SectionHead title="Quick add" />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Common blocks:</div>
            {[
              { label: 'Tutor session', kind: 'session', agent: 'TU', dur: 1 },
              { label: 'Spaced review', kind: 'review', agent: 'AN', dur: 0.5 },
              { label: 'Assignment work', kind: 'assign', agent: 'AS', dur: 1.5 },
            ].map(q => (
              <Btn key={q.label} variant="outline" size="sm" full style={{ marginBottom: 6, justifyContent: 'flex-start' }}
                onClick={() => {
                  const dayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
                  openEventModal({ title: q.label, kind: q.kind, agent: q.agent, day: dayIdx, start: 9, len: q.dur }, dayIdx, 9);
                }}>
                + {q.label}
              </Btn>
            ))}
          </Card>
          <Card style={{ padding: 14 }}>
            <SectionHead title="Block types" />
            {[{ l: 'Tutor session', c: 'var(--brand)' }, { l: 'Spaced review', c: 'var(--brand-3)' }, { l: 'Assignment', c: 'oklch(0.74 0.18 25)' }, { l: 'Reading', c: 'oklch(0.74 0.17 220)' }, { l: 'Live · cohort', c: 'var(--good)' }, { l: 'Project', c: 'oklch(0.78 0.16 85)' }].map((b) => (
              <div key={b.l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12.5, color: 'var(--ink-2)' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: b.c }} />{b.l}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </PageScroll>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ASSIGNMENTS
   ═══════════════════════════════════════════════════════════════════════════ */
// A real, varied catalogue the Assessment agent draws from — coding projects,
// larger homeworks, quizzes, and analyses, each with concrete tasks (#11, #16).
const ASSIGNMENT_LIBRARY = [
  { title: 'Implement k-NN from scratch', course: 'Machine Learning', kind: 'coding', priority: 'high', minutes: 120,
    description: 'Build a k-nearest-neighbours classifier without using scikit-learn, then evaluate it on a real dataset.',
    tasks: ['Load and split the Iris dataset', 'Implement Euclidean distance', 'Implement majority-vote prediction for arbitrary k', 'Plot accuracy vs k from 1–20', 'Write a 1-paragraph analysis of the best k'] },
  { title: 'Build a spam classifier', course: 'Machine Learning', kind: 'project', priority: 'high', minutes: 240,
    description: 'End-to-end project: train, evaluate, and report on a text classifier that flags spam messages.',
    tasks: ['Preprocess the SMS dataset (tokenize, vectorize)', 'Train a Naive Bayes baseline', 'Train a logistic-regression model', 'Compare precision/recall/F1', 'Write a short report with a confusion matrix'] },
  { title: 'Bias–Variance analysis', course: 'Machine Learning', kind: 'analysis', priority: 'med', minutes: 90,
    description: 'Empirically decompose error into bias and variance using the bootstrap.',
    tasks: ['Fit polynomials of degree 1, 3, and 15', 'Estimate bias² and variance via bootstrap resampling', 'Plot the bias–variance tradeoff curve', 'Identify the optimal complexity'] },
  { title: 'Gradient descent variants', course: 'Deep Learning', kind: 'coding', priority: 'med', minutes: 150,
    description: 'Implement and compare batch, stochastic, and mini-batch gradient descent.',
    tasks: ['Implement batch GD on a convex loss', 'Implement SGD and mini-batch GD', 'Plot loss curves for each', 'Tune the learning rate and report findings'] },
  { title: 'Model evaluation metrics', course: 'Machine Learning', kind: 'quiz', priority: 'low', minutes: 30,
    description: 'Short quiz on choosing and interpreting evaluation metrics.',
    tasks: ['When is accuracy misleading?', 'Compute precision and recall from a confusion matrix', 'Explain ROC-AUC in one sentence', 'Pick the right metric for an imbalanced fraud dataset'] },
  { title: 'RAG mini-project', course: 'Generative AI', kind: 'project', priority: 'high', minutes: 300,
    description: 'Build a small retrieval-augmented generation pipeline over a document set.',
    tasks: ['Chunk and embed a set of documents', 'Store embeddings in a vector index', 'Retrieve top-k for a query', 'Assemble a grounded prompt', 'Evaluate answer quality on 5 questions'] },
  { title: 'Hypothesis testing homework', course: 'Data Science', kind: 'homework', priority: 'med', minutes: 100,
    description: 'A larger homework working through several hypothesis tests on real data.',
    tasks: ['State hypotheses for 3 scenarios', 'Run a two-sample t-test', 'Run a chi-squared test', 'Interpret p-values and effect sizes', 'Summarize conclusions'] },
];

export function Assignments() {
  const { add: toast } = useToast();
  const { open: openModal } = useModal();
  const { data: rawAssignments, loading, reload } = useApi(() => API.getAssignments());

  const assignments = React.useMemo(() => {
    if (!rawAssignments) return [];
    return rawAssignments.map(a => ({
      id:       a.id,
      title:    a.title,
      course:   a.course,
      status:   a.status,
      pct:      a.progress || 0,
      grade:    a.grade,
      priority: a.priority || 'med',
      kind:     a.kind || 'homework',
      description: a.description || '',
      tasks:    (() => { try { return typeof a.tasks === 'string' ? JSON.parse(a.tasks || '[]') : (a.tasks || []); } catch { return []; } })(),
      est:      a.estimated_minutes ? `${a.estimated_minutes} min` : '—',
      due:      a.due_date ? dueLabel(a.due_date) : '—',
    }));
  }, [rawAssignments]);

  const [tab, setTab]                 = React.useState('all');
  const [expandedId, setExpandedId]   = React.useState(null);
  const [filterPriority, setFilterPriority] = React.useState('all');

  const filtered = assignments.filter(a => {
    if (tab === 'todo')   return a.status === 'todo' || a.status === 'in-progress';
    if (tab === 'graded') return a.status === 'graded';
    return true;
  }).filter(a => filterPriority === 'all' || a.priority === filterPriority);

  const tabs = [
    { id: 'all',    label: 'All',    n: assignments.length },
    { id: 'todo',   label: 'To do',  n: assignments.filter(a => a.status === 'todo' || a.status === 'in-progress').length },
    { id: 'graded', label: 'Graded', n: assignments.filter(a => a.status === 'graded').length },
  ];
  const statusMeta = { todo: { label: 'Not started', tone: 'neutral' }, 'in-progress': { label: 'In progress', tone: 'accent' }, graded: { label: 'Graded', tone: 'good' } };
  const prMeta     = { high: 'danger', med: 'warn', low: 'neutral' };

  const pending    = assignments.filter(a => a.status !== 'graded').length;
  const avgGrade   = (() => { const g = assignments.filter(a => a.grade != null); return g.length ? Math.round(g.reduce((s, a) => s + a.grade, 0) / g.length) : 0; })();

  return (
    <PageScroll>
      <PageHeader eyebrow={`${pending} pending`} title="Assignments" subtitle="Auto-graded work and longer projects from the Assessment Agent."
        actions={<><Btn variant="outline" size="md" icon={I.plus} onClick={() => openModal(<CreateAssignmentModal onCreated={() => { reload(); toast('Assignment created', 'success'); }} />)}>Create manually</Btn>
        <Btn variant="primary" size="md" icon={I.spark} onClick={async () => {
          // Try the AS agent first — context-aware generation based on the user's
          // most-recent active node. On any failure (no key, agent down) fall back
          // to a curated bank so the button still does something useful.
          let activeNodeId = null;
          try {
            const sessions = await API.getSessions().catch(() => []);
            const recent = (sessions || []).find(s => s.roadmap_node_id);
            if (recent) activeNodeId = recent.roadmap_node_id;
          } catch {}
          try {
            const kinds = ['coding', 'homework', 'quiz', 'project', 'analysis'];
            const kind = kinds[Math.floor(Math.random() * kinds.length)];
            const { assignment: a } = await API.generateAssignment({ node_id: activeNodeId, kind, difficulty: 'medium' });
            await API.createAssignment({
              title: a.title, course: a.course, kind: a.kind, priority: a.priority,
              estimated_minutes: a.estimated_minutes, description: a.description, tasks: a.tasks,
              due_date: new Date(Date.now() + 86400000 * (a.kind === 'project' ? 14 : 7)).toISOString().split('T')[0],
            });
            toast(`Generated by AS agent: "${a.title}"`, 'success');
            reload();
            return;
          } catch (err) {
            // Library fallback — used when no key or AS errors.
            const existing = new Set(assignments.map(a => a.title));
            const choices = ASSIGNMENT_LIBRARY.filter(a => !existing.has(a.title));
            const pick = (choices.length ? choices : ASSIGNMENT_LIBRARY)[Math.floor(Math.random() * (choices.length || ASSIGNMENT_LIBRARY.length))];
            try {
              await API.createAssignment({
                title: pick.title, course: pick.course, kind: pick.kind, priority: pick.priority,
                estimated_minutes: pick.minutes, description: pick.description, tasks: pick.tasks,
                due_date: new Date(Date.now() + 86400000 * (pick.kind === 'project' ? 14 : 7)).toISOString().split('T')[0],
              });
              toast(`From practice bank: "${pick.title}" — add an Anthropic key for AI-generated`, 'info');
              reload();
            } catch { toast('Could not generate assignment', 'error'); }
          }
        }}>Generate with AI</Btn></>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: SECT_MARGIN }}>
        <RoadmapStat2 icon={I.check}    label="In progress" value={assignments.filter(a => a.status === 'in-progress').length.toString()} sub="active"          color="var(--brand)" />
        <RoadmapStat2 icon={I.clock}    label="Avg grade"   value={avgGrade ? `${avgGrade}%` : '—'}                                       sub="last graded"    color="var(--good)" />
        <RoadmapStat2 icon={I.spark}    label="Pending"     value={pending.toString()}                                                     sub="to complete"    color="var(--brand-3)" />
        <RoadmapStat2 icon={I.calendar} label="Total"       value={assignments.length.toString()}                                          sub="assignments"    color="oklch(0.74 0.18 25)" />
      </div>
      <Card pad={false}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 6, borderBottom: '1px solid var(--border)' }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 14px', borderRadius: 7, border: 0, background: tab === t.id ? 'var(--surface)' : 'transparent', color: tab === t.id ? 'var(--ink)' : 'var(--muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all var(--dur-fast)' }}>
              {t.label}<span className="mono" style={{ fontSize: 10.5, color: tab === t.id ? 'var(--ink-2)' : 'var(--muted)' }}>{t.n}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={{ appearance: 'none', height: 28, padding: '0 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--ink-2)', fontSize: 11, cursor: 'pointer' }}>
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="med">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>Loading assignments…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
            {assignments.length === 0 ? 'No assignments yet.' : 'No assignments match your filters.'}
          </div>
        ) : filtered.map((a) => (
          <React.Fragment key={a.id}>
            <div className="interactive-row" onClick={() => setExpandedId(expandedId === a.id ? null : a.id)} style={{ display: 'grid', gridTemplateColumns: '1fr 200px 160px 120px 120px', gap: 16, padding: '14px 18px', alignItems: 'center', borderTop: '1px solid var(--border)', cursor: 'pointer', background: expandedId === a.id ? 'var(--surface)' : 'transparent' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag tone={a.kind === 'coding' || a.kind === 'project' ? 'accent' : a.kind === 'quiz' ? 'cyan' : 'neutral'}>{a.kind}</Tag>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{a.title}</div>
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{a.course} · {a.est} · {a.tasks?.length || 0} tasks</div>
              </div>
              <div>
                <Tag tone={(statusMeta[a.status] || statusMeta.todo).tone}>{(statusMeta[a.status] || statusMeta.todo).label}</Tag>
                {a.priority && a.status !== 'graded' && <Tag tone={prMeta[a.priority] || 'neutral'} style={{ marginLeft: 6 }}>{a.priority.toUpperCase()}</Tag>}
              </div>
              <div>
                {a.status === 'graded' ? (
                  <div className="mono" style={{ fontSize: 12, color: 'var(--good)' }}>Graded · {a.grade}%</div>
                ) : (
                  <div>
                    <ProgressBar value={a.pct} height={4} />
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>{Math.round(a.pct * 100)}% done</div>
                  </div>
                )}
              </div>
              <div className="mono" style={{ fontSize: 11.5, color: a.due === 'Yesterday' ? 'var(--bad)' : 'var(--ink-2)' }}>Due {a.due}</div>
              <div style={{ textAlign: 'right' }}>
                {a.status === 'graded' ? (
                  <Btn variant="ghost" iconRight={React.cloneElement(I.arrowR, { size: 13 })} onClick={(e) => { e.stopPropagation(); openModal(<AssignmentWorkModal a={a} reload={reload} />); }}>Review</Btn>
                ) : (
                  <Btn variant={a.status === 'in-progress' ? 'outline' : 'primary'} iconRight={React.cloneElement(I.arrowR, { size: 13 })}
                    onClick={(e) => { e.stopPropagation(); openModal(<AssignmentWorkModal a={a} reload={reload} />); }}>
                    {a.status === 'in-progress' ? 'Continue' : 'Open'}
                  </Btn>
                )}
              </div>
            </div>
            {expandedId === a.id && (
              <div style={{ padding: '16px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface)', animation: 'pageEnter var(--dur-fast) var(--ease-out)' }}>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                  {a.status === 'graded' ? `Submitted and graded: ${a.grade}%` : `Progress: ${Math.round(a.pct * 100)}% · Estimated time: ${a.est}`}
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </Card>
    </PageScroll>
  );
}

function RoadmapStat2({ icon, label, value, sub, color }) {
  return (
    <Card style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 40, height: 40, borderRadius: 9, background: `color-mix(in oklch, ${color} 18%, transparent)`, color, border: `1px solid color-mix(in oklch, ${color} 35%, transparent)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <div>
        <div className="cap">{label}</div>
        <div className="display" style={{ fontSize: 22, marginTop: 2, color: 'var(--ink)' }}>{value}</div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
      </div>
    </Card>
  );
}

// Real work surface: description + task checklist + written submission → LLM grading.
function AssignmentWorkModal({ a, reload }) {
  const { add: toast } = useToast();
  const { close } = useModal();
  const total = a.tasks?.length || 0;
  const [checked, setChecked] = React.useState(() => {
    const n = Math.round((a.pct || 0) * total);
    return (a.tasks || []).map((_, i) => a.status === 'graded' ? true : i < n);
  });
  const [submission, setSubmission] = React.useState('');
  const [grading, setGrading] = React.useState(false);
  const [feedback, setFeedback] = React.useState(null); // { grade, feedback_md, rubric }
  const isGraded = a.status === 'graded';
  const done = checked.filter(Boolean).length;
  const pct = total ? done / total : 0;
  const kindLabel = { coding: 'Coding exercise', project: 'Project', quiz: 'Quiz', analysis: 'Analysis', homework: 'Homework' }[a.kind] || 'Assignment';

  // Load existing submission on mount
  React.useEffect(() => {
    let alive = true;
    API.getAssignmentSubmission(a.id).then(res => {
      if (!alive || !res?.submission) return;
      if (res.submission.body_md) setSubmission(res.submission.body_md);
      if (res.status === 'graded' && res.submission.grade != null) {
        let rubric = [];
        try { rubric = JSON.parse(res.submission.rubric_json || '[]'); } catch {}
        setFeedback({ grade: res.submission.grade, feedback_md: res.submission.feedback_md, rubric });
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [a.id]);

  const toggle = (i) => { if (isGraded) return; setChecked(c => c.map((v, j) => j === i ? !v : v)); };
  const saveProgress = async () => {
    await API.patchAssignment(a.id, { status: 'in-progress', progress: pct }).catch(() => {});
    toast('Progress saved', 'success');
    close(); reload();
  };
  const submit = async () => {
    if (!submission.trim()) { toast('Please write your submission before submitting', 'error'); return; }
    setGrading(true);
    try {
      // Submit the written work — server stores it and enqueues a grade-assignment job
      const res = await API.submitAssignment(a.id, submission.trim());
      const subId = res.submission?.id;
      toast('Submission sent — grading…', 'info');
      // Poll for grading result (up to 60s)
      let graded = null;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await API.getAssignmentSubmission(a.id).catch(() => null);
        if (poll?.status === 'graded') { graded = poll.submission; break; }
      }
      if (graded) {
        let rubric = [];
        try { rubric = JSON.parse(graded.rubric_json || '[]'); } catch {}
        setFeedback({ grade: graded.grade, feedback_md: graded.feedback_md, rubric });
        toast(`Graded: ${graded.grade}%`, graded.grade >= 70 ? 'success' : 'error');
      } else {
        // Still pending — show a placeholder
        setFeedback({ grade: null, feedback_md: '**Grading in progress…**\n\nThe Assessment agent is reviewing your submission. Check back in a moment.', rubric: [] });
        toast('Grading is still in progress — check back shortly', 'info');
      }
    } catch (e) {
      toast(e.message || 'Could not submit for grading', 'error');
    } finally {
      setGrading(false);
    }
  };

  const displayGrade = feedback?.grade ?? a.grade;
  const displayFeedback = feedback?.feedback_md;
  const displayRubric = feedback?.rubric;

  return (
    <div style={{ minWidth: 520, maxWidth: 640 }}>
      <div className="cap" style={{ marginBottom: 4 }}>{kindLabel} · {a.course}</div>
      <h3 className="display" style={{ fontSize: 22, marginBottom: 8 }}>{a.title}</h3>
      {displayGrade != null && <Tag tone="good" style={{ marginBottom: 10 }}>Graded · {displayGrade}%</Tag>}
      {grading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 8, marginBottom: 12 }}>
          <span style={{ display: 'inline-flex', gap: 4 }}>{[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--brand)', animation: `ldot 1s ease-in-out ${i*0.15}s infinite` }} />)}</span>
          <span style={{ fontSize: 13 }}>Assessment agent is grading your submission…</span>
        </div>
      )}
      {a.description && <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 14 }}>{a.description}</p>}
      <div className="cap" style={{ marginBottom: 8 }}>Tasks ({done}/{total})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {total === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>No task breakdown for this assignment.</div>
        ) : a.tasks.map((t, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', cursor: isGraded ? 'default' : 'pointer' }}>
            <input type="checkbox" checked={checked[i]} onChange={() => toggle(i)} disabled={isGraded} style={{ marginTop: 2 }} />
            <span style={{ fontSize: 13, color: checked[i] ? 'var(--muted)' : 'var(--ink)', textDecoration: checked[i] ? 'line-through' : 'none', lineHeight: 1.5 }}>{t}</span>
          </label>
        ))}
      </div>
      {!isGraded && <ProgressBar value={pct} height={6} />}
      <div style={{ marginTop: 16 }}>
        <div className="cap" style={{ marginBottom: 6 }}>Your submission</div>
        <textarea
          value={submission}
          onChange={e => setSubmission(e.target.value)}
          disabled={isGraded || grading}
          placeholder={"Write your answer, paste code, or describe your solution here.\n\nThe Assessment agent will grade this against the assignment's objectives."}
          rows={6}
          style={{ width: '100%', padding: '10px 12px', background: isGraded ? 'var(--surface-2)' : 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13, resize: 'vertical', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}
        />
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4, textAlign: 'right' }}>{submission.length} chars</div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        {isGraded || displayGrade != null ? (
          <>
            {feedback && <Btn variant="outline" onClick={() => { close(); reload(); }}>Done</Btn>}
          </>
        ) : (
          <>
            <Btn variant="outline" onClick={saveProgress} disabled={grading}>Save progress</Btn>
            <Btn variant="primary" disabled={grading || !submission.trim()} onClick={submit}>
              {grading ? 'Grading…' : 'Submit for grading'}
            </Btn>
          </>
        )}
      </div>
      {displayFeedback && !grading && (
        <div style={{ marginTop: 16, padding: 16, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', animation: 'pageEnter var(--dur-fast) var(--ease-out)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div className="cap" style={{ color: displayGrade >= 85 ? 'var(--good)' : displayGrade >= 70 ? 'var(--warn)' : 'var(--bad)' }}>
              {displayGrade >= 85 ? '★ Strong work' : displayGrade >= 70 ? '● Satisfactory' : '○ Needs improvement'}
            </div>
            <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginLeft: 'auto' }}>{displayGrade != null ? `${displayGrade}%` : '…'}</span>
          </div>
          {displayRubric?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className="cap" style={{ marginBottom: 6 }}>Detailed rubric</div>
              {displayRubric.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-2)', flex: 1 }}>{r.criterion}</span>
                  <span className="mono" style={{ fontSize: 12, color: r.score >= 80 ? 'var(--good)' : r.score >= 60 ? 'var(--warn)' : 'var(--bad)' }}>{r.score}%</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
            {displayFeedback.split('\n').map((line, i) => {
              if (line.startsWith('### ')) return <h4 key={i} style={{ fontSize: 14, color: 'var(--ink)', margin: '10px 0 4px', fontWeight: 700 }}>{line.slice(4)}</h4>;
              if (line.startsWith('## ')) return <h3 key={i} style={{ fontSize: 15, color: 'var(--ink)', margin: '12px 0 6px', fontWeight: 700 }}>{line.slice(3)}</h3>;
              if (line.startsWith('**') && line.endsWith('**')) return <div key={i} style={{ fontWeight: 700, color: 'var(--ink)', margin: '6px 0 2px' }}>{line.slice(2, -2)}</div>;
              if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} style={{ paddingLeft: 14, margin: '2px 0' }}>• {line.slice(2)}</div>;
              if (!line.trim()) return <div key={i} style={{ height: 4 }} />;
              // Inline bold
              const formatted = line.replace(/\*\*([^*]+)\*\*/g, '**$1**');
              return <p key={i} style={{ margin: '3px 0' }} dangerouslySetInnerHTML={{ __html: formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FLASHCARDS
   ═══════════════════════════════════════════════════════════════════════════ */
export function Flashcards() {
  const { add: toast } = useToast();
  const { open: openModal, close: closeModal } = useModal();
  const { data: rawCards, loading, reload } = useApi(() => API.getFlashcardsDue());

  const cards = React.useMemo(() => {
    if (!rawCards) return [];
    return rawCards.map(c => ({
      id:       c.id,
      deck:     c.deck,
      q:        c.front,
      a:        c.back,
      interval: c.interval_days ? `${c.interval_days}d` : '1d',
    }));
  }, [rawCards]);

  const [idx, setIdx]                         = React.useState(0);
  const [flipped, setFlipped]                 = React.useState(false);
  const [reviewed, setReviewed]               = React.useState({});
  const [sessionComplete, setSessionComplete] = React.useState(false);

  const card  = cards[idx];
  const total = cards.length;
  const done  = Object.keys(reviewed).length;

  const grade = async (g) => {
    if (!flipped || !card) return;
    setReviewed(r => ({ ...r, [card.id]: g }));
    setFlipped(false);
    const gradeMap = { again: 1, hard: 2, good: 3, easy: 4 };
    await API.reviewFlashcard(card.id, { grade: gradeMap[g] || 3 }).catch(() => {});
    toast(g === 'again' ? 'Scheduled for 1 min' : g === 'easy' ? 'Scheduled for 12 days' : g === 'good' ? 'Scheduled for 4 days' : 'Scheduled for 6 min', 'success');
    if (idx < total - 1) setIdx(idx + 1);
    else { setSessionComplete(true); reload(); }
  };

  const resetSession = () => { setIdx(0); setFlipped(false); setReviewed({}); setSessionComplete(false); };

  if (loading) {
    return (
      <PageScroll>
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>Loading cards…</div>
      </PageScroll>
    );
  }

  return (
    <PageScroll>
      <PageHeader eyebrow={sessionComplete ? `Review complete! · ${total} cards reviewed` : `Review · ${done} / ${total} due today`} title="Spaced review" subtitle="Cards scheduled by the Assessment Agent based on your recall curve."
        actions={<>
          <Btn variant="outline" icon={I.plus} onClick={() => openModal(<CreateCardsModal onCreated={() => { closeModal(); reload(); toast('Cards created!', 'success'); }} />)}>Create cards</Btn>
          <Btn variant="primary" size="md" icon={I.play} onClick={() => { if (sessionComplete) resetSession(); else if (total === 0) toast('Create some cards first', 'info'); }}>{sessionComplete ? 'New session' : total === 0 ? 'No cards due' : 'Continue'}</Btn>
        </>} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: SECT_MARGIN }}>
        <Card pad={false} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {total === 0 ? (
            <div style={{ minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ fontSize: 48 }}>✨</div>
              <div className="display" style={{ fontSize: 24, color: 'var(--ink)' }}>All caught up!</div>
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>No cards due today. Come back tomorrow.</div>
            </div>
          ) : sessionComplete ? (
            <div style={{ minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ fontSize: 48 }}>🎉</div>
              <div className="display" style={{ fontSize: 24, color: 'var(--ink)' }}>Session Complete!</div>
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>You reviewed {total} cards. Great work!</div>
              <Btn variant="primary" size="md" onClick={resetSession}>Start another session</Btn>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Tag tone="cyan">{card.deck}</Tag>
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>card {idx + 1} of {total} · interval {card.interval}</span>
              </div>
              <div onClick={() => setFlipped(f => !f)} style={{ cursor: 'pointer', minHeight: 240, borderRadius: 14, background: 'linear-gradient(135deg, oklch(0.22 0.05 295), oklch(0.18 0.04 250))', border: '1px solid var(--accent-line)', padding: 30, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', boxShadow: 'var(--shadow-glow)' }}>
                <div className="cap" style={{ position: 'absolute', top: 14, left: 18, color: 'oklch(0.85 0.1 295)' }}>{flipped ? 'Answer' : 'Question'}</div>
                <div className="display" style={{ fontSize: 26, color: 'var(--ink)', lineHeight: 1.25 }}>{flipped ? card.a : card.q}</div>
                <div className="mono" style={{ position: 'absolute', bottom: 14, right: 18, color: 'var(--muted)', fontSize: 10.5 }}>click to {flipped ? 'see question' : 'reveal'}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[{ g: 'again', label: 'Again', sub: '<1m', tone: 'danger' }, { g: 'hard', label: 'Hard', sub: '6m', tone: 'warn' }, { g: 'good', label: 'Good', sub: '4d', tone: 'accent' }, { g: 'easy', label: 'Easy', sub: '12d', tone: 'good' }].map((b) => (
                  <button key={b.g} onClick={() => grade(b.g)} disabled={!flipped} style={{ opacity: flipped ? 1 : 0.45, padding: 14, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', cursor: flipped ? 'pointer' : 'not-allowed', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <Tag tone={b.tone}>{b.label}</Tag>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>next in {b.sub}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card style={{ padding: 16 }}>
            <SectionHead title="Today" subtitle={`${total} cards due`} />
            {total === 0 ? (
              <div style={{ padding: '12px 0', color: 'var(--muted)', fontSize: 13 }}>All clear — no cards due today!</div>
            ) : (
              // group by deck
              Object.entries(cards.reduce((acc, c) => { acc[c.deck] = (acc[c.deck] || 0) + 1; return acc; }, {})).map(([deck, n], i) => (
                <div key={deck} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i === 0 ? 0 : '1px solid var(--border)' }}>
                  <div style={{ flex: 1, fontSize: 12.5, color: 'var(--ink)' }}>{deck}</div>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{n} due</span>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </PageScroll>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CERTIFICATES
   ═══════════════════════════════════════════════════════════════════════════ */
export function Certificates() {
  const { add: toast } = useToast();
  const { data: rawCerts,  loading: loadingCerts  } = useApi(() => API.getCertificates());
  const { data: rawBadges, loading: loadingBadges } = useApi(() => API.getBadges());

  const certs  = rawCerts  || [];
  const badges = rawBadges || [];

  return (
    <PageScroll>
      <PageHeader eyebrow={`Issued by Certification Agent · ${certs.length} earned`} title="Certificates & Badges" subtitle="Verifiable credentials issued when you complete a roadmap or hit a milestone."
        actions={<><Btn variant="outline" icon={I.download} onClick={() => {
          const text = certs.map(c => `Certificate: ${c.title}\nIssued: ${fmtDate(c.issued_at)}\nMastery: ${Math.round((c.mastery || 0) * 100)}%\nID: ${c.id_short || c.id}`).join('\n\n---\n\n');
          const blob = new Blob([text || 'No certificates yet.'], { type: 'text/plain' });
          const url = URL.createObjectURL(blob); const a = document.createElement('a');
          a.href = url; a.download = 'learnos-certificates.txt'; a.click(); URL.revokeObjectURL(url);
          toast('Certificates exported', 'success');
        }}>Export</Btn><Btn variant="primary" size="md" icon={I.upload} onClick={async () => {
          const url = window.location.origin + '/certificates';
          try { await navigator.clipboard.writeText(url); toast('Link copied to clipboard!', 'success'); } catch { toast('Could not copy link', 'error'); }
        }}>Share</Btn></>} />
      <SectionHead title="Earned certificates" />
      {loadingCerts ? (
        <div style={{ padding: 32, color: 'var(--muted)' }}>Loading…</div>
      ) : certs.length === 0 ? (
        <Card style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 16, color: 'var(--muted)' }}>No certificates yet — complete a roadmap to earn one!</div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {certs.map((c) => <CertCard key={c.id} cert={{ ...c, issued: fmtDate(c.issued_at) }} />)}
        </div>
      )}
      <SectionHead title="Badges" style={{ marginTop: 24 }} />
      {loadingBadges ? (
        <div style={{ padding: 32, color: 'var(--muted)' }}>Loading…</div>
      ) : badges.length === 0 ? (
        <Card style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>No badges yet — keep learning!</div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          {badges.map((b) => (
            <Card key={b.id} pad={false} style={{ padding: 14, textAlign: 'center' }}>
              <div style={{ margin: '0 auto', width: 56, height: 56, borderRadius: 999, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
                {React.cloneElement(I[b.glyph] || I.star, { size: 24 })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600, marginTop: 8 }}>{b.label}</div>
            </Card>
          ))}
        </div>
      )}
    </PageScroll>
  );
}

function CertCard({ cert }) {
  const { add: toast } = useToast();
  const { open: openModal } = useModal();
  const color = cert.color || 'var(--brand)';
  const isVerified = cert.verified === undefined ? true : !!cert.verified;
  return (
    <Card pad={false} style={{ overflow: 'hidden' }}>
      <div style={{ padding: 18, background: `linear-gradient(135deg, color-mix(in oklch, ${color} 28%, var(--surface)), var(--surface))`, borderBottom: `1px solid color-mix(in oklch, ${color} 30%, transparent)`, textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <Tag tone={isVerified ? 'good' : 'neutral'}>{isVerified ? '✓ Verified' : 'Unverified'}</Tag>
        </div>
        <div className="cap" style={{ color }}>Certificate of Completion</div>
        <div className="display" style={{ fontSize: 16, color: 'var(--ink)', marginTop: 6 }}>LearnOS</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 18 }}>has successfully completed</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>{cert.title}</div>
        <div style={{ margin: '14px auto 0', width: 56, height: 56, borderRadius: 999, background: `radial-gradient(circle, ${color} 0%, transparent 70%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{React.cloneElement(I.ribbon, { size: 28 })}</div>
      </div>
      <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{cert.id_short}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2 }}>Issued {cert.issued} · Mastery {Math.round((cert.mastery || 0) * 100)}%</div>
        </div>
        <Btn variant="outline" icon={React.cloneElement(I.open, { size: 13 })} onClick={() => openModal(<VerificationModal cert={cert} />)}>Verify</Btn>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMMUNITY — backed by real API
   ═══════════════════════════════════════════════════════════════════════════ */
export function Community() {
  const { add: toast } = useToast();
  const { open: openModal } = useModal();
  const [tab, setTab] = React.useState('Recent');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [newThreadOpen, setNewThreadOpen] = React.useState(false);
  const [newThreadTitle, setNewThreadTitle] = React.useState('');
  const [newThreadBody, setNewThreadBody] = React.useState('');
  const [newThreadTag, setNewThreadTag] = React.useState('question');
  const [newThreadImage, setNewThreadImage] = React.useState('');
  const [newThreadRef, setNewThreadRef] = React.useState(''); // "course:slug" | "roadmap:id" | ""
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [refOptions, setRefOptions] = React.useState({ courses: [], roadmaps: [] });
  const [threads, setThreads] = React.useState([]);
  const [leaderboard, setLeaderboard] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [threadVotes, setThreadVotes] = React.useState({});
  const tabs = ['Recent', 'Top', 'Unanswered', 'Following'];

  // Load courses + roadmaps the user can reference from a post
  React.useEffect(() => {
    Promise.all([API.getCourses().catch(() => []), API.getRoadmaps().catch(() => [])])
      .then(([courses, roadmaps]) => setRefOptions({ courses: courses || [], roadmaps: roadmaps || [] }));
  }, []);

  // Load threads from API
  React.useEffect(() => {
    setLoading(true);
    const params = {};
    if (tab === 'Top') params.sort = 'top';
    if (tab === 'Unanswered') params.tag = 'question'; // filter client-side
    API.getCommunityThreads(params).then(rows => {
      setThreads(rows || []);
      // Build vote map
      const vm = {};
      (rows || []).forEach(t => { if (t.user_vote) vm[t.id] = t.user_vote; });
      setThreadVotes(vm);
    }).catch(() => setThreads([])).finally(() => setLoading(false));
  }, [tab]);

  // Load leaderboard
  React.useEffect(() => {
    API.getLeaderboard().then(rows => setLeaderboard(rows || [])).catch(() => {});
  }, []);

  const filtered = threads.filter(d => {
    if (tab === 'Unanswered') return d.replies_count === 0;
    if (tab === 'Following') return true; // simplified
    return true;
  }).filter(d => !searchQuery || d.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleCreateThread = async () => {
    if (!newThreadTitle.trim()) { toast('Please enter a thread title', 'error'); return; }
    if (newThreadImage.trim() && !/^https?:\/\//i.test(newThreadImage.trim())) {
      toast('Image must be a valid http(s):// URL', 'error'); return;
    }
    const payload = { title: newThreadTitle.trim(), body: newThreadBody.trim(), tag: newThreadTag };
    if (newThreadImage.trim()) payload.image_url = newThreadImage.trim();
    if (newThreadRef) {
      const [ref_type, ...rest] = newThreadRef.split(':');
      const ref_id = rest.join(':');
      const opt = ref_type === 'course'
        ? refOptions.courses.find(c => c.slug === ref_id)
        : refOptions.roadmaps.find(r => r.id === ref_id);
      payload.ref_type = ref_type;
      payload.ref_id = ref_id;
      payload.ref_label = opt?.title || ref_id;
    }
    try {
      const result = await API.createCommunityThread(payload);
      setThreads(prev => [result.thread, ...prev]);
      setNewThreadTitle(''); setNewThreadBody(''); setNewThreadImage(''); setNewThreadRef(''); setNewThreadOpen(false);
      toast('Thread created!', 'success');
    } catch { toast('Could not create thread', 'error'); }
  };

  const handleVote = async (threadId, value) => {
    try {
      const result = await API.voteThread(threadId, value);
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, votes: result.votes } : t));
      setThreadVotes(prev => ({ ...prev, [threadId]: value }));
    } catch { toast('Vote failed', 'error'); }
  };

  const handleOpenThread = async (d) => {
    // Fetch full thread with replies
    const full = await API.getCommunityThread(d.id).catch(() => d);
    openModal(<ThreadModal thread={full} onVote={handleVote} onReply={() => {
      // Refresh threads after reply
      API.getCommunityThreads({}).then(setThreads).catch(() => {});
    }} />);
  };

  return (
    <PageScroll>
      <PageHeader eyebrow={`${threads.length} threads · ${leaderboard.length} contributors`} title="Community" subtitle="Ask, answer, study together. Every thread is open-source."
        actions={<Btn variant="primary" size="md" icon={I.plus} onClick={() => setNewThreadOpen(!newThreadOpen)}>{newThreadOpen ? 'Cancel' : 'New thread'}</Btn>} />
      {newThreadOpen && (
        <Card style={{ padding: 20, marginBottom: SECT_MARGIN, animation: 'pageEnter var(--dur-fast) var(--ease-out)' }}>
          <h3 className="display" style={{ fontSize: 18, marginBottom: 12 }}>Start a new thread</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={newThreadTitle} onChange={e => setNewThreadTitle(e.target.value)} placeholder="Thread title…" style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 14 }} />
            <textarea value={newThreadBody} onChange={e => setNewThreadBody(e.target.value)} placeholder="Describe your question or topic…" rows={4} style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13, resize: 'vertical' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label className="cap" style={{ display: 'block', marginBottom: 4 }}>Image (optional)</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--brand)', color: 'oklch(0.16 0.02 270)', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {uploadingImage ? 'Uploading…' : '📎 Upload file'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingImage(true);
                      try {
                        const res = await API.uploadFile(file);
                        setNewThreadImage(res.url);
                        toast('Image uploaded!', 'success');
                      } catch (err) {
                        toast(err.message || 'Upload failed', 'error');
                      } finally { setUploadingImage(false); e.target.value = ''; }
                    }} />
                  </label>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>or</span>
                  <input value={newThreadImage} onChange={e => setNewThreadImage(e.target.value)} placeholder="Paste image URL…" style={{ flex: 1, padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--ink)', fontSize: 12.5 }} />
                </div>
                {newThreadImage.trim() && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={newThreadImage.trim()} alt="preview" style={{ maxHeight: 60, borderRadius: 6, border: '1px solid var(--border)' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                    <button onClick={() => setNewThreadImage('')} style={{ background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                  </div>
                )}
              </div>
              <div>
                <label className="cap" style={{ display: 'block', marginBottom: 4 }}>Reference a course or roadmap (optional)</label>
                <select value={newThreadRef} onChange={e => setNewThreadRef(e.target.value)} style={{ width: '100%', padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--ink)', fontSize: 12.5 }}>
                  <option value="">None</option>
                  {refOptions.courses.length > 0 && (
                    <optgroup label="Courses">
                      {refOptions.courses.map(c => <option key={`course:${c.slug}`} value={`course:${c.slug}`}>{c.title}</option>)}
                    </optgroup>
                  )}
                  {refOptions.roadmaps.length > 0 && (
                    <optgroup label="Roadmaps">
                      {refOptions.roadmaps.map(r => <option key={`roadmap:${r.id}`} value={`roadmap:${r.id}`}>{r.title}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>
            {newThreadImage.trim() && /^https?:\/\//i.test(newThreadImage.trim()) && (
              <img src={newThreadImage.trim()} alt="preview" style={{ maxHeight: 120, borderRadius: 8, border: '1px solid var(--border)', objectFit: 'cover', alignSelf: 'flex-start' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={newThreadTag} onChange={e => setNewThreadTag(e.target.value)} style={{ padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--ink)', fontSize: 12 }}>
                <option value="question">Question</option>
                <option value="errata">Errata</option>
                <option value="show">Show & Tell</option>
                <option value="group">Study Group</option>
              </select>
              <div style={{ flex: 1 }} />
              <Btn variant="outline" onClick={() => setNewThreadOpen(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={handleCreateThread}>Post Thread</Btn>
            </div>
          </div>
        </Card>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: SECT_MARGIN }}>
        <Card pad={false}>
          <div style={{ display: 'flex', gap: 4, padding: 6, borderBottom: '1px solid var(--border)' }}>
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', borderRadius: 7, border: 0, background: tab === t ? 'var(--surface)' : 'transparent', color: tab === t ? 'var(--ink)' : 'var(--muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{t}</button>
            ))}
          </div>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>Loading threads…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>No threads yet. Be the first to post!</div>
          ) : filtered.map(d => (
            <div key={d.id} className="interactive-row" style={{ display: 'grid', gridTemplateColumns: '52px 1fr 130px 100px', gap: 14, padding: '14px 18px', alignItems: 'center', borderTop: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={() => handleOpenThread(d)}>
              <div style={{ textAlign: 'center', padding: '6px 0', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div className="display" style={{ fontSize: 14, color: 'var(--ink)' }}>{d.votes}</div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>votes</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                {d.image_url && <img src={d.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none'; }} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{d.title}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Avatar name={d.author_name || 'User'} size={16} /> {d.author_name || 'User'}
                    {d.ref_type && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 7px', borderRadius: 999, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', color: 'var(--brand-3)', fontSize: 10 }}>{d.ref_type === 'course' ? '◉' : '⌗'} {d.ref_label || d.ref_id}</span>}
                  </div>
                </div>
              </div>
              <Tag tone={d.tag === 'question' ? 'accent' : d.tag === 'errata' ? 'warn' : d.tag === 'show' ? 'cyan' : 'neutral'}>{d.tag}</Tag>
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{d.replies_count} replies</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{timeAgo(d.created_at)}</div>
              </div>
            </div>
          ))}
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card style={{ padding: 16 }}>
            <SectionHead title="Leaderboard" subtitle="Top contributors" />
            {leaderboard.length === 0 ? (
              <div style={{ padding: '12px 0', color: 'var(--muted)', fontSize: 13 }}>No contributors yet.</div>
            ) : leaderboard.map(u => (
              <div key={u.rank} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: u.me ? '1px dashed var(--border)' : 'none', marginTop: u.me ? 6 : 0 }}>
                <div className="mono" style={{ width: 22, fontSize: 11, color: u.rank <= 3 ? 'var(--brand)' : 'var(--muted)', fontWeight: 600 }}>#{u.rank}</div>
                <Avatar name={u.name} size={24} />
                <div style={{ flex: 1, fontSize: 12.5, color: u.me ? 'var(--brand)' : 'var(--ink)', fontWeight: u.me ? 600 : 500 }}>{u.name}{u.me ? ' (you)' : ''}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{u.contributions}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </PageScroll>
  );
}

/* ── Thread detail modal ──────────────────────────────────────────────────── */
function ThreadModal({ thread, onVote, onReply }) {
  const [replyBody, setReplyBody] = React.useState('');
  const { add: toast } = useToast();

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    try {
      await API.replyToThread(thread.id, replyBody.trim());
      setReplyBody('');
      toast('Reply posted!', 'success');
      onReply();
    } catch { toast('Could not post reply', 'error'); }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Avatar name={thread.author_name || 'User'} size={32} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{thread.author_name || 'User'}</div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{timeAgo(thread.created_at)}</div>
        </div>
      </div>
      <h3 className="display" style={{ fontSize: 20, marginBottom: 12 }}>{thread.title}</h3>
      {thread.ref_type && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', color: 'var(--brand-3)', fontSize: 12, marginBottom: 12 }}>
          {thread.ref_type === 'course' ? '◉ Course' : '⌗ Roadmap'} · {thread.ref_label || thread.ref_id}
        </div>
      )}
      {thread.body && <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, marginBottom: 16 }}>{thread.body}</p>}
      {thread.image_url && <img src={thread.image_url} alt="attachment" style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none'; }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => onVote(thread.id, 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: thread.user_vote === 1 ? 'var(--accent-soft)' : 'var(--surface)', color: 'var(--ink-2)', fontSize: 13, cursor: 'pointer' }}>▲ {thread.votes}</button>
        <Tag tone={thread.tag === 'question' ? 'accent' : thread.tag === 'errata' ? 'warn' : thread.tag === 'show' ? 'cyan' : 'neutral'}>{thread.tag}</Tag>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{thread.replies_count} replies</span>
      </div>
      <div style={{ marginTop: 16 }}>
        <div className="cap" style={{ marginBottom: 8 }}>{(thread.replies || []).length} {(thread.replies || []).length === 1 ? 'reply' : 'replies'}</div>
        {(thread.replies || []).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(thread.replies || []).map((r, ri) => (
              <div key={r.id || ri} style={{ padding: 12, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Avatar name={r.author_name || 'User'} size={22} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{r.author_name || 'User'}</span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{timeAgo(r.created_at)}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{r.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No replies yet. Be the first to respond!</div>
        )}
        <form onSubmit={handleReply} style={{ marginTop: 12 }}>
          <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder="Write a reply…" rows={3} style={{ width: '100%', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13, resize: 'vertical' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="primary" size="sm" type="submit">Post Reply</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   FEED — shows personal activity log
   ═══════════════════════════════════════════════════════════════════════════ */
export function Feed() {
  const { data: rawActivity, loading } = useApi(() => API.getActivity());

  const kindMeta = {
    quiz:       { icon: I.check,  color: 'var(--good)',              label: 'Quiz' },
    assignment: { icon: I.upload, color: 'var(--brand)',             label: 'Assignment' },
    cert:       { icon: I.ribbon, color: 'oklch(0.78 0.16 85)',      label: 'Certificate' },
    session:    { icon: I.cap,    color: 'var(--brand-3)',           label: 'Session' },
    xp:         { icon: I.bolt,   color: 'var(--brand)',             label: 'XP' },
  };

  const activity = rawActivity || [];

  return (
    <PageScroll>
      <PageHeader eyebrow="Your learning activity" title="Feed" subtitle="Your completed sessions, quizzes, assignments, and achievements." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: SECT_MARGIN }}>
        <Card pad={false}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
          ) : activity.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>No activity yet — start learning to see your feed!</div>
          ) : activity.map(a => {
            const m = kindMeta[a.kind] || kindMeta.session;
            return (
              <div key={a.id} className="interactive-row" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px 18px', borderTop: '1px solid var(--border)' }}>
                <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 8, background: `color-mix(in oklch, ${m.color} 22%, transparent)`, color: m.color, border: `1px solid color-mix(in oklch, ${m.color} 40%, transparent)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{m.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Tag tone={a.kind === 'cert' ? 'good' : a.kind === 'quiz' ? 'accent' : 'neutral'}>{m.label}</Tag>
                    {a.xp > 0 && <span className="mono" style={{ fontSize: 11, color: 'var(--brand-3)', fontWeight: 600 }}>+{a.xp} XP</span>}
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>{a.text}</div>
                  {a.sub && <div className="mono" style={{ fontSize: 10.5, color: 'var(--brand-3)', marginTop: 4 }}>{a.sub}</div>}
                </div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{timeAgo(a.created_at)}</span>
              </div>
            );
          })}
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card style={{ padding: 14 }}>
            <SectionHead title="Summary" />
            {[
              { l: 'Total XP earned', v: (activity.reduce((s, a) => s + (a.xp || 0), 0)).toLocaleString() },
              { l: 'Sessions',        v: activity.filter(a => a.kind === 'session').length },
              { l: 'Quizzes',         v: activity.filter(a => a.kind === 'quiz').length },
              { l: 'Certificates',    v: activity.filter(a => a.kind === 'cert').length },
            ].map(s => (
              <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{s.l}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.v}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </PageScroll>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STARRED
   ═══════════════════════════════════════════════════════════════════════════ */
export function Starred() {
  const { add: toast } = useToast();

  const [starredItems, setStarredItems] = React.useState([]);
  const [courses, setCourses]           = React.useState([]);
  const [loading, setLoading]           = React.useState(true);

  React.useEffect(() => {
    const load = async () => {
      try {
        const [items, allCourses] = await Promise.all([
          API.getStarred().catch(() => []),
          API.getCourses().catch(() => []),
        ]);
        const slugs = (items || []).filter(i => i.item_type === 'course').map(i => i.item_id);
        const parsedCourses = (allCourses || []).map(c => ({
          ...c,
          tags: typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : (c.tags || []),
        }));
        setCourses(parsedCourses.filter(c => slugs.includes(c.slug)));
        setStarredItems(items || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const unstar = async (slug) => {
    setCourses(prev => prev.filter(c => c.slug !== slug));
    await API.removeStarred('course', slug).catch(() => {});
    toast(`Removed from starred`, 'info');
  };

  return (
    <PageScroll>
      <PageHeader eyebrow={`${courses.length} starred courses`} title="Starred" subtitle="Saved courses synced to your account." />
      <SectionHead title="Courses" />
      {loading ? (
        <div style={{ padding: 32, color: 'var(--muted)' }}>Loading…</div>
      ) : courses.length === 0 ? (
        <Card style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 16, color: 'var(--muted)' }}>No starred courses yet — star a course to save it here.</div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {courses.map(c => (
            <Card key={c.slug} pad={false} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="viz-placeholder" style={{ aspectRatio: '16 / 9', borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                <CoverVizSmall kind={['nodes', 'mesh', 'cube', 'speech'][Math.abs(c.slug.charCodeAt(0)) % 4]} />
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="display" style={{ fontSize: 15 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{c.blurb}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={c.author} size={20} />
                  <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{c.author}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="primary" size="sm" full onClick={() => API.enrollCourse(c.slug).then(() => toast(`Enrolled in "${c.title}"`, 'success')).catch(() => toast('Could not enroll', 'error'))}>Enroll</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => unstar(c.slug)}>★</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageScroll>
  );
}

function CoverVizSmall({ kind }) {
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
    </svg>);
  }
  if (kind === 'cube') {
    return (<svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <polygon points="120,60 180,40 240,60 180,80" fill="oklch(0.74 0.21 295 / 0.6)" stroke="oklch(0.78 0.16 195)" strokeWidth="1"/>
    </svg>);
  }
  return (<svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
    <rect x="50" y="50" width="100" height="50" rx="10" fill="oklch(0.74 0.21 295 / 0.5)" stroke="oklch(0.78 0.16 195)"/>
    <rect x="170" y="90" width="100" height="50" rx="10" fill="oklch(0.78 0.16 195 / 0.5)" stroke="oklch(0.74 0.21 295)"/>
  </svg>);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════════════════════════════════════════ */
export function Settings({ onLogout }) {
  const { add: toast } = useToast();
  const [activeTab, setActiveTab] = React.useState(() => localStorage.getItem('settings_tab') || 'api');
  React.useEffect(() => { localStorage.removeItem('settings_tab'); }, []);

  const { data: apiKeysData, loading: loadingKeys, reload: reloadKeys } = useApi(() => API.getApiKeys());
  const { data: profileData  } = useApi(() => API.getUserProfile());
  const { data: settingsData } = useApi(() => API.getUserSettings());
  const { data: routingData  } = useApi(() => API.getAgentRouting());

  const [showAddKey, setShowAddKey] = React.useState(null);
  const [newKey, setNewKey]         = React.useState('');
  const [newModel, setNewModel]     = React.useState('claude-haiku-4-5');
  const [theme, setTheme]           = React.useState('dark');
  const [density, setDensity]       = React.useState('regular');
  const [fontSize, setFontSize]     = React.useState(14);

  React.useEffect(() => {
    if (settingsData) {
      setTheme(settingsData.theme || 'dark');
      setDensity(settingsData.density || 'regular');
      setFontSize(settingsData.font_size || 14);
    }
  }, [settingsData]);

  const tabs = [
    { id: 'account',  label: 'Account',    icon: I.user },
    { id: 'api',      label: 'API keys',   icon: I.api },
    { id: 'agents',   label: 'Agents',     icon: I.spark },
    { id: 'theme',    label: 'Appearance', icon: I.bolt },
    { id: 'data',     label: 'Data',       icon: I.layers },
    { id: 'billing',  label: 'Billing',    icon: I.card },
  ];

  const handleAddKey = async (provider) => {
    if (!newKey.trim()) { toast('Please enter an API key', 'error'); return; }
    await API.createApiKey({ provider, encrypted_key: newKey, model: newModel, is_active: 1 }).catch(() => {});
    setNewKey(''); setNewModel('claude-haiku-4-5'); setShowAddKey(null);
    toast(`${provider} API key added`, 'success');
    reloadKeys();
  };

  const handleRemoveKey = async (id, provider) => {
    await API.deleteApiKey(id).catch(() => {});
    toast(`${provider} API key removed`, 'info');
    reloadKeys();
  };

  const handleSaveAccount = async () => {
    const nameInput = document.getElementById('settings-name');
    const name = nameInput?.value?.trim() || profileData?.name || '';
    try {
      await API.patchUserProfile({ name });
      toast('Account settings saved!', 'success');
    } catch {
      toast('Failed to save changes', 'error');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'account':
        return (
          <Card style={{ padding: 18 }}>
            <SectionHead title="Account Information" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><label className="cap" style={{ display: 'block', marginBottom: 6 }}>Display Name</label><input id="settings-name" defaultValue={profileData?.name || ''} style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 }} /></div>
              <div><label className="cap" style={{ display: 'block', marginBottom: 6 }}>Email</label><input defaultValue={profileData?.email || ''} disabled style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontSize: 13 }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Btn variant="primary" size="md" onClick={handleSaveAccount}>Save Changes</Btn>
              {onLogout && <Btn variant="outline" onClick={onLogout}>Sign out</Btn>}
            </div>
          </Card>
        );
      case 'api':
        return (
          <Card style={{ padding: 18 }}>
            <SectionHead title="LLM provider keys" subtitle="Stored encrypted server-side, used only during AI sessions." />
            {loadingKeys ? (
              <div style={{ padding: 24, color: 'var(--muted)' }}>Loading keys…</div>
            ) : (
              <>
                {(apiKeysData || []).map(k => (
                  <div key={k.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 120px 100px', gap: 14, padding: '12px 0', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{k.provider}</div>
                    <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{k.encrypted_key}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{k.model}</div>
                    <div style={{ textAlign: 'right' }}>
                      <Tag tone={k.is_active ? 'good' : 'neutral'}>{k.is_active ? 'active' : 'inactive'}</Tag>
                      <Btn variant="ghost" size="sm" onClick={() => handleRemoveKey(k.id, k.provider)} style={{ marginLeft: 4 }}>Remove</Btn>
                    </div>
                  </div>
                ))}
                {/* Add new key inline */}
                {showAddKey ? (
                  <div style={{ marginTop: 14, padding: 14, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div className="cap" style={{ marginBottom: 8 }}>Add API Key</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <select value={showAddKey} onChange={e => setShowAddKey(e.target.value)} style={{ padding: '8px 10px', background: 'var(--bg-window)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 }}>
                        {['anthropic', 'openai', 'gemini', 'mistral'].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <select value={newModel} onChange={e => setNewModel(e.target.value)} style={{ flex: 1, padding: '8px 10px', background: 'var(--bg-window)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 }}>
                        <option value="claude-haiku-4-5">claude-haiku-4-5</option>
                        <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
                        <option value="gpt-4o">gpt-4o</option>
                        <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="Enter your API key…" style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-window)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 }} />
                      <Btn variant="primary" size="sm" onClick={() => handleAddKey(showAddKey)}>Save</Btn>
                      <Btn variant="ghost" size="sm" onClick={() => { setShowAddKey(null); setNewKey(''); }}>Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <Btn variant="outline" size="md" style={{ marginTop: 14 }} onClick={() => setShowAddKey('anthropic')}>Add API key</Btn>
                )}
              </>
            )}
            <div style={{ marginTop: 14, padding: 12, background: 'oklch(0.78 0.16 75 / 0.10)', borderRadius: 8, border: '1px solid oklch(0.78 0.16 75 / 0.3)', display: 'flex', gap: 10 }}>
              <span style={{ color: 'var(--warn)' }}>{I.shield}</span>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>Keys are stored encrypted in the database and used only for AI session calls.</div>
            </div>
          </Card>
        );
      case 'agents':
        return (
          <Card style={{ padding: 18 }}>
            <SectionHead title="Per-agent routing" subtitle="Pick which model each agent uses." />
            {Object.entries(AGENTS).map(([code, a]) => {
              const route = (routingData || []).find(r => r.agent_code === code);
              return (
                <div key={code} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 160px', gap: 14, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AgentChip code={code} size={26} glow={false} />
                    <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{a.name}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{a.short}</div>
                  <select defaultValue={route?.model || 'claude-haiku-4-5'} onChange={async e => {
                    await API.patchAgentRouting(code, { model: e.target.value }).catch(() => {});
                    toast(`${a.name} → ${e.target.value}`, 'success');
                  }} style={{ appearance: 'none', height: 30, padding: '0 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--ink)', fontSize: 11.5 }}>
                    <option value="claude-haiku-4-5">claude-haiku-4-5</option>
                    <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                  </select>
                </div>
              );
            })}
          </Card>
        );
      case 'theme':
        return (
          <Card style={{ padding: 18 }}>
            <SectionHead title="Appearance" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div className="cap" style={{ marginBottom: 8 }}>Theme</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['dark', 'light'].map(t => (
                    <button key={t} onClick={() => { setTheme(t); document.documentElement.dataset.light = t === 'light' ? '1' : '0'; API.patchUserSettings({ theme: t }).catch(() => {}); toast(`Theme: ${t}`, 'success'); }} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${theme === t ? 'var(--accent-line)' : 'var(--border)'}`, background: theme === t ? 'var(--accent-soft)' : 'var(--surface)', color: theme === t ? 'oklch(0.82 0.18 295)' : 'var(--ink-2)', fontSize: 13, cursor: 'pointer' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="cap" style={{ marginBottom: 8 }}>Density</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['compact', 'regular', 'comfy'].map(d => (
                    <button key={d} onClick={() => { setDensity(d); document.documentElement.dataset.density = d; API.patchUserSettings({ density: d }).catch(() => {}); toast(`Density: ${d}`, 'success'); }} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${density === d ? 'var(--accent-line)' : 'var(--border)'}`, background: density === d ? 'var(--accent-soft)' : 'var(--surface)', color: density === d ? 'oklch(0.82 0.18 295)' : 'var(--ink-2)', fontSize: 13, cursor: 'pointer' }}>{d.charAt(0).toUpperCase() + d.slice(1)}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="cap" style={{ marginBottom: 8 }}>Font Size: {fontSize}px</div>
                <input type="range" min="12" max="18" step="1" value={fontSize} onChange={(e) => { const v = parseInt(e.target.value); setFontSize(v); API.patchUserSettings({ font_size: v }).catch(() => {}); }} style={{ width: 200, accentColor: 'oklch(0.74 0.21 295)' }} />
              </div>
            </div>
          </Card>
        );
      case 'data':
        return (
          <Card style={{ padding: 18 }}>
            <SectionHead title="Data" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                <div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Export all data</div><div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Download a complete backup</div></div>
                <Btn variant="outline" icon={I.download} onClick={async () => {
                  try {
                    const [profile, settings, keys, routing, agents] = await Promise.all([
                      API.getUserProfile().catch(() => ({})),
                      API.getUserSettings().catch(() => ({})),
                      API.getApiKeys().catch(() => []),
                      API.getAgentRouting().catch(() => []),
                      API.getAgents().catch(() => []),
                    ]);
                    const data = { profile, settings, api_keys: keys, agent_routing: routing, agents, exported_at: new Date().toISOString() };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob); const a = document.createElement('a');
                    a.href = url; a.download = 'learnos-data-export.json'; a.click(); URL.revokeObjectURL(url);
                    toast('Data exported', 'success');
                  } catch { toast('Export failed', 'error'); }
                }}>Export</Btn>
              </div>
              {onLogout && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                  <div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bad)' }}>Sign out</div><div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Sign out of your account</div></div>
                  <Btn variant="outline" onClick={onLogout}>Sign out</Btn>
                </div>
              )}
            </div>
          </Card>
        );
      case 'billing':
        return (
          <Card style={{ padding: 18 }}>
            <SectionHead title="Billing & Plan" />
            <div style={{ padding: 16, background: 'linear-gradient(135deg, oklch(0.18 0.03 295), oklch(0.15 0.025 270))', borderRadius: 12, border: '1px solid var(--accent-line)', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="cap" style={{ color: 'oklch(0.82 0.18 295)' }}>Current Plan</div>
                  <div className="display" style={{ fontSize: 24, color: 'var(--ink)', marginTop: 4 }}>Pro</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Free forever · Open-source</div>
                </div>
                <Tag tone="good">Active</Tag>
              </div>
            </div>
            <Btn variant="primary" full iconRight={I.arrowR} onClick={() => toast('You\'re on the free plan — all features included!', 'info')}>Current Plan: Free (All Features)</Btn>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <PageScroll>
      <PageHeader eyebrow="Account & preferences" title="Settings" subtitle="Manage your account, API keys, and appearance." />
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
        <Card pad={false} style={{ padding: 6, height: 'fit-content' }}>
          {tabs.map(s => (
            <button key={s.id} onClick={() => setActiveTab(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 0,
              background: activeTab === s.id ? 'var(--accent-soft)' : 'transparent',
              color: activeTab === s.id ? 'oklch(0.82 0.18 295)' : 'var(--ink-2)',
              borderRadius: 6, fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ width: 16, display: 'inline-flex' }}>{React.cloneElement(s.icon, { size: 14 })}</span>
              {s.label}
            </button>
          ))}
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {renderTabContent()}
        </div>
      </div>
    </PageScroll>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AGENTS PAGE — shows live agent statuses from DB
   ═══════════════════════════════════════════════════════════════════════════ */
// Where each agent actually acts in the product — shown so it's clear all 7
// are wired in, not just the Tutor (#19).
const AGENT_ROLE = {
  TU: 'Runs your tutoring sessions and answers questions',
  PR: 'Builds your learner profile from the intake',
  CR: 'Generates roadmaps and bundles courses',
  AS: 'Generates and grades assignments & quizzes',
  RE: 'Surfaces trusted resources for each module',
  AN: 'Summarizes sessions and tracks progress',
  CE: 'Issues certificates for verified courses',
};

export function AgentsPage({ setScreen }) {
  const { add: toast } = useToast();
  const [expandedAgent, setExpandedAgent] = React.useState(null);
  const { data: agentStatuses } = useApi(() => API.getAgents());
  const { data: activity } = useApi(() => API.getActivity());

  const statusMap = React.useMemo(() => {
    const m = {};
    (agentStatuses || []).forEach(a => { m[a.agent_code] = a; });
    return m;
  }, [agentStatuses]);

  // Real recent actions grouped by the agent that performed them.
  const byAgent = React.useMemo(() => {
    const m = {};
    (activity || []).forEach(e => { if (e.agent) { (m[e.agent] = m[e.agent] || []).push(e); } });
    return m;
  }, [activity]);

  return (
    <PageScroll>
      <PageHeader eyebrow="7 agents · multi-model" title="The Agent System" subtitle="A team of specialized AI agents working together to personalize and accelerate your learning."
        actions={<Btn variant="primary" size="md" icon={I.cog} onClick={() => { localStorage.setItem('settings_tab', 'agents'); setScreen ? setScreen('settings') : toast('Open Settings → Agents to configure routing', 'info'); }}>Agent routing settings</Btn>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {Object.entries(AGENTS).map(([code, a]) => {
          const acts = byAgent[code] || [];
          const hasActivity = acts.length > 0;
          const last = acts[0];
          return (
            <Card key={code} pad={false} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <AgentChip code={code} size={44} />
                <div style={{ flex: 1 }}>
                  <div className="display" style={{ fontSize: 16, color: 'var(--ink)' }}>{a.name} Agent</div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--brand-3)', marginTop: 2 }}>{acts.length} action{acts.length === 1 ? '' : 's'} logged</div>
                </div>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: hasActivity ? 'var(--good)' : 'var(--surface-3)', boxShadow: hasActivity ? '0 0 8px var(--good)' : 'none', animation: hasActivity ? 'lpulse 1.8s ease-in-out infinite' : 'none' }} />
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>{a.short}</div>
              <div style={{ padding: 10, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: 10 }}>
                <span style={{ color: a.color, marginTop: 2 }}>{React.cloneElement(I.spark, { size: 14 })}</span>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>{AGENT_ROLE[code] || `${a.name} Agent`}</div>
              </div>
              <Btn variant="outline" full onClick={() => setExpandedAgent(expandedAgent === code ? null : code)}>{expandedAgent === code ? 'Hide' : 'View'} Activity</Btn>
              {expandedAgent === code && (
                <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', animation: 'pageEnter var(--dur-fast) var(--ease-out)' }}>
                  <div className="cap" style={{ marginBottom: 8 }}>Recent activity</div>
                  {hasActivity ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {acts.slice(0, 5).map((e, i) => (
                        <div key={e.id || i} style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ minWidth: 0 }}>{e.text}</span>
                          <span className="mono" style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>{timeAgo(e.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>No actions yet — this agent will log work here as you use the related features.</div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </PageScroll>
  );
}

/* ── Feedback modal ────────────────────────────────────────────────────────── */

function CreateAssignmentModal({ onCreated }) {
  const { add: toast } = useToast();
  const { close: closeModal } = useModal();
  const [title, setTitle] = React.useState('');
  const [course, setCourse] = React.useState('');
  const [kind, setKind] = React.useState('homework');
  const [priority, setPriority] = React.useState('med');
  const [minutes, setMinutes] = React.useState(60);
  const [description, setDescription] = React.useState('');
  const [tasks, setTasks] = React.useState(['']);
  const [due, setDue] = React.useState(() => new Date(Date.now() + 7*86400000).toISOString().split('T')[0]);
  const [creating, setCreating] = React.useState(false);
  const inp = { width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 };

  const create = async () => {
    if (!title.trim() || !course.trim()) { toast('Title and course are required', 'error'); return; }
    setCreating(true);
    try {
      await API.createAssignment({
        title: title.trim(), course: course.trim(), kind, priority,
        estimated_minutes: Number(minutes) || 60,
        description: description.trim() || null,
        tasks: tasks.map(t => t.trim()).filter(Boolean),
        due_date: due || null,
      });
      closeModal(); onCreated && onCreated();
    } catch (e) { toast('Could not create assignment', 'error'); }
    finally { setCreating(false); }
  };

  return (
    <div>
      <h3 className="display" style={{ fontSize: 22, marginBottom: 6 }}>Create assignment</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>Build a project, quiz, or homework manually — useful when you want full control over the tasks.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><div className="cap" style={{ marginBottom: 4 }}>Title</div><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Implement softmax from scratch" style={inp} /></div>
        <div><div className="cap" style={{ marginBottom: 4 }}>Course</div><input value={course} onChange={e => setCourse(e.target.value)} placeholder="e.g. Deep Learning" style={inp} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><div className="cap" style={{ marginBottom: 4 }}>Kind</div><select value={kind} onChange={e => setKind(e.target.value)} style={inp}>{['homework','coding','project','quiz','analysis'].map(k => <option key={k} value={k}>{k}</option>)}</select></div>
        <div><div className="cap" style={{ marginBottom: 4 }}>Priority</div><select value={priority} onChange={e => setPriority(e.target.value)} style={inp}>{['low','med','high'].map(k => <option key={k} value={k}>{k}</option>)}</select></div>
        <div><div className="cap" style={{ marginBottom: 4 }}>Minutes</div><input type="number" value={minutes} onChange={e => setMinutes(e.target.value)} style={inp} /></div>
        <div><div className="cap" style={{ marginBottom: 4 }}>Due</div><input type="date" value={due} onChange={e => setDue(e.target.value)} style={inp} /></div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div className="cap" style={{ marginBottom: 4 }}>Description</div>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What is the learner producing? Why does it matter?" style={{ ...inp, minHeight: 80, fontFamily: 'inherit', resize: 'vertical' }} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <div className="cap" style={{ marginBottom: 4 }}>Tasks (checklist)</div>
        {tasks.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input value={t} onChange={e => setTasks(tasks.map((x, j) => j === i ? e.target.value : x))} placeholder={`Step ${i + 1}`} style={inp} />
            <button onClick={() => setTasks(tasks.length > 1 ? tasks.filter((_, j) => j !== i) : tasks)} style={{ padding: '0 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', cursor: 'pointer' }}>×</button>
          </div>
        ))}
        <button onClick={() => setTasks([...tasks, ''])} style={{ fontSize: 12, padding: '6px 10px', background: 'var(--surface-2)', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--ink-2)', cursor: 'pointer' }}>+ Add task</button>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="outline" onClick={closeModal}>Cancel</Btn>
        <Btn variant="primary" onClick={create} disabled={creating}>{creating ? 'Creating…' : 'Create assignment'}</Btn>
      </div>
    </div>
  );
}

function CreateCardsModal({ onCreated }) {
  const [deck, setDeck] = React.useState('General');
  const [cards, setCards] = React.useState([{ q: '', a: '' }]);
  const [creating, setCreating] = React.useState(false);
  const inp = { width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 };
  const addCard = () => setCards([...cards, { q: '', a: '' }]);
  const removeCard = (i) => setCards(cards.filter((_, j) => j !== i));
  const updateCard = (i, field, val) => { const nc = [...cards]; nc[i] = { ...nc[i], [field]: val }; setCards(nc); };
  return (
    <div style={{ minWidth: 480 }}>
      <h3 className="display" style={{ fontSize: 22, marginBottom: 6 }}>Create flashcards</h3>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Add cards to your spaced repetition deck.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="cap" style={{ display:'block', marginBottom:4 }}>Deck</label><input value={deck} onChange={e => setDeck(e.target.value)} placeholder="e.g. ML · Bias–Variance" style={inp} /></div>
        {cards.map((c, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div><label className="cap" style={{ display:'block', marginBottom:4 }}>Question</label><input value={c.q} onChange={e => updateCard(i, 'q', e.target.value)} placeholder="Question..." style={inp} /></div>
            <div><label className="cap" style={{ display:'block', marginBottom:4 }}>Answer</label><input value={c.a} onChange={e => updateCard(i, 'a', e.target.value)} placeholder="Answer..." style={inp} /></div>
            {cards.length > 1 && <Btn variant="ghost" size="sm" onClick={() => removeCard(i)} style={{ marginBottom: 2 }}>✕</Btn>}
          </div>
        ))}
        <Btn variant="outline" size="sm" onClick={addCard}>+ Add card</Btn>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="primary" disabled={!deck.trim() || cards.every(c => !c.q.trim())} onClick={async () => {
            setCreating(true);
            try {
              for (const c of cards) {
                if (c.q.trim() && c.a.trim()) {
                  await API.createFlashcard({ deck: deck.trim(), front: c.q.trim(), back: c.a.trim() });
                }
              }
              onCreated();
            } catch { toast('Could not create cards', 'error'); } finally { setCreating(false); }
          }}>{creating ? 'Creating...' : 'Create cards'}</Btn>
        </div>
      </div>
    </div>
  );
}

function FeedbackModal({ assignment: a }) {
  const feedbackTexts = {
    high: "Excellent work! Your solution demonstrates a strong understanding of the core concepts.",
    med: "Good effort! Your approach is correct but there are some areas for improvement.",
    low: "This needs more work. Please review the foundational concepts and try again.",
  };
  const level = (a.grade >= 85) ? 'high' : (a.grade >= 70) ? 'med' : 'low';
  return (
    <div>
      <h3 className="display" style={{ fontSize: 22, marginBottom: 4 }}>Feedback</h3>
      <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16 }}>{a.title} · Grade: {a.grade}%</div>
      <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16 }}>
        <div className="cap" style={{ marginBottom: 8, color: level === 'high' ? 'var(--good)' : level === 'med' ? 'var(--warn)' : 'var(--bad)' }}>
          {level === 'high' ? '★ Strong' : level === 'med' ? '● Satisfactory' : '○ Needs improvement'}
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65 }}>{feedbackTexts[level]}</p>
      </div>
      <Btn variant="outline" full onClick={() => { navigator?.clipboard?.writeText('Assignment: ' + a.title + '\nGrade: ' + a.grade + '%\n\nFeedback: ' + feedbackTexts[level]); toast('Feedback copied', 'success'); }}>Copy to clipboard</Btn>
    </div>
  );
}

/* ── Verification modal ────────────────────────────────────────────────────── */
function VerificationModal({ cert }) {
  const isVerified = cert.verified === undefined ? true : !!cert.verified;
  return (
    <div>
      <h3 className="display" style={{ fontSize: 22, marginBottom: 4 }}>Verify Certificate</h3>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Credential verification</div>
      <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, fontSize: 13 }}>
          <span style={{ color: 'var(--muted)' }}>ID</span><span className="mono" style={{ color: 'var(--ink)' }}>{cert.id_short || cert.id}</span>
          <span style={{ color: 'var(--muted)' }}>Title</span><span style={{ color: 'var(--ink)' }}>{cert.title}</span>
          <span style={{ color: 'var(--muted)' }}>Issued</span><span style={{ color: 'var(--ink)' }}>{cert.issued}</span>
          <span style={{ color: 'var(--muted)' }}>Mastery</span><span style={{ color: 'var(--ink)' }}>{Math.round((cert.mastery || 0) * 100)}%</span>
          <span style={{ color: 'var(--muted)' }}>Status</span><span style={{ color: isVerified ? 'var(--good)' : 'var(--muted)' }}>{isVerified ? 'Valid' : 'Unverified completion'}</span>
        </div>
      </div>
      {isVerified ? (
        <div style={{ padding: 12, background: 'oklch(0.78 0.16 155 / 0.10)', borderRadius: 8, border: '1px solid oklch(0.78 0.16 155 / 0.3)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: 'var(--good)', fontSize: 20 }}>✓</span>
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>This is a verified credential, issued by the LearnOS Certification Agent for a LearnOS-verified course.</span>
        </div>
      ) : (
        <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: 'var(--muted)', fontSize: 20 }}>○</span>
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>This is a completion record for a personal or community course that hasn't been LearnOS-verified. Only verified courses issue formal credentials.</span>
        </div>
      )}
    </div>
  );
}

/* ── Profile modal ────────────────────────────────────────────────────────── */
function ProfileModal({ name, contributions }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <Avatar name={name} size={56} />
        <div>
          <div className="display" style={{ fontSize: 20 }}>{name}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{contributions} contributions</div>
        </div>
      </div>
      <div style={{ padding: 14, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 12 }}>
        <div className="cap" style={{ marginBottom: 8 }}>Top areas</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Machine Learning', 'Deep Learning', 'Python'].map(t => <Tag key={t}>{t}</Tag>)}
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
        Active contributor in the LearnOS community. Focuses on machine learning course content and hands-on exercises.
      </div>
    </div>
  );
}
