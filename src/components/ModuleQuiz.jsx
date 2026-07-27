import React from 'react';
import { I } from './Icons';
import { Card, Btn, ProgressBar, Ring } from './UI';
import API from '../api.js';
import MarkdownText from './Markdown';

/**
 * Practice / graded assessment surface (M3).
 *
 * Practice is safe: unlimited attempts, every answer explained. Graded costs an
 * attempt, hides explanations until it's passed or attempts run out, and is what
 * moves mastery and unlocks the next module — so the UI has to make which one
 * you're taking unmistakable.
 */
export default function ModuleQuiz({ moduleId, mode = 'practice', title, onDone, onClose }) {
  const graded = mode === 'graded';
  const [state, setState] = React.useState('loading'); // loading | taking | scored | error
  const [err, setErr] = React.useState('');
  const [quiz, setQuiz] = React.useState(null);
  const [answers, setAnswers] = React.useState({});
  const [result, setResult] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setState('loading');
    API.getModuleQuiz(moduleId, mode)
      .then(q => { if (alive) { setQuiz(q); setAnswers({}); setState('taking'); } })
      .catch(e => { if (alive) { setErr(e.code === 'NO_ATTEMPTS_LEFT' ? e.message : (e.message || 'Could not load this assessment.')); setState('error'); } });
    return () => { alive = false; };
  }, [moduleId, mode]);

  const submit = async () => {
    if (!quiz) return;
    setSubmitting(true);
    try {
      const ids = quiz.questions.map(q => q.id);
      const res = await API.submitModuleQuiz(moduleId, { mode, item_ids: ids, answers: ids.map((_, i) => (answers[i] ?? null)) });
      setResult(res);
      setState('scored');
      onDone && onDone(res);
    } catch (e) {
      setErr(e.message || 'Could not submit.');
      setState('error');
    } finally { setSubmitting(false); }
  };

  const accent = graded ? 'oklch(0.74 0.18 25)' : 'var(--brand)';

  if (state === 'loading') return <Shell title={title}><div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading assessment…</div></Shell>;

  if (state === 'error') return (
    <Shell title={title}>
      <div style={{ padding: '32px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>🔒</div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>{err}</div>
        <div style={{ marginTop: 18 }}><Btn variant="outline" onClick={onClose}>Close</Btn></div>
      </div>
    </Shell>
  );

  if (state === 'scored' && result) {
    const passLine = graded
      ? (result.passed
        ? `Passed · you needed ${Math.round((result.passThreshold || 0.8) * 100)}%`
        : `Not passed · ${Math.round((result.passThreshold || 0.8) * 100)}% needed${result.attemptsLeft ? ` · ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? '' : 's'} left` : ' · no attempts left'}`)
      : 'Practice · this does not affect your grade';
    return (
      <Shell title={title}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '4px 0 18px' }}>
          <Ring value={result.score / 100} size={78} sw={7} color={graded ? (result.passed ? 'var(--good)' : 'var(--bad)') : 'var(--brand)'} label={`${result.score}%`} />
          <div style={{ flex: 1 }}>
            <div className="display" style={{ fontSize: 20, color: 'var(--ink)' }}>{result.correct} of {result.total} correct</div>
            <div style={{ fontSize: 12.5, color: graded ? (result.passed ? 'var(--good)' : 'var(--bad)') : 'var(--muted)', marginTop: 4, fontWeight: graded ? 600 : 400 }}>{passLine}</div>
            {result.unlocked?.nextModules?.length > 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--brand)', marginTop: 6 }}>Unlocked: {result.unlocked.nextModules.join(', ')}</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '46vh', overflowY: 'auto', paddingRight: 4 }}>
          {result.results.map((r, i) => (
            <div key={i} style={{ padding: 12, borderRadius: 10, background: 'var(--surface-2)', border: `1px solid ${r.isCorrect ? 'color-mix(in oklch, var(--good) 40%, var(--border))' : 'color-mix(in oklch, var(--bad) 40%, var(--border))'}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: r.isCorrect ? 'var(--good)' : 'var(--bad)', fontWeight: 700, flexShrink: 0 }}>{r.isCorrect ? '✓' : '✕'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{r.question}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                    Your answer: <span style={{ color: r.isCorrect ? 'var(--good)' : 'var(--bad)' }}>{r.chosen == null ? '— skipped —' : (r.choices?.[r.chosen] ?? r.chosen)}</span>
                  </div>
                  {!r.isCorrect && result.explanationsRevealed && (
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 3 }}>Correct: {r.choices?.[r.answer_idx]}</div>
                  )}
                  {r.explanation && (
                    <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)', lineHeight: 1.6 }}>
                      <MarkdownText text={r.explanation} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!result.explanationsRevealed && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, lineHeight: 1.5 }}>
            Explanations stay hidden during a graded assessment — they're released once you pass or use your last attempt.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <Btn variant="outline" onClick={onClose}>Close</Btn>
          <div style={{ flex: 1 }} />
          {(!graded || (!result.passed && result.attemptsLeft > 0)) && (
            <Btn variant="primary" onClick={() => { setResult(null); setAnswers({}); setState('loading');
              API.getModuleQuiz(moduleId, mode).then(q => { setQuiz(q); setState('taking'); }).catch(e => { setErr(e.message); setState('error'); }); }}>
              {graded ? 'Try again' : 'Practice again'}
            </Btn>
          )}
        </div>
      </Shell>
    );
  }

  const qs = quiz?.questions || [];
  const answered = Object.keys(answers).length;
  return (
    <Shell title={title}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span className="mono" style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, background: `color-mix(in oklch, ${accent} 16%, transparent)`, color: accent, border: `1px solid color-mix(in oklch, ${accent} 35%, transparent)` }}>
          {graded ? 'Graded' : 'Practice'}
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {graded
            ? `Attempt ${(quiz.attemptsUsed || 0) + 1} of ${quiz.maxAttempts} · ${Math.round((quiz.passThreshold || 0.8) * 100)}% to pass`
            : 'Unlimited attempts · does not affect your grade'}
        </span>
        <span style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{answered}/{qs.length}</span>
      </div>
      <ProgressBar value={qs.length ? answered / qs.length : 0} height={5} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16, maxHeight: '52vh', overflowY: 'auto', paddingRight: 4 }}>
        {qs.map((q, i) => (
          <div key={q.id} style={{ padding: 14, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55, marginBottom: 10 }}>
              <span className="mono" style={{ color: 'var(--muted)', marginRight: 8 }}>{i + 1}.</span>{q.question}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(q.choices || []).map((ch, ci) => {
                const sel = answers[i] === ci;
                return (
                  <button key={ci} onClick={() => setAnswers(a => ({ ...a, [i]: ci }))}
                    style={{ textAlign: 'left', padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, lineHeight: 1.45,
                      background: sel ? `color-mix(in oklch, ${accent} 14%, transparent)` : 'var(--surface)',
                      border: `1px solid ${sel ? accent : 'var(--border)'}`, color: 'var(--ink)' }}>
                    <span className="mono" style={{ color: sel ? accent : 'var(--muted)', marginRight: 8 }}>{String.fromCharCode(65 + ci)}</span>{ch}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 18, alignItems: 'center' }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <div style={{ flex: 1 }} />
        {graded && answered < qs.length && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Answer all {qs.length} to submit</span>}
        <Btn variant="primary" disabled={submitting || (graded && answered < qs.length) || answered === 0} onClick={submit}>
          {submitting ? 'Scoring…' : graded ? 'Submit for grading' : 'Check my answers'}
        </Btn>
      </div>
    </Shell>
  );
}

// The modal wrapper already renders its own close control, so this header
// deliberately doesn't add a second one.
function Shell({ title, children }) {
  return (
    <div style={{ minWidth: 560, maxWidth: 720 }}>
      <h3 className="display" style={{ fontSize: 21, margin: '0 32px 14px 0' }}>{title || 'Assessment'}</h3>
      {children}
    </div>
  );
}
