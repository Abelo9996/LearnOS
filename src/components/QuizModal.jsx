import React from 'react';
import { I } from './Icons';
import { Btn, Ring } from './UI';
import API from '../api.js';
import { useToast } from '../App';

/**
 * A real, scored quiz. Generates a multiple-choice quiz for a node via the
 * Assessment agent, lets the learner answer every question, then submits it to
 * be scored + persisted (XP, activity, node mastery). Rendered inside the global
 * modal; `onClose` closes it, `onDone` lets the opener refresh (e.g. mastery).
 */
export default function QuizModal({ nodeId = null, title = 'Module quiz', onClose, onDone }) {
  const { add: toast } = useToast();
  const [phase, setPhase] = React.useState('loading'); // loading | error | taking | results
  const [errMsg, setErrMsg] = React.useState('');
  const [quiz, setQuiz] = React.useState(null);
  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState([]);
  const [result, setResult] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await API.generateQuiz({ node_id: nodeId });
        const q = res?.quiz || res;
        if (!alive) return;
        if (!q?.questions?.length) throw new Error('The Assessment agent returned an empty quiz.');
        setQuiz(q);
        setAnswers(new Array(q.questions.length).fill(null));
        setPhase('taking');
      } catch (e) {
        if (!alive) return;
        setErrMsg(e.code === 'NO_KEY' || /key/i.test(e.message || '')
          ? 'Add an OpenRouter key in Settings → API Keys to generate quizzes.'
          : (e.message || 'Could not generate a quiz right now.'));
        setPhase('error');
      }
    })();
    return () => { alive = false; };
  }, [nodeId]);

  const questions = quiz?.questions || [];
  const q = questions[idx];
  const pick = (i) => setAnswers(a => a.map((v, j) => (j === idx ? i : v)));
  const answeredCount = answers.filter(a => a !== null).length;

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await API.submitQuiz({
        node_id: nodeId,
        title: quiz.title || title,
        questions,
        answers,
      });
      setResult(res);
      setPhase('results');
      toast(`Quiz scored: ${res.score}% · +${res.xp} XP`, res.score >= 70 ? 'success' : 'info');
      onDone && onDone(res);
    } catch (e) {
      toast(e.message || 'Could not submit the quiz', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const wrap = (children) => <div style={{ minWidth: 460, maxWidth: 560 }}>{children}</div>;

  if (phase === 'loading') {
    return wrap(
      <div style={{ padding: '40px 8px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', gap: 6, marginBottom: 14 }}>
          {[0, 1, 2].map(i => <span key={i} style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--brand)', animation: `ldot 1s ease-in-out ${i * 0.15}s infinite` }} />)}
        </div>
        <div className="display" style={{ fontSize: 18, color: 'var(--ink)' }}>Assessment agent is writing your quiz…</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>{title}</div>
      </div>
    );
  }

  if (phase === 'error') {
    return wrap(
      <div style={{ padding: '28px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🔌</div>
        <div className="display" style={{ fontSize: 18, color: 'var(--ink)' }}>Can't start the quiz</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 20px', lineHeight: 1.6 }}>{errMsg}</div>
        <Btn variant="outline" onClick={onClose}>Close</Btn>
      </div>
    );
  }

  if (phase === 'results') {
    const pct = result.score;
    const tone = pct >= 80 ? 'var(--good)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)';
    return wrap(
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <Ring value={pct / 100} size={72} sw={7} color={tone} label={`${pct}%`} />
          <div>
            <div className="display" style={{ fontSize: 22, color: 'var(--ink)' }}>{result.correct} / {result.total} correct</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>+{result.xp} XP earned{nodeId ? ' · mastery updated' : ''}</div>
          </div>
        </div>
        <div className="scroll" style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {questions.map((qq, i) => {
            const r = result.results[i];
            return (
              <div key={i} style={{ padding: 12, borderRadius: 10, background: 'var(--surface)', border: `1px solid ${r.isCorrect ? 'oklch(0.78 0.16 155 / 0.4)' : 'oklch(0.7 0.2 25 / 0.4)'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: r.isCorrect ? 'var(--good)' : 'var(--bad)', fontWeight: 700, flexShrink: 0 }}>{r.isCorrect ? '✓' : '✗'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, marginBottom: 6 }}>{qq.q}</div>
                    {qq.options.map((opt, oi) => (
                      <div key={oi} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, marginBottom: 3,
                        color: oi === r.correct ? 'var(--good)' : oi === r.chosen ? 'var(--bad)' : 'var(--muted)',
                        background: oi === r.correct ? 'oklch(0.78 0.16 155 / 0.12)' : oi === r.chosen && !r.isCorrect ? 'oklch(0.7 0.2 25 / 0.12)' : 'transparent',
                        fontWeight: oi === r.correct ? 600 : 400 }}>
                        {oi === r.correct ? '● ' : oi === r.chosen ? '○ ' : '  '}{opt}
                      </div>
                    ))}
                    {qq.why && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6, fontStyle: 'italic' }}>{qq.why}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn variant="primary" onClick={onClose}>Done</Btn>
        </div>
      </div>
    );
  }

  // taking
  return wrap(
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div className="cap" style={{ color: 'var(--brand)' }}>Question {idx + 1} of {questions.length}</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{answeredCount}/{questions.length} answered</div>
      </div>
      {/* progress dots */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
        {questions.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i === idx ? 'var(--brand)' : answers[i] !== null ? 'var(--brand-3)' : 'var(--surface-3)', transition: 'background var(--dur-normal)' }} />
        ))}
      </div>
      <div className="display" style={{ fontSize: 18, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 16 }}>{q.q}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {q.options.map((opt, oi) => {
          const on = answers[idx] === oi;
          return (
            <button key={oi} onClick={() => pick(oi)} className="ui-btn" style={{
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%',
              padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
              background: on ? 'var(--accent-soft)' : 'var(--surface)',
              border: `1px solid ${on ? 'var(--accent-line)' : 'var(--border)'}`,
              color: on ? 'oklch(0.82 0.18 295)' : 'var(--ink-2)', fontSize: 13.5,
            }}>
              <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 999, border: `2px solid ${on ? 'var(--brand)' : 'var(--border-strong)'}`, background: on ? 'var(--brand)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.16 0.02 270)', fontSize: 12, fontWeight: 700 }}>{String.fromCharCode(65 + oi)}</span>
              {opt}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
        <Btn variant="ghost" disabled={idx === 0} onClick={() => setIdx(i => Math.max(0, i - 1))} icon={React.cloneElement(I.chevronL, { size: 14 })}>Back</Btn>
        {idx < questions.length - 1 ? (
          <Btn variant="primary" disabled={answers[idx] === null} onClick={() => setIdx(i => i + 1)} iconRight={React.cloneElement(I.arrowR, { size: 15 })}>Next</Btn>
        ) : (
          <Btn variant="primary" disabled={answeredCount < questions.length || submitting} onClick={submit}>
            {submitting ? 'Scoring…' : 'Submit quiz'}
          </Btn>
        )}
      </div>
    </div>
  );
}
