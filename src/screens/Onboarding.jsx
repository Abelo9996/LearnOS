import React from 'react';
import { I } from '../components/Icons';
import { Btn } from '../components/UI';
import API from '../api';

const GOAL_CHIPS = ['Machine Learning', 'Generative AI', 'Data Science', 'Web development'];
const STYLE_CHIPS = ['Visual examples', 'Hands-on projects', 'Theory first', 'Quick sprints'];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = React.useState(1);
  const [goal, setGoal] = React.useState('');
  const [level, setLevel] = React.useState('beginner');
  const [hours, setHours] = React.useState(5);
  const [styles, setStyles] = React.useState([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [jobStatus, setJobStatus] = React.useState(null); // null | 'working' | { jobId }
  const [error, setError] = React.useState(null);

  const toggleStyle = (s) => {
    setStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const canSubmit = goal.trim().length >= 3;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // Persist the PR profile
      await API.postIntake({
        goal: goal.trim(),
        answers: { level, time_per_week: hours, learning_style: styles },
      });

      // Mark onboarded
      await API.patchUserSettings({ onboarded_at: new Date().toISOString() }).catch(() => {});

      // Kick off roadmap generation
      const { jobId } = await API.genRoadmap(goal.trim(), { level, time_per_week: hours, learning_style: styles });
      setJobStatus({ jobId });

      // Poll for completion
      let result = null;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const job = await API.getJob(jobId).catch(() => null);
        if (job?.status === 'done') { result = job.result; break; }
        if (job?.status === 'failed') throw new Error(job.error || 'Generation failed');
      }
      if (!result?.roadmapId) throw new Error('Generation timed out — try again from Roadmaps');

      onComplete(result.roadmapId);
    } catch (e) {
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
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: 'var(--brand-grad)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            boxShadow: '0 0 0 1px oklch(0.68 0.21 295 / 0.4), 0 0 20px oklch(0.68 0.21 295 / 0.4)',
          }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <path d="M12 3 21 8v8l-9 5-9-5V8z" stroke="oklch(0.16 0.02 270)" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M3 8l9 5 9-5M12 13v9" stroke="oklch(0.16 0.02 270)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="display" style={{ fontSize: 26, marginBottom: 6 }}>Welcome to LearnOS</h1>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>Let's personalize your learning experience</div>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 32 }}>
          <StepDot n={1} />
          <div style={{ width: 40, height: 2, background: step >= 2 ? 'var(--brand)' : 'var(--border)', borderRadius: 999 }} />
          <StepDot n={2} />
          <div style={{ width: 40, height: 2, background: step >= 3 ? 'var(--brand)' : 'var(--border)', borderRadius: 999 }} />
          <StepDot n={3} />
        </div>

        {/* Step 1 — Goal */}
        {step === 1 && (
          <div style={{ animation: 'pageEnter var(--dur-normal) var(--ease-out)' }}>
            <div className="cap" style={{ marginBottom: 8, fontSize: 11 }}>Step 1 of 3</div>
            <h2 className="display" style={{ fontSize: 20, marginBottom: 6 }}>What do you want to learn?</h2>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              Describe your learning goal — be as specific or broad as you like.
            </div>
            <input
              autoFocus
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="e.g. Build and deploy large language model applications"
              onKeyDown={e => { if (e.key === 'Enter' && goal.trim().length >= 3) setStep(2); }}
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
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn variant="primary" disabled={goal.trim().length < 3} onClick={() => setStep(2)}>Continue →</Btn>
            </div>
          </div>
        )}

        {/* Step 2 — Level + time */}
        {step === 2 && (
          <div style={{ animation: 'pageEnter var(--dur-normal) var(--ease-out)' }}>
            <div className="cap" style={{ marginBottom: 8, fontSize: 11 }}>Step 2 of 3</div>
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
              <Btn variant="outline" onClick={() => setStep(1)}>← Back</Btn>
              <Btn variant="primary" onClick={() => setStep(3)}>Continue →</Btn>
            </div>
          </div>
        )}

        {/* Step 3 — Style */}
        {step === 3 && (
          <div style={{ animation: 'pageEnter var(--dur-normal) var(--ease-out)' }}>
            <div className="cap" style={{ marginBottom: 8, fontSize: 11 }}>Step 3 of 3</div>
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
              <Btn variant="outline" onClick={() => setStep(2)}>← Back</Btn>
              <Btn variant="primary" icon={I.spark} onClick={handleSubmit}>Generate my roadmap →</Btn>
            </div>
          </div>
        )}

        {/* Submitting / polling state */}
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
                {jobStatus ? 'Curriculum agent is designing your roadmap…' : 'Setting up your profile…'}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                This usually takes 30–90 seconds. We'll take you to your roadmap when it's ready.
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'oklch(0.7 0.2 25 / 0.12)', border: '1px solid oklch(0.7 0.2 25 / 0.4)', borderRadius: 10, color: 'var(--bad)', fontSize: 13 }}>
            {error}
            <button onClick={() => { setError(null); setSubmitting(false); }} style={{ float: 'right', background: 'none', border: 0, color: 'var(--bad)', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        )}
      </div>
    </div>
  );
}
