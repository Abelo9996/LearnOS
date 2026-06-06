import React from 'react';
import { I } from '../components/Icons';
import { Card, Btn, ProgressBar, Tag, Avatar, AgentChip } from '../components/UI';
import { AGENTS } from '../data/data';
import API from '../api';
// LLM calls go through /api/ai/chat
import { useToast } from '../App';
import { useUser } from '../UserContext.jsx';
import MarkdownText from '../components/Markdown';

export default function Session({ setScreen }) {
  const { add: toast } = useToast();
  const user = useUser();
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [vizTab, setVizTab] = React.useState('notes');
  const [complexity, setComplexity] = React.useState(0.45);
  const [sessionEnded, setSessionEnded] = React.useState(false);
  const [session, setSession] = React.useState(null);
  const [noKeyBanner, setNoKeyBanner] = React.useState(false);
  const scrollerRef = React.useRef(null);

  // Load existing session or show empty state
  React.useEffect(() => {
    const normalize = (sessData) => {
      const rawMsgs = sessData?.messages || [];
      setMessages(rawMsgs.map(m2 => ({
        ...m2,
        agent: m2.agent || m2.agent_code || 'TU',
        kind: m2.kind || 'text',
      })));
      if (sessData?.status === 'completed') setSessionEnded(true);
    };
    const initSession = async () => {
      try {
        // If a roadmap (or schedule) handed us a specific session, open THAT one.
        const handoffId = localStorage.getItem('learnos_active_session');
        if (handoffId) {
          localStorage.removeItem('learnos_active_session');
          const sessData = await API.getSession(handoffId).catch(() => null);
          if (sessData && sessData.id) {
            setSession(sessData);
            normalize(sessData);
            return;
          }
        }
        const sessions = await API.getSessions();
        if (sessions && sessions.length > 0) {
          // Use the most recent session
          const s = sessions[0];
          setSession(s);
          const sessData = await API.getSession(s.id);
          normalize(sessData);
        }
        // If no sessions, session stays null — parent shows empty state
      } catch {
        // API failure — stay at null (empty state)
      }
    };
    initSession();
  }, []);

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const submit = async (text) => {
    if (sessionEnded) { toast('Session has ended. Start a new session from the Roadmap.', 'info'); return; }
    if (!session) return;
    const t = (text ?? input).trim();
    if (!t) return;

    const userMsg = { role: 'user', kind: 'text', body: t };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setThinking(true);

    // Save user message to API
    if (session.id && session.id !== 'local') {
      try { await API.postMessage(session.id, userMsg); } catch {}
    }

    const sessionContextObj = session ? {
      text: `Session: ${session.title}\nCourse: ${session.course || 'General'}\nLevel: ${session.level || 'Intermediate'}`,
      nodeId: session.roadmap_node_id || null,
    } : { text: 'General tutoring session', nodeId: null };

    let replyBody = null;
    let replyAgent = 'TU';
    let replyKind = 'text';

    // Try real LLM call via API
    let usedFallback = false;
    try {
      const convHistory = messages
        .filter(m => m.role === 'user' || (m.role === 'agent' && m.kind === 'text'))
        .slice(-10)
        .map(m => (m.role === 'user' ? 'Learner' : 'Tutor') + ': ' + (m.body || ''))
        .join('\n');
      const chatRes = await API.postChat({
        messages: convHistory + '\nLearner: ' + t,
        sessionContext: sessionContextObj,
      });
      replyBody = chatRes.text || chatRes.ok && chatRes.text;
      if (!replyBody) throw new Error('Empty response');
      replyAgent = 'TU';
    } catch (err) {
      // Topic-aware offline fallback. Uses the current session, NOT a hardcoded example.
      usedFallback = true;
      const lower = t.toLowerCase();
      const topic = (session && session.title) || 'this module';
      const course = (session && session.course) || 'this course';
      const level  = (session && session.level)  || 'intermediate';
      if (lower.includes('quiz') || lower.includes('test') || lower.includes('assess')) {
        replyAgent = 'AS';
        try {
          const { quiz } = await API.generateQuiz({ node_id: session?.roadmap_node_id || null });
          replyKind = 'quiz';
          if (quiz?.questions?.length) {
            const Q = quiz.questions[0];
            const ids = ['a', 'b', 'c', 'd'];
            window.__learnos_dynamic_quiz = {
              prompt: Q.q,
              options: (Q.options || []).map((txt, i) => ({
                id: ids[i] || String(i),
                text: txt,
                verdict: i === Q.correct ? 'right' : 'wrong',
                feedback: i === Q.correct ? (Q.why || 'Correct.') : `Not quite. ${Q.why || ''}`.trim(),
              })),
            };
          } else { window.__learnos_dynamic_quiz = null; }
        } catch {
          replyKind = 'quiz';
          window.__learnos_dynamic_quiz = null;
        }
      } else if (lower.includes('cite') || lower.includes('source') || lower.includes('paper') || lower.includes('read')) {
        replyAgent = 'RE';
        let resources = [];
        try {
          if (session && session.roadmap_node_id) {
            resources = await API.getNodeResources(session.roadmap_node_id).catch(() => []);
          }
        } catch {}
        if (resources && resources.length) {
          const lines = resources.slice(0, 5).map(r => `• [${r.title}](${r.url}) — *${r.source || r.kind}*`).join('\n');
          replyBody = `Verified resources for **${topic}**:\n\n${lines}`;
        } else {
          replyBody = `I don't have verified sources for **${topic}** yet. Add an Anthropic key in Settings to let the Research agent propose and verify resources for this module.`;
        }
      } else if (lower.includes('example') || lower.includes('real') || lower.includes('show')) {
        replyBody = `For a real example of **${topic}**, I'd normally walk you through a concrete case. To generate one tailored to *${course}* at the *${level}* level, add an Anthropic key in Settings — I'll then produce a worked example, not a canned one.`;
      } else if (lower.includes('summary') || lower.includes('recap')) {
        replyBody = `Here's a recap framework for **${topic}**:\n\n1. The core idea this module covers\n2. Why it matters in *${course}*\n3. The pitfalls people commonly run into\n4. How it connects to what comes next\n\nFor a personalized recap drawn from our conversation, configure your Anthropic key in Settings.`;
      } else {
        replyBody = `I can help you explore **${topic}** at the *${level}* level. Try asking for an example, a quiz, a recap, or sources — or configure your Anthropic key in Settings for full conversational tutoring.`;
      }
      // Show the no-key banner once per session.
      if (!localStorage.getItem('learnos_nokey_banner_dismissed')) {
        setNoKeyBanner(true);
      }
    }

    const reply = replyKind === 'quiz'
      ? { role: 'agent', agent: replyAgent, kind: 'quiz', quiz: (window.__learnos_dynamic_quiz || null) }
      : { role: 'agent', agent: replyAgent, kind: 'text', body: replyBody };

    setMessages((m) => [...m, reply]);
    setThinking(false);

    // Save agent reply to API
    if (session.id && session.id !== 'local') {
      try { await API.postMessage(session.id, reply); } catch {}
    }
  };

  const handleEndSession = async () => {
    setSessionEnded(true);
    if (session && session.id && session.id !== 'local') {
      try {
        await API.patchSession(session.id, { status: 'completed', mastery_score: 1 });
        const placeholder = { role: 'agent', agent: 'AN', kind: 'text', body: `**Session Summary — ${session.title || 'Module'}**\n\n_The Analytics agent is reviewing your session…_` };
        setMessages(m => [...m, placeholder]);
        toast('Session completed · mastery updated · +25 XP', 'success');

        let analysisResult = null;
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 1500));
          const a = await API.getSessionAnalysis(session.id).catch(() => null);
          if (a && (a.status === 'done' || a.status === 'failed')) { analysisResult = a; break; }
        }
        let summaryBody;
        if (analysisResult?.result?.summary) {
          const r = analysisResult.result;
          const lines = [r.summary];
          if (r.objectives?.length) {
            lines.push('\n**Per-objective mastery:**');
            r.objectives.forEach(o => lines.push(`- ${o.objective} — **${Math.round((o.mastery || 0) * 100)}%**`));
          }
          if (r.weak_areas?.length) {
            lines.push(`\n**Revisit:** ${r.weak_areas.slice(0,3).join(' · ')}`);
            lines.push('Extra spaced-review cards have been queued for these areas.');
          }
          // B-02: If AN inserted remediation nodes, notify and flag for roadmap refetch
          if (r.replanned && r.inserted_node_ids?.length) {
            lines.push(`\n🔄 The Curriculum agent inserted ${r.inserted_node_ids.length} remediation node(s) into your roadmap.`);
            try { localStorage.setItem('learnos_replanned', '1'); } catch {}
          }
          summaryBody = `**Session Summary — ${session.title || 'Module'}**\n\n${lines.join('\n')}`;
        } else {
          const userQs = messages.filter(m => m.role === 'user' && m.kind === 'text');
          summaryBody = `**Session Summary — ${session.title || 'Module'}**\n\n- Exchanged ${userQs.length} question${userQs.length === 1 ? '' : 's'} with the Tutor.\n- Module marked complete — mastery updated and next module unlocked.\n- Try a spaced-review session in a few days to lock it in.`;
        }
        setMessages(m => m.map(x => x === placeholder ? { ...x, body: summaryBody } : x));
      } catch { toast('Session ended', 'info'); }
    } else {
      toast('Session ended', 'info');
    }
  };

  const handleNewSession = async () => {
    try {
      const newSess = await API.createSession({
        title: 'New Session',
        subtitle: '',
        agent: 'TU',
      });
      setSession(newSess);
      const welcomeMsg = { role: 'agent', agent: 'TU', kind: 'text', body: `Welcome! I'm your Tutor Agent. What would you like to explore first?` };
      setMessages([welcomeMsg]);
      await API.postMessage(newSess.id, welcomeMsg);
    } catch {
      // Fallback: start an offline session
      setSession({ id: 'local', title: 'Offline Session', status: 'active' });
      setMessages([{ role: 'agent', agent: 'TU', kind: 'text', body: `Welcome! I'm your Tutor Agent. What would you like to explore first?` }]);
    }
    setInput('');
    setThinking(false);
    setSessionEnded(false);
    setVizTab('visualizer');
    setComplexity(0.45);
  };

  const handleExportSession = () => {
    const text = messages.map(m => {
      const who = m.role === 'user' ? user.name : `${AGENTS[m.agent]?.name || m.agent} Agent`;
      return `[${who}]\n${m.body || ''}`;
    }).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'session-transcript.txt'; a.click();
    URL.revokeObjectURL(url);
    toast('Transcript downloaded.', 'success');
  };

  const handleAction = (label) => {
    if (label === 'Ask follow-up') {
      document.querySelector('.chat-composer-input')?.focus();
      toast('Type your follow-up question below', 'info');
    } else if (label === 'Generate quiz') {
      submit('Can you quiz me on this?');
    } else if (label === 'Explain simpler') {
      submit('Can you rephrase your last response at a beginner level, with a simple analogy?');
    } else if (label === 'Show examples') {
      submit('Can you show me a real example for this topic?');
    } else if (label === 'Export session') {
      handleExportSession();
    }
  };

  // F-01: If no session is active, render empty state with CTA to roadmaps
  if (!session) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
          <div className="display" style={{ fontSize: 24, color: 'var(--ink)', marginBottom: 8 }}>No active session</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
            Pick a roadmap node to start a tutoring session, or create a new session from your roadmaps.
          </div>
          <Btn variant="primary" onClick={() => setScreen && setScreen('roadmaps')}>
            Go to Roadmaps
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <SessionHeader onEndSession={handleEndSession} onAction={handleAction} sessionEnded={sessionEnded} onNewSession={handleNewSession} session={session} />
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr) 280px', gap: 16, padding: '0 20px 20px' }}>
        <ChatColumn scrollerRef={scrollerRef} messages={messages} thinking={thinking} input={input} setInput={setInput} submit={submit} sessionEnded={sessionEnded} session={session} noKeyBanner={noKeyBanner} dismissBanner={() => { localStorage.setItem('learnos_nokey_banner_dismissed', '1'); setNoKeyBanner(false); }} setScreen={setScreen} user={user} />
        <VisualizerColumn vizTab={vizTab} setVizTab={setVizTab} complexity={complexity} setComplexity={setComplexity} session={session} />
        <RightRail onExport={handleExportSession} setScreen={setScreen} session={session} />
      </div>
    </div>
  );
}

function SessionHeader({ onEndSession, onAction, sessionEnded, onNewSession, session }) {
  const title    = session?.title || 'Session';
  const subtitle = session?.subtitle || '';
  const course   = session?.course || '';
  const level    = session?.level || '';
  const idx      = session?.session_index || '';
  const total    = session?.total_sessions || '';
  return (
    <div style={{ padding: '20px 32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', rowGap: 10 }}>
            <h1 className="display" style={{ fontSize: 32, lineHeight: 1.05, color: 'var(--ink)', margin: 0, fontWeight: 600 }}>{title}</h1>
            {!sessionEnded ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: 'oklch(0.78 0.16 155 / 0.14)', color: 'var(--good)', border: '1px solid oklch(0.78 0.16 155 / 0.4)', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--good)', boxShadow: '0 0 6px var(--good)', animation: 'lpulse 1.6s ease-in-out infinite' }} />
                Live Session
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                Ended
              </span>
            )}
          </div>
          {subtitle && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10, maxWidth: 640 }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {!sessionEnded && (
            <Btn variant="outline" icon={<span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--bad)' }} />} onClick={onEndSession}>End Session</Btn>
          )}
          {sessionEnded && (
            <Btn variant="primary" icon={I.play} onClick={onNewSession}>New Session</Btn>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {course && <MetaPill label="Course" value={course} />}
        {level && <MetaPill label="Level" value={level} />}
        {idx && total && <MetaPill label="Session" value={`${idx} of ${total}`} />}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {[{ icon: I.spark, label: 'Ask follow-up' }, { icon: I.check, label: 'Generate quiz' }, { icon: I.book, label: 'Explain simpler' }, { icon: I.plus, label: 'Show examples' }, { icon: I.upload, label: 'Export session' }].map((a) => (
          <SessionAction key={a.label} icon={a.icon} label={a.label} onClick={() => onAction(a.label)} />
        ))}
      </div>
    </div>
  );
}

function MetaPill({ label, value, live }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {live && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--bad)', animation: 'lpulse 1.4s ease-in-out infinite' }} />}
      {label && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{label}:</span>}
      <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>{value}</span>
    </span>
  );
}

function SessionAction({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', height: 34, borderRadius: 8,
      background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-2)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
      transition: 'all var(--dur-fast) var(--ease-smooth)',
    }}>
      <span style={{ color: 'var(--brand)' }}>{React.cloneElement(icon, { size: 15 })}</span>
      {label}
    </button>
  );
}

function ChatColumn({ scrollerRef, messages, thinking, input, setInput, submit, sessionEnded, session, noKeyBanner, dismissBanner, setScreen, user }) {
  return (
    <Card pad={false} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {noKeyBanner && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'oklch(0.74 0.18 80 / 0.12)', borderBottom: '1px solid oklch(0.74 0.18 80 / 0.3)', color: 'var(--ink-2)', fontSize: 12.5 }}>
          <span style={{ flex: 1 }}>Offline mode — replies are generic. Add an Anthropic key in Settings for real conversational tutoring.</span>
          <button onClick={() => setScreen && (localStorage.setItem('settings_tab', 'keys'), setScreen('settings'))} style={{ padding: '4px 10px', fontSize: 11.5, fontWeight: 600, background: 'var(--brand)', color: 'oklch(0.16 0.02 270)', border: 0, borderRadius: 6, cursor: 'pointer' }}>Add key</button>
          <button onClick={dismissBanner} title="Dismiss" style={{ padding: '4px 8px', background: 'transparent', color: 'var(--muted)', border: 0, cursor: 'pointer', fontSize: 14 }}>×</button>
        </div>
      )}
      <div ref={scrollerRef} className="scroll" style={{ flex: 1, padding: '20px 22px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {messages.map((m, i) => <ChatMessage key={i} m={m} session={session} user={user} />)}
          {thinking && (
            <div>
              <ChatHeader code="TU" t="typing" />
              <div style={{ marginLeft: 42, display: 'flex', gap: 4, alignItems: 'center', height: 22 }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--brand)', animation: `ldot 1s ease-in-out ${i * 0.15}s infinite` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <Composer input={input} setInput={setInput} submit={() => submit()} sessionEnded={sessionEnded} session={session} />
    </Card>
  );
}

function ChatHeader({ code, t }) {
  const agent = AGENTS[code] || { name: 'Unknown' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <AgentChip code={code} size={30} />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{agent.name} Agent</span>
      <Tag tone="accent">AI</Tag>
      {t && <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{t}</span>}
    </div>
  );
}


function ChatMessage({ m, session, user }) {
  const { add: toast } = useToast();
  if (m.role === 'user') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{m.t || ''}</span>
          <Avatar name={user.name} size={26} hue={295} />
        </div>
        <div style={{ maxWidth: '82%', padding: '10px 14px', background: 'var(--brand-grad)', color: 'oklch(0.16 0.02 270)', borderRadius: 14, borderTopRightRadius: 4, fontSize: 13.5, lineHeight: 1.5, fontWeight: 500 }}><MarkdownText text={m.body} /></div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <IconBtn icon={I.copy} title="Copy" onClick={() => { navigator?.clipboard?.writeText(m.body); toast('Copied to clipboard', 'success'); }} />
          <IconBtn icon="👍" title="Like" onClick={async () => {
            if (session && session.id && session.id !== 'local' && m.id) {
              try { await API.patchMessage(session.id, m.id, { user_rating: 1 }); } catch {}
            }
            toast('Thanks for the feedback!', 'success');
          }} />
          <IconBtn icon="👎" title="Dislike" onClick={async () => {
            if (session && session.id && session.id !== 'local' && m.id) {
              try { await API.patchMessage(session.id, m.id, { user_rating: -1 }); } catch {}
            }
            toast('Feedback recorded. We\'ll improve.', 'info');
          }} />
        </div>
      </div>
    );
  }
  if (m.kind === 'quiz') {
    if (!m.quiz) return null; // F-01: no QUIZ fallback — render nothing
    return <QuizCard q={m.quiz} />;
  }
  if (m.kind === 'viz' && m.vizKind === 'tradeoff-trio') {
    return (
      <div>
        <ChatHeader code={m.agent} t={m.t} />
        <div style={{ marginLeft: 42 }}>
          {m.body && <div style={{ marginBottom: 10 }}><MarkdownText text={m.body} /></div>}
          <TradeoffTrio />
        </div>
      </div>
    );
  }
  return (
    <div>
      <ChatHeader code={m.agent} t={m.t} />
      <div style={{ marginLeft: 42 }}><MarkdownText text={m.body} /></div>
    </div>
  );
}

function IconBtn({ icon, title, onClick }) {
  return (
    <button title={title} onClick={onClick} style={{
      width: 24, height: 24, borderRadius: 6, border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 13,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all var(--dur-fast)',
    }}>
      {typeof icon === 'string' ? icon : React.cloneElement(icon, { size: 13 })}
    </button>
  );
}

function TradeoffTrio() {
  const W = 480, H = 180;
  const cells = [
    { title: 'High Bias', sub: '(Underfitting)', kind: 'under' },
    { title: 'Optimal Balance', sub: '', kind: 'good' },
    { title: 'High Variance', sub: '(Overfitting)', kind: 'over' },
  ];
  const N = 24;
  const rng = (i) => Math.sin(i * 13.37) * 10000 % 1;
  const pts = Array.from({ length: N }, (_, i) => {
    const x = i / (N - 1);
    const noise = (rng(i) - 0.5) * 0.16;
    const y = 0.6 - 0.65 * (x - 0.55) ** 2 + noise;
    return { x, y };
  });
  return (
    <Card pad={false} style={{ padding: 16, background: 'var(--surface)' }}>
      <div className="display" style={{ fontSize: 14, marginBottom: 4 }}>Bias–Variance Tradeoff</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 10 }}>
        {cells.map((c) => (
          <div key={c.title}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>{c.title}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{c.sub}</div>
            <svg viewBox="0 0 180 110" style={{ width: '100%', marginTop: 6 }}>
              <line x1="14" y1="100" x2="14" y2="6" stroke="var(--border-strong)" strokeWidth="0.7"/>
              <line x1="14" y1="100" x2="172" y2="100" stroke="var(--border-strong)" strokeWidth="0.7"/>
              <text x="6" y="10" fontFamily="var(--font-mono)" fontSize="7" fill="var(--muted)">y</text>
              <text x="170" y="108" fontFamily="var(--font-mono)" fontSize="7" fill="var(--muted)">x</text>
              {(() => {
                const tox = (x) => 14 + x * 158;
                const toy = (y) => 100 - y * 90;
                let d = '';
                if (c.kind === 'under') { d = `M ${tox(0)} ${toy(0.3)} L ${tox(1)} ${toy(0.55)}`; }
                else if (c.kind === 'good') {
                  const pts2 = [];
                  for (let i = 0; i <= 24; i++) { const x = i / 24; const y = 0.6 - 0.62 * (x - 0.55) ** 2; pts2.push([tox(x), toy(y)]); }
                  d = pts2.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
                } else {
                  const pts2 = pts.map((p) => [tox(p.x), toy(p.y)]);
                  d = pts2.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
                }
                return <path d={d} stroke="oklch(0.74 0.21 295)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
              })()}
              {pts.map((p, i) => (<circle key={i} cx={14 + p.x * 158} cy={100 - p.y * 90} r="1.6" fill="oklch(0.78 0.16 195)" />))}
            </svg>
          </div>
        ))}
      </div>
    </Card>
  );
}

function QuizCard({ q }) {
  const [picked, setPicked] = React.useState(null);
  const { add: toast } = useToast();
  const opt = q.options.find((o) => o.id === picked);
  const handlePick = (id) => {
    if (picked) return;
    setPicked(id);
    const choice = q.options.find((o) => o.id === id);
    if (choice?.verdict === 'right') toast('Correct! +15 XP earned', 'success');
    else toast('Not quite — review the explanation', 'error');
  };
  return (
    <div>
      <ChatHeader code="AS" />
      <div style={{ marginLeft: 42 }}>
        <Card style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="cap">Quick check · 1 of 3</span>
            <Tag tone="accent">{I.check} Auto-graded</Tag>
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55, marginBottom: 12 }}>{q.prompt}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {q.options.map((o) => {
              const isPicked = picked === o.id;
              const reveal = !!picked;
              const isAnswer = o.verdict === 'right';
              const bd = reveal && isAnswer ? 'var(--good)' : reveal && isPicked ? 'var(--bad)' : 'var(--border)';
              const bg = reveal && isAnswer ? 'oklch(0.78 0.16 155 / 0.10)' : reveal && isPicked ? 'oklch(0.7 0.2 25 / 0.08)' : 'transparent';
              return (
                <button key={o.id} disabled={reveal} onClick={() => handlePick(o.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', textAlign: 'left',
                  background: bg, border: `1px solid ${bd}`, borderRadius: 8,
                  cursor: reveal ? 'default' : 'pointer', color: 'var(--ink)', transition: 'all var(--dur-fast)',
                }}>
                  <span className="mono" style={{
                    width: 22, height: 22, flexShrink: 0, borderRadius: 5, border: `1px solid ${bd}`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700,
                    background: reveal && isAnswer ? 'var(--good)' : reveal && isPicked ? 'var(--bad)' : 'transparent',
                    color: reveal && (isAnswer || isPicked) ? 'oklch(0.16 0.02 270)' : 'var(--muted)',
                  }}>{o.id.toUpperCase()}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{o.text}</span>
                </button>
              );
            })}
          </div>
          {picked && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Tag tone={opt.verdict === 'right' ? 'good' : 'danger'}>{opt.verdict === 'right' ? 'Correct' : 'Not quite'}</Tag>
              <span style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, flex: 1 }}>{opt.feedback}</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Composer({ input, setInput, submit, sessionEnded, session }) {
  const topic = session?.title || 'this topic';
  return (
    <div style={{ padding: 14, borderTop: '1px solid var(--border)', background: 'var(--bg-window)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '6px 6px 6px 14px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12 }}>
        <textarea
          className="chat-composer-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder={sessionEnded ? 'Session ended. Start a new session to continue.' : `Ask anything about ${topic}…`}
          disabled={sessionEnded}
          rows={1}
          style={{ flex: 1, resize: 'none', border: 0, outline: 0, padding: '8px 0', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink)', minHeight: 22, maxHeight: 120, opacity: sessionEnded ? 0.5 : 1 }}
        />
        <button onClick={submit} disabled={sessionEnded} style={{
          width: 38, height: 38, borderRadius: 10, border: 0,
          background: sessionEnded ? 'var(--surface-2)' : 'var(--brand-grad)',
          color: sessionEnded ? 'var(--muted)' : 'oklch(0.16 0.02 270)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: sessionEnded ? 'not-allowed' : 'pointer',
          boxShadow: sessionEnded ? 'none' : '0 0 0 1px oklch(0.68 0.21 295 / 0.5), 0 4px 14px oklch(0.68 0.21 295 / 0.35)',
          transition: 'all var(--dur-fast)',
        }}>{I.arrowR}</button>
      </div>
    </div>
  );
}

function VisualizerColumn({ vizTab, setVizTab, complexity, setComplexity, session }) {
  const tabs = ['Notes', 'Code', 'Whiteboard'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }} className="scroll">
      <Card pad={false}>
        <div style={{ display: 'flex', padding: 6, background: 'var(--surface)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
          {tabs.map((t) => {
            const k = t.toLowerCase();
            const on = vizTab === k;
            return (
              <button key={t} onClick={() => setVizTab(k)} style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, border: 0,
                background: on ? 'var(--bg-window)' : 'transparent',
                color: on ? 'var(--ink)' : 'var(--muted)',
                fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', boxShadow: on ? 'var(--shadow-sm)' : 'none',
                transition: 'all var(--dur-fast)',
              }}>{t}</button>
            );
          })}
        </div>
        {(vizTab === 'notes' || vizTab === 'visualizer') && <SessionNotes session={session} />}
        {vizTab === 'code' && <CodeView session={session} />}
        {vizTab === 'whiteboard' && <WhiteboardView session={session} />}
      </Card>
    </div>
  );
}

function SessionNotes({ session }) {
  const sid = session?.id || 'local';
  const key = `learnos_notes_${sid}`;
  const [text, setText] = React.useState(() => { try { return localStorage.getItem(key) || ''; } catch { return ''; } });
  React.useEffect(() => { try { localStorage.setItem(key, text); } catch {} }, [key, text]);
  React.useEffect(() => { try { setText(localStorage.getItem(key) || ''); } catch {} }, [key]);
  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color: 'var(--brand)' }}>{React.cloneElement(I.book, { size: 16 })}</span>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Your notes for this session</div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Take notes about ${session?.title || 'this topic'}…\n\nThey'll save automatically per-session.`}
        style={{ width: '100%', minHeight: 280, padding: 12, fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.6, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, resize: 'vertical', outline: 'none' }}
      />
      <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 6, textAlign: 'right' }} className="mono">
        {text.length} chars · autosaved
      </div>
    </div>
  );
}

function SignalTile({ label, value, sub, tone }) {
  const c = tone === 'good' ? 'var(--good)' : 'var(--warn)';
  return (
    <div style={{ padding: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
      <div className="display" style={{ fontSize: 18, color: 'var(--ink)', marginTop: 3 }}>{value}</div>
      <div className="mono" style={{ fontSize: 10, color: c, marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <span style={{ width: 5, height: 5, borderRadius: 999, background: c }} /> {sub}
      </div>
    </div>
  );
}

function ModelComplexityChart({ complexity }) {
  const W = 380, H = 230, padX = 36, padY = 24;
  const N = 60;
  const xs = Array.from({ length: N }, (_, i) => i / (N - 1));
  const train = xs.map((x) => Math.max(0.04, 0.85 * Math.exp(-x * 3.4)));
  const test = xs.map((x) => Math.max(0.16, 0.85 * Math.exp(-x * 3.4) + 0.78 * (x - 0.45) ** 2));
  const tox = (x) => padX + x * (W - padX * 2);
  const toy = (y) => H - padY - y * (H - padY * 2);
  const pathTrain = train.map((y, i) => `${i === 0 ? 'M' : 'L'} ${tox(xs[i])} ${toy(y)}`).join(' ');
  const pathTest = test.map((y, i) => `${i === 0 ? 'M' : 'L'} ${tox(xs[i])} ${toy(y)}`).join(' ');
  const optX = 0.45;
  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Model Complexity vs Error</div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 2, background: 'oklch(0.74 0.21 295)', borderRadius: 999 }} /> Test Error</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 2, background: 'oklch(0.78 0.16 195)', borderRadius: 999 }} /> Training Error</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        <text x="6" y={padY} fontFamily="var(--font-mono)" fontSize="10" fill="var(--muted)">Error</text>
        <text x="6" y={padY + 14} fontFamily="var(--font-mono)" fontSize="10" fill="var(--muted)">1.0</text>
        <text x="6" y={H - padY} fontFamily="var(--font-mono)" fontSize="10" fill="var(--muted)">0</text>
        <text x={padX} y={H - 4} fontFamily="var(--font-mono)" fontSize="10" fill="var(--muted)">Low</text>
        <text x={W - padX - 22} y={H - 4} fontFamily="var(--font-mono)" fontSize="10" fill="var(--muted)">High</text>
        <text x={W / 2 - 36} y={H - 4} fontFamily="var(--font-mono)" fontSize="9" fill="var(--ink-2)">Model Complexity</text>
        {[0.25, 0.5, 0.75].map((g) => (<line key={g} x1={padX} x2={W - padX} y1={toy(g)} y2={toy(g)} stroke="var(--border)" strokeDasharray="2 4" strokeWidth="0.5"/>))}
        <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="var(--border-strong)" strokeWidth="0.7"/>
        <line x1={padX} y1={padY} x2={padX} y2={H - padY} stroke="var(--border-strong)" strokeWidth="0.7"/>
        <path d={pathTrain} stroke="oklch(0.78 0.16 195)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d={pathTest} stroke="oklch(0.74 0.21 295)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <line x1={tox(optX)} y1={padY} x2={tox(optX)} y2={H - padY} stroke="oklch(0.74 0.21 295 / 0.5)" strokeDasharray="3 3" strokeWidth="1"/>
        <circle cx={tox(optX)} cy={toy(0.32)} r="4" fill="oklch(0.74 0.21 295)" stroke="var(--bg-window)" strokeWidth="2"/>
        <text x={tox(optX) + 6} y={toy(0.32) - 6} fontFamily="var(--font-mono)" fontSize="9" fill="var(--ink-2)">Optimal Complexity</text>
        <circle cx={tox(complexity)} cy={toy(test[Math.round(complexity * (N - 1))])} r="4" fill="oklch(0.78 0.16 195)" stroke="var(--bg-window)" strokeWidth="2"/>
      </svg>
    </div>
  );
}

function CodeView({ session }) {
  const sid = session?.id || 'local';
  const key = `learnos_code_${sid}`;
  const [code, setCode] = React.useState(() => { try { return localStorage.getItem(key) || ''; } catch { return ''; } });
  React.useEffect(() => { try { localStorage.setItem(key, code); } catch {} }, [key, code]);
  React.useEffect(() => { try { setCode(localStorage.getItem(key) || ''); } catch {} }, [key]);
  return (
    <div style={{ padding: 14 }}>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>Scratchpad — paste or write code while you learn. Saved per-session.</div>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        placeholder={`# Paste code snippets from the Tutor or write your own…\n`}
        style={{ width: '100%', minHeight: 280, padding: 12, fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.6, color: 'var(--ink-2)', background: 'oklch(0.12 0.02 270)', border: '1px solid var(--border)', borderRadius: 8, resize: 'vertical', outline: 'none' }}
      />
    </div>
  );
}

function WhiteboardView({ session }) {
  const canvasRef = React.useRef(null);
  const [tool, setTool]       = React.useState('pen');
  const [drawing, setDrawing] = React.useState(false);
  const [lastPos, setLastPos] = React.useState(null);
  const [strokes, setStrokes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const sid = session?.id || 'local';
  const isOnline = sid && sid !== 'local';

  React.useEffect(() => {
    if (!isOnline) { setLoading(false); return; }
    setLoading(true);
    API.getWhiteboardStrokes(sid)
      .then(rows => { setStrokes(rows || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sid, isOnline]);

  const redrawCanvas = React.useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 9999, 9999);
    for (const s of strokes) {
      try {
        const st = JSON.parse(s.stroke_json);
        if (!st.points || st.points.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(st.points[0].x, st.points[0].y);
        for (let i = 1; i < st.points.length; i++) {
          ctx.lineTo(st.points[i].x, st.points[i].y);
        }
        ctx.strokeStyle = st.color || 'oklch(0.78 0.16 195)';
        ctx.lineWidth   = st.width || 2;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.stroke();
      } catch {}
    }
  }, [strokes]);

  React.useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = Math.round(r.width  * dpr);
      canvas.height = Math.round(r.height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redrawCanvas();
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [redrawCanvas]);

  React.useEffect(() => { redrawCanvas(); }, [strokes, redrawCanvas]);

  const getPos = (e, canvas) => {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };

  const currentColor = () => tool === 'highlight' ? 'oklch(0.78 0.16 85 / 0.5)' : 'oklch(0.78 0.16 195)';
  const currentWidth = () => tool === 'highlight' ? 12 : 2;

  const startDraw = (e) => {
    const canvas = canvasRef.current; if (!canvas) return;
    setDrawing(true);
    const pos = getPos(e, canvas);
    setLastPos(pos);
    setStrokes(prev => [...prev, { id: `local-${Date.now()}`, stroke_json: JSON.stringify({ tool, points: [pos], color: currentColor(), width: currentWidth() }) }]);
  };

  const draw = (e) => {
    if (!drawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    if (tool === 'eraser') {
      ctx.clearRect(pos.x - 10, pos.y - 10, 20, 20);
    } else {
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = currentColor();
      ctx.lineWidth   = currentWidth();
      ctx.lineCap     = 'round';
      ctx.stroke();
    }
    setStrokes(prev => {
      const updated = [...prev];
      const last = { ...updated[updated.length - 1] };
      try {
        const st = JSON.parse(last.stroke_json);
        st.points.push(pos);
        last.stroke_json = JSON.stringify(st);
      } catch {}
      updated[updated.length - 1] = last;
      return updated;
    });
    setLastPos(pos);
  };

  const stopDraw = async () => {
    if (!drawing) return;
    setDrawing(false);
    setLastPos(null);
    if (isOnline && strokes.length > 0) {
      const last = strokes[strokes.length - 1];
      if (last.id.startsWith('local-')) {
        try {
          const res = await API.saveWhiteboardStroke(sid, { stroke_json: last.stroke_json });
          setStrokes(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], id: res.id };
            return updated;
          });
        } catch {}
      }
    }
  };

  const handleUndo = async () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setStrokes(prev => prev.slice(0, -1));
    if (isOnline && !last.id.startsWith('local-')) {
      try { await API.deleteWhiteboardStroke(sid, last.id); } catch {}
    }
  };

  const handleClear = async () => {
    setStrokes([]);
    if (isOnline) {
      try { await API.clearWhiteboardStrokes(sid); } catch {}
    }
  };

  const tools = [
    { id: 'pen',       label: 'Pen'       },
    { id: 'highlight', label: 'Highlight' },
    { id: 'eraser',    label: 'Eraser'    },
  ];

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {tools.map(t => (
          <button key={t.id} onClick={() => setTool(t.id)} style={{
            padding: '4px 12px', borderRadius: 6, border: `1px solid ${tool === t.id ? 'var(--accent-line)' : 'var(--border)'}`,
            background: tool === t.id ? 'var(--accent-soft)' : 'var(--surface)',
            color: tool === t.id ? 'oklch(0.82 0.18 295)' : 'var(--muted)',
            fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
          }}>{t.label}</button>
        ))}
        <button onClick={handleUndo} disabled={strokes.length === 0} style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: strokes.length === 0 ? 'var(--faint)' : 'var(--muted)', fontSize: 11.5, cursor: strokes.length === 0 ? 'not-allowed' : 'pointer' }}>Undo</button>
        <button onClick={handleClear} disabled={strokes.length === 0} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: strokes.length === 0 ? 'var(--faint)' : 'var(--muted)', fontSize: 11.5, cursor: strokes.length === 0 ? 'not-allowed' : 'pointer' }}>Clear</button>
      </div>
      {loading && (
        <div style={{ padding: '4px 0', fontSize: 11, color: 'var(--muted)' }}>Loading whiteboard…</div>
      )}
      <canvas
        ref={canvasRef}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        style={{ width: '100%', height: 200, borderRadius: 8, background: 'oklch(0.16 0.025 270)', cursor: tool === 'eraser' ? 'cell' : 'crosshair', display: 'block' }}
      />
    </div>
  );
}

function RightRail({ onExport, setScreen, session }) {
  const [outline, setOutline] = React.useState([]);
  const [assignment, setAssignment] = React.useState(null);
  const [roadmapMastery, setRoadmapMastery] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    setOutline([]); setAssignment(null);
    (async () => {
      if (session?.roadmap_node_id) {
        try {
          const r = await API.getRoadmap(session.roadmap_id);
          if (!alive || !r) return;
          const node = (r.nodes || []).find(n => n.id === session.roadmap_node_id);
          if (node?.objectives?.length) {
            setOutline(node.objectives.map((label, i) => ({ label, state: i === 0 ? 'active' : 'queued' })));
          }
          setRoadmapMastery({ title: r.title, value: r.mastery || 0 });
        } catch {}
      }
      if (session?.course) {
        try {
          const assignments = await API.getAssignments();
          const a = (assignments || []).find(x => x.course === session.course && x.status !== 'graded');
          if (alive && a) setAssignment(a);
        } catch {}
      }
    })();
    return () => { alive = false; };
  }, [session?.id, session?.roadmap_node_id, session?.course, session?.roadmap_id]);

  const concepts = React.useMemo(() => {
    const t = (session?.title || '').replace(/[–—]/g, '-');
    return t ? Array.from(new Set(t.split(/[\s\-]+/).filter(w => w.length > 3))).slice(0, 6) : [];
  }, [session?.title]);

  const sessMastery = session?.mastery_score != null ? session.mastery_score : null;
  const allDone = outline.length > 0 && outline.every(o => o.state === 'done');

  return (
    <div className="scroll" style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <Card pad={false} style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Learning objectives</div>
          {outline.length > 0 && <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{outline.filter(o=>o.state==='done').length} / {outline.length}</span>}
        </div>
        {outline.length === 0 ? (
          <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>No objectives defined for this session.</div>
        ) : outline.map((o, i) => (<OutlineRow key={i} idx={i + 1} {...o} />))}
      </Card>
      {concepts.length > 0 && (
        <Card pad={false} style={{ padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>Topics</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {concepts.map((c) => <Tag key={c} tone="accent">{c}</Tag>)}
          </div>
        </Card>
      )}
      {assignment && (
        <Card pad={false} style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Active assignment</div>
            <span style={{ color: 'var(--muted)' }}>{React.cloneElement(I.calendar, { size: 14 })}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500, marginBottom: 4 }}>{assignment.title}</div>
          {assignment.description && <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>{assignment.description.slice(0, 160)}{assignment.description.length > 160 ? '…' : ''}</div>}
          <Btn variant="primary" size="md" full style={{ marginTop: 10 }} onClick={() => {
            if (session?.course) { try { localStorage.setItem('assignments_course', session.course); } catch {} }
            setScreen ? setScreen('assignments') : null;
          }}>View Assignment</Btn>
        </Card>
      )}
      <Card pad={false} style={{ padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>Your Mastery</div>
        {sessMastery != null && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{session?.title || 'This session'}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink)' }}>{Math.round(sessMastery * 100)}%</span>
            </div>
            <ProgressBar value={sessMastery} height={4} />
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>this session</div>
          </div>
        )}
        {roadmapMastery && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{roadmapMastery.title}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink)' }}>{Math.round(roadmapMastery.value * 100)}%</span>
            </div>
            <ProgressBar value={roadmapMastery.value} height={4} />
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>overall roadmap</div>
          </div>
        )}
        {sessMastery == null && !roadmapMastery && (
          <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>Mastery is tracked as you complete sessions.</div>
        )}
        <Btn variant="outline" size="md" full iconRight={React.cloneElement(I.download, { size: 13 })} style={{ marginTop: 12 }} onClick={onExport}>Export Transcript</Btn>
      </Card>
    </div>
  );
}

function OutlineRow({ idx, label, state }) {
  const C = {
    done: { dot: 'var(--good)', text: 'var(--muted)', strike: true },
    active: { dot: 'var(--brand)', text: 'var(--ink)' },
    queued: { dot: 'var(--surface-3)', text: 'var(--faint)' },
  }[state];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <div style={{ width: 18, display: 'flex', justifyContent: 'center' }}>
        {state === 'done' ? (
          <span style={{ width: 16, height: 16, borderRadius: 999, background: 'oklch(0.78 0.16 155 / 0.2)', color: 'var(--good)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m4 12 5 5L20 6"/></svg>
          </span>
        ) : state === 'active' ? (
          <span style={{ width: 16, height: 16, borderRadius: 999, background: 'var(--bg-window)', border: '2px solid var(--brand)', boxShadow: '0 0 0 4px var(--accent-soft)' }} />
        ) : (
          <span style={{ width: 10, height: 10, borderRadius: 999, background: C.dot }} />
        )}
      </div>
      <span style={{ fontSize: 12.5, color: C.text, textDecoration: C.strike ? 'line-through' : 'none', textDecorationColor: 'var(--faint)', fontWeight: state === 'active' ? 600 : 400 }}>
        {idx}. {label}
      </span>
    </div>
  );
}
