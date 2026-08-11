import React from 'react';

/**
 * Choose any model OpenRouter offers, as a vendor and then a model.
 *
 * Onboarding used to hardcode four options, so somebody who wanted a free model
 * — the reason to bring your own key in the first place — simply could not pick
 * one. Replacing that with one flat list of 341 `vendor/model` slugs fixed the
 * availability but not the browsing: every entry repeated its vendor prefix,
 * and finding Anthropic's models meant scrolling past OpenAI's 59 and Qwen's
 * 49. Pick the vendor first, then the model, and each list stays a length a
 * person can actually read.
 *
 * Price is shown per million tokens because that is the unit OpenRouter quotes
 * and the only one where the numbers are legible: $0.0000002 per token says
 * nothing, $0.20/M says it is cheap.
 */
export function formatPrice(m) {
  if (!m) return '';
  if (m.free) return 'Free';
  if (m.promptPrice == null) return '';
  const fmt = (v) => (v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}`);
  const inM = m.promptPrice * 1e6;
  const outM = m.completionPrice != null ? m.completionPrice * 1e6 : null;
  return outM != null ? `${fmt(inM)} in · ${fmt(outM)} out /M` : `${fmt(inM)} /M`;
}

const fmtContext = (n) => (!n ? '' : n >= 1000 ? `${Math.round(n / 1000)}K ctx` : `${n} ctx`);
const providerOf = (id) => (id && id.includes('/') ? id.split('/')[0].replace(/^~/, '') : '');

export default function ModelPicker({
  value, onChange, models,
  allowCustom = true,
  size = 'md',
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [freeOnly, setFreeOnly] = React.useState(false);
  // Which vendor's list is on screen. Starts at whatever is selected, but the
  // stored value only changes when a model is actually chosen — browsing around
  // must not silently repoint an agent.
  const [browse, setBrowse] = React.useState(() => providerOf(value));
  const ref = React.useRef(null);

  React.useEffect(() => { setBrowse(providerOf(value)); }, [value]);
  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const providers = React.useMemo(() => {
    const by = new Map();
    for (const m of models || []) {
      if (freeOnly && !m.free) continue;
      const p = by.get(m.provider) || { id: m.provider, count: 0, free: false, cheapest: null };
      p.count++;
      if (m.free) p.free = true;
      if (m.promptPrice != null && (p.cheapest == null || m.promptPrice < p.cheapest)) p.cheapest = m.promptPrice;
      by.set(m.provider, p);
    }
    return [...by.values()].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  }, [models, freeOnly]);

  // Turning on "Free only" can empty the provider you were looking at —
  // Anthropic has no free models — which left the panel showing "0 · No models
  // here" and no obvious way forward. Move to the first provider that does.
  React.useEffect(() => {
    if (!providers.length) return;
    if (!browse || !providers.some(p => p.id === browse)) setBrowse(providers[0].id);
  }, [providers, browse]);

  // A search is answered across every vendor — you should not have to know who
  // makes a model to find it by name.
  const searching = q.trim().length > 0;
  const list = React.useMemo(() => {
    let arr = models || [];
    if (freeOnly) arr = arr.filter(m => m.free);
    const ql = q.trim().toLowerCase();
    if (ql) return arr.filter(m => m.id.toLowerCase().includes(ql) || (m.name || '').toLowerCase().includes(ql));
    return browse ? arr.filter(m => m.provider === browse) : [];
  }, [models, q, freeOnly, browse]);

  const selected = (models || []).find(m => m.id === value);
  const pad = size === 'lg' ? '11px 14px' : '8px 12px';
  const font = size === 'lg' ? 13.5 : 12.5;
  const rowBg = (id) => (id === value ? 'var(--accent-soft)' : 'transparent');

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <button type="button" onClick={() => { setOpen(o => !o); setQ(''); }}
        style={{
          width: '100%', padding: pad, textAlign: 'left', cursor: 'pointer',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: size === 'lg' ? 10 : 8, color: 'var(--ink)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
        <span className="mono" style={{ flex: 1, minWidth: 0, fontSize: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || 'Choose a model…'}
        </span>
        {selected && (
          <span className="mono" style={{ flexShrink: 0, fontSize: 10, color: selected.free ? 'var(--good)' : 'var(--muted)' }}>
            {formatPrice(selected)}
          </span>
        )}
        <span style={{ flexShrink: 0, color: 'var(--muted)', fontSize: 10 }}>▾</span>
      </button>

      {!open && selected && (
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span>{selected.name}</span>
          {selected.context ? <span>{fmtContext(selected.context)}</span> : null}
          {selected.alias ? <span style={{ color: 'var(--brand)' }}>tracks latest</span> : null}
        </div>
      )}

      {/* The panel is deliberately wider than its trigger: two columns plus a
          price do not fit in the narrow cell this sits in on the routing
          screen, and inheriting that width clipped the prices and hid the model
          names entirely. Anchored right so it opens inward, not off-page. */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, left: 'auto', zIndex: 60,
          width: 'max(100%, min(560px, 88vw))',
          background: 'var(--bg-window)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: 'var(--shadow-md)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
            <input
              autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search all models, or pick a provider below…"
              style={{ flex: 1, minWidth: 0, padding: '6px 9px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--ink)', fontSize: 12, outline: 'none' }}
            />
            <button type="button" onClick={() => setFreeOnly(f => !f)}
              style={{
                flexShrink: 0, padding: '4px 9px', borderRadius: 999, fontSize: 10.5, cursor: 'pointer',
                background: freeOnly ? 'color-mix(in oklch, var(--good) 18%, transparent)' : 'transparent',
                border: `1px solid ${freeOnly ? 'var(--good)' : 'var(--border)'}`,
                color: freeOnly ? 'var(--good)' : 'var(--muted)',
              }}>
              Free only
            </button>
          </div>

          <div style={{ display: 'flex', maxHeight: 320 }}>
            {/* Providers */}
            {!searching && (
              <div className="scroll" style={{ width: 158, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid var(--border)' }}>
                <div className="cap" style={{ padding: '7px 10px 5px', fontSize: 9.5, color: 'var(--faint)' }}>
                  Provider · {providers.length}
                </div>
                {providers.map(p => (
                  <button type="button" key={p.id} onClick={() => setBrowse(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                      padding: '6px 10px', border: 0, cursor: 'pointer', fontSize: 11.5,
                      background: p.id === browse ? 'var(--accent-soft)' : 'transparent',
                      color: p.id === browse ? 'var(--ink)' : 'var(--ink-2)',
                    }}
                    onMouseEnter={e => { if (p.id !== browse) e.currentTarget.style.background = 'var(--surface)'; }}
                    onMouseLeave={e => { if (p.id !== browse) e.currentTarget.style.background = 'transparent'; }}>
                    <span className="mono" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.id}</span>
                    {p.free && <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: 999, background: 'var(--good)' }} title="has free models" />}
                    <span className="mono" style={{ flexShrink: 0, fontSize: 10, color: 'var(--faint)' }}>{p.count}</span>
                  </button>
                ))}
                {providers.length === 0 && <div style={{ padding: 10, fontSize: 11.5, color: 'var(--muted)' }}>None</div>}
              </div>
            )}

            {/* Models */}
            <div className="scroll" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
              {!models && <div style={{ padding: 12, fontSize: 12, color: 'var(--muted)' }}>Loading models…</div>}
              {models && !searching && (
                <div className="cap" style={{ padding: '7px 10px 5px', fontSize: 9.5, color: 'var(--faint)' }}>
                  {browse ? `${browse} · ${list.length}` : 'Pick a provider'}
                </div>
              )}
              {models && searching && (
                <div className="cap" style={{ padding: '7px 10px 5px', fontSize: 9.5, color: 'var(--faint)' }}>
                  {list.length} match{list.length === 1 ? '' : 'es'} across all providers
                </div>
              )}
              {models && list.length === 0 && (
                <div style={{ padding: '4px 10px 12px', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {searching ? `Nothing matches${freeOnly ? ' among the free models' : ''}.`
                    : browse ? 'No models here.' : 'Choose a provider on the left, or type to search.'}
                </div>
              )}
              {list.map(m => (
                <button type="button" key={m.id} onClick={() => { onChange(m.id); setOpen(false); setQ(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                    padding: '7px 10px', border: 0, borderTop: '1px solid var(--border)', cursor: 'pointer',
                    background: rowBg(m.id),
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = rowBg(m.id)}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="mono" style={{ display: 'block', fontSize: 11.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {/* Inside a provider the prefix is redundant; in a global
                          search it is the only thing telling them apart. */}
                      {searching ? m.id : m.slug}
                    </span>
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name}{m.context ? ` · ${fmtContext(m.context)}` : ''}{m.alias ? ' · tracks latest' : ''}
                    </span>
                  </span>
                  <span className="mono" style={{
                    flexShrink: 0, fontSize: 10, padding: '2px 7px', borderRadius: 999,
                    color: m.free ? 'var(--good)' : 'var(--muted)',
                    background: m.free ? 'color-mix(in oklch, var(--good) 14%, transparent)' : 'transparent',
                    border: `1px solid ${m.free ? 'color-mix(in oklch, var(--good) 35%, transparent)' : 'transparent'}`,
                  }}>
                    {formatPrice(m)}
                  </span>
                </button>
              ))}
              {allowCustom && searching && !list.some(m => m.id === q.trim()) && (
                <button type="button" onClick={() => { onChange(q.trim()); setOpen(false); setQ(''); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', background: 'transparent', border: 0, borderTop: '1px solid var(--border)', cursor: 'pointer', fontSize: 11.5, color: 'var(--brand)' }}>
                  Use custom slug "{q.trim()}"
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
