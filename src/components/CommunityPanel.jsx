import React from 'react';
import { I } from './Icons';
import { Card, Btn, Tag, SectionHead, SkeletonRows } from './UI';
import API from '../api.js';
import { useToast } from '../App';

/**
 * The community registry, from inside LearnOS.
 *
 * Strictly a convenience layered on top of file sharing. If the registry is
 * unreachable, misconfigured, or switched off, everything here degrades to a
 * message and export/import by file keeps working exactly as before — the app
 * must never need a network to be useful.
 */
export function CommunityBrowse({ onImported }) {
  const { add: toast } = useToast();
  const [config, setConfig] = React.useState(null);
  const [courses, setCourses] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [q, setQ] = React.useState('');
  const [importing, setImporting] = React.useState(null);

  const load = React.useCallback(() => {
    setLoading(true); setError('');
    let isDefault = false;
    API.getRegistryConfig()
      .then(cfg => {
        setConfig(cfg); isDefault = !!cfg.isDefault;
        if (!cfg.enabled) { setError('DISABLED'); setLoading(false); return null; }
        return API.browseRegistry({ q }).then(r => setCourses(r.courses || []));
      })
      // On a fresh clone the default address is a registry on this machine that
      // nobody has started. That is the expected state, not a fault, and saying
      // "could not reach" makes a working install look broken on day one.
      .catch(e => setError(isDefault ? 'NO_LOCAL_REGISTRY' : (e.message || 'Could not reach the registry.')))
      .finally(() => setLoading(false));
  }, [q]);

  React.useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const importCourse = async (c) => {
    setImporting(c.id);
    try {
      // Fetch the bundle, then push it through the SAME import path a
      // hand-dropped file uses — community content gets no special trust.
      const { bundle } = await API.importFromRegistry(c.id);
      const r = await API.importCourse(bundle);
      toast(`Imported "${r.title}" · ${r.lessons} lessons`, 'success');
      onImported && onImported();
    } catch (e) {
      toast(e.message || 'Import failed', 'error');
    } finally { setImporting(null); }
  };

  if (error === 'DISABLED') {
    return (
      <Card style={{ marginBottom: 20 }}>
        <SectionHead title="Community courses" subtitle="Currently switched off for this instance" />
        <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.65, marginTop: 8 }}>
          LearnOS is not contacting any registry. Export and import by file still work — turn the
          registry back on in Settings if you want to browse published courses.
        </div>
      </Card>
    );
  }

  if (error === 'NO_LOCAL_REGISTRY') {
    return (
      <Card style={{ marginBottom: 20 }}>
        <SectionHead title="Community courses" subtitle="No registry connected yet" />
        <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.65, marginTop: 8 }}>
          Nothing to browse yet — LearnOS is looking for a registry on this machine and none is
          running. That is the normal starting state: a registry is an optional server people run to
          publish courses to each other, and LearnOS is complete without one.
          <div style={{ marginTop: 10 }}>
            Point it at one in <strong style={{ color: 'var(--ink-2)', fontWeight: 500 }}>Settings → Community</strong>, or
            skip it entirely and share courses as files below.
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Btn variant="outline" size="sm" onClick={load}>Check again</Btn>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card pad={false} style={{ marginBottom: 20 }}>
      <div style={{ padding: 'var(--pad)' }}>
        <SectionHead
          title="Community courses"
          subtitle={config?.url ? `Published by other people · ${config.url.replace(/^https?:\/\//, '')}` : 'Published by other people'}
        />
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search published courses…"
          style={{ width: '100%', marginTop: 12, padding: '10px 14px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)', fontSize: 13.5, outline: 'none' }}
        />
      </div>

      {loading ? (
        <div style={{ padding: '0 var(--pad) var(--pad)' }}><SkeletonRows rows={3} height={54} /></div>
      ) : error ? (
        <div style={{ padding: '0 var(--pad) var(--pad)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            {error}
            <div style={{ marginTop: 10 }}><Btn variant="outline" size="sm" onClick={load}>Try again</Btn></div>
          </div>
        </div>
      ) : courses.length === 0 ? (
        <div style={{ padding: '0 var(--pad) var(--pad)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          {q ? 'Nothing matches that search.' : 'Nothing has been published to this registry yet. Publish one of your own courses below and it will show up here.'}
        </div>
      ) : (
        <div className="stagger">
          {courses.map(c => (
            <div key={c.id} className="list-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px var(--pad)', borderTop: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>{c.title}</span>
                  {c.level && <Tag tone="neutral">{c.level}</Tag>}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                  by {c.publisher} · {c.modules} modules · {c.lessons} lessons · {c.quizItems} questions{c.hours ? ` · ${c.hours}h` : ''}
                </div>
              </div>
              <Btn variant="outline" size="sm" disabled={importing === c.id} onClick={() => importCourse(c)}>
                {importing === c.id ? 'Importing…' : 'Import'}
              </Btn>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * Publishing. A handle is claimed on first publish and the registry issues a
 * token which the server stores — it never reaches this component, because the
 * only thing it authorises is changing your own published work.
 */
export function PublishPanel({ courses, onPublished }) {
  const { add: toast } = useToast();
  const [config, setConfig] = React.useState(null);
  const [handle, setHandle] = React.useState('');
  const [publishing, setPublishing] = React.useState(null);
  const [notice, setNotice] = React.useState(null);

  const loadConfig = React.useCallback(() => {
    API.getRegistryConfig().then(c => { setConfig(c); if (c.handle) setHandle(c.handle); }).catch(() => setConfig(null));
  }, []);
  React.useEffect(loadConfig, [loadConfig]);

  if (config && !config.enabled) return null;

  const publish = async (c) => {
    const h = handle.trim().toLowerCase();
    if (!h) { toast('Choose a publisher handle first', 'error'); return; }
    setPublishing(c.slug); setNotice(null);
    try {
      const r = await API.publishToRegistry(c.slug, h);
      toast(`${r.updated ? 'Updated' : 'Published'} "${c.title}" as @${h}`, 'success');
      if (r.tokenSaved) {
        setNotice(`The handle @${h} is now yours on this registry. Its token is stored locally — keep this LearnOS install and you keep the ability to update what you publish.`);
      }
      loadConfig();
      onPublished && onPublished();
    } catch (e) {
      if (e.code === 'HANDLE_TAKEN') {
        toast(`"${h}" is already claimed by someone else — pick another handle.`, 'error');
      } else {
        toast(e.message || 'Publish failed', 'error');
      }
    } finally { setPublishing(null); }
  };

  return (
    <Card pad={false} style={{ marginBottom: 20 }}>
      <div style={{ padding: 'var(--pad)' }}>
        <SectionHead title="Publish to the community" subtitle="Make one of your courses available for anyone to import" />
        <label className="cap" style={{ display: 'block', margin: '12px 0 6px', fontSize: 10.5 }}>
          Publisher handle {config?.handle && <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--good)', fontWeight: 400 }}>— claimed</span>}
        </label>
        <input
          value={handle}
          onChange={e => setHandle(e.target.value.toLowerCase())}
          placeholder="e.g. abel"
          disabled={!!config?.handle}
          style={{
            width: '100%', maxWidth: 300, padding: '9px 13px', borderRadius: 9,
            background: config?.handle ? 'var(--surface-2)' : 'var(--surface)',
            border: '1px solid var(--border)', color: config?.handle ? 'var(--muted)' : 'var(--ink)',
            fontSize: 13.5, outline: 'none', fontFamily: 'var(--font-mono)',
          }}
        />
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 7, lineHeight: 1.55 }}>
          No account, no email. The first publish claims the handle; after that only this install can
          update what you published under it.
        </div>
        {notice && (
          <div style={{ marginTop: 12, padding: 11, borderRadius: 9, fontSize: 12.5, lineHeight: 1.55, background: 'var(--surface-2)', border: '1px solid color-mix(in oklch, var(--good) 40%, var(--border))', color: 'var(--ink-2)' }}>
            {notice}
          </div>
        )}
      </div>

      {courses.length === 0 ? (
        <div style={{ padding: '0 var(--pad) var(--pad)', fontSize: 13, color: 'var(--muted)' }}>No courses yet — generate one first.</div>
      ) : (
        <div>
          {courses.map(c => (
            <div key={c.slug} className="list-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px var(--pad)', borderTop: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>{c.title}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {c.modules} modules · {c.lessons} lessons · {c.quizItems} questions
                </div>
              </div>
              <Btn variant="outline" size="sm" disabled={publishing === c.slug || !handle.trim()} onClick={() => publish(c)}>
                {publishing === c.slug ? 'Publishing…' : 'Publish'}
              </Btn>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
