import React from 'react';
import { I } from './components/Icons';
import { Btn, Avatar } from './components/UI';
import API, { timeAgo } from './api.js';
import { UserProvider, useUser } from './UserContext.jsx';
import Landing from './screens/Landing';
import Dashboard from './screens/Dashboard';
import Session from './screens/Session';
import Roadmap from './screens/Roadmap';
import Courses from './screens/Courses';
import { Schedule, Assignments, Flashcards, Certificates, Feed, Starred, Settings, AgentsPage } from './screens/Extras';
import Share from './screens/Share';
import Onboarding from './screens/Onboarding';

const ACCENT_TOKENS = {
  '#7c3aed': { accent: 'oklch(0.68 0.21 295)', grad: 'linear-gradient(135deg, oklch(0.68 0.21 295) 0%, oklch(0.78 0.16 195) 100%)', soft: 'oklch(0.68 0.21 295 / 0.13)', line: 'oklch(0.68 0.21 295 / 0.35)' },
  '#06b6d4': { accent: 'oklch(0.76 0.17 200)', grad: 'linear-gradient(135deg, oklch(0.76 0.17 200) 0%, oklch(0.72 0.18 295) 100%)', soft: 'oklch(0.76 0.17 200 / 0.13)', line: 'oklch(0.76 0.17 200 / 0.35)' },
  '#e0476a': { accent: 'oklch(0.72 0.19 15)', grad: 'linear-gradient(135deg, oklch(0.72 0.19 15) 0%, oklch(0.78 0.16 75) 100%)', soft: 'oklch(0.72 0.19 15 / 0.13)', line: 'oklch(0.72 0.19 15 / 0.35)' },
  '#10b981': { accent: 'oklch(0.74 0.16 160)', grad: 'linear-gradient(135deg, oklch(0.74 0.16 160) 0%, oklch(0.78 0.16 195) 100%)', soft: 'oklch(0.74 0.16 160 / 0.13)', line: 'oklch(0.74 0.16 160 / 0.35)' },
};

const NAV = [
  { group: 'LEARN', items: [
    { id: 'dashboard',   label: 'Dashboard',    icon: 'home' },
    { id: 'roadmaps',    label: 'Roadmaps',     icon: 'graph' },
    { id: 'courses',     label: 'Courses',      icon: 'book' },
    { id: 'assignments', label: 'Assignments',  icon: 'check' },
    { id: 'cards',       label: 'Spaced review',icon: 'card' },
    { id: 'schedule',    label: 'Schedule',     icon: 'calendar' },
  ]},
  { group: 'BUILD', items: [
    { id: 'agents',      label: 'Agents',       icon: 'spark' },
    { id: 'certificates',label: 'Certificates', icon: 'ribbon' },
  ]},
  { group: 'LIBRARY', items: [
    { id: 'share',       label: 'Share',        icon: 'people' },
    { id: 'feed',        label: 'Activity',     icon: 'rss' },
    { id: 'starred',     label: 'Starred',      icon: 'star' },
  ]},
  { group: 'ANALYTICS', items: [
    { id: 'settings',    label: 'Settings',     icon: 'cog' },
  ]},
];

/* ── Toast ─────────────────────────────────────────────────────────────────── */
const ToastContext = React.createContext(null);

function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);
  const add = (msg, type = 'info', action = null) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };
  const remove = (id) => setToasts((t) => t.filter((x) => x.id !== id));
  return (
    <ToastContext.Provider value={{ add }}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: '10px 16px', borderRadius: 10,
            background: t.type === 'success' ? 'oklch(0.78 0.16 155 / 0.2)' : t.type === 'error' ? 'oklch(0.7 0.2 25 / 0.2)' : 'var(--surface-2)',
            border: `1px solid ${t.type === 'success' ? 'oklch(0.78 0.16 155 / 0.5)' : t.type === 'error' ? 'oklch(0.7 0.2 25 / 0.5)' : 'var(--border)'}`,
            color: 'var(--ink)', fontSize: 13, fontWeight: 500,
            boxShadow: '0 8px 30px oklch(0 0 0 / 0.3)',
            animation: 'pageEnter var(--dur-normal) var(--ease-out)',
            display: 'flex', alignItems: 'center', gap: 10, minWidth: 240,
          }}>
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
            <span style={{ flex: 1 }}>{t.msg}</span>
            {t.action && (
              <button
                onClick={() => { t.action.onClick(); remove(t.id); }}
                style={{
                  padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
                  background: 'var(--brand)', color: 'oklch(0.16 0.02 270)',
                  border: 0, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {t.action.label}
              </button>
            )}
            <button onClick={() => remove(t.id)} style={{ background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', padding: 0 }}>✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ── Modal ─────────────────────────────────────────────────────────────────── */
const ModalContext = React.createContext(null);

function ModalProvider({ children }) {
  const [modal, setModal] = React.useState(null);
  const open  = React.useCallback((content) => setModal(content), []);
  const close = React.useCallback(() => setModal(null), []);
  return (
    <ModalContext.Provider value={{ open, close }}>
      {children}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'oklch(0 0 0 / 0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'backdropIn var(--dur-fast) ease-out',
        }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div style={{
            background: 'var(--bg-window)', border: '1px solid var(--border)',
            borderRadius: 16, padding: 28, maxWidth: 560, width: '90%',
            boxShadow: '0 30px 80px oklch(0 0 0 / 0.5)',
            animation: 'modalPop var(--dur-normal) var(--ease-spring)',
            position: 'relative',
          }}>
            <button onClick={close} className="modal-close" style={{
              position: 'absolute', top: 16, right: 16, background: 'none', border: 0,
              color: 'var(--muted)', cursor: 'pointer', fontSize: 16, padding: 6, lineHeight: 1,
            }}>✕</button>
            {modal}
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

function useToast() { return React.useContext(ToastContext); }
function useModal() { return React.useContext(ModalContext); }

// ── App entry ───────────────────────────────────────────────────────────────
// No login: a cleaned-up Landing is the front door, then straight into the app.
// (First run with an empty library drops into onboarding.)
function AppRoot() {
  // The landing page is a front door, not a toll gate. Someone who has already
  // been inside should reopen straight into their dashboard — being shown the
  // marketing page every single load is friction for the person who uses this
  // daily, which is the only person there is.
  const [phase, setPhase] = React.useState(() => {
    try { return localStorage.getItem('learnos_entered') === '1' ? 'app' : 'landing'; }
    catch { return 'landing'; }
  });
  const [version, setVersion] = React.useState(0);

  // Does this user still need onboarding? (no roadmaps + never onboarded)
  // NOTE: the API calls intentionally do NOT swallow errors. An unreachable or
  // throttled API must never be mistaken for "this user has no data" — that
  // would drop an existing learner back into the onboarding wizard.
  const checkOnboarding = async () => {
    try {
      const [roadmaps, settings] = await Promise.all([
        API.getRoadmaps(),
        API.getUserSettings(),
      ]);
      const hasRoadmaps = Array.isArray(roadmaps) && roadmaps.length > 0;
      const hasOnboarded = settings && settings.onboarded_at;
      if (!hasRoadmaps && !hasOnboarded) {
        setPhase('onboarding');
        return true;
      }
    } catch { /* API failed — fall through to the app, never force onboarding */ }
    return false;
  };

  const remember = (entered) => {
    try { localStorage.setItem('learnos_entered', entered ? '1' : '0'); } catch {}
  };

  async function handleEnterApp() {
    setPhase('loading');
    const needsOnboarding = await checkOnboarding();
    if (!needsOnboarding) {
      remember(true);
      setVersion(v => v + 1);
      setPhase('app');
    }
  }

  function handleOnboardingComplete() {
    remember(true);
    setVersion(v => v + 1);
    setPhase('app');
  }

  // Going back out to the landing page must be possible — it holds the project's
  // "what is this / open source" story, which someone may well want to reread or
  // show to another person.
  function handleExitToLanding() {
    remember(false);
    setPhase('landing');
  }

  React.useEffect(() => {
    document.title = phase === 'landing' ? 'LearnOS — Open-source AI University'
      : phase === 'onboarding' ? 'Get started · LearnOS'
      : 'LearnOS';
  }, [phase]);

  if (phase === 'loading') return <AppLoader />;
  if (phase === 'landing') return <Landing onEnterApp={handleEnterApp} />;
  if (phase === 'onboarding') return <Onboarding onComplete={handleOnboardingComplete} />;
  return <App key={version} onExitToLanding={handleExitToLanding} />;
}

function AppLoader() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', flexDirection: 'column', gap: 18,
    }}>
      <span style={{
        width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 11, background: 'var(--brand-grad)',
        boxShadow: '0 0 0 1px oklch(0.68 0.21 295 / 0.4), 0 0 18px oklch(0.68 0.21 295 / 0.4)',
      }}>
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <path d="M12 3 21 8v8l-9 5-9-5V8z" stroke="oklch(0.16 0.02 270)" strokeWidth="2" strokeLinejoin="round"/>
          <path d="M3 8l9 5 9-5M12 13v9" stroke="oklch(0.16 0.02 270)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
        </svg>
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 7, height: 7, borderRadius: 999, background: 'var(--brand)',
            animation: `ldot 1s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

export default AppRoot;

// ── Main authenticated app ────────────────────────────────────────────────────
// Outer `App` only mounts providers. The shell that *consumes* the contexts
// must live below the providers in the tree (you cannot read a context in the
// same component that renders its Provider — useContext returns the default
// null and destructuring `{ add }` throws).
function App({ onExitToLanding }) {
  const [me, setMe] = React.useState(null);

  React.useEffect(() => {
    API.getMe().then(u => {
      setMe({
        name:       u.name || '',
        email:      u.email || '',
        level:      u.level || 1,
        xp:         u.xp || 0,
        xpToNext:   u.xpToNext ?? u.xp_to_next ?? 500,
        streak:     u.streak || 0,
        bestStreak: u.bestStreak ?? u.best_streak ?? 0,
        role:       u.role || 'user',
        avatar_url: u.avatar_url || null,
      });
    }).catch(() => {});
  }, []);

  if (!me) return <AppLoader />;

  return (
    <UserProvider user={me}>
      <ToastProvider><ModalProvider>
        <AppShell onExitToLanding={onExitToLanding} />
      </ModalProvider></ToastProvider>
    </UserProvider>
  );
}

function AppShell({ onExitToLanding }) {
  const [screen, setScreen]               = React.useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [density, setDensity]             = React.useState('regular');

  const [navCounts, setNavCounts] = React.useState({});

  const { add: toast } = useToast();

  // Live sidebar counts (pending assignments, due review cards) — refreshed on
  // navigation so they reflect real state instead of hardcoded numbers.
  React.useEffect(() => {
    let alive = true;
    Promise.all([
      API.getAssignments().catch(() => []),
      API.getFlashcardsDue().catch(() => []),
    ]).then(([assignments, due]) => {
      if (!alive) return;
      setNavCounts({
        assignments: (assignments || []).filter(a => a.status !== 'graded').length,
        cards: (due || []).length,
      });
    });
    return () => { alive = false; };
  }, [screen]);

  // §3.8 — Schedule reminders: poll every 60s for events starting within 15 min
  const remindedRef = React.useRef(new Set()); // track already-reminded event ids
  React.useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const due = await API.getScheduleDue().catch(() => []);
        if (!alive) return;
        for (const ev of (due || [])) {
          if (remindedRef.current.has(ev.id)) continue;
          remindedRef.current.add(ev.id);
          // Mark as reminded server-side
          try {
            await API.patchScheduleEvent(ev.id, { reminder_sent_at: new Date().toISOString() });
          } catch {}
          // Determine deep-link screen
          const screenMap = { session: 'session', review: 'cards', assign: 'assignments', read: 'courses', project: 'assignments', live: 'session' };
          const dest = screenMap[ev.event_type] || 'schedule';
          toast(
            `⏰ "${ev.title}" starts soon${ev.start_hour ? ` at ${String(Math.floor(ev.start_hour)).padStart(2, '0')}:${String(Math.round((ev.start_hour % 1) * 60)).padStart(2, '0')}` : ''}`,
            'info',
            { label: 'Start now →', onClick: () => setScreen(dest) }
          );
        }
      } catch {}
    };
    // Run immediately, then every 60s
    tick();
    const interval = setInterval(tick, 60000);
    return () => { alive = false; clearInterval(interval); };
  }, [toast]);

  React.useEffect(() => {
    // 'session' is reachable from roadmaps/courses/dashboard but is
    // intentionally not a sidebar destination, so it needs its own label here.
    const label = NAV.flatMap(g => g.items).find(i => i.id === screen)?.label
      || (screen === 'session' ? 'Session' : 'Dashboard');
    document.title = `${label} · LearnOS`;
  }, [screen]);

  const go = (s) => setScreen(s);
  const toggleSidebar = () => setSidebarCollapsed((c) => !c);

  // Must react to resize/rotation — computing this once at first render meant a
  // phone turned sideways (or any window resize) kept the wrong layout until a
  // full reload.
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const sw = isMobile ? 0 : (sidebarCollapsed ? 64 : 240);
  const tk = ACCENT_TOKENS['#7c3aed'];

  React.useEffect(() => {
    document.documentElement.dataset.density = density;
    document.documentElement.style.setProperty('--brand',      tk.accent);
    document.documentElement.style.setProperty('--accent',     tk.accent);
    document.documentElement.style.setProperty('--accent-soft',tk.soft);
    document.documentElement.style.setProperty('--accent-line',tk.line);
    document.documentElement.style.setProperty('--brand-grad', tk.grad);
    document.documentElement.style.setProperty('--sidebar-w',  `${sw}px`);
  }, [density, sw, tk.accent, tk.soft, tk.line, tk.grad]);

  return (
    // Fixed viewport shell: the sidebar and top bar are locked; only each
    // screen's own PageScroll area scrolls. minHeight here (instead of height)
    // made inner 100% chains collapse, so the whole body scrolled — dragging
    // the sidebar with it.
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {!isMobile && <Sidebar screen={screen} setScreen={go} collapsed={sidebarCollapsed} onToggle={toggleSidebar} counts={navCounts} onExitToLanding={onExitToLanding} />}
      <main style={{
        flex: 1,
        width: isMobile ? '100%' : `calc(100vw - ${sw}px)`,
        maxWidth: '100%',
        minWidth: 0,               // lets flex children shrink instead of forcing sideways scroll
        display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
        // Leave room for the mobile tab bar so the last item isn't sitting under it.
        paddingBottom: isMobile ? 'calc(58px + env(safe-area-inset-bottom, 0px))' : 0,
        transition: 'width var(--dur-normal) var(--ease-smooth)',
      }}>
        <TopBar setScreen={go} onToggleSidebar={toggleSidebar} collapsed={sidebarCollapsed} />
        <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          <ScreenRouter screen={screen} setScreen={go} />
        </div>
      </main>
      {/* Without this there is literally no way to navigate on a phone — the
          sidebar is hidden and nothing replaces it. */}
      {isMobile && <MobileNav screen={screen} setScreen={go} counts={navCounts} onExitToLanding={onExitToLanding} />}
    </div>
  );
}

/* ── Mobile navigation ──────────────────────────────────────────────────────
   A phone has no room for the sidebar, so it gets a bottom tab bar with the
   five destinations people actually move between, plus "More" for the rest.
   Bottom-anchored because that is where thumbs are. */
const MOBILE_PRIMARY = ['dashboard', 'roadmaps', 'courses', 'assignments', 'cards'];

function MobileNav({ screen, setScreen, counts = {}, onExitToLanding }) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const allItems = NAV.flatMap(g => g.items);
  const primary = MOBILE_PRIMARY.map(id => allItems.find(i => i.id === id)).filter(Boolean);
  const rest = allItems.filter(i => !MOBILE_PRIMARY.includes(i.id));

  const countFor = (id) => (id === 'assignments' ? counts.assignments : id === 'cards' ? counts.cards : 0);

  const Tab = ({ item, active, onClick, label, icon }) => (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 3, padding: '7px 2px', background: 'none', border: 0, cursor: 'pointer',
        color: active ? 'var(--brand)' : 'var(--muted)', position: 'relative',
      }}
    >
      <span style={{ display: 'inline-flex', position: 'relative' }}>
        {React.cloneElement(I[icon] || I.home, { size: 19 })}
        {countFor(item?.id) > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -7, minWidth: 15, height: 15, padding: '0 3px',
            borderRadius: 999, background: 'var(--brand)', color: 'oklch(0.16 0.02 270)',
            fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>{countFor(item.id) > 99 ? '99+' : countFor(item.id)}</span>
        )}
      </span>
      <span style={{ fontSize: 9.5, fontWeight: active ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
        {label}
      </span>
    </button>
  );

  return (
    <>
      {moreOpen && (
        <div
          onClick={() => setMoreOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9996, background: 'oklch(0.12 0.02 270 / 0.6)', backdropFilter: 'blur(2px)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="keep-grid"
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 'calc(58px + env(safe-area-inset-bottom, 0px))',
              background: 'var(--surface)', borderTop: '1px solid var(--border)',
              borderRadius: '14px 14px 0 0', padding: 12,
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
            }}
          >
            {onExitToLanding && (
              <button key="__about"
                onClick={() => { setMoreOpen(false); onExitToLanding(); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 6px',
                  borderRadius: 10, cursor: 'pointer', background: 'var(--surface-2)',
                  border: '1px solid var(--border)', color: 'var(--ink-2)',
                }}>
                {React.cloneElement(I.home, { size: 18 })}
                <span style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.2 }}>About</span>
              </button>
            )}
            {rest.map(item => (
              <button key={item.id}
                onClick={() => { setScreen(item.id); setMoreOpen(false); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 6px',
                  borderRadius: 10, cursor: 'pointer',
                  background: screen === item.id ? 'color-mix(in oklch, var(--brand) 14%, transparent)' : 'var(--surface-2)',
                  border: `1px solid ${screen === item.id ? 'var(--brand)' : 'var(--border)'}`,
                  color: screen === item.id ? 'var(--brand)' : 'var(--ink-2)',
                }}>
                {React.cloneElement(I[item.icon] || I.home, { size: 18 })}
                <span style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.2 }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav
        aria-label="Main"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9997,
          display: 'flex', alignItems: 'stretch',
          background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--border)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          height: 'calc(58px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {primary.map(item => (
          <Tab key={item.id} item={item} icon={item.icon}
            label={item.id === 'cards' ? 'Review' : item.label}
            active={screen === item.id}
            onClick={() => { setMoreOpen(false); setScreen(item.id); }} />
        ))}
        <Tab item={null} icon="more" label="More" active={moreOpen || rest.some(r => r.id === screen)}
          onClick={() => setMoreOpen(o => !o)} />
      </nav>
    </>
  );
}

function ScreenRouter({ screen, setScreen }) {
  // height:100% is required for the Session screen's flex layout
  const wrap = (el) => <div key={screen} className="page-enter" style={{ height: '100%' }}>{el}</div>;
  switch (screen) {
    case 'dashboard':    return wrap(<Dashboard onOpenSession={() => setScreen('session')} onOpenRoadmap={() => setScreen('roadmaps')} onOpenCourses={() => setScreen('courses')} onOpenCards={() => setScreen('cards')} setScreen={setScreen} />);
    case 'session':      return wrap(<Session setScreen={setScreen} />);
    case 'roadmaps':     return wrap(<Roadmap onOpenSession={() => setScreen('session')} onOpenCourse={(slug) => { if (slug) { try { localStorage.setItem('learnos_open_course', slug); } catch {} } setScreen('courses'); }} />);
    case 'courses':      return wrap(<Courses setScreen={setScreen} />);
    case 'schedule':     return wrap(<Schedule setScreen={setScreen} />);
    case 'assignments':  return wrap(<Assignments />);
    case 'cards':        return wrap(<Flashcards />);
    case 'certificates': return wrap(<Certificates />);
    case 'share':        return wrap(<Share />);
    case 'feed':         return wrap(<Feed />);
    case 'starred':      return wrap(<Starred />);
    case 'agents':       return wrap(<AgentsPage setScreen={setScreen} />);
    case 'settings':     return wrap(<Settings />);
    default:             return wrap(<Dashboard onOpenSession={() => setScreen('session')} onOpenRoadmap={() => setScreen('roadmaps')} onOpenCourses={() => setScreen('courses')} onOpenCards={() => setScreen('cards')} setScreen={setScreen} />);
  }
}

/* ── Progress popup ─────────────────────────────────────────────────────────── */
function ProgressPopup({ onClose }) {
  const [stats, setStats]     = React.useState(null);
  const [roadmaps, setRoadmaps] = React.useState([]);
  const user = useUser();

  React.useEffect(() => {
    API.getStats().then(s => { if (s) setStats(s); }).catch(() => {});
    API.getRoadmaps().then(rows => { if (Array.isArray(rows)) setRoadmaps(rows.slice(0, 3)); }).catch(() => {});
  }, []);

  const level    = stats?.level     ?? user.level ?? 1;
  const xp       = stats?.xp        ?? user.xp    ?? 0;
  const xpToNext = stats?.xpToNext  ?? user.xpToNext ?? 500;
  const streak   = stats?.streak    ?? user.streak ?? 0;
  const mastery  = stats?.mastery   ?? 0;
  const pct      = Math.min(1, xp / Math.max(xpToNext, 1));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="display" style={{ fontSize: 22 }}>Your Progress</div>
        <button onClick={onClose} style={{ background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: 18, padding: 4 }}>✕</button>
      </div>

      {/* XP / Level */}
      <div style={{ padding: 16, background: 'linear-gradient(135deg, oklch(0.22 0.05 295), oklch(0.18 0.05 250))', borderRadius: 12, border: '1px solid var(--accent-line)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
          <div>
            <div className="cap" style={{ color: 'oklch(0.82 0.18 295)' }}>Level {level}</div>
            <div className="display" style={{ fontSize: 28, color: 'var(--ink)', marginTop: 2 }}>{xp.toLocaleString()} <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 400 }}>XP</span></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>to Level {level + 1}</div>
            <div className="display" style={{ fontSize: 18, color: 'var(--brand)' }}>{xpToNext.toLocaleString()} XP</div>
          </div>
        </div>
        <div style={{ background: 'oklch(1 0 0 / 0.1)', height: 6, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(pct * 100)}%`, height: '100%', background: 'var(--brand-grad)', borderRadius: 999, transition: 'width var(--dur-slow) var(--ease-out)' }} />
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: 'oklch(0.82 0.18 295)', marginTop: 6 }}>{Math.round(pct * 100)}% to next level</div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Streak',  value: `${streak}d`, sub: 'days',   color: 'oklch(0.75 0.18 45)' },
          { label: 'Mastery', value: `${mastery}%`, sub: 'avg',   color: 'var(--brand-3)' },
          { label: 'Sessions',value: stats?.totalSessions ?? '—', sub: 'total', color: 'var(--brand)' },
        ].map(s => (
          <div key={s.label} style={{ padding: 12, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' }}>
            <div className="display" style={{ fontSize: 22, color: s.color }}>{s.value}</div>
            <div className="cap" style={{ marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Roadmap progress */}
      {roadmaps.length > 0 && (
        <div>
          <div className="cap" style={{ marginBottom: 8 }}>Active Roadmaps</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {roadmaps.map(r => (
              <div key={r.id} style={{ padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{r.title}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{Math.round((r.mastery || 0) * 100)}%</span>
                </div>
                <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((r.mastery || 0) * 100)}%`, height: '100%', background: r.color || 'var(--brand-grad)', borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sidebar ──────────────────────────────────────────────────────────────── */
function Sidebar({ screen, setScreen, collapsed, onToggle, counts = {}, onExitToLanding }) {
  const { open: openModal, close: closeModal } = useModal();
  const user = useUser();
  const w = collapsed ? 64 : 240;
  return (
    <aside style={{
      width: w, flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'oklch(from var(--bg) calc(l - 0.005) c h)',
      display: 'flex', flexDirection: 'column',
      height: '100%',
      transition: 'width var(--dur-normal) var(--ease-smooth)',
      overflow: 'hidden',
    }}>
      {/* Logo — also the way back out to the landing page. */}
      <button
        onClick={() => onExitToLanding && onExitToLanding()}
        title="About LearnOS"
        aria-label="About LearnOS"
        className="sidebar-home"
        style={{
          padding: collapsed ? '16px 0' : '16px 18px',
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          justifyContent: collapsed ? 'center' : 'flex-start',
          background: 'none', border: 0, cursor: 'pointer', textAlign: 'left',
          transition: 'padding var(--dur-normal) var(--ease-smooth), background var(--dur-fast) var(--ease-smooth)',
        }}>
        <span className="sidebar-logo" style={{
          width: 32, height: 32, display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
          borderRadius: 8, background: 'var(--brand-grad)',
          boxShadow: '0 0 0 1px oklch(0.68 0.21 295 / 0.4), 0 0 18px oklch(0.68 0.21 295 / 0.4)',
          flexShrink: 0,
          transition: 'transform var(--dur-normal) var(--ease-spring), box-shadow var(--dur-normal) var(--ease-smooth)',
        }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <path d="M12 3 21 8v8l-9 5-9-5V8z" stroke="oklch(0.16 0.02 270)" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M3 8l9 5 9-5M12 13v9" stroke="oklch(0.16 0.02 270)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
          </svg>
        </span>
        {!collapsed && (
          <span className="display" style={{
            fontSize: 18, color: 'var(--ink)', letterSpacing: '-0.02em',
            whiteSpace: 'nowrap', overflow: 'hidden',
            animation: 'labelFadeIn var(--dur-normal) var(--ease-smooth) both',
          }}>LearnOS</span>
        )}
      </button>

      {/* Nav items */}
      <div className="scroll" style={{
        flex: 1, minHeight: 0,
        padding: collapsed ? '0 8px' : '0 10px',
        transition: 'padding var(--dur-normal) var(--ease-smooth)',
      }}>
        {NAV.map((g) => (
          <div key={g.group} style={{ marginBottom: 12 }}>
            {!collapsed && (
              <div className="cap sidebar-group-label" style={{
                padding: '10px 8px 6px', color: 'var(--faint)',
                fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em',
                whiteSpace: 'nowrap', overflow: 'hidden',
                animation: 'labelFadeIn var(--dur-normal) var(--ease-smooth) both',
              }}>{g.group}</div>
            )}
            {collapsed && <div style={{ height: 8 }} />}
            {g.items.map((n) => (
              <NavItem key={n.id} n={counts[n.id] != null ? { ...n, count: counts[n.id] } : n} active={screen === n.id} collapsed={collapsed} onClick={() => setScreen(n.id)} />
            ))}
          </div>
        ))}
      </div>

      {/* Progress card */}
      {!collapsed && (
        <div className="sidebar-plan-card" style={{
          margin: '6px 12px 10px', padding: 12,
          background: 'linear-gradient(135deg, oklch(0.22 0.05 295), oklch(0.18 0.05 250))',
          border: '1px solid var(--accent-line)', borderRadius: 10,
          whiteSpace: 'nowrap', overflow: 'hidden',
          transition: 'border-color var(--dur-normal) var(--ease-smooth), box-shadow var(--dur-normal) var(--ease-smooth)',
          animation: 'labelFadeIn var(--dur-normal) var(--ease-smooth) both',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="cap" style={{ color: 'oklch(0.82 0.18 295)' }}>Progress</span>
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{(user.xp || 0).toLocaleString()} XP</span>
          </div>
          <div className="display" style={{ fontSize: 16, color: 'var(--ink)' }}>Level {user.level}</div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', margin: '6px 0' }}>
            {Math.round(((user.xp || 0) / (user.xpToNext || 500)) * 100)}% to Level {(user.level || 1) + 1}
          </div>
          <div style={{ background: 'var(--surface-3)', height: 3, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(((user.xp || 0) / (user.xpToNext || 500)) * 100)}%`, height: '100%', background: 'var(--brand-grad)', borderRadius: 999, transition: 'width var(--dur-slow) var(--ease-out)' }} />
          </div>
          <Btn variant="outline" size="md" full style={{ marginTop: 8 }} onClick={() => openModal(<ProgressPopup onClose={closeModal} />)}>View Progress</Btn>
        </div>
      )}

      {/* User area */}
      <div style={{
        padding: collapsed ? '10px 0 14px' : '10px 14px 14px',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
        transition: 'padding var(--dur-normal) var(--ease-smooth)',
      }}>
        <Avatar name={user.name} size={32} hue={295} />
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0, animation: 'labelFadeIn var(--dur-normal) var(--ease-smooth) both' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{user.name}</div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ── NavItem ──────────────────────────────────────────────────────────────── */
function NavItem({ n, active, collapsed, onClick }) {
  return (
    <button onClick={onClick} title={collapsed ? n.label : undefined} className={`nav-item ${active ? 'nav-item-active' : ''}`}
      style={{
        appearance: 'none', width: '100%', border: 0,
        display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '10px 0' : '8px 10px',
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'oklch(0.82 0.18 295)' : 'var(--ink-2)',
        borderRadius: 8, margin: '2px 0', cursor: 'pointer',
        fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: active ? 600 : 500,
        transition: 'all var(--dur-fast) var(--ease-smooth)',
        position: 'relative', overflow: 'hidden',
      }}>
      <span style={{ width: 20, height: 20, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'transform var(--dur-normal) var(--ease-spring)' }}>
        {React.cloneElement(I[n.icon], { size: 16 })}
      </span>
      {!collapsed && (
        <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', transition: 'opacity var(--dur-normal)', animation: 'labelFadeIn var(--dur-normal) var(--ease-smooth) both' }}>{n.label}</span>
      )}
      {!collapsed && n.badge && (
        <span className="nav-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: 'var(--accent-soft)', color: 'oklch(0.82 0.18 295)', border: '1px solid var(--accent-line)', fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600 }}>{n.badge}</span>
      )}
      {!collapsed && n.tag && (
        <span className="nav-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: 'var(--cyan-soft)', color: 'var(--brand-3)', border: '1px solid var(--cyan-line)', fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600 }}>{n.tag}</span>
      )}
      {!collapsed && n.count != null && (
        <span className="mono" style={{ fontSize: 10.5, color: active ? 'oklch(0.82 0.18 295)' : 'var(--muted)', minWidth: 16, textAlign: 'right', flexShrink: 0 }}>{n.count}</span>
      )}
    </button>
  );
}

/* ── TopBar Search ────────────────────────────────────────────────────────── */
function TopBarSearch({ setScreen }) {
  const [query, setQuery]               = React.useState('');
  const [results, setResults]           = React.useState(null);
  const [loading, setLoading]           = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const { open: openModal, close: closeModal } = useModal();
  const searchRef = React.useRef(null);

  const doSearch = React.useCallback(async (q) => {
    if (!q.trim()) { setResults(null); setShowDropdown(false); return; }
    setLoading(true);
    setShowDropdown(true);
    try {
      const [courses, roadmaps, assignments, sessions] = await Promise.all([
        API.getCourses(q).catch(() => []),
        API.getRoadmaps().catch(() => []),
        API.getAssignments().catch(() => []),
        API.getSessions().catch(() => []),
      ]);
      const qLower = q.toLowerCase();
      const filtered = {
        courses: (courses || []).filter(c => c.title.toLowerCase().includes(qLower) || c.author.toLowerCase().includes(qLower)),
        roadmaps: (roadmaps || []).filter(r => r.title.toLowerCase().includes(qLower)),
        assignments: (assignments || []).filter(a => a.title.toLowerCase().includes(qLower)),
        sessions: (sessions || []).filter(s => s.title.toLowerCase().includes(qLower)),
      };
      setResults(filtered);
    } catch {
      setResults({ courses: [], roadmaps: [], assignments: [], sessions: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  React.useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.querySelector('input')?.focus();
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', handler); };
  }, []);

  const totalResults = results ? results.courses.length + results.roadmaps.length + results.assignments.length + results.sessions.length : 0;

  const ResultItem = ({ icon, label, sub, color, onClick }) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', width: '100%', background: 'none', border: 0, borderTop: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', transition: 'background var(--dur-fast)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <span style={{ width: 28, height: 28, borderRadius: 6, background: `color-mix(in oklch, ${color} 18%, transparent)`, color, border: `1px solid color-mix(in oklch, ${color} 35%, transparent)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 500 }}>{label}</div>
        {sub && <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>}
      </div>
    </button>
  );

  return (
    <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 14px', background: 'var(--surface)', border: `1px solid ${showDropdown && query ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 999, transition: 'border-color var(--dur-normal)' }}>
        <span style={{ color: 'var(--muted)' }}>{I.search}</span>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search courses, roadmaps, assignments…" style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontSize: 13, color: 'var(--ink)' }} />
        {!query && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, padding: '2px 6px', borderRadius: 5, background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>⌘K</span>}
        {query && <button onClick={() => { setQuery(''); setResults(null); setShowDropdown(false); }} style={{ background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', padding: 0, fontSize: 14 }}>✕</button>}
      </div>
      {showDropdown && query && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 1000, background: 'var(--bg-window)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-md)', maxHeight: 400, overflowY: 'auto', animation: 'pageEnter var(--dur-fast) var(--ease-out)' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Searching…</div>
          ) : totalResults === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No results for "{query}"</div>
          ) : (
            <>
              {results.courses.length > 0 && (
                <div>
                  <div className="cap" style={{ padding: '8px 12px 4px', color: 'var(--muted)', fontSize: 10.5 }}>Courses ({results.courses.length})</div>
                  {results.courses.slice(0, 3).map(c => (
                    <ResultItem key={c.slug} icon="📚" label={c.title} sub={c.author} color="var(--brand)"
                      onClick={() => { setShowDropdown(false); setQuery(''); setScreen('courses'); }} />
                  ))}
                </div>
              )}
              {results.roadmaps.length > 0 && (
                <div>
                  <div className="cap" style={{ padding: '8px 12px 4px', color: 'var(--muted)', fontSize: 10.5 }}>Roadmaps ({results.roadmaps.length})</div>
                  {results.roadmaps.slice(0, 3).map(r => (
                    <ResultItem key={r.id} icon="🗺" label={r.title} sub={`${Math.round((r.mastery || 0) * 100)}% mastery`} color="var(--brand-3)"
                      onClick={() => { setShowDropdown(false); setQuery(''); try { localStorage.setItem('learnos_active_roadmap', r.id); } catch {} setScreen('roadmaps'); }} />
                  ))}
                </div>
              )}
              {results.assignments.length > 0 && (
                <div>
                  <div className="cap" style={{ padding: '8px 12px 4px', color: 'var(--muted)', fontSize: 10.5 }}>Assignments ({results.assignments.length})</div>
                  {results.assignments.slice(0, 3).map(a => (
                    <ResultItem key={a.id} icon="✓" label={a.title} sub={a.course} color="oklch(0.74 0.18 25)"
                      onClick={() => { setShowDropdown(false); setQuery(''); setScreen('assignments'); }} />
                  ))}
                </div>
              )}
              {results.sessions.length > 0 && (
                <div>
                  <div className="cap" style={{ padding: '8px 12px 4px', color: 'var(--muted)', fontSize: 10.5 }}>Sessions ({results.sessions.length})</div>
                  {results.sessions.slice(0, 3).map(s => (
                    <ResultItem key={s.id} icon="▸" label={s.title} sub={s.course || 'Session'} color="var(--brand-3)"
                      onClick={() => { setShowDropdown(false); setQuery(''); try { localStorage.setItem('learnos_active_session', s.id); } catch {} setScreen('session'); }} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── TopBar ───────────────────────────────────────────────────────────────── */
function TopBar({ setScreen, onToggleSidebar, collapsed }) {
  const user = useUser();
  const [showUserMenu, setShowUserMenu]           = React.useState(false);
  const [showNotifs, setShowNotifs]               = React.useState(false);
  const [notifs, setNotifs]                       = React.useState([]);
  const [notifsLoading, setNotifsLoading]         = React.useState(false);
  const [unread, setUnread]                       = React.useState(0);
  const menuRef  = React.useRef(null);
  const notifRef = React.useRef(null);

  const kindMeta = {
    quiz:       { icon: '✓', color: 'var(--good)',    label: 'Quiz' },
    assignment: { icon: '↑', color: 'var(--brand)',   label: 'Assignment' },
    cert:       { icon: '🎓', color: 'oklch(0.78 0.16 85)', label: 'Certificate' },
    session:    { icon: '▸', color: 'var(--brand-3)', label: 'Session' },
  };

  // Unread count is tracked server-side (users.notifications_seen_at), so it
  // is consistent across reloads and browsers. Refreshed on mount + every 60s.
  React.useEffect(() => {
    let alive = true;
    const tick = () => API.getUnreadNotifs().then(r => { if (alive) setUnread(r?.count || 0); }).catch(() => {});
    tick();
    const interval = setInterval(tick, 60000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  const openNotifs = () => {
    if (showNotifs) { setShowNotifs(false); return; }
    setShowNotifs(true);
    setUnread(0);
    API.markNotifsSeen().catch(() => {});
    setNotifsLoading(true);
    API.getActivity().then(rows => {
      setNotifs((rows || []).slice(0, 8));
    }).catch(() => {}).finally(() => setNotifsLoading(false));
  };

  React.useEffect(() => {
    const handler = (e) => {
      if (menuRef.current  && !menuRef.current.contains(e.target))  setShowUserMenu(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header style={{
      height: 58, flexShrink: 0, borderBottom: '1px solid var(--border)',
      background: 'oklch(from var(--bg) calc(l - 0.005) c h)',
      display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px',
    }}>
      <button onClick={onToggleSidebar} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all var(--dur-fast) var(--ease-smooth)' }}>
        <span style={{ display: 'inline-flex', transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-normal) var(--ease-spring)' }}>
          {React.cloneElement(I.chevronL, { size: 14 })}
        </span>
      </button>

      <TopBarSearch setScreen={setScreen} />

      <div style={{ flex: 1, minWidth: 0 }} />

      {/* Notifications */}
      <div ref={notifRef} style={{ position: 'relative' }}>
        <button onClick={openNotifs} title="Notifications"
          style={{ width: 36, height: 36, borderRadius: 8, border: 0, background: showNotifs ? 'var(--surface)' : 'transparent', color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', transition: 'all var(--dur-fast)' }}>
          {React.cloneElement(I.bell, { size: 18 })}
          {unread > 0 && <span style={{ position: 'absolute', top: 4, right: 4, background: 'var(--bad)', color: 'oklch(0.16 0.02 270)', fontSize: 9, fontWeight: 700, padding: '0 4px', borderRadius: 999, minWidth: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>}
        </button>

        {showNotifs && (
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1000, width: 360, maxHeight: 480, background: 'var(--bg-window)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-md)', animation: 'pageEnter var(--dur-fast) var(--ease-out)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div className="display" style={{ fontSize: 14 }}>Notifications</div>
              <button onClick={() => setShowNotifs(false)} style={{ background: 'none', border: 0, color: 'var(--brand)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Close</button>
            </div>
            <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
              {notifsLoading ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
              ) : notifs.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No activity yet.</div>
              ) : notifs.map((n, i) => {
                const m = kindMeta[n.kind] || kindMeta.session;
                return (
                  <div key={n.id || i} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderTop: i === 0 ? 0 : '1px solid var(--border)', cursor: 'pointer', transition: 'background var(--dur-fast)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => setShowNotifs(false)}>
                    <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, background: `color-mix(in oklch, ${m.color} 18%, transparent)`, color: m.color, border: `1px solid color-mix(in oklch, ${m.color} 40%, transparent)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{m.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.4 }}>{n.text}</div>
                      {n.sub && <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{n.sub}</div>}
                    </div>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0, marginTop: 2 }}>{timeAgo(n.created_at)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* User menu */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button className="topbar-user" onClick={() => setShowUserMenu(!showUserMenu)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 12px 5px 5px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, cursor: 'pointer' }}>
          <Avatar name={user.name} size={28} hue={295} avatarUrl={user.avatar_url} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1 }}>{user.name}</div>
              {user.role === 'admin' && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'var(--brand)', color: 'oklch(0.16 0.02 270)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admin</span>}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Level {user.level} · {(user.xp || 0).toLocaleString()} XP</div>
          </div>
          <span style={{ color: 'var(--muted)', flexShrink: 0, transform: showUserMenu ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-normal) var(--ease-spring)' }}>{React.cloneElement(I.chevronD, { size: 14 })}</span>
        </button>

        {showUserMenu && (
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1000, background: 'var(--bg-window)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, minWidth: 160, boxShadow: 'var(--shadow-md)', animation: 'pageEnter var(--dur-fast) var(--ease-out)' }}>
            <MenuBtn icon={I.cog}    label="Settings"  onClick={() => { setScreen('settings'); setShowUserMenu(false); }} />
          </div>
        )}
      </div>
    </header>
  );
}

function MenuBtn({ icon, label, danger, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
        background: hover ? 'var(--surface)' : 'none', border: 0,
        color: danger ? 'var(--bad)' : 'var(--ink-2)', fontSize: 13, cursor: 'pointer',
        borderRadius: 7, textAlign: 'left', transition: 'all var(--dur-fast)',
      }}>
      {React.cloneElement(icon, { size: 14 })} {label}
    </button>
  );
}

export { useToast, useModal, ToastContext, ModalContext };
