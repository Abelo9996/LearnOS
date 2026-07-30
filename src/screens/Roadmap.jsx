import React from 'react';
import { I } from '../components/Icons';
import { Card, Btn, ProgressBar, Ring, Tag, Avatar, AgentChip, PageScroll, PageHeader, SectionHead } from '../components/UI';
// All roadmap data loaded from API
import API from '../api.js';
import { useToast, useModal } from '../App';
import QuizModal from '../components/QuizModal.jsx';

// Extract a YouTube video id so lecture videos embed inline (like the course
// lesson viewer) rather than opening in a new tab.
const youtubeId = (url) => {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
};

export default function Roadmap({ onOpenSession, onOpenCourse }) {
  const { add: toast } = useToast();
  const { open: openModal, close: closeModal } = useModal();
  const [allRoadmaps, setAllRoadmaps]   = React.useState([]);
  const [roadmap, setRoadmap]           = React.useState(null);
  const [loading, setLoading]          = React.useState(true);
  const [view, setView]                 = React.useState('graph');
  const [selected, setSelected]         = React.useState(null);
  const [generating, setGenerating]    = React.useState(false);
  // B-02: Track node IDs that were just inserted by AN for highlighting
  const [highlightedIds, setHighlightedIds] = React.useState([]);

  const loadAllRoadmaps = React.useCallback(async () => {
    try {
      const rows = await API.getRoadmaps();
      setAllRoadmaps(rows || []);
      return rows;
    } catch { return []; }
  }, []);

  const loadRoadmap = React.useCallback(async (id) => {
    setLoading(true);
    try {
      const full = await API.getRoadmap(id);
      setRoadmap(full);
      const active = full.nodes?.find(n => n.status === 'active') || full.nodes?.find(n => n.status === 'next') || full.nodes?.[0];
      setSelected(active ? active.id : null);
      // B-02: Check for replanned nodes (source === 'replan') and highlight them
      const replanned = (full.nodes || []).filter(n => n.source === 'replan').map(n => n.id);
      if (replanned.length > 0) {
        setHighlightedIds(replanned);
        setSelected(replanned[0]);
        toast(`Curriculum agent inserted ${replanned.length} remediation node(s) based on your recent sessions.`, 'info');
        setTimeout(() => setHighlightedIds([]), 10000);
      }
    } catch { toast('Could not load roadmap', 'error'); } finally {
      setLoading(false);
    }
  }, [toast]);

  // B-02: Refetch roadmap when returning from a session that triggered replan
  React.useEffect(() => {
    const checkReplan = () => {
      const flag = localStorage.getItem('learnos_replanned');
      if (flag) {
        localStorage.removeItem('learnos_replanned');
        if (roadmap?.id) loadRoadmap(roadmap.id);
      }
    };
    checkReplan();
    window.addEventListener('focus', checkReplan);
    return () => window.removeEventListener('focus', checkReplan);
  }, [roadmap?.id, loadRoadmap]);

  // Initial load runs exactly once. The guard matters: this effect's deps
  // include loadRoadmap (which depends on the unstable `toast`), so without it
  // the effect re-runs, and the second run reads the already-consumed handoff
  // → falls back to rows[0], clobbering the roadmap the user actually clicked.
  const didInit = React.useRef(false);
  React.useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    (async () => {
      setLoading(true);
      const rows = await loadAllRoadmaps();
      if (!rows || rows.length === 0) { setLoading(false); return; }
      let targetId = null;
      try { targetId = localStorage.getItem('learnos_active_roadmap'); localStorage.removeItem('learnos_active_roadmap'); } catch {}
      const picked = (targetId && rows.some(r => r.id === targetId)) ? targetId : rows[0].id;
      await loadRoadmap(picked);
    })();
  }, [loadAllRoadmaps, loadRoadmap]);

  const handleGenerate = async ({ goal, level, hours, type }) => {
    closeModal();
    setGenerating(true);
    try {
      await API.postIntake({ goal, answers: { level, time_per_week: Number(hours) || 5 } }).catch(() => {});
      if (type === 'pathway') {
        // Course pathway (specialization): a sequence of whole courses from A to
        // B, with a placement diagnostic. Planning takes longer than a concept map.
        const { jobId } = await API.planSpecialization({ goal, level });
        let result = null;
        for (let i = 0; i < 120; i++) {
          await new Promise(r => setTimeout(r, 1000));
          const job = await API.getJob(jobId).catch(() => null);
          if (job?.status === 'done') { result = job.result; break; }
          if (job?.status === 'failed') throw new Error(job.error || 'Pathway planning failed');
        }
        if (!result?.roadmap_id) throw new Error('Pathway planning timed out');
        await loadAllRoadmaps();
        await loadRoadmap(result.roadmap_id);
        toast(`Pathway planned · ${result.courses} courses toward "${goal}"${result.diagnosticQuestions ? ' — take the placement diagnostic to skip what you already know' : ''}`, 'success');
      } else {
        const { jobId } = await API.genRoadmap(goal);
        let result = null;
        for (let i = 0; i < 40; i++) {
          await new Promise(r => setTimeout(r, 700));
          const job = await API.getJob(jobId).catch(() => null);
          if (job?.status === 'done') { result = job.result; break; }
          if (job?.status === 'failed') throw new Error(job.error || 'Generation failed');
        }
        if (!result?.roadmapId) throw new Error('Generation timed out');
        await loadAllRoadmaps();
        await loadRoadmap(result.roadmapId);
        toast(
          result.source === 'ai'
            ? `Roadmap generated by the Curriculum agent · ${result.nodeCount} modules`
            : `Roadmap created (offline template — add an API key for AI) · ${result.nodeCount} modules`,
          'success'
        );
      }
    } catch (e) {
      const msg = e.message || 'Could not generate roadmap';
      toast(/key|NO_KEY/i.test(msg) && type === 'pathway'
        ? 'Course pathways need an AI key (Settings → API Keys). A Concept map works offline.'
        : msg, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteRoadmap = async () => {
    if (!roadmap) return;
    if (!confirm(`Delete roadmap "${roadmap.title}"? Its modules and progress are removed. Past sessions are kept as history.`)) return;
    try {
      await API.deleteRoadmap(roadmap.id);
      toast('Roadmap deleted', 'info');
      const rows = await loadAllRoadmaps();
      if (rows && rows.length > 0) await loadRoadmap(rows[0].id);
      else { setRoadmap(null); setLoading(false); }
    } catch { toast('Could not delete roadmap', 'error'); }
  };

  // F-09: Delete node handler
  const handleDeleteNode = React.useCallback(async (nodeId) => {
    if (!roadmap?.id) return;
    try {
      await API.deleteRoadmapNode(roadmap.id, nodeId);
      toast('Node deleted', 'info');
      loadRoadmap(roadmap.id);
    } catch { toast('Could not delete node', 'error'); }
  }, [roadmap?.id, loadRoadmap, toast]);

  // Listen for delete events from ModuleDetail
  React.useEffect(() => {
    const handler = (e) => handleDeleteNode(e.detail.nodeId);
    window.addEventListener('roadmap-delete-node', handler);
    return () => window.removeEventListener('roadmap-delete-node', handler);
  }, [handleDeleteNode]);

  if (!roadmap && !loading) return (
    <PageScroll>
      <div style={{ padding: '72px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {React.cloneElement(I.graph, { size: 26 })}
        </span>
        <div className="display" style={{ fontSize: 22, color: 'var(--ink)' }}>Start your first roadmap</div>
        <div style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 420, lineHeight: 1.6 }}>
          Tell the Curriculum agent what you want to master and it will design a
          personalized path of modules, from fundamentals to advanced.
        </div>
        {generating ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <span style={{ display: 'inline-flex', gap: 5 }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--brand)', animation: `lpulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink)' }}>The Curriculum agent is designing your roadmap…</span>
          </div>
        ) : (
          <Btn variant="primary" size="md" icon={I.spark} onClick={() => openModal(<GenerateModal onGenerate={handleGenerate} onCancel={closeModal} />)}>
            Generate a roadmap
          </Btn>
        )}
      </div>
    </PageScroll>
  );
  if (!roadmap) return null;
  const r = roadmap;

  // Normalize nodes from DB (col/row_idx) vs static data (col/row)
  const nodes = (r.nodes || []).map(n => ({
    ...n,
    row: n.row ?? n.row_idx ?? 0,
    col: n.col ?? 0,
  }));

  const sel = nodes.find(n => n.id === selected) || nodes.find(n => n.status === 'active') || nodes[0];

  const openNodeSession = async (node) => {
    const n = node || sel;
    if (!n) return;
    if (n.status === 'locked') {
      toast(`"${n.title}" is locked — complete prerequisites first.`, 'info');
      return;
    }
    try {
      const sessions = await API.getSessions().catch(() => []);
      let target = (sessions || []).find(s => s.roadmap_node_id === n.id);
      if (!target) {
        const res = await API.createSession({
          title: n.title,
          subtitle: `Module from ${r.title}`,
          roadmap_id: r.id,
          roadmap_node_id: n.id,
          agent: 'TU',
          course: r.title,
          level: 'Intermediate',
        });
        target = res.session || res;
        const objs = n.objectives?.length
          ? `\n\nIn this module we'll work through:\n${n.objectives.map(o => `- ${o}`).join('\n')}`
          : '';
        const greeting = {
          role: 'agent', agent: 'TU', kind: 'text',
          body: `Welcome to **${n.title}**. I'm your Tutor agent for this module.${objs}\n\nAsk me anything, request a quiz, or ask for worked examples and trusted sources to begin.`,
        };
        await API.postMessage(target.id, greeting).catch(() => {});
      }
      localStorage.setItem('learnos_active_session', target.id);
      toast(n.status === 'done' ? `Reviewing "${n.title}"` : `Opening "${n.title}"`, 'success');
      onOpenSession();
    } catch {
      toast('Could not open session', 'error');
    }
  };
  const handleResume = () => openNodeSession(sel);

  if (loading) {
    return (
      <PageScroll>
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>Loading roadmap…</div>
      </PageScroll>
    );
  }

  return (
    <PageScroll>
      {allRoadmaps.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="cap" style={{ marginBottom: 8 }}>Your roadmaps · {allRoadmaps.length}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {allRoadmaps.map(rm => {
              const on = rm.id === r.id;
              return (
                <button key={rm.id} onClick={() => loadRoadmap(rm.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                  border: `1px solid ${on ? 'var(--accent-line)' : 'var(--border)'}`,
                  background: on ? 'var(--accent-soft)' : 'var(--surface)',
                  color: on ? 'var(--ink)' : 'var(--ink-2)',
                }}>
                  <span style={{ width: 24, height: 24, borderRadius: 6, background: rm.color || 'var(--brand)', opacity: 0.85, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.16 0.02 270)', flexShrink: 0 }}>{React.cloneElement(I[rm.icon] || I.box, { size: 13 })}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.2 }}>{rm.title}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{Math.round((rm.mastery || 0) * 100)}% · {rm.completed_modules || 0}/{rm.total_modules || 0}</div>
                  </div>
                </button>
              );
            })}
            <button onClick={() => openModal(<GenerateModal onGenerate={handleGenerate} onCancel={closeModal} />)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
              border: '1px dashed var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 12.5, fontWeight: 600,
            }}>
              {React.cloneElement(I.plus, { size: 13 })} New roadmap
            </button>
          </div>
        </div>
      )}
      <PageHeader
        eyebrow={`Roadmap · ${r.title}`}
        title={r.title}
        subtitle={r.subtitle || `${r.total_modules || 0} modules · ${r.completed_modules || 0} completed`}
        actions={
          <>
            <ViewToggle view={view} setView={setView} />
            <Btn variant="ghost" onClick={() => openModal(
              <EditRoadmapModal roadmap={r} onCancel={closeModal} onSaved={() => { closeModal(); loadAllRoadmaps(); loadRoadmap(r.id); toast('Roadmap updated', 'success'); }} />
            )}>Rename</Btn>
            <Btn variant="ghost" style={{ color: 'var(--bad)' }} onClick={handleDeleteRoadmap}>Delete</Btn>
            <Btn variant="outline" icon={I.spark} onClick={() => openModal(<GenerateModal onGenerate={handleGenerate} onCancel={closeModal} />)}>Generate</Btn>
            <Btn variant="outline" icon={I.plus} onClick={() => openModal(<AddNodeModal roadmapId={r.id} nodes={nodes} onAdded={() => { closeModal(); loadRoadmap(r.id); toast('Node added!', 'success'); }} onCancel={closeModal} />)}>Add node</Btn>
            <Btn variant="primary" size="md" icon={I.play} onClick={handleResume}>
              {sel?.status === 'active' ? `Resume · ${sel.title}` : sel?.status === 'locked' ? 'Locked' : sel?.status === 'next' ? `Start · ${sel.title}` : 'Resume'}
            </Btn>
          </>
        }
      />
      {generating && (
        <Card style={{ padding: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--accent-line)' }}>
          <span style={{ display: 'inline-flex', gap: 5 }}>
            {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--brand)', animation: `ldot 1s ease-in-out ${i * 0.15}s infinite` }} />)}
          </span>
          <span style={{ fontSize: 13, color: 'var(--ink)' }}>The Curriculum agent is designing your roadmap…</span>
        </Card>
      )}
      {/* Placement diagnostic — a pathway starts where the learner actually is,
          so surface it until they have demonstrated (completed) something. */}
      {r.kind === 'specialization' && r.placement_json && nodes.length > 0 && !nodes.some(n => n.status === 'done') && (
        <Card style={{ padding: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14, border: '1px solid var(--accent-line)' }}>
          <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {React.cloneElement(I.check, { size: 18 })}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Find your starting point</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>A short diagnostic checks what you already know — courses you can demonstrate get skipped.</div>
          </div>
          <Btn variant="primary" size="md" onClick={() => openModal(
            <PlacementModal roadmapId={r.id} onCancel={closeModal} onDone={(res) => {
              closeModal();
              toast(res.skipped > 0
                ? `Placement complete — ${res.skipped} course(s) skipped, starting at "${res.startNode}"`
                : `Placement complete — starting from the beginning`, 'success');
              loadRoadmap(r.id);
            }} />
          )}>Take the diagnostic</Btn>
        </Card>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <RoadmapStat icon={I.book}     label="Modules"     value={`${r.completed_modules ?? r.completedModules ?? 0}/${r.total_modules ?? r.totalModules ?? 0}`} sub="completed"        color="var(--brand)" />
        <RoadmapStat icon={I.bolt}     label="Mastery"     value={`${Math.round((r.mastery || 0) * 100)}%`}                                                        sub="weighted average" color="var(--brand-3)" />
        <RoadmapStat icon={I.flame}    label="In progress" value={`${nodes.filter(n => n.status === 'active' || n.status === 'next').length}`}                     sub="active + up next" color="oklch(0.75 0.18 45)" />
        <RoadmapStat icon={I.shield}   label="Locked"      value={`${nodes.filter(n => n.status === 'locked').length}`}                                            sub="prereqs pending"  color="var(--muted)" />
      </div>
      <Card pad={false}>
        {nodes.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 6 }}>This roadmap has no modules yet.</div>
            <div style={{ fontSize: 13 }}>Use <strong style={{ color: 'var(--brand)' }}>Generate</strong> to have the Curriculum agent design the path.</div>
          </div>
        ) : (
          <>
            {view === 'graph'  && <RoadmapGraph  nodes={nodes} edges={r.edges || []} selected={selected} setSelected={setSelected} highlightedIds={highlightedIds} />}
            {view === 'list'   && <ModuleList    nodes={nodes} selected={selected}   setSelected={setSelected} onResume={openNodeSession} toast={toast} highlightedIds={highlightedIds} />}
            {view === 'kanban' && <Kanban        nodes={nodes} selected={selected} setSelected={setSelected} />}
          </>
        )}
      </Card>
      {sel && nodes.length > 0 && <ModuleDetail node={sel} nodes={nodes} edges={r.edges || []} onOpenSession={handleResume} toast={toast} openModal={openModal} closeModal={closeModal} onMasteryChange={() => loadRoadmap(r.id)} onOpenCourse={onOpenCourse} />}
    </PageScroll>
  );
}

function GenerateModal({ onGenerate, onCancel }) {
  const [goal, setGoal] = React.useState('');
  const [level, setLevel] = React.useState('beginner');
  const [hours, setHours] = React.useState(5);
  const [type, setType] = React.useState('pathway');
  const inp = { width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 };
  const submit = () => { if (goal.trim()) onGenerate({ goal: goal.trim(), level, hours, type }); };
  const TYPES = [
    { id: 'pathway', title: 'Course pathway', desc: 'A sequence of full courses from where you are to your goal, with a placement diagnostic. Needs an AI key.' },
    { id: 'concept', title: 'Concept map',    desc: 'A lightweight graph of topics with tutor sessions and quizzes. Works offline.' },
  ];
  return (
    <div style={{ minWidth: 440, maxWidth: 520 }}>
      <h3 className="display" style={{ fontSize: 22, marginBottom: 6 }}>Generate a roadmap</h3>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Tell the Curriculum agent what you want to master — it designs an ordered path for you.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="cap" style={{ display: 'block', marginBottom: 4 }}>What do you want to master?</label>
          <input autoFocus value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. Reinforcement learning, Rust, music theory…" style={inp}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
        </div>
        <div>
          <label className="cap" style={{ display: 'block', marginBottom: 4 }}>Roadmap type</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {TYPES.map(t => {
              const on = type === t.id;
              return (
                <button key={t.id} onClick={() => setType(t.id)} style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  border: `1px solid ${on ? 'var(--accent-line)' : 'var(--border)'}`,
                  background: on ? 'var(--accent-soft)' : 'var(--surface)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.45 }}>{t.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="cap" style={{ display: 'block', marginBottom: 4 }}>Your level</label>
            <select value={level} onChange={e => setLevel(e.target.value)} style={inp}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className="cap" style={{ display: 'block', marginBottom: 4 }}>Hours / week</label>
            <select value={hours} onChange={e => setHours(e.target.value)} style={inp}>
              {[2, 5, 8, 12, 20].map(h => <option key={h} value={h}>{h} hours</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Btn variant="outline" onClick={onCancel}>Cancel</Btn>
          <Btn variant="primary" icon={I.spark} onClick={submit}>Generate roadmap</Btn>
        </div>
      </div>
    </div>
  );
}

function EditRoadmapModal({ roadmap, onSaved, onCancel }) {
  const [title, setTitle] = React.useState(roadmap.title || '');
  const [subtitle, setSubtitle] = React.useState(roadmap.subtitle || '');
  const [saving, setSaving] = React.useState(false);
  const inp = { width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 };
  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await API.patchRoadmap(roadmap.id, { title: title.trim(), subtitle: subtitle.trim() });
      onSaved();
    } catch { setSaving(false); }
  };
  return (
    <div style={{ minWidth: 440 }}>
      <h3 className="display" style={{ fontSize: 22, marginBottom: 14 }}>Rename roadmap</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="cap" style={{ display: 'block', marginBottom: 4 }}>Title</label>
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} style={inp} onKeyDown={e => { if (e.key === 'Enter') save(); }} />
        </div>
        <div>
          <label className="cap" style={{ display: 'block', marginBottom: 4 }}>Subtitle</label>
          <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Optional description" style={inp} onKeyDown={e => { if (e.key === 'Enter') save(); }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Btn variant="outline" onClick={onCancel}>Cancel</Btn>
          <Btn variant="primary" disabled={!title.trim() || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Btn>
        </div>
      </div>
    </div>
  );
}

function PlacementModal({ roadmapId, onDone, onCancel }) {
  const [questions, setQuestions] = React.useState(null);
  const [answers, setAnswers] = React.useState({});
  const [submitting, setSubmitting] = React.useState(false);
  React.useEffect(() => {
    API.getPlacement(roadmapId)
      .then(r => setQuestions(r?.questions || []))
      .catch(() => setQuestions([]));
  }, [roadmapId]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const arr = questions.map((_, i) => (answers[i] ?? -1));
      const res = await API.submitPlacement(roadmapId, arr);
      onDone(res);
    } catch {
      setSubmitting(false);
    }
  };

  if (questions === null) return <div style={{ minWidth: 440, padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading diagnostic…</div>;
  if (questions.length === 0) return (
    <div style={{ minWidth: 440 }}>
      <div style={{ padding: 12, color: 'var(--muted)', fontSize: 13 }}>This pathway has no placement diagnostic.</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Btn variant="outline" onClick={onCancel}>Close</Btn></div>
    </div>
  );
  const answered = Object.keys(answers).length;
  return (
    <div style={{ minWidth: 480, maxWidth: 560 }}>
      <h3 className="display" style={{ fontSize: 22, marginBottom: 4 }}>Placement diagnostic</h3>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
        Answer what you can — courses you already demonstrate get marked done, and the pathway starts where you actually are. Skipping a question just counts it as "not yet".
      </div>
      <div className="scroll" style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 6 }}>
        {questions.map((q, i) => (
          <div key={i}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>{i + 1}. {q.question}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              {(q.choices || []).map((c, k) => {
                const on = answers[i] === k;
                return (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, border: `1px solid ${on ? 'var(--accent-line)' : 'var(--border)'}`, background: on ? 'var(--accent-soft)' : 'var(--surface)', color: on ? 'var(--ink)' : 'var(--ink-2)' }}>
                    <input type="radio" name={`pq-${i}`} checked={on} onChange={() => setAnswers(a => ({ ...a, [i]: k }))} style={{ accentColor: 'var(--brand)' }} />
                    {c}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{answered}/{questions.length} answered</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="outline" onClick={onCancel}>Cancel</Btn>
          <Btn variant="primary" disabled={submitting} onClick={submit}>{submitting ? 'Scoring…' : 'Submit'}</Btn>
        </div>
      </div>
    </div>
  );
}

function RoadmapStat({ icon, label, value, sub, color }) {
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

function ViewToggle({ view, setView }) {
  const opts = [{ id: 'graph', label: 'Graph' }, { id: 'list', label: 'Modules' }, { id: 'kanban', label: 'Kanban' }];
  return (
    <div style={{ display: 'inline-flex', padding: 3, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
      {opts.map((o) => {
        const on = view === o.id;
        return (
          <button key={o.id} onClick={() => setView(o.id)} style={{ height: 30, padding: '0 12px', border: 0, background: on ? 'var(--bg-window)' : 'transparent', color: on ? 'var(--ink)' : 'var(--muted)', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, boxShadow: on ? 'var(--shadow-sm)' : 'none', transition: 'all var(--dur-fast)' }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function RoadmapGraph({ nodes, edges, selected, setSelected, highlightedIds = [] }) {
  // Layout scales to the actual graph: a fixed 5-column grid rendered nodes in
  // deeper columns (e.g. manually added ones) off the right edge of the canvas.
  const maxCol = Math.max(0, ...nodes.map(n => n.col || 0));
  const maxRow = Math.max(0, ...nodes.map(n => n.row || 0));
  const W = 1080, H = Math.max(380, 220 + maxRow * 150), padX = 90, padY = 80;
  const colW = maxCol > 0 ? (W - padX * 2) / maxCol : 0;
  const rowH = maxRow > 0 ? (H - padY * 2) / maxRow : 0;
  const pos = (n) => ({
    x: maxCol > 0 ? padX + (n.col || 0) * colW : W / 2,
    y: maxRow > 0 ? padY + (n.row || 0) * rowH : H / 2,
  });

  return (
    <div style={{ padding: '18px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Concept graph</div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', display: 'flex', gap: 14 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--good)' }} />done</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--brand)', boxShadow: '0 0 6px var(--brand)' }} />active</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--surface-3)' }} />locked</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="rmEdgeActive" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.78 0.16 195)"/>
            <stop offset="100%" stopColor="oklch(0.74 0.21 295)"/>
          </linearGradient>
        </defs>
        {edges.map(([a, b], i) => {
          const na = nodes.find(n => n.id === a);
          const nb = nodes.find(n => n.id === b);
          if (!na || !nb) return null;
          const pa = pos(na), pb = pos(nb);
          const isDone   = na.status === 'done' && (nb.status === 'done' || nb.status === 'active');
          const isActive = na.status === 'active' || nb.status === 'active';
          const stroke   = isDone || isActive ? 'url(#rmEdgeActive)' : 'var(--border)';
          const dash     = nb.status === 'locked' ? '4 4' : undefined;
          const dx = (pb.x - pa.x) * 0.4;
          const d  = `M ${pa.x + 32} ${pa.y} C ${pa.x + dx} ${pa.y}, ${pb.x - dx} ${pb.y}, ${pb.x - 32} ${pb.y}`;
          return <path key={i} d={d} stroke={stroke} strokeWidth={isActive ? 2 : 1.2} fill="none" strokeDasharray={dash} opacity={nb.status === 'locked' ? 0.5 : 1} />;
        })}
        {nodes.map((n) => {
          const p = pos(n);
          const on       = n.id === selected;
          const isDone   = n.status === 'done';
          const isActive = n.status === 'active';
          const isLocked = n.status === 'locked';
          const isHighlighted = highlightedIds.includes(n.id);
          const fill   = isDone ? 'var(--good)' : isActive ? 'oklch(0.74 0.21 295)' : n.status === 'next' ? 'var(--surface-2)' : 'var(--surface)';
          const stroke = isDone ? 'var(--good)' : isActive ? 'oklch(0.78 0.16 195)' : n.status === 'next' ? 'var(--brand)' : 'var(--border)';
          return (
            <g key={n.id} onClick={() => setSelected(n.id)} style={{ cursor: 'pointer' }}>
              {on       && <circle cx={p.x} cy={p.y} r={42} fill="var(--accent-soft)" />}
              {isActive && <circle cx={p.x} cy={p.y} r={36} fill="none" stroke="oklch(0.78 0.16 195 / 0.4)" strokeWidth="1" />}
              {isHighlighted && <circle cx={p.x} cy={p.y} r={48} fill="none" stroke="oklch(0.78 0.16 85)" strokeWidth="2" strokeDasharray="4 3">
                <animateTransform attributeName="transform" type="rotate" from={`0 ${p.x} ${p.y}`} to={`360 ${p.x} ${p.y}`} dur="8s" repeatCount="3" />
              </circle>}
              <circle cx={p.x} cy={p.y} r={26} fill={fill} stroke={stroke} strokeWidth={isActive ? 2 : 1.2} />
              {isDone   && <path d={`M ${p.x - 7} ${p.y} L ${p.x - 2} ${p.y + 5} L ${p.x + 8} ${p.y - 6}`} stroke="oklch(0.16 0.02 270)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
              {isActive && <text x={p.x} y={p.y + 4} textAnchor="middle" fontFamily="var(--font-display)" fontSize="13" fontWeight="700" fill="oklch(0.16 0.02 270)">{Math.round((n.mastery || 0) * 100)}</text>}
              {!isDone && !isActive && <text x={p.x} y={p.y + 4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fontWeight="600" fill={isLocked ? 'var(--faint)' : 'var(--brand)'}>{Math.round((n.mastery || 0) * 100)}</text>}
              <text x={p.x} y={p.y + 50} textAnchor="middle" fontFamily="var(--font-body)" fontSize="11.5" fontWeight={on ? 600 : 500} fill={isLocked ? 'var(--faint)' : 'var(--ink-2)'}>{n.title}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ModuleList({ nodes, selected, setSelected, onResume, toast, highlightedIds = [] }) {
  return (
    <div>
      <div className="cap" style={{ display: 'grid', gridTemplateColumns: '40px 1fr 110px 200px 100px', gap: 12, padding: '10px 22px', borderBottom: '1px solid var(--border)' }}>
        <div>#</div><div>Module</div><div>Status</div><div>Mastery</div><div></div>
      </div>
      {nodes.map((n, i) => {
        const on = n.id === selected;
        const isHighlighted = highlightedIds.includes(n.id);
        return (
          <div key={n.id} onClick={() => setSelected(n.id)} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 110px 200px 100px', gap: 12, padding: '12px 22px', alignItems: 'center', borderTop: '1px solid var(--border)', background: on ? 'var(--accent-soft)' : isHighlighted ? 'oklch(0.78 0.16 85 / 0.08)' : 'transparent', cursor: 'pointer', transition: 'background var(--dur-fast)' }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{String(i+1).padStart(2,'0')}</div>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: on ? 600 : 500 }}>
              {n.title}
              {isHighlighted && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'oklch(0.78 0.16 85 / 0.2)', color: 'oklch(0.78 0.16 85)', border: '1px solid oklch(0.78 0.16 85 / 0.4)' }}>Suggested by AN</span>}
            </div>
            <div>
              {n.status === 'done'   && <Tag tone="good">DONE</Tag>}
              {n.status === 'active' && <Tag tone="accent">ACTIVE</Tag>}
              {n.status === 'next'   && <Tag tone="cyan">NEXT</Tag>}
              {n.status === 'locked' && <Tag>LOCKED</Tag>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}><ProgressBar value={n.mastery || 0} height={4} /></div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', width: 36, textAlign: 'right' }}>{Math.round((n.mastery || 0) * 100)}%</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {(n.status === 'active' || n.status === 'next') && <Btn variant="primary" size="sm" iconRight={React.cloneElement(I.play, { size: 12 })} onClick={(e) => { e.stopPropagation(); onResume(n); }}>{n.status === 'active' ? 'Resume' : 'Start'}</Btn>}
              {n.status === 'locked' && <Btn variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toast('Complete prerequisites to unlock', 'info'); }}>Locked</Btn>}
              {n.status === 'done'   && <Btn variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onResume(n); }}>Review</Btn>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Kanban({ nodes, selected, setSelected }) {
  const cols = [
    { id: 'done',   label: 'Done',        filter: (n) => n.status === 'done' },
    { id: 'active', label: 'In progress', filter: (n) => n.status === 'active' || n.status === 'next' },
    { id: 'locked', label: 'Locked',      filter: (n) => n.status === 'locked' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 18 }}>
      {cols.map((c) => {
        const cards = nodes.filter(c.filter);
        return (
          <div key={c.id} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: 12 }}>
            <div className="cap" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span>{c.label}</span>
              <span className="mono" style={{ color: 'var(--faint)' }}>{cards.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cards.map((n) => (
                <div key={n.id} onClick={() => setSelected && setSelected(n.id)} className="hover-lift" style={{ padding: '10px 12px', background: 'var(--bg-window)', border: `1px solid ${selected === n.id ? 'var(--accent-line)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{n.title}</div>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1 }}><ProgressBar value={n.mastery || 0} height={3} /></div>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{Math.round((n.mastery || 0) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModuleDetail({ node, nodes = [], edges = [], onOpenSession, toast, openModal, closeModal, onMasteryChange, onOpenCourse }) {
  const isActive = node.status === 'active';
  const isLocked = node.status === 'locked';
  const isDone   = node.status === 'done';
  const isNext   = node.status === 'next';
  const prereqs = (edges || [])
    .filter(e => (Array.isArray(e) ? e[1] : e.to_node) === node.id)
    .map(e => nodes.find(n => n.id === (Array.isArray(e) ? e[0] : e.from_node)))
    .filter(Boolean);

  const [resources, setResources] = React.useState([]);
  const [proposing, setProposing] = React.useState(false);
  const [lesson, setLesson] = React.useState(null);
  const [building, setBuilding] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    setResources([]); setLesson(null);
    setBuilding(node.build_status === 'building');
    API.getNodeResources(node.id).then(r => { if (alive) setResources(r || []); }).catch(() => {});
    API.getNodeLesson(node.id).then(l => { if (alive) setLesson(l?.body_md || null); }).catch(() => {});
    return () => { alive = false; };
  }, [node.id, node.build_status]);

  // Pathway nodes are whole courses, planned up front and built on demand.
  const isCourseNode = node.node_kind === 'course';
  const buildCourse = async () => {
    setBuilding(true);
    try {
      const res = await API.buildPathwayCourse(node.roadmap_id, node.id);
      if (res.alreadyBuilt) { onMasteryChange && onMasteryChange(); setBuilding(false); return; }
      toast && toast('Building this course — a full syllabus takes a few minutes…', 'info');
      for (let i = 0; i < 200; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const j = await API.getJob(res.jobId).catch(() => null);
        if (j?.status === 'done') {
          toast && toast('Course ready — opening it', 'success');
          onMasteryChange && onMasteryChange();
          if (j.result?.slug && onOpenCourse) onOpenCourse(j.result.slug);
          setBuilding(false);
          return;
        }
        if (j?.status === 'failed') {
          toast && toast(j.error || 'Course build failed (an AI key is required)', 'error');
          onMasteryChange && onMasteryChange();
          setBuilding(false);
          return;
        }
      }
      toast && toast('Still building — the course will appear on this node when done', 'info');
    } catch (e) {
      toast && toast(e.message || 'Could not build course', 'error');
      setBuilding(false);
    }
  };
  const proposeMore = async () => {
    setProposing(true);
    try {
      const { jobId } = await API.proposeNodeResources(node.id);
      toast && toast('Research agent is proposing and verifying resources… (this can take ~30s)', 'info');
      let done = false;
      for (let i = 0; i < 30 && !done; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const j = await API.getJob(jobId).catch(() => null);
        if (!j) continue;
        if (j.status === 'done' || j.status === 'failed') {
          done = true;
          if (j.status === 'failed') toast && toast(j.error || 'Resource proposal failed (no API key?)', 'error');
        }
      }
      // Only ever show VERIFIED resources. Proposals verify asynchronously, so
      // keep polling the verified list while the verifier jobs land.
      let count = -1;
      for (let i = 0; i < 10; i++) {
        const r = await API.getNodeResources(node.id).catch(() => []);
        setResources(r || []);
        if ((r || []).length === count && i > 2) break; // stable — verifiers done
        count = (r || []).length;
        await new Promise(res => setTimeout(res, 2000));
      }
    } catch { toast && toast('Could not propose resources', 'error'); }
    finally { setProposing(false); }
  };
  return (
    <Card pad={false} style={{ marginTop: 16 }}>
      <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="cap" style={{ marginBottom: 4 }}>{node.status === 'done' ? 'Completed' : isActive ? 'Active module' : isLocked ? 'Locked module' : isNext ? 'Up next' : 'Module'}</div>
          <div className="display" style={{ fontSize: 22, marginTop: 4 }}>{node.title}</div>
          {node.objectives?.length > 0 ? (
            <div style={{ marginTop: 10 }}>
              <div className="cap" style={{ marginBottom: 6 }}>Learning objectives</div>
              <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {node.objectives.map((o, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{o}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.55 }}>
              {isLocked ? 'Complete prerequisite modules to unlock this topic.' : isNext ? 'Start this module when you are ready to continue your learning path.' : isActive ? 'You are currently studying this module. Resume your session to continue.' : 'Master this topic to build towards the next module.'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {(isActive || isNext) && <Btn variant="primary" size="md" icon={I.play} onClick={onOpenSession}>{isActive ? 'Resume session' : 'Start session'}</Btn>}
          {isDone && <Btn variant="outline" size="md" onClick={onOpenSession}>Review</Btn>}
          {node.course_slug && onOpenCourse && (
            <Btn variant="outline" size="md" icon={React.cloneElement(I.book, { size: 15 })} onClick={() => onOpenCourse(node.course_slug)}>
              Study content
            </Btn>
          )}
          {isCourseNode && !node.course_slug && !isLocked && (
            <Btn variant="outline" size="md" icon={React.cloneElement(I.spark, { size: 15 })} disabled={building} onClick={buildCourse}>
              {building ? 'Building course…' : 'Build course'}
            </Btn>
          )}
          {!isLocked && openModal && (
            <Btn variant="outline" size="md" icon={React.cloneElement(I.check, { size: 15 })}
              onClick={() => openModal(<QuizModal nodeId={node.id} title={node.title} onClose={closeModal} onDone={() => onMasteryChange && onMasteryChange()} />)}>
              Take quiz
            </Btn>
          )}
          {isLocked && <Btn variant="ghost" size="md" onClick={() => toast('Complete prerequisites to unlock this module', 'info')}>Locked</Btn>}
          {/* F-09: Delete node button (not for done/active nodes to prevent accidental data loss) */}
          {!isActive && !isDone && (
            <Btn variant="ghost" size="md" icon={I.trash || I.x} onClick={() => {
              if (confirm(`Delete "${node.title}" from this roadmap? This cannot be undone.`)) {
                // Need access to onDelete — handled via parent
                window.dispatchEvent(new CustomEvent('roadmap-delete-node', { detail: { nodeId: node.id } }));
              }
            }} style={{ color: 'var(--bad)' }}>Delete</Btn>
          )}
        </div>
      </div>
      {lesson && (
        <div style={{ padding: '20px 20px 0', borderBottom: '1px solid var(--border)' }}>
          <div className="cap" style={{ marginBottom: 8 }}>Lesson</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.65, paddingBottom: 16, whiteSpace: 'pre-wrap' }}>
            {lesson.split('\n').map((line, i) => {
              if (line.startsWith('### ')) return <h4 key={i} style={{ fontSize: 14, color: 'var(--ink)', margin: '14px 0 6px' }}>{line.slice(4)}</h4>;
              if (line.startsWith('## '))  return <h3 key={i} style={{ fontSize: 16, color: 'var(--ink)', margin: '18px 0 8px' }}>{line.slice(3)}</h3>;
              if (line.startsWith('# '))   return <h2 key={i} style={{ fontSize: 18, color: 'var(--ink)', margin: '20px 0 10px' }}>{line.slice(2)}</h2>;
              if (line.startsWith('- ') || /^\d+\. /.test(line)) return <div key={i} style={{ marginLeft: 14, lineHeight: 1.7 }}>{line.replace(/^\*\*([^*]+)\*\*/, (_, t) => t)}</div>;
              if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
              return <p key={i} style={{ margin: '4px 0' }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>') }} />;
            })}
          </div>
        </div>
      )}
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div className="cap" style={{ marginBottom: 6 }}>Mastery</div>
            <Ring value={node.mastery || 0} size={64} sw={6} color="var(--brand)" label={`${Math.round((node.mastery || 0) * 100)}%`} />
          </div>
          <div style={{ flex: 1, marginLeft: 16 }}>
            <ProgressBar value={node.mastery || 0} height={8} />
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
              {isDone ? 'Module completed' : isActive ? 'Currently studying' : isLocked ? 'Not yet unlocked' : isNext ? 'Ready to start' : 'In progress'}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 18 }}>
          <div>
            <div className="cap" style={{ marginBottom: 8 }}>Prerequisites</div>
            {prereqs.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>None — you can start this any time.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {prereqs.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-2)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: p.status === 'done' ? 'var(--good)' : 'var(--surface-3)', flexShrink: 0 }} />
                    {p.title}
                    {p.status === 'done' && <span className="mono" style={{ fontSize: 10, color: 'var(--good)' }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="cap" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AgentChip code="RE" size={16} glow={false} /> Trusted resources
              <span style={{ flex: 1 }} />
              {!isLocked && (
                <button onClick={proposeMore} disabled={proposing} style={{ fontSize: 10.5, padding: '2px 8px', background: proposing ? 'var(--surface-2)' : 'var(--brand)', color: proposing ? 'var(--muted)' : 'oklch(0.16 0.02 270)', border: 0, borderRadius: 6, cursor: proposing ? 'wait' : 'pointer', fontWeight: 600 }}>
                  {proposing ? 'Researching…' : '+ Propose more'}
                </button>
              )}
            </div>
            {isLocked ? (
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                Complete prerequisites — the Research agent will assemble vetted resources once this module unlocks.
              </div>
            ) : resources.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                No verified resources yet. Click <em>Propose more</em> to ask the Research agent — you'll need an OpenRouter key configured in Settings.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {resources.slice(0, 10).map(r => {
                  const KM = { video: ['oklch(0.7 0.19 25)', 'video'], paper: ['oklch(0.72 0.18 295)', 'paper'], book: ['oklch(0.76 0.15 85)', 'book'], blog: ['oklch(0.72 0.16 330)', 'blog'], article: ['oklch(0.74 0.16 155)', 'article'], website: ['oklch(0.72 0.15 220)', 'site'], docs: ['oklch(0.74 0.16 200)', 'docs'], repo: ['oklch(0.68 0.02 270)', 'repo'] };
                  const [c, label] = KM[r.kind] || KM.article;
                  const vid = youtubeId(r.url);
                  const badge = (
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>
                      {r.source}
                      {r.status === 'verified' && <span style={{ marginLeft: 6, color: 'var(--good)' }}>✓ verified</span>}
                      {r.status === 'proposed' && <span style={{ marginLeft: 6, color: 'oklch(0.74 0.18 80)' }}>· unverified</span>}
                    </div>
                  );
                  // Lecture videos embed inline; everything else stays a rich link card.
                  if (vid) {
                    return (
                      <div key={r.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000' }}>
                          <iframe src={`https://www.youtube-nocookie.com/embed/${vid}`} title={r.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
                        </div>
                        <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span className="mono" style={{ fontSize: 9.5, padding: '2px 6px', borderRadius: 4, background: `color-mix(in oklch, ${c} 18%, transparent)`, color: c, textTransform: 'uppercase', fontWeight: 600, flexShrink: 0, marginTop: 1, letterSpacing: '0.04em' }}>{label}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.35 }}>{r.title}</div>
                            {badge}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                       style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none', color: 'var(--ink)', transition: 'all 0.15s' }}
                       onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.background = 'var(--surface-3)'; }}
                       onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface-2)'; }}>
                      <span className="mono" style={{ fontSize: 9.5, padding: '2px 6px', borderRadius: 4, background: `color-mix(in oklch, ${c} 18%, transparent)`, color: c, textTransform: 'uppercase', fontWeight: 600, flexShrink: 0, marginTop: 1, letterSpacing: '0.04em' }}>{label}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.35 }}>{r.title}</div>
                        {badge}
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// F-09: Add node modal
function AddNodeModal({ roadmapId, nodes, onAdded, onCancel }) {
  const [title, setTitle] = React.useState('');
  const [objective, setObjective] = React.useState('');
  const [objectives, setObjectives] = React.useState([]);
  const [submitting, setSubmitting] = React.useState(false);
  // Preselect the deepest node so consecutive adds chain into a connected path
  // instead of floating unconnected in the graph.
  const deepest = nodes.length ? nodes.reduce((a, b) => ((b.col || 0) > (a.col || 0) ? b : a)) : null;
  const [prereqs, setPrereqs] = React.useState(deepest ? [deepest.id] : []);
  const togglePrereq = (id) => setPrereqs(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const inp = { width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 };
  const addObj = () => { if (objective.trim()) { setObjectives(o => [...o, objective.trim()]); setObjective(''); } };
  const removeObj = (i) => setObjectives(o => o.filter((_, idx) => idx !== i));
  const submit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      // Place the node one column after its deepest prerequisite, stacked
      // below any nodes already in that column.
      const chosen = nodes.filter(n => prereqs.includes(n.id));
      const col = chosen.length ? Math.max(...chosen.map(n => n.col || 0)) + 1 : undefined;
      const row = col !== undefined ? nodes.filter(n => (n.col || 0) === col).length : undefined;
      await API.createRoadmapNode(roadmapId, { title: title.trim(), objectives, prereqs, col, row });
      onAdded();
    } catch { /* parent shows toast */ }
    finally { setSubmitting(false); }
  };
  return (
    <div style={{ minWidth: 440 }}>
      <h3 className="display" style={{ fontSize: 22, marginBottom: 6 }}>Add module</h3>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Add a new module to this roadmap. It will be placed at the end of the path.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="cap" style={{ display: 'block', marginBottom: 4 }}>Module title</label>
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Attention mechanisms" style={inp} onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
        </div>
        <div>
          <label className="cap" style={{ display: 'block', marginBottom: 4 }}>Learning objectives (optional)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={objective} onChange={e => setObjective(e.target.value)} placeholder="e.g. Understand self-attention" style={{ ...inp, flex: 1 }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addObj(); } }} />
            <Btn variant="outline" size="sm" onClick={addObj}>Add</Btn>
          </div>
          {objectives.length > 0 && (
            <ul style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {objectives.map((o, i) => (
                <li key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {o}
                  <button onClick={() => removeObj(i)} style={{ background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', padding: 0, fontSize: 14 }}>×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {nodes.length > 0 && (
          <div>
            <label className="cap" style={{ display: 'block', marginBottom: 4 }}>Connects after (prerequisites)</label>
            <div className="scroll" style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {nodes.map(n => (
                <label key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, color: prereqs.includes(n.id) ? 'var(--ink)' : 'var(--ink-2)', background: prereqs.includes(n.id) ? 'var(--accent-soft)' : 'transparent' }}>
                  <input type="checkbox" checked={prereqs.includes(n.id)} onChange={() => togglePrereq(n.id)} style={{ accentColor: 'var(--brand)' }} />
                  {n.title}
                </label>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>The new module is drawn after these in the concept graph and unlocks once they are mastered.</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Btn variant="outline" onClick={onCancel}>Cancel</Btn>
          <Btn variant="primary" disabled={!title.trim() || submitting} onClick={submit}>{submitting ? 'Adding…' : 'Add module'}</Btn>
        </div>
      </div>
    </div>
  );
}
