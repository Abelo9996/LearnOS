import React from 'react';
import { I } from '../components/Icons';
import { Card, Btn, Tag, PageScroll, PageHeader, SectionHead, SkeletonRows } from '../components/UI';
import API from '../api.js';
import { useToast } from '../App';

const GITHUB = 'https://github.com/Abelo9996/LearnOS';

/**
 * Share — M12.
 *
 * This screen used to be "Community": a feed of threads written by four invented
 * people, with a leaderboard of fabricated contributions. LearnOS is single-user
 * and self-hosted, so there was no community — it was set dressing, and it sat
 * oddly next to a codebase that refuses to fabricate anything else.
 *
 * What a local open-source tool can genuinely do is treat a course as a file:
 * export yours, send it to someone, import theirs. No accounts, no server, works
 * offline. Real discussion lives where the project actually is — GitHub.
 */
export default function Share() {
  const { add: toast } = useToast();
  const [courses, setCourses] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const fileRef = React.useRef(null);

  const load = React.useCallback(() => {
    setLoading(true);
    API.getExportableCourses()
      .then(r => setCourses(r.courses || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(load, [load]);

  const exportCourse = async (slug, title) => {
    try {
      const bundle = await API.exportCourse(slug);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}.learnos.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast(`Exported "${title}"`, 'success');
    } catch (e) {
      toast(e.message || 'Export failed', 'error');
    }
  };

  const onFile = async (file) => {
    if (!file) return;
    setImporting(true); setResult(null);
    try {
      const text = await file.text();
      let bundle;
      try { bundle = JSON.parse(text); }
      catch { throw new Error('That file is not valid JSON.'); }
      const r = await API.importCourse(bundle);
      setResult(r);
      toast(`Imported "${r.title}" · ${r.lessons} lessons`, 'success');
      load();
    } catch (e) {
      setResult({ error: true, message: e.message || 'Import failed' });
      toast(e.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <PageScroll>
      <PageHeader
        eyebrow="Open-source content commons"
        title="Share"
        subtitle="A course is a file. Export yours to send to someone, or import one you were given — readings, resources, labs and question bank included."
      />

      {/* Import */}
      <Card style={{ marginBottom: 20 }}>
        <SectionHead title="Import a course" subtitle="Drop in a .learnos.json bundle" />
        <div
          onDragOver={e => { e.preventDefault(); e.currentTarget.dataset.over = '1'; }}
          onDragLeave={e => { e.currentTarget.dataset.over = '0'; }}
          onDrop={e => { e.preventDefault(); e.currentTarget.dataset.over = '0'; onFile(e.dataTransfer.files?.[0]); }}
          className="drop-zone"
          style={{
            marginTop: 12, padding: '28px 20px', borderRadius: 12, textAlign: 'center',
            border: '1.5px dashed var(--border-strong)', background: 'var(--surface)',
            transition: 'border-color var(--dur-fast) var(--ease-smooth), background var(--dur-fast) var(--ease-smooth)',
          }}
        >
          <div style={{ color: 'var(--muted)', display: 'inline-flex', marginBottom: 10 }}>
            {React.cloneElement(I.upload || I.download, { size: 26 })}
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
            {importing ? 'Importing…' : 'Drop a course bundle here'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 5 }}>
            or <button onClick={() => fileRef.current?.click()} style={{ background: 'none', border: 0, color: 'var(--brand)', cursor: 'pointer', textDecoration: 'underline', padding: 0, font: 'inherit' }}>choose a file</button>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={e => onFile(e.target.files?.[0])} style={{ display: 'none' }} />
        </div>

        {result && (
          <div style={{
            marginTop: 12, padding: 12, borderRadius: 10, fontSize: 13, lineHeight: 1.6,
            background: 'var(--surface-2)',
            border: `1px solid ${result.error ? 'color-mix(in oklch, var(--bad) 40%, var(--border))' : 'color-mix(in oklch, var(--good) 40%, var(--border))'}`,
            color: result.error ? 'var(--bad)' : 'var(--ink-2)',
          }}>
            {result.error ? result.message : (
              <>
                <strong style={{ color: 'var(--good)' }}>Imported “{result.title}”</strong> — {result.modules} modules,
                {' '}{result.lessons} lessons, {result.quizItems} questions.
                {result.droppedUrls > 0 && <> {result.droppedUrls} unsafe link{result.droppedUrls === 1 ? '' : 's'} were dropped.</>}
                <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 12.5 }}>{result.note}</div>
              </>
            )}
          </div>
        )}
      </Card>

      {/* Export */}
      <Card pad={false} style={{ marginBottom: 20 }}>
        <div style={{ padding: 'var(--pad)' }}>
          <SectionHead title="Export a course" subtitle="Everything travels with it — lessons, verified resources, labs and the question bank" />
        </div>
        {loading ? (
          <div style={{ padding: '0 var(--pad) var(--pad)' }}><SkeletonRows rows={4} height={46} /></div>
        ) : courses.length === 0 ? (
          <div style={{ padding: '0 var(--pad) var(--pad)', color: 'var(--muted)', fontSize: 13 }}>No courses yet — generate one first.</div>
        ) : (
          <div className="stagger">
            {courses.map(c => (
              <div key={c.slug} className="list-row" style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px var(--pad)', borderTop: '1px solid var(--border)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>{c.title}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {c.modules} modules · {c.lessons} lessons · {c.quizItems} questions{c.hours ? ` · ${c.hours}h` : ''}
                  </div>
                </div>
                <Btn variant="outline" size="sm" icon={React.cloneElement(I.download || I.open, { size: 14 })}
                  onClick={() => exportCourse(c.slug, c.title)}>Export</Btn>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Where the actual community is */}
      <Card>
        <SectionHead title="Discussion & contribution" subtitle="LearnOS runs entirely on your machine — there is no server holding a forum" />
        <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.7, marginTop: 10 }}>
          This app is yours alone: your data never leaves this computer, and there is no account,
          no telemetry and no feed of other people. That is the point of it being self-hosted —
          but it does mean the community lives where the project does, not inside the app.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <a href={GITHUB} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <Btn variant="primary" size="md" icon={React.cloneElement(I.github, { size: 15 })}>Project on GitHub</Btn>
          </a>
          <a href={`${GITHUB}/discussions`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <Btn variant="outline" size="md" icon={React.cloneElement(I.people, { size: 15 })}>Discussions</Btn>
          </a>
          <a href={`${GITHUB}/issues`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <Btn variant="outline" size="md" icon={React.cloneElement(I.spark, { size: 15 })}>Report an issue</Btn>
          </a>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <Tag tone="neutral">No account</Tag>
          <Tag tone="neutral">No telemetry</Tag>
          <Tag tone="neutral">Runs offline</Tag>
        </div>
      </Card>
    </PageScroll>
  );
}
