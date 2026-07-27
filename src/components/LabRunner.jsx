import React from 'react';
import { I } from './Icons';
import { Btn, ProgressBar } from './UI';
import API from '../api.js';

/**
 * Executable lab surface (M8).
 *
 * Hands-on practice is what learners say they value most, and it is the part we
 * previously only described. This gives a lab a real editor, a Run button, the
 * actual program output, and pass/fail against declared cases — so "doing" means
 * doing, not reading about doing.
 *
 * Work is autosaved locally: losing an hour of lab work to a refresh would be
 * unforgivable.
 */
export default function LabRunner({ lessonId }) {
  const [lab, setLab] = React.useState(null);
  const [source, setSource] = React.useState('');
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState('');
  const storageKey = `learnos_lab_${lessonId}`;

  React.useEffect(() => {
    let alive = true;
    setResult(null); setError(''); setLab(null);
    API.getLab(lessonId)
      .then(r => {
        if (!alive) return;
        setLab(r.lab);
        let saved = null;
        try { saved = localStorage.getItem(storageKey); } catch {}
        setSource(saved ?? r.lab.starter_code ?? '');
      })
      .catch(e => { if (alive) setError(e.message || 'Could not load this lab.'); });
    return () => { alive = false; };
  }, [lessonId]);

  const onEdit = (v) => {
    setSource(v);
    try { localStorage.setItem(storageKey, v); } catch {}
  };

  const run = async () => {
    setRunning(true); setResult(null);
    try {
      setResult(await API.runLab(lessonId, { source, language: lab.language }));
    } catch (e) {
      setError(e.message || 'Could not run your code.');
    } finally { setRunning(false); }
  };

  const reset = () => {
    onEdit(lab?.starter_code || '');
    setResult(null);
  };

  if (error) return <Panel><div style={{ color: 'var(--bad)', fontSize: 13 }}>{error}</div></Panel>;
  if (!lab) return <Panel><div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading lab…</div></Panel>;

  // A lab without a runtime is still a legitimate exercise — it just isn't code.
  if (lab.language !== 'javascript' && lab.language !== 'python') return null;

  const tests = result?.tests;
  return (
    <Panel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, background: 'color-mix(in oklch, var(--brand-3) 16%, transparent)', color: 'var(--brand-3)', border: '1px solid color-mix(in oklch, var(--brand-3) 35%, transparent)' }}>
          {lab.language === 'python' ? 'Python' : 'JavaScript'}
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          Write it, run it, see what happens{lab.tests?.length ? ` — ${lab.tests.length + (lab.hiddenTestCount || 0)} checks` : ''}
        </span>
        <span style={{ flex: 1 }} />
        <Btn variant="ghost" size="sm" onClick={reset}>Reset</Btn>
        <Btn variant="primary" size="sm" disabled={running} onClick={run} icon={React.cloneElement(I.play, { size: 13 })}>
          {running ? 'Running…' : 'Run'}
        </Btn>
      </div>

      <textarea
        value={source}
        onChange={e => onEdit(e.target.value)}
        spellCheck={false}
        onKeyDown={e => {
          // Tab should indent, not escape the editor.
          if (e.key === 'Tab') {
            e.preventDefault();
            const el = e.target, s = el.selectionStart, en = el.selectionEnd;
            const next = `${source.slice(0, s)}    ${source.slice(en)}`;
            onEdit(next);
            requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; });
          }
        }}
        style={{
          width: '100%', minHeight: 240, padding: 14, borderRadius: 10, resize: 'vertical',
          background: 'oklch(0.16 0.02 270)', color: 'oklch(0.92 0.02 270)',
          border: '1px solid var(--border)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12.5, lineHeight: 1.6, tabSize: 4,
        }}
      />

      {lab.tests?.length > 0 && !result && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
          Your code is checked against {lab.tests.length} visible case{lab.tests.length === 1 ? '' : 's'}
          {lab.hiddenTestCount ? ` and ${lab.hiddenTestCount} hidden one${lab.hiddenTestCount === 1 ? '' : 's'}` : ''}.
          {lab.tests[0] && <> For example: <code style={{ color: 'var(--ink-2)' }}>{lab.tests[0].fn}({JSON.stringify(lab.tests[0].args).slice(1, -1)}) → {JSON.stringify(lab.tests[0].expected)}</code></>}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 14 }}>
          {tests && (
            <div style={{ padding: 12, borderRadius: 10, marginBottom: 10, background: 'var(--surface-2)', border: `1px solid ${tests.passed ? 'color-mix(in oklch, var(--good) 40%, var(--border))' : 'color-mix(in oklch, var(--bad) 35%, var(--border))'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: tests.passed ? 'var(--good)' : 'var(--ink)' }}>
                  {tests.passed ? '✓ All checks passed' : `${tests.passedCount}/${tests.total} checks passed`}
                </span>
                <div style={{ flex: 1 }}><ProgressBar value={tests.total ? tests.passedCount / tests.total : 0} height={5} /></div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{tests.score}%</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
                {(tests.cases || []).map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'flex-start' }}>
                    <span style={{ color: c.passed ? 'var(--good)' : 'var(--bad)', flexShrink: 0 }}>{c.passed ? '✓' : '✕'}</span>
                    <span style={{ color: 'var(--ink-2)', flex: 1 }}>
                      {c.name}{c.hidden ? ' (hidden)' : ''}
                      {!c.passed && c.error && <span style={{ color: 'var(--bad)' }}> — {c.error}</span>}
                      {!c.passed && !c.error && !c.hidden && 'actual' in c && (
                        <span style={{ color: 'var(--muted)' }}> — expected {JSON.stringify(c.expected)}, got {JSON.stringify(c.actual)}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="cap" style={{ marginBottom: 6 }}>Output</div>
          <pre style={{
            margin: 0, padding: 12, borderRadius: 10, maxHeight: 260, overflow: 'auto',
            background: 'oklch(0.16 0.02 270)', color: 'oklch(0.88 0.02 270)',
            border: '1px solid var(--border)', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {result.stdout || (result.stderr ? '' : '(no output)')}
            {result.stderr && <span style={{ color: 'oklch(0.75 0.17 25)' }}>{result.stdout ? '\n' : ''}{result.stderr}</span>}
          </pre>
          <div style={{ fontSize: 11.5, color: result.error ? 'var(--bad)' : 'var(--muted)', marginTop: 7 }}>
            {result.error || `Exited with code ${result.exitCode} in ${result.durationMs} ms`}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Panel({ children }) {
  return (
    <div style={{ marginTop: 20, padding: 18, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {children}
    </div>
  );
}
