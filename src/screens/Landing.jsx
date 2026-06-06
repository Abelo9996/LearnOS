import React from 'react';
import { I } from '../components/Icons';
import { Card, Btn, Tag, Avatar, AgentChip } from '../components/UI';
import { AGENTS, LEARNING_PROGRESS } from '../data/data';

/* ═══════════════════════════════════════════════════════════════════════════
   Shared landing primitives
   ═══════════════════════════════════════════════════════════════════════════ */

function Eyebrow({ children, style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '7px 16px', borderRadius: 999,
      background: 'oklch(0.18 0.03 270 / 0.6)',
      border: '1px solid var(--border-strong)',
      boxShadow: '0 0 24px oklch(0.68 0.21 295 / 0.22), inset 0 1px 0 oklch(1 0 0 / 0.05)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em',
      ...style,
    }}>{children}</span>
  );
}

function SectionHeading({ eyebrow, title, sub, max = 660 }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', gap: 18, maxWidth: max, margin: '0 auto',
    }}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="display" style={{
        margin: 0, fontSize: 52, lineHeight: 1.04, letterSpacing: '-0.035em',
        fontWeight: 700, color: 'var(--ink)',
      }}>{title}</h2>
      {sub && <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: 'var(--muted)', maxWidth: max }}>{sub}</p>}
    </div>
  );
}

function GlowCard({ children, glow = 'tl', tone = 'brand', pad = 28, radius = 24, bright = false, interactive = false, style, ...rest }) {
  const c = tone === 'cyan' ? 'var(--brand-3)' : tone === 'rose' ? 'oklch(0.74 0.18 25)' : 'var(--brand)';
  const pos = { tl: '0% 0%', tr: '100% 0%', bl: '0% 100%', br: '100% 100%', c: '50% 0%' }[glow] || '0% 0%';
  const glowLayer = bright
    ? `radial-gradient(120% 120% at ${pos}, color-mix(in oklch, ${c} 34%, transparent), transparent 60%)`
    : `radial-gradient(90% 90% at ${pos}, color-mix(in oklch, ${c} 18%, transparent), transparent 62%)`;
  const baseShadow = 'inset 0 1px 0 oklch(1 0 0 / 0.04), 0 24px 60px oklch(0 0 0 / 0.45)';
  return (
    <div {...rest} style={{
      position: 'relative', overflow: 'hidden', borderRadius: radius, padding: pad,
      background: `${glowLayer}, oklch(0.155 0.022 270 / 0.5)`,
      border: '1px solid var(--border)', boxShadow: baseShadow,
      transition: interactive ? 'transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease' : undefined,
      ...style,
    }}
      onMouseEnter={interactive ? (e) => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.borderColor = `color-mix(in oklch, ${c} 55%, var(--border))`;
        e.currentTarget.style.boxShadow = `${baseShadow}, 0 0 0 1px color-mix(in oklch, ${c} 30%, transparent), 0 18px 50px color-mix(in oklch, ${c} 20%, transparent)`;
      } : undefined}
      onMouseLeave={interactive ? (e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = baseShadow;
      } : undefined}>{children}</div>
  );
}

function PillBtn({ children, variant = 'outline', icon, iconRight, onClick, size = 'lg' }) {
  const h = size === 'lg' ? 50 : 42;
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
    height: h, padding: `0 ${size === 'lg' ? 26 : 18}px`, borderRadius: 999,
    fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
    border: '1px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'transform 140ms ease, filter 140ms ease, background 140ms ease',
  };
  const variants = {
    primary: { background: 'var(--brand-grad)', color: 'oklch(0.15 0.02 270)', boxShadow: '0 0 0 1px oklch(0.68 0.21 295 / 0.5), 0 8px 30px oklch(0.68 0.21 295 / 0.4)' },
    outline: { background: 'oklch(0.18 0.03 270 / 0.5)', color: 'var(--ink)', borderColor: 'var(--border-strong)', boxShadow: 'inset 0 1px 0 oklch(1 0 0 / 0.05)' },
  };
  return (
    <button onClick={onClick} style={{ ...base, ...variants[variant] }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; if (variant === 'primary') e.currentTarget.style.filter = 'brightness(1.08)'; else e.currentTarget.style.background = 'oklch(0.22 0.035 270 / 0.7)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.filter = 'none'; if (variant === 'outline') e.currentTarget.style.background = 'oklch(0.18 0.03 270 / 0.5)'; }}>
      {icon}{children}{iconRight}
    </button>
  );
}

function BrandGlyph({ size = 32 }) {
  return (
    <span style={{
      width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: size / 4, background: 'var(--brand-grad)',
      boxShadow: '0 0 0 1px oklch(0.68 0.21 295 / 0.4), 0 0 18px oklch(0.68 0.21 295 / 0.4)',
    }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <path d="M12 3 21 8v8l-9 5-9-5V8z" stroke="oklch(0.16 0.02 270)" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M3 8l9 5 9-5M12 13v9" stroke="oklch(0.16 0.02 270)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      </svg>
    </span>
  );
}

function BrandLockup({ size = 32, font = 19 }) {
  return (
    <a href="#hero" onClick={(e) => { e.preventDefault(); document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--ink)' }}>
      <BrandGlyph size={size} />
      <span className="display" style={{ fontSize: font, color: 'var(--ink)', fontWeight: 700 }}>LearnOS</span>
    </a>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Ambient background
   ═══════════════════════════════════════════════════════════════════════════ */

function LandingAmbient() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* violet–cyan radial dot pattern */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundColor: 'oklch(0.65 0.15 295)',
        backgroundImage: [
          'radial-gradient(circle at 50% 40%, oklch(0.72 0.14 295 / 0.55) 0%, oklch(0.65 0.15 295 / 0.35) 25%, oklch(0.55 0.12 295 / 0.15) 50%, transparent 70%)',
          'repeating-radial-gradient(circle at 50% 40%, oklch(0.80 0.12 195 / 0.18) 0px, oklch(0.80 0.12 195 / 0.18) 3px, transparent 6px, transparent 14px)',
          'radial-gradient(circle at 30% 65%, oklch(0.76 0.14 200 / 0.22) 0%, transparent 55%)',
          'radial-gradient(circle at 75% 30%, oklch(0.70 0.16 280 / 0.20) 0%, transparent 50%)',
        ].join(', '),
        backgroundBlendMode: 'multiply',
      }} />
      {/* soft glow blobs for depth */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-5%', width: '50%', height: '60%',
        borderRadius: '50%',
        background: 'radial-gradient(circle, oklch(0.74 0.18 295 / 0.20), transparent 65%)',
        filter: 'blur(60px)',
      }} />
      <div style={{
        position: 'absolute', top: '20%', right: '-8%', width: '45%', height: '55%',
        borderRadius: '50%',
        background: 'radial-gradient(circle, oklch(0.78 0.14 195 / 0.18), transparent 65%)',
        filter: 'blur(60px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '5%', left: '15%', width: '40%', height: '40%',
        borderRadius: '50%',
        background: 'radial-gradient(circle, oklch(0.70 0.16 280 / 0.14), transparent 65%)',
        filter: 'blur(50px)',
      }} />
    </div>
  );
}

function Starfield({ count = 60, seed = 1 }) {
  const stars = React.useMemo(() => {
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    return Array.from({ length: count }, () => ({
      x: rnd() * 100, y: rnd() * 100, sz: 1 + rnd() * 1.6, d: 2 + rnd() * 4, delay: rnd() * 4, bright: rnd() > 0.7,
    }));
  }, [count, seed]);
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {stars.map((st, i) => (
        <span key={i} className="lp-anim-star" style={{
          position: 'absolute', left: `${st.x}%`, top: `${st.y}%`,
          width: st.sz, height: st.sz, borderRadius: 999,
          background: st.bright ? 'var(--brand-3)' : 'oklch(0.95 0.01 270)',
          boxShadow: st.bright ? '0 0 6px var(--brand-3)' : 'none',
          animation: `ltwinkle ${st.d}s ease-in-out ${st.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

function AuroraBeam() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div className="lp-anim-beam" style={{
        position: 'absolute', top: -140, left: '50%', transform: 'translateX(-50%)',
        width: 760, height: 880,
        background: 'radial-gradient(46% 60% at 50% 0%, oklch(0.78 0.16 195 / 0.30), transparent 70%)',
        filter: 'blur(28px)', animation: 'lbeam 7s ease-in-out infinite',
      }} />
      <div className="lp-anim-beam" style={{
        position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)',
        width: 168, height: 820,
        background: 'linear-gradient(to bottom, oklch(0.82 0.16 190 / 0.65) 0%, oklch(0.7 0.2 295 / 0.40) 42%, oklch(0.68 0.21 295 / 0.12) 70%, transparent 100%)',
        filter: 'blur(26px)', animation: 'lbeam 7s ease-in-out infinite',
      }} />
      <div className="lp-anim-beam" style={{
        position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)',
        width: 36, height: 560,
        background: 'linear-gradient(to bottom, oklch(0.96 0.06 190 / 0.85), oklch(0.82 0.16 250 / 0.3) 55%, transparent)',
        filter: 'blur(10px)', animation: 'lbeam 5s ease-in-out infinite',
      }} />
    </div>
  );
}

function NeonFrame({ children, style }) {
  return (
    <div style={{
      position: 'relative', borderRadius: 28, padding: 3,
      background: 'linear-gradient(160deg, var(--brand-3), var(--brand) 55%, oklch(0.5 0.18 295))',
      boxShadow: '0 0 0 1px oklch(0.68 0.21 295 / 0.4), 0 0 50px oklch(0.7 0.2 290 / 0.45), 0 0 120px oklch(0.78 0.16 195 / 0.25), 0 40px 120px oklch(0 0 0 / 0.6)',
      ...style,
    }}>
      <div style={{ borderRadius: 25, overflow: 'hidden', background: 'oklch(0.12 0.02 270)', border: '1px solid oklch(0.2 0.03 270)' }}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Dashboard preview (inside NeonFrame)
   ═══════════════════════════════════════════════════════════════════════════ */

function DashboardPreview() {
  const nav = [
    { l: 'Dashboard', i: 'home', on: true },
    { l: 'Roadmaps', i: 'graph' },
    { l: 'Sessions', i: 'cap' },
    { l: 'Courses', i: 'book' },
    { l: 'Certificates', i: 'ribbon' },
  ];
  const stats = [
    { l: 'Overall mastery', v: '68', u: '%', d: '+6% this week', acc: 'var(--brand)' },
    { l: 'Day streak', v: '12', u: 'days', d: 'Best 18', acc: 'oklch(0.78 0.16 75)' },
    { l: 'XP earned', v: '2,350', u: 'xp', d: '+420 this week', acc: 'var(--brand-3)' },
    { l: 'Certificates', v: '3', u: 'earned', d: '+1 this month', acc: 'oklch(0.74 0.18 25)' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', minHeight: 440, fontSize: 12 }}>
      <div style={{ borderRight: '1px solid var(--border)', padding: '16px 12px', background: 'oklch(0.115 0.018 270)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 8px 16px' }}>
          <BrandGlyph size={22} />
          <span className="display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>LearnOS</span>
        </div>
        {nav.map((n) => (
          <div key={n.l} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, marginBottom: 3,
            background: n.on ? 'var(--accent-soft)' : 'transparent',
            border: n.on ? '1px solid var(--accent-line)' : '1px solid transparent',
            color: n.on ? 'oklch(0.82 0.18 295)' : 'var(--ink-2)', fontWeight: n.on ? 600 : 500,
          }}>
            {React.cloneElement(I[n.i], { size: 16 })}<span>{n.l}</span>
          </div>
        ))}
        <div style={{ marginTop: 18, padding: 12, borderRadius: 10, background: 'linear-gradient(135deg, oklch(0.22 0.05 295), oklch(0.17 0.04 250))', border: '1px solid var(--accent-line)' }}>
          <div className="cap" style={{ color: 'oklch(0.82 0.18 295)', fontSize: 9.5 }}>Pro plan</div>
          <div className="display" style={{ fontSize: 15, color: 'var(--ink)', marginTop: 4 }}>Level 4</div>
          <div style={{ height: 4, borderRadius: 999, background: 'oklch(0.3 0.03 270)', marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: '68%', height: '100%', background: 'var(--brand-grad)' }} />
          </div>
        </div>
      </div>
      <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16, background: 'oklch(0.125 0.02 270)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div className="display" style={{ fontSize: 19, color: 'var(--ink)' }}>Welcome back, Alex</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Pick up where you left off — Machine Learning Engineer</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, background: 'oklch(0.17 0.025 270)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
              {React.cloneElement(I.search, { size: 14 })}<span style={{ fontSize: 11.5 }}>Search…</span>
            </div>
            <Avatar name="Alex Learner" size={32} hue={295} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {stats.map((s) => (
            <div key={s.l} style={{ padding: 14, borderRadius: 12, background: 'oklch(0.155 0.022 270)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.l}</div>
              <div className="display" style={{ fontSize: 26, color: 'var(--ink)', marginTop: 7, lineHeight: 1 }}>{s.v}<span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginLeft: 4 }}>{s.u}</span></div>
              <div style={{ fontSize: 10.5, color: s.acc, marginTop: 8, fontFamily: 'var(--font-mono)' }}>{s.d}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 12, flex: 1 }}>
          <div style={{ padding: 16, borderRadius: 12, background: 'oklch(0.155 0.022 270)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {React.cloneElement(I.chart, { size: 15, stroke: 'var(--brand)' })}
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>Learning hours</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--brand-3)', fontFamily: 'var(--font-mono)' }}>13.1h</span>
            </div>
            <AreaChart />
          </div>
          <div style={{ padding: 16, borderRadius: 12, background: 'oklch(0.155 0.022 270)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', alignSelf: 'flex-start' }}>Roadmap progress</span>
            <Gauge value={0.68} />
            <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>14 / 24 modules</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AreaChart() {
  const data = LEARNING_PROGRESS.map((d) => d.v);
  const w = 380, h = 96, max = Math.max(...data) * 1.15;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - (v / max) * h]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 96, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="lp-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.68 0.21 295 / 0.45)" />
          <stop offset="100%" stopColor="oklch(0.68 0.21 295 / 0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lp-area)" />
      <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => i === pts.length - 1 && (
        <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="var(--brand-3)" stroke="oklch(0.12 0.02 270)" strokeWidth="2" />
      ))}
    </svg>
  );
}

function Gauge({ value }) {
  const r = 52, cx = 64, cy = 64, c = Math.PI * r;
  return (
    <svg viewBox="0 0 128 78" style={{ width: 130, height: 80 }}>
      <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="oklch(0.25 0.03 270)" strokeWidth="10" strokeLinecap="round" />
      <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="url(#lp-gauge)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} />
      <defs>
        <linearGradient id="lp-gauge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--brand-3)" /><stop offset="100%" stopColor="var(--brand)" />
        </linearGradient>
      </defs>
      <text x={cx} y={cy - 8} textAnchor="middle" className="display" fill="var(--ink)" style={{ fontSize: 22 }}>68%</text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page sections
   ═══════════════════════════════════════════════════════════════════════════ */

const SECT = { marginTop: 112 };

function Marquee() {
  const providers = ['OpenAI', 'Anthropic', 'Gemini', 'Mistral', 'Llama', 'Cohere', 'Groq', 'Ollama', 'DeepSeek'];
  const row = [...providers, ...providers];
  return (
    <section style={{ ...SECT, marginTop: 84, opacity: 1 }}>
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <span className="cap" style={{ color: 'var(--ink)' }}>Bring your own model — works with every major provider</span>
      </div>
      <div className="lp-marquee" style={{
        position: 'relative', overflow: 'hidden',
        maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
      }}>
        <div className="lp-marquee-track" style={{ display: 'flex', gap: 56, width: 'max-content', alignItems: 'center' }}>
          {row.map((p, i) => (
            <span key={i} style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{p}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatementBlock() {
  return (
    <section style={{ ...SECT, opacity: 1 }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 28 }}>
        <Eyebrow>Why LearnOS</Eyebrow>
        <p className="display" style={{ margin: 0, fontSize: 40, lineHeight: 1.26, letterSpacing: '-0.03em', fontWeight: 600 }}>
          <span style={{ color: 'var(--ink)' }}>A team of AI agents teaches, quizzes, reviews, and mentors you</span>
          <span style={{ color: 'var(--muted)' }}> — adapting to how you learn, citing real sources, and tracking mastery from first principles all the way to a verifiable certificate.</span>
        </p>
      </div>
    </section>
  );
}

function SpotlightCards() {
  return (
    <section style={{ ...SECT, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'stretch', opacity: 1 }}>
      <GlowCard glow="tl" tone="brand" bright interactive pad={32} style={{ display: 'flex', flexDirection: 'column' }}>
        <Eyebrow>Your faculty</Eyebrow>
        <h3 className="display" style={{ fontSize: 28, margin: '18px 0 10px', letterSpacing: '-0.03em', color: 'var(--ink)' }}>A team of agents on your side</h3>
        <p style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 22px', maxWidth: 400 }}>Seven specialized agents collaborate to profile you, plan a path, teach, quiz for mastery, and certify what you know.</p>
        <div style={{ marginTop: 'auto' }}><AgentRoster /></div>
      </GlowCard>
      <GlowCard glow="tr" tone="cyan" bright interactive pad={32} style={{ display: 'flex', flexDirection: 'column' }}>
        <Eyebrow>Open by design</Eyebrow>
        <h3 className="display" style={{ fontSize: 28, margin: '18px 0 10px', letterSpacing: '-0.03em', color: 'var(--ink)' }}>Bring your own model</h3>
        <p style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 22px', maxWidth: 400 }}>Plug in any provider with your own API key. Your keys, your data, your choice — no lock-in, ever.</p>
        <div style={{ marginTop: 'auto' }}><ModelPicker /></div>
      </GlowCard>
    </section>
  );
}

function AgentRoster() {
  const roles = {
    PR: 'Learns your goals, pace & background', CR: 'Builds your personalized roadmap',
    TU: 'Teaches concepts & answers questions', AS: 'Generates quizzes & scores mastery',
    RE: 'Finds, summarizes & cites sources', AN: 'Tracks progress & surfaces insights',
    CE: 'Issues verifiable certificates',
  };
  const codes = ['PR', 'CR', 'TU', 'AS', 'RE', 'AN', 'CE'];
  const [hover, setHover] = React.useState('TU');
  return (
    <div style={{ borderRadius: 16, background: 'oklch(0.11 0.018 270)', border: '1px solid var(--border)', padding: 8 }}>
      {codes.map((code) => {
        const a = AGENTS[code];
        const on = hover === code;
        return (
          <div key={code} onMouseEnter={() => setHover(code)} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '9px 11px', borderRadius: 11,
            background: on ? `color-mix(in oklch, ${a.color} 14%, transparent)` : 'transparent',
            border: on ? `1px solid color-mix(in oklch, ${a.color} 40%, transparent)` : '1px solid transparent',
            transition: 'background 140ms, border-color 140ms', cursor: 'default',
          }}>
            <AgentChip code={code} size={32} glow={on} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{a.name} Agent</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{roles[code]}</div>
            </div>
            <span className="mono" style={{ fontSize: 10.5, color: on ? a.color : 'var(--faint)' }}>{code}</span>
          </div>
        );
      })}
    </div>
  );
}

function ModelPicker() {
  const providers = [
    { id: 'anthropic', name: 'Anthropic', model: 'claude-sonnet-4', mono: 'CL', hue: 25 },
    { id: 'openai', name: 'OpenAI', model: 'gpt-4o', mono: 'AI', hue: 160 },
    { id: 'google', name: 'Google', model: 'gemini-2.0-pro', mono: 'GM', hue: 250 },
    { id: 'mistral', name: 'Mistral', model: 'mistral-large', mono: 'MS', hue: 295 },
  ];
  const [sel, setSel] = React.useState('anthropic');
  const cur = providers.find((p) => p.id === sel);
  return (
    <div style={{ borderRadius: 16, background: 'oklch(0.11 0.018 270)', border: '1px solid var(--border)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {providers.map((p) => {
          const on = sel === p.id;
          return (
            <button key={p.id} onClick={() => setSel(p.id)} style={{
              appearance: 'none', textAlign: 'left', width: '100%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 11,
              background: on ? 'var(--accent-soft)' : 'oklch(0.135 0.02 270)',
              border: on ? '1px solid var(--accent-line)' : '1px solid var(--border)',
              transition: 'all 140ms',
            }}>
              <span style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(135deg, oklch(0.7 0.16 ${p.hue}), oklch(0.78 0.14 ${(p.hue + 50) % 360}))`,
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'oklch(0.16 0.02 270)',
              }}>{p.mono}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{p.model}</div>
              </div>
              <span style={{
                width: 18, height: 18, borderRadius: 999, flexShrink: 0,
                border: on ? '5px solid var(--brand)' : '2px solid var(--border-strong)',
                background: on ? 'var(--brand)' : 'transparent',
                boxShadow: on ? 'inset 0 0 0 3px oklch(0.11 0.018 270)' : 'none',
              }} />
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 11, background: 'oklch(0.135 0.02 270)', border: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--muted)' }}>{React.cloneElement(I.api, { size: 16 })}</span>
        <span className="mono" style={{ flex: 1, fontSize: 12, color: 'var(--ink-2)', letterSpacing: 0 }}>{cur.id}-key-••••••3f2</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--good)' }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--good)', boxShadow: '0 0 8px var(--good)' }} />
          Connected
        </span>
      </div>
    </div>
  );
}

function FeatureGrid() {
  const items = [
    { i: 'cap', t: 'AI Agents as Teachers', b: 'Specialized agents teach, quiz, review, and guide you one-on-one — never a pre-recorded lecture.', tone: 'brand' },
    { i: 'check', t: 'Mastery-Based Learning', b: 'Progress only when you have truly understood. Spaced review keeps it locked in for good.', tone: 'cyan' },
    { i: 'api', t: 'Bring Your Own API Key', b: 'Use any LLM provider you prefer. You own your keys, your data, and your costs.', tone: 'rose' },
    { i: 'fork', t: 'GitHub for Courses', b: 'Version your learning. Fork, PR, and contribute to a living library of community courses.', tone: 'brand' },
    { i: 'shield', t: 'Local-First & Private', b: 'Your data stays on your device. Works offline, always in sync, nothing to leak.', tone: 'cyan' },
    { i: 'ribbon', t: 'Verifiable Certificates', b: 'Earn signed, shareable certificates that prove mastery — not just attendance.', tone: 'rose' },
  ];
  return (
    <section style={{ ...SECT, opacity: 1 }}>
      <SectionHeading eyebrow="Smart, agent-native learning" title="Everything you need to master anything" sub="LearnOS pairs a faculty of AI agents with mastery-based progression, so every learner gets a path built for them." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 52 }}>
        {items.map((f) => {
          const c = f.tone === 'cyan' ? 'var(--brand-3)' : f.tone === 'rose' ? 'oklch(0.74 0.18 25)' : 'var(--brand)';
          return (
            <GlowCard key={f.t} glow="tr" tone={f.tone} interactive pad={26} radius={20} style={{ minHeight: 196 }}>
              <span style={{
                width: 46, height: 46, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: `color-mix(in oklch, ${c} 16%, transparent)`, border: `1px solid color-mix(in oklch, ${c} 38%, transparent)`,
                color: c, marginBottom: 18,
              }}>{React.cloneElement(I[f.i], { size: 22 })}</span>
              <h3 className="display" style={{ fontSize: 20, margin: '0 0 9px', letterSpacing: '-0.02em', color: 'var(--ink)' }}>{f.t}</h3>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>{f.b}</p>
            </GlowCard>
          );
        })}
      </div>
    </section>
  );
}

function ProgressSplit() {
  const rows = [
    { l: 'Modules mastered', v: '14 / 24' }, { l: 'Day streak', v: '12' }, { l: 'Certificates earned', v: '3' },
  ];
  return (
    <section style={{ ...SECT, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center', opacity: 1 }}>
      <GlowCard glow="bl" tone="brand" bright pad={30} radius={24}>
        <h3 className="display" style={{ fontSize: 24, margin: '0 0 22px', letterSpacing: '-0.025em', color: 'var(--ink)', maxWidth: 260 }}>Your mastery, quantified in real time</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r) => (
            <div key={r.l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderRadius: 14, background: 'oklch(0.115 0.018 270)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14.5, color: 'var(--ink-2)' }}>{r.l}</span>
              <span className="display" style={{ fontSize: 26, color: 'var(--ink)' }}>{r.v}</span>
            </div>
          ))}
        </div>
      </GlowCard>
      <div>
        <Eyebrow>Mastery-based</Eyebrow>
        <h3 className="display" style={{ fontSize: 40, margin: '20px 0 16px', letterSpacing: '-0.03em', lineHeight: 1.08, color: 'var(--ink)' }}>Learn deeply.<br />Prove it for real.</h3>
        <p style={{ fontSize: 16, color: 'var(--muted)', lineHeight: 1.62, margin: 0, maxWidth: 440 }}>Every quiz, assignment, and session updates a live mastery signal. You advance only when you have genuinely understood — and walk away with a verifiable certificate that means something.</p>
        <div style={{ display: 'flex', gap: 18, marginTop: 26, flexWrap: 'wrap' }}>
          {['Adaptive quizzes', 'Spaced review', 'Signed certificates'].map((t) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: 'var(--ink-2)' }}>
              <span style={{ color: 'var(--good)' }}>{React.cloneElement(I.check, { size: 16 })}</span>{t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: '01', t: 'Pick a roadmap', b: 'Choose a goal and the Curriculum agent builds a personalized path — or fork one from the community.' },
    { n: '02', t: 'Learn with your agents', b: 'Sit in live sessions with the Tutor agent, get quizzed for mastery, and review with spaced repetition.' },
    { n: '03', t: 'Earn your certificate', b: 'Hit mastery and the Certification agent issues a signed, shareable certificate you actually own.' },
  ];
  return (
    <section style={{ ...SECT, opacity: 1 }}>
      <SectionHeading eyebrow="How it works" title="From zero to mastery, in three steps" sub="A guided loop that adapts to you — pick a path, learn with agents, and prove what you know." />
      <div style={{ position: 'relative', marginTop: 60, maxWidth: 940, marginLeft: 'auto', marginRight: 'auto' }}>
        <div style={{ position: 'absolute', left: '50%', top: 10, bottom: 10, width: 2, transform: 'translateX(-50%)', background: 'repeating-linear-gradient(to bottom, var(--border-strong) 0 6px, transparent 6px 14px)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          {steps.map((s, i) => {
            const leftSide = i % 2 === 0;
            return (
              <div key={s.n} style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', alignItems: 'center', columnGap: 0 }}>
                <div style={{ gridColumn: leftSide ? 1 : 3, gridRow: 1 }}>
                  <GlowCard glow={leftSide ? 'tr' : 'tl'} tone={i === 1 ? 'cyan' : 'brand'} pad={26} radius={20}>
                    <div style={{ width: 44, height: 44, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.11 0.018 270)', border: '1px solid var(--border-strong)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 16 }}>{s.n}</div>
                    <h3 className="display" style={{ fontSize: 23, margin: '0 0 9px', letterSpacing: '-0.025em', color: 'var(--ink)' }}>{s.t}</h3>
                    <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>{s.b}</p>
                  </GlowCard>
                </div>
                <div style={{ gridColumn: 2, gridRow: 1, display: 'flex', justifyContent: 'center' }}>
                  <span style={{ width: 18, height: 18, borderRadius: 999, background: 'var(--brand-3)', boxShadow: '0 0 0 5px oklch(0.78 0.16 195 / 0.18), 0 0 22px var(--brand-3)', animation: `lfloat ${4 + i}s ease-in-out infinite` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ScreenShowcase({ onEnterApp }) {
  const tiles = [
    { t: 'Dashboard', s: 'Your learning command center.', k: 'dash', tone: 'brand' },
    { t: 'Roadmaps', s: 'Personalized paths to mastery.', k: 'roadmap', tone: 'cyan' },
    { t: 'Sessions', s: 'Live learning with the Tutor agent.', k: 'session', tone: 'brand' },
    { t: 'Certificates', s: 'Prove your mastery. Share anywhere.', k: 'cert', tone: 'rose' },
  ];
  return (
    <section style={{ ...SECT, opacity: 1 }}>
      <SectionHeading eyebrow="See it in action" title="One workspace for the whole journey" sub="Every screen is built around your mastery — explore the product before you sign in." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 52 }}>
        {tiles.map((t) => (
          <GlowCard key={t.t} glow="tl" tone={t.tone} interactive pad={0} radius={18} style={{ cursor: 'pointer' }} onClick={onEnterApp}>
            <div style={{ padding: '20px 20px 0' }}>
              <h3 className="display" style={{ fontSize: 17, margin: '0 0 5px', color: 'var(--ink)' }}>{t.t}</h3>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0, minHeight: 34 }}>{t.s}</p>
            </div>
            <div style={{ padding: 14 }}><MiniScreen kind={t.k} /></div>
          </GlowCard>
        ))}
      </div>
    </section>
  );
}

function MiniScreen({ kind }) {
  const wrap = { background: 'oklch(0.115 0.018 270)', border: '1px solid var(--border)', borderRadius: 12, padding: 10, fontSize: 8 };
  if (kind === 'dash') {
    return (
      <div style={wrap}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 9.5 }}>Dashboard</span>
          <span style={{ color: 'var(--warn)' }}>🔥 12</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
          {['Mastery', 'Streak', 'XP'].map((l, i) => (
            <div key={l} style={{ background: 'oklch(0.155 0.022 270)', borderRadius: 6, padding: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 7, color: 'var(--muted)' }}>{l}</div>
              <div className="display" style={{ fontSize: 12, color: 'var(--ink)', marginTop: 2 }}>{['68%', '12d', '2.3k'][i]}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 6, height: 28, borderRadius: 6, background: 'linear-gradient(to top, oklch(0.68 0.21 295 / 0.25), transparent)', borderBottom: '1.5px solid var(--brand)' }} />
      </div>
    );
  }
  if (kind === 'roadmap') {
    return (
      <div style={wrap}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <BrandGlyph size={16} />
          <div>
            <div style={{ fontSize: 9, color: 'var(--ink)', fontWeight: 700 }}>ML Engineer</div>
            <div style={{ fontSize: 7, color: 'var(--brand)' }}>Level 4 · 68%</div>
          </div>
        </div>
        <div style={{ height: 4, background: 'oklch(0.25 0.03 270)', borderRadius: 999, marginBottom: 8 }}>
          <div style={{ width: '68%', height: '100%', background: 'var(--brand-grad)', borderRadius: 999 }} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['Lin Alg', 'Python', 'Stats', 'ML'].map((n, i) => (
            <div key={n} style={{ flex: 1, background: 'oklch(0.155 0.022 270)', borderRadius: 5, padding: '5px 2px', textAlign: 'center', fontSize: 7, color: i < 3 ? 'var(--ink)' : 'var(--muted)', border: i < 3 ? '1px solid var(--accent-line)' : '1px solid var(--border)' }}>{n}</div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === 'session') {
    return (
      <div style={wrap}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 8, color: 'var(--muted)' }}>
          {React.cloneElement(I.chevronL, { size: 10 })} Bias–Variance Tradeoff
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start', marginBottom: 6 }}>
          <AgentChip code="TU" size={16} glow={false} />
          <div style={{ fontSize: 7.5, color: 'var(--ink-2)', flex: 1, lineHeight: 1.4, background: 'oklch(0.155 0.022 270)', padding: 6, borderRadius: 6 }}>Let's explore the tradeoff with an intuitive example.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
          {['Under', 'Good', 'Over'].map((l, i) => (
            <div key={l} style={{ background: 'oklch(0.155 0.022 270)', borderRadius: 5, padding: 4, textAlign: 'center' }}>
              <div style={{ fontSize: 6, color: 'var(--muted)' }}>{l}</div>
              <svg viewBox="0 0 40 16" style={{ width: '100%', height: 12 }}>
                <path d={i === 0 ? 'M2 13 L38 4' : i === 1 ? 'M2 13 Q20 0 38 11' : 'M2 13 Q8 2 14 11 Q22 0 28 13 Q34 2 38 9'} stroke="var(--brand-3)" strokeWidth="1.2" fill="none" />
              </svg>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div style={{ ...wrap, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: 14 }}>
      <span style={{ width: 26, height: 26, borderRadius: 999, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>{React.cloneElement(I.ribbon, { size: 15 })}</span>
      <div style={{ fontSize: 7, color: 'var(--muted)' }}>Certificate of mastery</div>
      <div className="display" style={{ fontSize: 10, color: 'var(--brand)' }}>LearnOS</div>
      <div style={{ fontSize: 8, color: 'var(--ink)', fontWeight: 700 }}>Alex Learner</div>
      <div style={{ fontSize: 6.5, color: 'var(--ink-2)' }}>Machine Learning Engineer</div>
      <div style={{ width: '70%', height: 1, background: 'var(--border)', margin: '2px 0' }} />
      <div className="mono" style={{ fontSize: 5.5, color: 'var(--faint)' }}>LOS-MLE-2026-0481</div>
    </div>
  );
}

function LandingCTA({ onEnterApp }) {
  return (
    <section style={{ ...SECT, opacity: 1 }}>
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 32, padding: '72px 32px', textAlign: 'center',
        background: 'radial-gradient(80% 140% at 50% 0%, oklch(0.22 0.06 290 / 0.7), transparent 60%), oklch(0.13 0.022 270)',
        border: '1px solid var(--border-strong)',
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / 0.05), 0 0 80px oklch(0.68 0.21 295 / 0.18)',
      }}>
        <Starfield count={48} seed={11} />
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
          <Eyebrow>
            <span style={{ display: 'inline-flex', color: 'var(--brand-3)' }}>{React.cloneElement(I.spark, { size: 14 })}</span>
            100% open-source
          </Eyebrow>
          <h2 className="display" style={{ margin: 0, fontSize: 56, lineHeight: 1.02, letterSpacing: '-0.04em', fontWeight: 700, color: 'var(--ink)' }}>
            Stop watching.<br /><span className="gradient-text">Start learning.</span>
          </h2>
          <p style={{ margin: 0, fontSize: 17, color: 'var(--muted)', lineHeight: 1.55, maxWidth: 520 }}>Spin up your first roadmap in 30 seconds. Bring your own keys, take your data with you, master anything. No lock-in.</p>
          <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <PillBtn variant="primary" iconRight={React.cloneElement(I.arrowR, { size: 18 })} onClick={onEnterApp}>Open the app</PillBtn>
            <PillBtn variant="outline" icon={React.cloneElement(I.github, { size: 17 })} onClick={() => window.open('https://github.com', '_blank')}>Star on GitHub</PillBtn>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  const cols = [
    { h: 'Product', links: ['Features', 'Agents', 'Roadmaps', 'Certificates', 'Pricing'] },
    { h: 'Learn', links: ['Courses', 'Community', 'Docs', 'Changelog', 'Blog'] },
    { h: 'Open source', links: ['GitHub', 'Contribute', 'License (MIT)', 'Self-host', 'Status'] },
  ];
  return (
    <footer style={{ position: 'relative', marginTop: 60, borderTop: '1px solid oklch(0.28 0.025 270 / 0.5)', background: 'oklch(0.11 0.02 270)' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '64px 48px 36px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(3, 1fr)', gap: 40 }}>
          <div>
            <BrandLockup size={32} font={21} />
            <p style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.6, margin: '18px 0 20px', maxWidth: 300 }}>The open-source, AI-native university. Bring your own model, own your data, master anything.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {[I.github, I.rss, I.people, I.send].map((ic, i) => (
                <a key={i} href="#" style={{
                  width: 38, height: 38, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--border)', background: 'oklch(0.15 0.02 270)', color: 'var(--ink-2)', textDecoration: 'none',
                  transition: 'all var(--dur-fast)',
                }}>{React.cloneElement(ic, { size: 16 })}</a>
              ))}
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.h}>
              <div className="cap" style={{ marginBottom: 16 }}>{c.h}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {c.links.map((l) => (
                  <a key={l} href="#" style={{ fontSize: 14, color: 'var(--muted)', textDecoration: 'none', transition: 'color var(--dur-fast)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ink)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}>{l}</a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontSize: 12.5, color: 'var(--faint)' }}>© 2026 LearnOS · MIT licensed · built by 4,182 contributors</span>
          <div style={{ display: 'flex', gap: 22 }}>
            {['Privacy', 'Terms', 'Security'].map((l) => (
              <a key={l} href="#" style={{ fontSize: 12.5, color: 'var(--faint)', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Nav
   ═══════════════════════════════════════════════════════════════════════════ */

function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function LandingNav({ onEnterApp }) {
  const links = [
    { label: 'Features', target: 'features' },
    { label: 'Agents', target: 'spotlight' },
    { label: 'Courses', target: 'screens' },
    { label: 'Pricing', target: 'cta' },
  ];
  return (
    <div style={{ position: 'sticky', top: 18, zIndex: 60, padding: '0 24px' }}>
      <div style={{
        maxWidth: '100%', margin: '0 auto',
        display: 'flex', alignItems: 'center', gap: 20,
        padding: '11px 12px 11px 22px', borderRadius: 999,
        background: 'oklch(0.15 0.025 270 / 0.72)',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 0 0 1px oklch(0 0 0 / 0.2), 0 18px 50px oklch(0 0 0 / 0.45), inset 0 1px 0 oklch(1 0 0 / 0.05)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      }}>
        <BrandLockup size={28} font={18} />
        <nav style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center' }}>
          {links.map((l) => (
            <a key={l.label} href={`#${l.target}`} onClick={(e) => { e.preventDefault(); scrollToId(l.target); }}
              style={{
                padding: '8px 16px', borderRadius: 999, textDecoration: 'none',
                color: 'var(--ink-2)', fontSize: 14.5, fontWeight: 500, letterSpacing: '-0.01em',
                transition: 'color 120ms, background 120ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.background = 'oklch(0.22 0.03 270 / 0.6)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-2)'; e.currentTarget.style.background = 'transparent'; }}>
              {l.label}
            </a>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="#" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none', color: 'var(--ink-2)',
            fontFamily: 'var(--font-mono)', fontSize: 12.5, padding: '8px 13px', borderRadius: 999,
            border: '1px solid var(--border)', background: 'oklch(0.13 0.02 270 / 0.6)',
            transition: 'all var(--dur-fast)',
          }}>
            {React.cloneElement(I.github, { size: 15 })} <span style={{ fontWeight: 600, color: 'var(--ink)' }}>28.4k</span>
          </a>
          <PillBtn variant="primary" size="md" iconRight={React.cloneElement(I.arrowR, { size: 16 })} onClick={onEnterApp}>Start Learning</PillBtn>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Hero
   ═══════════════════════════════════════════════════════════════════════════ */

function LandingHero({ onEnterApp }) {
  return (
    <header id="hero" style={{ position: 'relative', paddingTop: 92 }}>
      <AuroraBeam />
      <Starfield count={70} seed={7} />
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1400, margin: '0 auto', padding: '0 48px' }}>
        <div style={{ maxWidth: 860 }}>
          <Eyebrow style={{ marginBottom: 26 }}>
            <span style={{ display: 'inline-flex', color: 'var(--brand-3)' }}>{React.cloneElement(I.spark, { size: 15 })}</span>
            Open-source · Learn by doing, with agents
          </Eyebrow>
          <h1 className="display" style={{
            margin: '0 0 26px', fontSize: 84, lineHeight: 0.98, letterSpacing: '-0.04em',
            fontWeight: 700, color: 'var(--ink)',
          }}>
            LearnOS Is Your<br />AI-Powered <span className="gradient-text">University</span>
          </h1>
          <p style={{ margin: '0 0 34px', fontSize: 19, lineHeight: 1.55, color: 'var(--muted)', maxWidth: 580 }}>
            An open platform that replaces pre-recorded lectures with a team of AI agents and personalized, mastery-based learning that adapts to exactly how you learn.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <PillBtn variant="primary" iconRight={React.cloneElement(I.arrowR, { size: 18 })} onClick={onEnterApp}>Start Learning</PillBtn>
            <PillBtn variant="outline" icon={React.cloneElement(I.book, { size: 17 })} onClick={() => scrollToId('screens')}>Explore Courses</PillBtn>
          </div>
        </div>
      </div>
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1380, margin: '60px auto -40px', padding: '0 48px' }}>
        <NeonFrame>
          <DashboardPreview />
        </NeonFrame>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main export
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Landing({ onEnterApp }) {
  return (
    <div style={{ width: '100%', minHeight: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* ===== Header + Hero: clean dark background, NO gradient ===== */}
      <div style={{ position: 'relative', zIndex: 2, background: 'oklch(0.095 0.015 270)' }}>
        <LandingNav onEnterApp={onEnterApp} />
        <LandingHero onEnterApp={onEnterApp} />
      </div>

      {/* ===== Content area: violet gradient background behind transparent sections ===== */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Gradient background layer */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0,
          opacity: 0.2,
          backgroundColor: 'oklch(0.65 0.28 310)',
          backgroundImage: [
            'radial-gradient(circle at center center, oklch(0.78 0.16 195), oklch(0.65 0.28 310))',
            'repeating-radial-gradient(circle at center center, oklch(0.78 0.16 195), oklch(0.78 0.16 195), 8px, transparent 16px, transparent 8px)',
          ].join(', '),
          backgroundBlendMode: 'multiply',
          pointerEvents: 'none',
        }} />
        {/* Top fade: transparent → gradient color */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 120, zIndex: 1,
          background: 'linear-gradient(to bottom, oklch(0.095 0.015 270), transparent)',
          pointerEvents: 'none',
        }} />
        {/* Bottom fade: gradient color → transparent */}
        <div aria-hidden="true" style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, zIndex: 1,
          background: 'linear-gradient(to top, oklch(0.095 0.015 270), transparent)',
          pointerEvents: 'none',
        }} />
        {/* Section content on top */}
        <div style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', padding: '0 48px' }}>
          <div id="providers"><Marquee /></div>
          <div id="statement"><StatementBlock /></div>
          <div id="spotlight"><SpotlightCards /></div>
          <div id="features"><FeatureGrid /></div>
          <ProgressSplit />
          <HowItWorks />
          <div id="screens"><ScreenShowcase onEnterApp={onEnterApp} /></div>
          <div id="cta"><LandingCTA onEnterApp={onEnterApp} /></div>
        </div>
      </div>

      {/* ===== Footer: clean dark background, NO gradient ===== */}
      <div style={{ position: 'relative', zIndex: 2, background: 'oklch(0.095 0.015 270)' }}>
        <LandingFooter />
      </div>
    </div>
  );
}
