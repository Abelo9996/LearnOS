import React from 'react';
import { I } from './Icons';
import { AGENTS } from '../data/data';

/* ── Agent chip ───────────────────────────────────────────────────────────── */
export function AgentChip({ code, size = 28, showLabel = false, sub, glow = true }) {
  const a = AGENTS[code] || { name: 'Unknown', icon: 'spark', color: 'var(--brand)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, verticalAlign: 'middle' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: size <= 22 ? 6 : 8,
        background: `linear-gradient(135deg, color-mix(in oklch, ${a.color} 80%, transparent), ${a.color})`,
        boxShadow: glow ? `0 0 0 1px ${a.color}33, 0 0 12px ${a.color}33` : `0 0 0 1px ${a.color}22`,
        color: 'oklch(0.16 0.02 270)',
        transition: 'transform var(--dur-normal) var(--ease-spring), box-shadow var(--dur-normal) var(--ease-smooth)',
      }}>
        {I[a.icon] && React.cloneElement(I[a.icon], { size: Math.round(size * 0.55), stroke: 'oklch(0.16 0.02 270)', sw: 2 })}
      </span>
      {showLabel && (
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{a.name}</span>
          {sub && <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{sub}</span>}
        </span>
      )}
    </span>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────────── */
export function Card({ children, style, pad = true, surface = 'window', glow = false, hover = false, onClick, className = '', ...rest }) {
  const bg = surface === 'surface' ? 'var(--surface)' : 'var(--bg-window)';
  const interactive = hover || !!onClick;
  return (
    <div {...rest} onClick={onClick} className={`${interactive ? 'hover-card ' : ''}${className}`.trim() || undefined} style={{
      background: bg,
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: glow ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
      padding: pad ? 'var(--pad)' : 0,
      transition: 'transform var(--dur-normal) var(--ease-out), box-shadow var(--dur-normal) var(--ease-out), border-color var(--dur-normal) var(--ease-smooth)',
      cursor: onClick ? 'pointer' : undefined,
      ...style,
    }}>{children}</div>
  );
}

export function StatCard({ icon, label, value, unit, sub, trend, accent, chart }) {
  return (
    <Card pad={false} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 6,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: accent ? `${accent}22` : 'var(--accent-soft)',
          color: accent || 'var(--brand)',
          transition: 'transform var(--dur-normal) var(--ease-spring)',
        }}>{icon}</span>
        <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, justifyContent: 'space-between' }}>
        <div>
          <div className="display" style={{ fontSize: 30, lineHeight: 1, color: 'var(--ink)' }}>
            {value}{unit && <span style={{ fontSize: 14, color: 'var(--muted)', marginLeft: 4, fontWeight: 500 }}>{unit}</span>}
          </div>
          {sub && <div className="mono" style={{ fontSize: 11, color: trend === 'down' ? 'var(--bad)' : trend === 'up' ? 'var(--good)' : 'var(--muted)', marginTop: 8, letterSpacing: 0 }}>{sub}</div>}
        </div>
        {chart}
      </div>
    </Card>
  );
}

/* ── Buttons ──────────────────────────────────────────────────────────────── */
export function Btn({ children, variant = 'ghost', size = 'sm', icon, iconRight, onClick, style, title, full, disabled, className = '' }) {
  const h = size === 'lg' ? 40 : size === 'md' ? 34 : 28;
  const px = size === 'lg' ? 16 : size === 'md' ? 12 : 10;
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: h, padding: `0 ${px}px`,
    borderRadius: 'var(--radius)',
    fontFamily: 'var(--font-body)', fontSize: size === 'lg' ? 14 : 13, fontWeight: 600,
    border: '1px solid transparent', whiteSpace: 'nowrap',
    transition: 'all var(--dur-fast) var(--ease-smooth)',
    width: full ? '100%' : undefined,
    position: 'relative', overflow: 'hidden',
  };
  const variants = {
    primary: {
      background: 'var(--brand-grad)',
      color: 'oklch(0.16 0.02 270)',
      boxShadow: '0 0 0 1px oklch(0.68 0.21 295 / 0.5), 0 4px 18px oklch(0.68 0.21 295 / 0.35)',
    },
    outline: { background: 'transparent', color: 'var(--ink)', borderColor: 'var(--border-strong)' },
    ghost:   { background: 'transparent', color: 'var(--ink-2)' },
    soft:    { background: 'var(--surface-2)', color: 'var(--ink)', borderColor: 'var(--border)' },
    danger:  { background: 'transparent', color: 'var(--bad)', borderColor: 'oklch(0.7 0.2 25 / 0.5)' },
  };
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      className={`ui-btn ui-btn-${variant} ${className}`.trim()}
      style={{ ...base, ...variants[variant], ...style }}>
      {icon}{children}{iconRight}
    </button>
  );
}

/* ── Progress / Ring / Bar ───────────────────────────────────────────────── */
export function ProgressBar({ value, height = 6, gradient = true, track = 'var(--surface-3)' }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ background: track, height, borderRadius: 999, overflow: 'hidden' }}>
      <div style={{
        width: `${v * 100}%`, height: '100%',
        background: gradient ? 'var(--brand-grad)' : 'var(--brand)',
        transition: 'width var(--dur-slow) var(--ease-out)',
        borderRadius: 999,
      }} />
    </div>
  );
}

export function Ring({ value, size = 56, sw = 6, color = 'var(--brand)', label }) {
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--surface-3)" strokeWidth={sw} fill="none" />
        <circle cx={size/2} cy={size/2} r={r}
          stroke={color} strokeWidth={sw} fill="none"
          strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dashoffset var(--dur-slow) var(--ease-out)' }} />
      </svg>
      {label && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink)',
        }}>{label}</div>
      )}
    </div>
  );
}

export function MiniBars({ values, color = 'var(--brand)', height = 36, width = 92, gap = 2 }) {
  const max = Math.max(...values, 1);
  const bw = (width - gap * (values.length - 1)) / values.length;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        return <rect key={i} x={i * (bw + gap)} y={height - h} width={bw} height={h}
          rx={Math.min(bw / 2, 2)} fill={color} opacity={i === values.length - 1 ? 1 : 0.5 + 0.5 * (v / max)}
          style={{ transition: `height var(--dur-slow) var(--ease-out) ${i * 50}ms` }} />;
      })}
    </svg>
  );
}

/* ── Tag ──────────────────────────────────────────────────────────────────── */
export function Tag({ children, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: 'var(--surface-2)', fg: 'var(--ink-2)', bd: 'var(--border)' },
    accent:  { bg: 'var(--accent-soft)', fg: 'oklch(0.82 0.18 295)', bd: 'var(--accent-line)' },
    cyan:    { bg: 'var(--cyan-soft)', fg: 'var(--brand-3)', bd: 'var(--cyan-line)' },
    good:    { bg: 'oklch(0.78 0.16 155 / 0.14)', fg: 'var(--good)', bd: 'oklch(0.78 0.16 155 / 0.4)' },
    warn:    { bg: 'oklch(0.78 0.16 75 / 0.14)', fg: 'var(--warn)', bd: 'oklch(0.78 0.16 75 / 0.4)' },
    danger:  { bg: 'oklch(0.7 0.2 25 / 0.14)', fg: 'var(--bad)', bd: 'oklch(0.7 0.2 25 / 0.4)' },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 999,
      background: t.bg, color: t.fg,
      border: `1px solid ${t.bd}`,
      fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
      letterSpacing: 0,
      transition: 'transform var(--dur-normal) var(--ease-spring)',
    }}>{children}</span>
  );
}

/* ── Kbd ──────────────────────────────────────────────────────────────────── */
export function Kbd({ children }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 10.5,
      padding: '2px 6px', borderRadius: 5,
      background: 'var(--surface-2)', color: 'var(--muted)',
      border: '1px solid var(--border)',
      transition: 'background var(--dur-fast)',
    }}>{children}</span>
  );
}

/* ── Avatar ───────────────────────────────────────────────────────────────── */
export function Avatar({ name = '?', size = 32, hue, ring }) {
  const initials = name.split(/[ .]/).filter(Boolean).slice(0,2).map(s => s[0]).join('').toUpperCase();
  const h = hue ?? (name.length * 47) % 360;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, flexShrink: 0,
      borderRadius: 999,
      background: `linear-gradient(135deg, oklch(0.55 0.18 ${h}), oklch(0.7 0.16 ${(h + 60) % 360}))`,
      color: 'oklch(0.97 0.01 270)',
      fontFamily: 'var(--font-display)', fontWeight: 600,
      fontSize: size * 0.36,
      boxShadow: ring ? '0 0 0 2px var(--bg-window), 0 0 0 4px oklch(0.7 0.16 195 / 0.5)' : '0 0 0 1px oklch(0 0 0 / 0.2)',
      transition: 'transform var(--dur-normal) var(--ease-spring), box-shadow var(--dur-normal) var(--ease-smooth)',
    }}>{initials}</span>
  );
}

/* ── Page header ──────────────────────────────────────────────────────────── */
export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 24 }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="cap" style={{ marginBottom: 8 }}>{eyebrow}</div>}
        <div className="display" style={{ fontSize: 34, lineHeight: 1.05, color: 'var(--ink)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8, maxWidth: 640 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}

/* ── Section ──────────────────────────────────────────────────────────────── */
export function SectionHead({ title, action, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, gap: 16 }}>
      <div>
        <div className="display" style={{ fontSize: 18, color: 'var(--ink)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

/* ── Brand helpers ────────────────────────────────────────────────────────── */
export function PageScroll({ children }) {
  return (
    <div className="scroll" style={{ height: '100%', padding: '28px 32px 60px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>{children}</div>
    </div>
  );
}

export function BrandGlyph({ size = 32 }) {
  return (
    <span style={{
      width: size, height: size, display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      borderRadius: size / 4,
      background: 'var(--brand-grad)',
      boxShadow: '0 0 0 1px oklch(0.68 0.21 295 / 0.4), 0 0 18px oklch(0.68 0.21 295 / 0.4)',
      transition: 'transform var(--dur-normal) var(--ease-spring), box-shadow var(--dur-normal) var(--ease-smooth)',
    }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <path d="M12 3 21 8v8l-9 5-9-5V8z" stroke="oklch(0.16 0.02 270)" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M3 8l9 5 9-5M12 13v9" stroke="oklch(0.16 0.02 270)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      </svg>
    </span>
  );
}

export function BrandLockup() {
  return (
    <a href="#" style={{
      display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--ink)',
      transition: 'opacity var(--dur-normal)',
    }}>
      <BrandGlyph size={32} />
      <span className="display" style={{ fontSize: 19, color: 'var(--ink)' }}>LearnOS</span>
    </a>
  );
}
