import React from 'react';
import { I } from '../components/Icons';
import { Btn } from '../components/UI';
import API from '../api';
import { generatePathway } from '../lib/generatePathway.js';

const GOAL_CHIPS = ['Machine Learning', 'Generative AI', 'Data Science', 'Web development'];

/**
 * Turn a provider failure into something a person can act on.
 * The raw form is a JSON blob ("OpenRouter 401: {"error":{"message":...}}"),
 * which tells a learner nothing about what to actually do next.
 */
function explainKeyError(e) {
  const raw = String(e?.message || '');
  if (/401|unauthor|user not found|invalid api key/i.test(raw)) {
    return 'OpenRouter rejected that key. Check you pasted the whole thing — it starts with "sk-or-v1-".';
  }
  if (/402|insufficient credit|requires more credits/i.test(raw)) {
    return 'That key is valid but has no credit left. Add credit at openrouter.ai, then test again.';
  }
  if (/403|limit exceeded/i.test(raw)) {
    return 'That key has hit its spending limit. Raise the limit on the key at openrouter.ai, then test again.';
  }
  if (/429|rate limit/i.test(raw)) return 'OpenRouter is rate-limiting this key right now. Wait a moment and test again.';
  if (/cannot reach the server/i.test(raw)) return 'Cannot reach the LearnOS server — is it still running?';
  if (/fetch|network|ENOTFOUND|ETIMEDOUT/i.test(raw)) return 'Could not reach OpenRouter. Check your internet connection.';
  return raw.replace(/\s*\{.*$/s, '') || 'That key could not be verified.';
}
const STYLE_CHIPS = ['Visual examples', 'Hands-on projects', 'Theory first', 'Quick sprints'];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = React.useState(1);
  const [name, setName] = React.useState('');
  const [background, setBackground] = React.useState('');
  const [goal, setGoal] = React.useState('');
  const [level, setLevel] = React.useState('beginner');
  const [hours, setHours] = React.useState(5);
  const [styles, setStyles] = React.useState([]);
  const [apiKey, setApiKey] = React.useState('');
  const [model, setModel] = React.useState('anthropic/claude-sonnet-4.6');
  const [keyState, setKeyState] = React.useState('idle');   // idle | testing | ok | bad
  const [keyMsg, setKeyMsg] = React.useState('');
  const [skipKey, setSkipKey] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [jobStatus, setJobStatus] = React.useState(null); // null | { message } — live progress from the job
  const [error, setError] = React.useState(null);
  const [pollProgress, setPollProgress] = React.useState(0);

  const toggleStyle = (s) => {
    setStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const canSubmit = goal.trim().length >= 3;
  const canPassIntro = name.trim().length >= 1;

  // A key that is merely stored is not a key that works. Save it, then make a
  // real call — otherwise the first thing the learner discovers is a silent
  // fallback to a template roadmap, which is exactly what this step exists to
  // prevent.
  const saveAndTestKey = async () => {
    if (!apiKey.trim()) return;
    setKeyState('testing'); setKeyMsg('');
    let createdId = null;
    try {
      const saved = await API.createApiKey({ provider: 'openrouter', encrypted_key: apiKey.trim(), model });
      createdId = saved?.key?.id || null;
      const ping = await API.pingAI();
      setKeyState('ok');
      setKeyMsg(`Connected — replied using ${ping.model || model}.`);
      setSkipKey(false);
    } catch (e) {
      // A key that failed its test must not be left configured: the app would
      // then look connected while every AI call quietly failed.
      if (createdId) await API.deleteApiKey(createdId).catch(() => {});
      setKeyState('bad');
      setKeyMsg(explainKeyError(e));
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setPollProgress(0);
    try {
      // Who they are comes first: the greeting, certificates and coach all read
      // the user's name, and until now every install was stuck calling them "You".
      await API.patchUserProfile({
        name: name.trim().slice(0, 80),
        ...(background.trim() ? { bio: background.trim().slice(0, 500) } : {}),
      }).catch(() => {});

      // Persist the PR profile
      const profile = {
        level, time_per_week: hours, learning_style: styles,
        ...(background.trim() ? { background: background.trim() } : {}),
      };
      await API.postIntake({ goal: goal.trim(), answers: profile });

      // Generate through the SAME path the Roadmaps page uses. Onboarding used
      // to call genRoadmap directly, so the very first roadmap a learner got
      // behaved differently from every one they made afterwards.
      const result = await generatePathway({
        goal: goal.trim(), level, profile,
        onProgress: (pct, msg) => {
          if (typeof pct === 'number') setPollProgress(Math.round(pct * 100));
          if (msg) setJobStatus({ message: msg });
        },
      });
      if (!result?.roadmapId) throw new Error('Generation timed out — try again from Roadmaps');

      // F-02: Only mark onboarded AFTER successful generation
      await API.patchUserSettings({ onboarded_at: new Date().toISOString() }).catch(() => {});

      onComplete(result.roadmapId, { source: result.source });
    } catch (e) {
      // F-02: On error, do NOT set onboarded_at — user stays on intake with retry
      setError(e.message || 'Something went wrong');
      setSubmitting(false);
    }
  };

  // ── Step indicators ──────────────────────────────────────────────────────────
  const StepDot = ({ n }) => (
    <div style={{
      width: 28, height: 28, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: step >= n ? 'var(--brand-grad)' : 'var(--surface-2)',
      color: step >= n ? 'oklch(0.16 0.02 270)' : 'var(--muted)',
      fontSize: 12, fontWeight: 700, flexShrink: 0,
    }}>{n}</div>
  );

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 580, background: 'var(--bg-window)', border: '1px solid var(--border)',
        borderRadius: 20, padding: 40, boxShadow: '0 30px 80px oklch(0 0 0 / 0.4)',
        animation: 'pageEnter var(--dur-normal) var(--ease-out)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="" aria-hidden="true" width={60} height={60} draggable={false}
            style={{ width: 60, height: 60, display: 'block', margin: '0 auto 16px', objectFit: 'contain' }} />
          <h1 className="display" style={{ fontSize: 26, marginBottom: 6 }}>
            {name.trim() && step > 1 ? `Nice to meet you, ${name.trim().split(' ')[0]}` : 'Welcome to LearnOS'}
          </h1>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>Let's personalize your learning experience</div>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 32 }}>
          <StepDot n={1} />
          <div style={{ width: 28, height: 2, background: step >= 2 ? 'var(--brand)' : 'var(--border)', borderRadius: 999 }} />
          <StepDot n={2} />
          <div style={{ width: 28, height: 2, background: step >= 3 ? 'var(--brand)' : 'var(--border)', borderRadius: 999 }} />
          <StepDot n={3} />
          <div style={{ width: 28, height: 2, background: step >= 4 ? 'var(--brand)' : 'var(--border)', borderRadius: 999 }} />
          <StepDot n={4} />
          <div style={{ width: 28, height: 2, background: step >= 5 ? 'var(--brand)' : 'var(--border)', borderRadius: 999 }} />
          <StepDot n={5} />
        </div>

        {/* Step 1 — Who you are.
            The greeting, certificates and the coach all read the user's name, and
            without this every install addressed the learner as "You". Background is
            optional but genuinely used: it is passed to the Curriculum agent so the
            roadmap is pitched at someone with that experience. */}
        {step === 1 && (
          <div style={{ animation: 'pageEnter var(--dur-normal) var(--ease-out)' }}>
            <div className="cap" style={{ marginBottom: 8, fontSize: 11 }}>Step 1 of 5</div>
            <h2 className="display" style={{ fontSize: 20, marginBottom: 6 }}>First — what should we call you?</h2>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              This stays on your machine. LearnOS has no accounts and no sign-up — it is
              only used to make the app feel like yours.
            </div>

            <label className="cap" style={{ display: 'block', marginBottom: 6, fontSize: 10.5 }}>Your name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Abel"
              maxLength={80}
              onKeyDown={e => { if (e.key === 'Enter' && canPassIntro) setStep(2); }}
              style={{
                width: '100%', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, color: 'var(--ink)', fontSize: 14, outline: 'none', marginBottom: 18,
              }}
            />

            <label className="cap" style={{ display: 'block', marginBottom: 6, fontSize: 10.5 }}>
              What do you do? <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--faint)', fontWeight: 400 }}>— optional</span>
            </label>
            <textarea
              value={background}
              onChange={e => setBackground(e.target.value)}
              placeholder="e.g. Backend engineer, comfortable with Python, no ML background yet"
              maxLength={500}
              rows={3}
              style={{
                width: '100%', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, color: 'var(--ink)', fontSize: 13.5, outline: 'none', resize: 'vertical',
                fontFamily: 'inherit', lineHeight: 1.6, marginBottom: 8,
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.5 }}>
              The Curriculum agent uses this to pitch your roadmap at the right level and skip
              what you already know.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn variant="primary" disabled={!canPassIntro} onClick={() => setStep(2)}>Continue →</Btn>
            </div>
          </div>
        )}

        {/* Step 2 — Goal */}
        {step === 2 && (
          <div style={{ animation: 'pageEnter var(--dur-normal) var(--ease-out)' }}>
            <div className="cap" style={{ marginBottom: 8, fontSize: 11 }}>Step 2 of 5</div>
            <h2 className="display" style={{ fontSize: 20, marginBottom: 6 }}>What do you want to learn?</h2>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              Describe your learning goal — be as specific or broad as you like.
            </div>
            <input
              autoFocus
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="e.g. Build and deploy large language model applications"
              onKeyDown={e => { if (e.key === 'Enter' && goal.trim().length >= 3) setStep(3); }}
              style={{
                width: '100%', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, color: 'var(--ink)', fontSize: 14, outline: 'none', marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
              {GOAL_CHIPS.map(c => (
                <button key={c} onClick={() => setGoal(c)} style={{
                  padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
                  background: goal === c ? 'var(--accent-soft)' : 'var(--surface)',
                  color: goal === c ? 'oklch(0.82 0.18 295)' : 'var(--ink-2)',
                  fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                }}>{c}</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Btn variant="outline" onClick={() => setStep(1)}>← Back</Btn>
              <div style={{ flex: 1 }} />
              <Btn variant="primary" disabled={goal.trim().length < 3} onClick={() => setStep(3)}>Continue →</Btn>
            </div>
          </div>
        )}

        {/* Step 3 — Level + time */}
        {step === 3 && (
          <div style={{ animation: 'pageEnter var(--dur-normal) var(--ease-out)' }}>
            <div className="cap" style={{ marginBottom: 8, fontSize: 11 }}>Step 3 of 5</div>
            <h2 className="display" style={{ fontSize: 20, marginBottom: 6 }}>Your level &amp; time</h2>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              This helps the Curriculum agent calibrate the roadmap depth and pace.
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="cap" style={{ display: 'block', marginBottom: 8 }}>Experience level</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['beginner', 'intermediate', 'advanced'].map(l => (
                  <button key={l} onClick={() => setLevel(l)} style={{
                    flex: 1, padding: '12px 16px', borderRadius: 10, textAlign: 'center',
                    border: `1px solid ${level === l ? 'var(--accent-line)' : 'var(--border)'}`,
                    background: level === l ? 'var(--accent-soft)' : 'var(--surface)',
                    color: level === l ? 'oklch(0.82 0.18 295)' : 'var(--ink-2)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                  }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="cap" style={{ display: 'block', marginBottom: 8 }}>
                Hours per week: <span style={{ color: 'var(--ink)' }}>{hours}h</span>
              </label>
              <input
                type="range" min={1} max={20} value={hours}
                onChange={e => setHours(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--brand)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                <span>1h</span><span>20h</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Btn variant="outline" onClick={() => setStep(2)}>← Back</Btn>
              <Btn variant="primary" onClick={() => setStep(4)}>Continue →</Btn>
            </div>
          </div>
        )}

        {/* Step 4 — Style */}
        {step === 4 && (
          <div style={{ animation: 'pageEnter var(--dur-normal) var(--ease-out)' }}>
            <div className="cap" style={{ marginBottom: 8, fontSize: 11 }}>Step 4 of 5</div>
            <h2 className="display" style={{ fontSize: 20, marginBottom: 6 }}>How do you learn best?</h2>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              Select one or more. This shapes how the Tutor agent presents material.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {STYLE_CHIPS.map(s => {
                const on = styles.includes(s);
                return (
                  <button key={s} onClick={() => toggleStyle(s)} style={{
                    padding: '14px 16px', borderRadius: 10, textAlign: 'left',
                    border: `1px solid ${on ? 'var(--accent-line)' : 'var(--border)'}`,
                    background: on ? 'var(--accent-soft)' : 'var(--surface)',
                    color: on ? 'oklch(0.82 0.18 295)' : 'var(--ink-2)',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}>
                    <span style={{ marginRight: 8 }}>{on ? '✓' : '○'}</span>{s}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Btn variant="outline" onClick={() => setStep(3)}>← Back</Btn>
              <Btn variant="primary" onClick={() => setStep(5)}>Continue →</Btn>
            </div>
          </div>
        )}

        {/* Submitting / polling state */}

        {/* Step 5 — Connect the AI.
            Without a key, generateRoadmap silently falls back to a generic
            template. That fallback used to happen invisibly: the learner
            finished onboarding believing they had a personalised roadmap when
            they had a canned one. Asking here — and saying plainly what
            skipping costs — is the honest version. */}
        {step === 5 && (
          <div style={{ animation: 'pageEnter var(--dur-normal) var(--ease-out)' }}>
            <div className="cap" style={{ marginBottom: 8, fontSize: 11 }}>Step 5 of 5</div>
            <h2 className="display" style={{ fontSize: 20, marginBottom: 6 }}>Connect your AI</h2>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.6 }}>
              LearnOS runs on your own OpenRouter key. It is encrypted and stored on this
              machine — there is no LearnOS server to send it to.{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)' }}>
                Get a key →
              </a>
            </div>

            <label className="cap" style={{ display: 'block', marginBottom: 6, fontSize: 10.5 }}>OpenRouter API key</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="password"
                autoFocus
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setKeyState('idle'); setKeyMsg(''); }}
                placeholder="sk-or-v1-…"
                onKeyDown={e => { if (e.key === 'Enter' && apiKey.trim() && keyState !== 'testing') saveAndTestKey(); }}
                style={{
                  flex: 1, padding: '12px 16px', background: 'var(--surface)',
                  border: `1px solid ${keyState === 'ok' ? 'var(--good)' : keyState === 'bad' ? 'var(--bad)' : 'var(--border)'}`,
                  borderRadius: 10, color: 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: 'var(--font-mono)',
                }}
              />
              <Btn variant="outline" disabled={!apiKey.trim() || keyState === 'testing'} onClick={saveAndTestKey}>
                {keyState === 'testing' ? 'Testing…' : keyState === 'ok' ? 'Re-test' : 'Test'}
              </Btn>
            </div>

            <label className="cap" style={{ display: 'block', marginBottom: 6, fontSize: 10.5 }}>Model</label>
            <select
              value={model}
              onChange={e => { setModel(e.target.value); if (keyState === 'ok') setKeyState('idle'); }}
              style={{
                width: '100%', padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, color: 'var(--ink)', fontSize: 13.5, outline: 'none', marginBottom: 12,
              }}
            >
              <option value="anthropic/claude-sonnet-4.6">Claude Sonnet 4.6 — best quality (recommended)</option>
              <option value="anthropic/claude-haiku-4.5">Claude Haiku 4.5 — faster and cheaper</option>
              <option value="openai/gpt-4o">GPT-4o</option>
              <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash</option>
            </select>

            {keyMsg && (
              <div style={{
                padding: '10px 12px', borderRadius: 9, fontSize: 12.5, lineHeight: 1.5, marginBottom: 14,
                background: 'var(--surface-2)',
                border: `1px solid color-mix(in oklch, ${keyState === 'ok' ? 'var(--good)' : 'var(--bad)'} 40%, var(--border))`,
                color: keyState === 'ok' ? 'var(--good)' : 'var(--bad)',
              }}>
                {keyState === 'ok' ? '✓ ' : '✕ '}{keyMsg}
              </div>
            )}

            {/* Skipping is allowed, but never silently. */}
            {keyState !== 'ok' && (
              <label style={{
                display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 10, cursor: 'pointer',
                background: skipKey ? 'var(--surface-2)' : 'transparent',
                border: `1px solid ${skipKey ? 'var(--border-strong)' : 'var(--border)'}`, marginBottom: 20,
              }}>
                <input type="checkbox" checked={skipKey} onChange={e => setSkipKey(e.target.checked)} style={{ marginTop: 2 }} />
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                  Continue without a key — I understand LearnOS will build a{' '}
                  <strong style={{ color: 'var(--ink)' }}>generic starter roadmap from a template</strong>, not one
                  personalised to my goal, and that course generation, tutoring and grading stay unavailable
                  until I add a key in Settings.
                </span>
              </label>
            )}

            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Btn variant="outline" onClick={() => setStep(4)}>← Back</Btn>
              <div style={{ flex: 1 }} />
              <Btn variant="primary" icon={I.spark} disabled={keyState !== 'ok' && !skipKey} onClick={handleSubmit}>
                {keyState === 'ok' ? 'Generate my roadmap →' : 'Continue with a template →'}
              </Btn>
            </div>
          </div>
        )}


        {submitting && (
          <div style={{ animation: 'pageEnter var(--dur-normal) var(--ease-out)' }}>
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ display: 'inline-flex', gap: 6, marginBottom: 20 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: 10, height: 10, borderRadius: 999, background: 'var(--brand)',
                    animation: `ldot 1s ease-in-out ${i * 0.15}s infinite`,
                  }} />
                ))}
              </div>
              <h2 className="display" style={{ fontSize: 20, marginBottom: 8 }}>
                {jobStatus?.message || 'Setting up your profile…'}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                This usually takes 30–90 seconds. We'll take you to your roadmap when it's ready.
              </div>
              {/* F-02: Progress bar showing poll progress */}
              <div style={{ maxWidth: 280, margin: '0 auto' }}>
                <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pollProgress}%`, height: '100%', background: 'var(--brand-grad)',
                    borderRadius: 999, transition: 'width 1s linear',
                  }} />
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                  {pollProgress < 100 ? `Waiting… ${pollProgress}%` : 'Almost done…'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error — F-02: keeps user on intake screen with Retry button */}
        {error && (
          <div style={{ marginTop: 16 }}>
            <div style={{ padding: '12px 16px', background: 'oklch(0.7 0.2 25 / 0.12)', border: '1px solid oklch(0.7 0.2 25 / 0.4)', borderRadius: 10, color: 'var(--bad)', fontSize: 13 }}>
              {error}
              <button onClick={() => { setError(null); setSubmitting(false); setJobStatus(null); setPollProgress(0); }} style={{ float: 'right', background: 'none', border: 0, color: 'var(--bad)', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <Btn variant="outline" onClick={() => { setError(null); setSubmitting(false); setJobStatus(null); setPollProgress(0); setStep(4); }}>
                ← Back to questions
              </Btn>
              <Btn variant="primary" icon={I.spark} onClick={handleSubmit}>
                Retry generation →
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
