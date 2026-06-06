import React from 'react';
import { Btn } from '../components/UI.jsx';
import API from '../api.js';

// ── Brand glyph (inline — same SVG as sidebar logo) ──────────────────────────
function BrandGlyph({ size = 40 }) {
  return (
    <span style={{
      width: size, height: size, display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      borderRadius: size / 4,
      background: 'var(--brand-grad)',
      boxShadow: '0 0 0 1px oklch(0.68 0.21 295 / 0.4), 0 0 18px oklch(0.68 0.21 295 / 0.4)',
      flexShrink: 0,
    }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path d="M12 3 21 8v8l-9 5-9-5V8z" stroke="oklch(0.16 0.02 270)" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M3 8l9 5 9-5M12 13v9" stroke="oklch(0.16 0.02 270)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      </svg>
    </span>
  );
}

export default function Auth({ onSuccess }) {
  const [mode, setMode] = React.useState('login');

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', position: 'relative', overflow: 'hidden',
    }}>
      {/* ambient glows */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background:
          'radial-gradient(60% 55% at 25% 50%, oklch(0.68 0.21 295 / 0.12), transparent 60%),' +
          'radial-gradient(40% 40% at 75% 30%, oklch(0.76 0.17 200 / 0.08), transparent 60%)',
      }} />

      <div style={{
        width: '100%', maxWidth: 1100, display: 'flex', alignItems: 'stretch',
        margin: '0 auto', minHeight: '100vh', position: 'relative', zIndex: 1,
      }}>
        {/* ── Left: brand panel ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '60px 56px 60px 64px',
        }}>
          <div style={{ maxWidth: 460, marginLeft: 'auto' }}>
            {/* wordmark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 52 }}>
              <BrandGlyph size={42} />
              <span className="display" style={{ fontSize: 24, color: 'var(--ink)' }}>LearnOS</span>
            </div>

            <h1 className="display" style={{
              fontSize: 52, lineHeight: 1.0, letterSpacing: '-0.03em',
              color: 'var(--ink)', margin: '0 0 20px',
            }}>
              Learn anything.<br />
              <span style={{
                background: 'var(--brand-grad)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Master everything.</span>
            </h1>

            <p style={{
              fontSize: 15, color: 'var(--muted)', lineHeight: 1.65,
              margin: '0 0 36px', maxWidth: 400,
            }}>
              An AI-powered learning system with specialized agents that adapt to how you think. No lectures — just you and the knowledge.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { e: '🎯', t: 'Mastery-based learning that adapts to your pace' },
                { e: '🤖', t: '7 specialized AI agents: Tutor, Research, Assessment and more' },
                { e: '🔑', t: 'Bring your own API key — your data stays yours' },
                { e: '🌿', t: 'Open-source and free — fork, extend, contribute' },
              ].map(f => (
                <div key={f.t} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 16, lineHeight: 1.1 }}>{f.e}</span>
                  <span style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>{f.t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* divider */}
        <div style={{ width: 1, background: 'var(--border)', margin: '40px 0', flexShrink: 0 }} />

        {/* ── Right: form panel ── */}
        <div style={{
          width: 440, flexShrink: 0, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '60px 48px',
        }}>
          <AuthForm mode={mode} setMode={setMode} onSuccess={onSuccess} />
        </div>
      </div>
    </div>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────────

function AuthForm({ mode, setMode, onSuccess }) {
  const [name,     setName]     = React.useState('');
  const [email,    setEmail]    = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading,  setLoading]  = React.useState(false);
  const [error,    setError]    = React.useState(null);
  const isLogin = mode === 'login';

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = isLogin
        ? await API.login(email, password)
        : await API.register(name, email, password);
      onSuccess(result.user);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(isLogin ? 'register' : 'login');
    setError(null);
    setName(''); setEmail(''); setPassword('');
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 className="display" style={{ fontSize: 28, color: 'var(--ink)', margin: 0 }}>
          {isLogin ? 'Welcome back' : 'Start learning'}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>
          {isLogin ? 'Sign in to your LearnOS account' : "Create your account — it's free"}
        </p>
      </div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!isLogin && (
          <Field label="Full name" type="text" value={name} onChange={setName}
            placeholder="Alex Learner" autoFocus />
        )}
        <Field label="Email" type="email" value={email} onChange={setEmail}
          placeholder="you@example.com" autoFocus={isLogin} />
        <Field label="Password" type="password" value={password} onChange={setPassword}
          placeholder={isLogin ? '••••••••' : 'At least 8 characters'} />

        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'oklch(0.7 0.2 25 / 0.10)',
            border: '1px solid oklch(0.7 0.2 25 / 0.4)',
            borderRadius: 8, fontSize: 13, color: 'var(--bad)', lineHeight: 1.5,
          }}>{error}</div>
        )}

        <button type="submit" disabled={loading} style={{
          marginTop: 4, height: 44, borderRadius: 10, border: 0,
          background: loading ? 'var(--surface-2)' : 'var(--brand-grad)',
          color: loading ? 'var(--muted)' : 'oklch(0.16 0.02 270)',
          fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: loading ? 'none' : '0 0 0 1px oklch(0.68 0.21 295 / 0.5), 0 4px 18px oklch(0.68 0.21 295 / 0.35)',
          transition: 'all 150ms',
        }}>
          {loading && <Spinner />}
          {loading
            ? (isLogin ? 'Signing in…' : 'Creating account…')
            : (isLogin ? 'Sign in' : 'Create account')}
        </button>
      </form>

      {isLogin && (
        <div style={{
          marginTop: 14, padding: '9px 14px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6,
        }}>
          <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Dev login:</span>{' '}
          alex@learnos.dev / learnos123
        </div>
      )}

      <div style={{
        marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 18,
        textAlign: 'center', fontSize: 13.5, color: 'var(--muted)',
      }}>
        {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button onClick={switchMode} style={{
          background: 'none', border: 0, padding: 0, cursor: 'pointer',
          color: 'var(--brand)', fontWeight: 600, fontSize: 13.5,
          fontFamily: 'var(--font-body)',
        }}>
          {isLogin ? 'Create one' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder, autoFocus }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoFocus={autoFocus} required
        style={{
          height: 40, padding: '0 14px',
          background: 'var(--surface)', border: '1px solid var(--border-strong)',
          borderRadius: 8, color: 'var(--ink)', fontSize: 14,
          fontFamily: 'var(--font-body)', outline: 'none', transition: 'border-color 120ms',
        }}
        onFocus={e  => { e.target.style.borderColor = 'var(--accent)'; }}
        onBlur={e   => { e.target.style.borderColor = 'var(--border-strong)'; }}
      />
    </div>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round"
      style={{ animation: 'spin 0.8s linear infinite' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
