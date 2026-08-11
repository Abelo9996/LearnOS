import React from 'react';

/**
 * Choose any model OpenRouter offers.
 *
 * Onboarding used to hardcode four options, so somebody who wanted a free model
 * — the reason to bring your own key in the first place — simply could not pick
 * one. The catalog is ~340 models after the batch duplicates are dropped, and
 * all of them belong here.
 *
 * Price is shown per million tokens because that is the unit OpenRouter quotes
 * and the only one where these numbers are legible: $0.0000002 per token says
 * nothing, $0.20/M says it is cheap.
 */
export function formatPrice(m) {
  if (m.free) return 'Free';
  if (m.promptPrice == null) return '';
  const inM = m.promptPrice * 1e6;
  const outM = m.completionPrice != null ? m.completionPrice * 1e6 : null;
  const fmt = (v) => (v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}`);
  return outM != null ? `${fmt(inM)} in · ${fmt(outM)} out /M` : `${fmt(inM)} /M`;
}

const fmtContext = (n) => (!n ? '' : n >= 1000 ? `${Math.round(n / 1000)}K ctx` : `${n} ctx`);

export default function ModelPicker({
  value, onChange, models,
  placeholder = 'Search 300+ models…',
  allowCustom = true,
  size = 'md',
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [freeOnly, setFreeOnly] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const freeCount = React.useMemo(() => (models || []).filter(m => m.free).length, [models]);

  const list = React.useMemo(() => {
    let arr = models || [];
    if (freeOnly) arr = arr.filter(m => m.free);
    const ql = q.trim().toLowerCase();
    if (ql) arr = arr.filter(m => m.id.toLowerCase().includes(ql) || (m.name || '').toLowerCase().includes(ql));
    // No cap. The old picker sliced to 80, so with 400 models two thirds of the
    // catalog was unreachable unless you already knew what to type.
    return arr;
  }, [q, models, freeOnly]);

  const selected = (models || []).find(m => m.id === value);
  const pad = size === 'lg' ? '11px 14px' : '8px 12px';
  const font = size === 'lg' ? 13.5 : 12.5;

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        value={open ? q : (value || '')}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQ(''); }}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        style={{
          width: '100%', padding: pad, background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: size === 'lg' ? 10 : 8, color: 'var(--ink)', fontSize: font,
          fontFamily: 'var(--font-mono)', outline: 'none',
        }}
      />
      {!open && selected && (
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span>{selected.name}</span>
          <span style={{ color: selected.free ? 'var(--good)' : 'var(--muted)' }}>{formatPrice(selected)}</span>
          {selected.context ? <span>{fmtContext(selected.context)}</span> : null}
        </div>
      )}

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60,
          background: 'var(--bg-window)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: 'var(--shadow-md)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>
            <button type="button" onClick={() => setFreeOnly(f => !f)}
              style={{
                padding: '3px 9px', borderRadius: 999, fontSize: 10.5, cursor: 'pointer',
                background: freeOnly ? 'color-mix(in oklch, var(--good) 18%, transparent)' : 'transparent',
                border: `1px solid ${freeOnly ? 'var(--good)' : 'var(--border)'}`,
                color: freeOnly ? 'var(--good)' : 'var(--muted)',
              }}>
              Free only{freeCount ? ` · ${freeCount}` : ''}
            </button>
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', marginLeft: 'auto' }}>
              {models ? `${list.length} of ${models.length}` : 'loading…'}
            </span>
          </div>

          <div className="scroll" style={{ maxHeight: 300, overflowY: 'auto' }}>
            {!models && <div style={{ padding: 10, fontSize: 12, color: 'var(--muted)' }}>Loading models…</div>}
            {models && list.length === 0 && (
              <div style={{ padding: 10, fontSize: 12, color: 'var(--muted)' }}>
                Nothing matches{freeOnly ? ' among the free models' : ''}.
              </div>
            )}
            {list.map(m => (
              <button type="button" key={m.id} onClick={() => { onChange(m.id); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                  padding: '7px 10px', border: 0, borderTop: '1px solid var(--border)', cursor: 'pointer',
                  background: m.id === value ? 'var(--accent-soft)' : 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                onMouseLeave={e => e.currentTarget.style.background = m.id === value ? 'var(--accent-soft)' : 'transparent'}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="mono" style={{ display: 'block', fontSize: 11.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.id}</span>
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}{m.context ? ` · ${fmtContext(m.context)}` : ''}
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
            {allowCustom && q.trim() && !list.some(m => m.id === q.trim()) && (
              <button type="button" onClick={() => { onChange(q.trim()); setOpen(false); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', background: 'transparent', border: 0, borderTop: '1px solid var(--border)', cursor: 'pointer', fontSize: 11.5, color: 'var(--brand)' }}>
                Use custom slug "{q.trim()}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
