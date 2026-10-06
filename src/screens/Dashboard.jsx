import React from 'react';
import { I } from '../components/Icons';
import { Card, StatCard, Btn, ProgressBar, Ring, MiniBars, AgentChip, PageScroll, SectionHead } from '../components/UI';
import API, { timeAgo } from '../api.js';
import { useToast } from '../App';
import { useUser } from '../UserContext.jsx';

export default function Dashboard({ onOpenSession, onOpenRoadmap, onOpenCourses, onOpenCards, setScreen }) {
  const { add: toast } = useToast();
  const user = useUser();
  const [roadmaps, setRoadmaps]   = React.useState([]);
  const [activity, setActivity]   = React.useState([]);
  const [stats, setStats]         = React.useState(null);
  const [dailyStats, setDailyStats] = React.useState([]);
  const [coach, setCoach]         = React.useState(null);

  React.useEffect(() => {
    API.getCoach().then(c => { if (c) setCoach(c); }).catch(() => {});
    API.getDailyStats(14).then(rows => { if (Array.isArray(rows)) setDailyStats(rows); }).catch(() => {});
    API.getRoadmaps().then(rows => {
      if (Array.isArray(rows) && rows.length) {
        setRoadmaps(rows.map(r => ({
          id:          r.id,
          title:       r.title,
          status:      r.status === 'active' ? 'In Progress' : (r.status || 'In Progress'),
          mastery:     r.mastery || 0,
          nextModule:  r.next_module || 'Start learning',
          modulesLeft: r.modules_left || 0,
          color:       r.color || 'var(--brand)',
          icon:        r.icon || 'box',
          level:       Math.max(1, Math.ceil(((r.completed_modules || 0) / Math.max(r.total_modules || 1, 1)) * 10)),
        })));
      }
    }).catch(() => {});

    API.getActivity().then(rows => {
      if (Array.isArray(rows) && rows.length) {
        setActivity(rows.slice(0, 4).map(a => ({
          kind:  a.kind || 'session',
          text:  a.text,
          sub:   a.sub || '',
          when:  timeAgo(a.created_at),
          xp:    a.xp || 0,
          agent: a.agent || 'TU',
        })));
      }
    }).catch(() => {});

    API.getStats().then(s => { if (s) setStats(s); }).catch(() => {});
  }, []);

  const streak    = stats?.streak     ?? user.streak;
  const bestStreak = stats?.bestStreak ?? user.bestStreak;
  const mastery   = stats?.mastery    ?? 0;
  const pending   = stats?.pendingAssignments ?? 0;
  const totalSessions = stats?.totalSessions ?? 0;
  const completedSessions = stats?.completedSessions ?? 0;
  const dueFlashcards = stats?.dueFlashcards ?? 0;

  // F-04: Derive mini-bar values from real daily stats
  const streakBars = dailyStats.length >= 7
    ? dailyStats.slice(-7).map(d => Math.max(0.1, (d.xp || 0) / 40))
    : [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];

  return (
    <PageScroll>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 20 }}>
        <div>
          <div className="display" style={{ fontSize: 30, lineHeight: 1.05, color: 'var(--ink)' }}>Welcome back, {user.name.split(' ')[0]}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>Here's where to pick up.</div>
        </div>
        <StreakCard streak={streak} />
      </div>
      <StatRow streak={streak} bestStreak={bestStreak} mastery={mastery} pending={pending} totalSessions={totalSessions} completedSessions={completedSessions} onOpenAssignments={() => setScreen('assignments')} streakBars={streakBars} />
      <LearningCoach coach={coach} setScreen={setScreen} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 16, marginTop: 16 }}>
        <RoadmapsRow setScreen={setScreen} onOpenRoadmap={onOpenRoadmap} roadmaps={roadmaps} />
        <QuickActionsCard onOpenSession={onOpenSession} onOpenRoadmap={onOpenRoadmap} onOpenCourses={onOpenCourses} onOpenCards={onOpenCards} />
      </div>
      <div style={{ marginTop: 16 }}>
        <RecentActivityCard activity={activity} setScreen={setScreen} />
      </div>
    </PageScroll>
  );
}

// The adaptive advisor, front and center: real proficiency/pace read + concrete,
// clickable next steps driven by the learner's actual results.
function LearningCoach({ coach, setScreen }) {
  if (!coach || !coach.recommendations?.length) return null;
  const prof = coach.proficiency;
  const profColor = prof == null ? 'var(--muted)' : prof >= 75 ? 'var(--good)' : prof >= 50 ? 'var(--brand-3)' : 'var(--warn)';
  const iconMap = { play: I.play, spark: I.spark, chart: I.chart, check: I.check };
  const go = (action) => {
    if (!action) return;
    if (action.screen === 'roadmaps' && action.roadmap_id) { try { localStorage.setItem('learnos_active_roadmap', action.roadmap_id); } catch {} }
    setScreen(action.screen || 'dashboard');
  };
  return (
    <Card style={{ padding: 20, marginTop: 16, background: 'linear-gradient(135deg, var(--accent-soft), var(--bg-window))', border: '1px solid var(--accent-line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <AgentChip code="AN" size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="display" style={{ fontSize: 18, color: 'var(--ink)' }}>Your Learning Coach</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{coach.paceMsg}</div>
        </div>
        {prof != null && (
          <div style={{ textAlign: 'right' }}>
            <div className="display" style={{ fontSize: 26, color: profColor, lineHeight: 1 }}>{prof}%</div>
            <div className="cap" style={{ color: 'var(--muted)', marginTop: 2 }}>Proficiency</div>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        {coach.recommendations.map((r, i) => {
          const c = r.tone === 'good' ? 'var(--good)' : r.tone === 'warn' ? 'var(--warn)' : r.tone === 'accent' ? 'var(--brand-3)' : 'var(--brand)';
          return (
            <button key={i} onClick={() => go(r.action)} className="hover-card" style={{ display: 'flex', gap: 10, textAlign: 'left', padding: 12, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, background: `color-mix(in oklch, ${c} 16%, transparent)`, color: c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid color-mix(in oklch, ${c} 35%, transparent)` }}>{React.cloneElement(iconMap[r.icon] || I.spark, { size: 15 })}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{r.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.45 }}>{r.detail}</div>
              </div>
              <span style={{ color: 'var(--muted)', flexShrink: 0, alignSelf: 'center' }}>{React.cloneElement(I.arrowR, { size: 14 })}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function StreakCard({ streak }) {
  return (
    <Card pad={false} className="hover-lift" style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: '12px 16px 12px 14px', background: 'linear-gradient(135deg, oklch(0.95 0.05 70), oklch(0.97 0.03 45))', border: '1px solid oklch(0.80 0.10 60 / 0.5)', minWidth: 230 }}>
      <span style={{ width: 40, height: 40, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.75 0.17 55 / 0.22)', color: 'oklch(0.55 0.16 50)' }}>{React.cloneElement(I.flame, { size: 22 })}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{streak} day streak</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Keep it up!</div>
      </div>
      <span style={{ color: 'var(--muted)' }}>{I.arrowR}</span>
    </Card>
  );
}

function StatRow({ streak, bestStreak, mastery, pending, totalSessions, completedSessions, onOpenAssignments, streakBars }) {
  return (
    <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 8 }}>
      <StatCard icon={React.cloneElement(I.flame, { size: 16 })} label="Learning Streak" value={streak} unit="days" sub={`Best: ${bestStreak} days`} accent="oklch(0.75 0.18 45)" chart={<MiniBars values={streakBars} color="oklch(0.75 0.18 45)" />} />
      <StatCard icon={React.cloneElement(I.bolt, { size: 16 })} label="Mastery Score" value={mastery} unit="%" sub="weighted average" accent="var(--brand-3)" chart={<Ring value={mastery / 100} size={44} sw={5} color="var(--brand-3)" />} />
      <StatCard icon={React.cloneElement(I.cap, { size: 16 })} label="Sessions" value={String(totalSessions)} unit="" sub={`${completedSessions} completed`} accent="var(--brand)" chart={<MiniBars values={streakBars.slice(-7)} color="var(--brand)" />} />
      <Card pad={false} onClick={onOpenAssignments} className="hover-lift" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 28, height: 28, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.78 0.16 155 / 0.18)', color: 'var(--good)' }}>{React.cloneElement(I.check, { size: 16 })}</span>
          <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 }}>Pending Assignments</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, justifyContent: 'space-between' }}>
          <div>
            <div className="display" style={{ fontSize: 30, lineHeight: 1, color: 'var(--ink)' }}>{pending}</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>{pending === 1 ? '1 due soon' : pending > 0 ? 'Due soon' : 'All caught up'}</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: 'oklch(0.78 0.16 155 / 0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--good)' }}>{I.card}</div>
        </div>
      </Card>
    </div>
  );
}

function RoadmapsRow({ setScreen, onOpenRoadmap, roadmaps }) {
  const display = roadmaps.length > 0 ? roadmaps : [];
  return (
    <Card pad={false} style={{ padding: 18 }}>
      <SectionHead title="Current Roadmaps" action={<a href="#" onClick={(e) => { e.preventDefault(); onOpenRoadmap(); }} className="hover-underline" style={{ color: 'var(--brand)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>View all</a>} />
      {display.length === 0 ? (
        <div style={{ padding: '24px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--brand-grad)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-brand)' }}>{React.cloneElement(I.graph, { size: 22 })}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Let's build your first roadmap</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4, maxWidth: 360 }}>
              Tell us what you want to learn — the Curriculum agent will generate a personalized path of modules, lessons, and assessments.
            </div>
          </div>
          <Btn variant="primary" size="md" icon={I.spark} onClick={() => onOpenRoadmap()}>Generate my roadmap</Btn>
        </div>
      ) : (
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {display.map((r) => (
            <div key={r.id} className="hover-lift hover-glow" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', transition: 'all var(--dur-normal) var(--ease-out)' }} onClick={() => { try { localStorage.setItem('learnos_active_roadmap', r.id); } catch {} onOpenRoadmap(); }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 7, background: `color-mix(in oklch, ${r.color} 22%, transparent)`, color: r.color, border: `1px solid color-mix(in oklch, ${r.color} 40%, transparent)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{React.cloneElement(I[r.icon] || I.box, { size: 16 })}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>{r.title}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 3 }}>Level {r.level} · {r.status}</div>
                </div>
              </div>
              <div>
                <ProgressBar value={r.mastery} height={5} />
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{Math.round(r.mastery * 100)}%</span>
                </div>
              </div>
              <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Next up</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 600, marginTop: 2 }}>{r.nextModule}</div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>in {r.modulesLeft} module{r.modulesLeft === 1 ? '' : 's'}</div>
              </div>
              <Btn variant="primary" size="sm" full onClick={(e) => { e.stopPropagation(); try { localStorage.setItem('learnos_active_roadmap', r.id); } catch {} onOpenRoadmap(); }}>
                Continue Roadmap {React.cloneElement(I.arrowR, { size: 13 })}
              </Btn>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RecentActivityCard({ activity, setScreen }) {
  const kindMeta = {
    quiz:       { icon: I.check,  color: 'var(--good)' },
    assignment: { icon: I.upload, color: 'var(--brand)' },
    cert:       { icon: I.ribbon, color: 'var(--agent-ce)' },
    session:    { icon: I.cap,    color: 'var(--brand-3)' },
  };
  return (
    <Card pad={false} style={{ padding: 18 }}>
      <SectionHead title="Recent Activity" action={<a href="#" onClick={(e) => { e.preventDefault(); setScreen('feed'); }} className="hover-underline" style={{ color: 'var(--brand)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>View all</a>} />
      {activity.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No activity yet.</div>
      ) : (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activity.map((a, i) => {
            const k = kindMeta[a.kind] || kindMeta.session;
            return (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ width: 34, height: 34, borderRadius: 8, background: `color-mix(in oklch, ${k.color} 18%, transparent)`, color: k.color, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid color-mix(in oklch, ${k.color} 40%, transparent)` }}>{React.cloneElement(k.icon, { size: 16 })}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 500 }}>{a.text}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{a.sub}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {a.xp > 0 && <div className="mono" style={{ fontSize: 11, color: 'var(--brand-3)', fontWeight: 600 }}>+{a.xp} XP</div>}
                  <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{a.when}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function QuickActionsCard({ onOpenSession, onOpenRoadmap, onOpenCourses, onOpenCards }) {
  const actions = [
    { label: 'Start Session',   sub: 'Learn with your AI Tutor',  icon: I.play,  color: 'var(--brand)',              onClick: onOpenSession },
    { label: 'Open Roadmaps',   sub: 'View your learning paths',  icon: I.graph, color: 'var(--brand-3)',            onClick: onOpenRoadmap },
    { label: 'Browse Courses',  sub: 'Explore expert content',    icon: I.book,  color: 'oklch(0.74 0.17 220)',      onClick: onOpenCourses },
    { label: 'Review Flashcards', sub: 'Reinforce your memory',   icon: I.card,  color: 'oklch(0.78 0.16 85)',       onClick: onOpenCards },
  ];
  return (
    <Card pad={false} style={{ padding: 18 }}>
      <SectionHead title="Quick Actions" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {actions.map((a) => (
          <button key={a.label} onClick={a.onClick} className="hover-lift tap-scale" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: 12, textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', transition: 'all var(--dur-normal) var(--ease-out)' }}>
            <span style={{ width: 34, height: 34, borderRadius: 8, background: `color-mix(in oklch, ${a.color} 22%, transparent)`, color: a.color, border: `1px solid color-mix(in oklch, ${a.color} 40%, transparent)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{React.cloneElement(a.icon, { size: 16 })}</span>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{a.label}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{a.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

