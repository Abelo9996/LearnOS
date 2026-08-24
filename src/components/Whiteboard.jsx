import React from 'react';
import { Excalidraw, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw';
import API from '../api';

/**
 * The Tutor whiteboard, on Excalidraw.
 *
 * The old board was freehand strokes on a raw canvas — fine for scribbling,
 * useless for teaching. Excalidraw gives real shapes, arrows, text and sticky
 * notes, and — the reason it's here — a **Mermaid → diagram** path: paste (or
 * have the tutor emit) Mermaid and it drops onto the board as editable,
 * hand-drawn-style elements you can then rearrange and annotate.
 *
 * Loaded lazily by Session.jsx (Excalidraw is large). The whole scene persists
 * per session as one JSON blob. MIT-licensed — no watermark, no license key.
 * Its fonts come from the Excalidraw CDN; LearnOS is self-hosted, not offline,
 * so that's fine, and the CSP in server.js allows it.
 */
export default function Whiteboard({ session }) {
  const sid = session?.id;
  const isOnline = sid && sid !== 'local';
  const [apiRef, setApiRef] = React.useState(null);
  const [initial, setInitial] = React.useState(undefined); // undefined = loading
  const [mermaidText, setMermaidText] = React.useState('');
  const [mermaidErr, setMermaidErr] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const saveTimer = React.useRef(null);

  React.useEffect(() => {
    let alive = true;
    if (!isOnline) { setInitial({ elements: [] }); return; }
    API.getWhiteboardScene(sid)
      .then(r => { if (alive) setInitial(r?.scene?.elements ? r.scene : { elements: [] }); })
      .catch(() => { if (alive) setInitial({ elements: [] }); });
    return () => { alive = false; };
  }, [sid, isOnline]);

  // Debounced autosave — Excalidraw fires onChange on every pointer move.
  const persist = React.useCallback((elements) => {
    if (!isOnline) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      // Strip deleted elements so the scene doesn't grow forever.
      const live = (elements || []).filter(el => !el.isDeleted);
      API.saveWhiteboardScene(sid, { elements: live }).catch(() => {});
    }, 1000);
  }, [sid, isOnline]);

  React.useEffect(() => () => clearTimeout(saveTimer.current), []);

  const drawMermaid = async () => {
    const text = mermaidText.trim();
    if (!text) return;
    setMermaidErr('');
    try {
      const { elements, files } = await parseMermaidToExcalidraw(text, { themeVariables: { fontSize: '16px' } });
      const converted = convertToExcalidrawElements(elements);
      if (apiRef) {
        const existing = apiRef.getSceneElements();
        apiRef.updateScene({ elements: [...existing, ...converted] });
        if (files) apiRef.addFiles(Object.values(files));
        apiRef.scrollToContent(converted, { fitToContent: true, animate: true });
        persist([...existing, ...converted]);  // updateScene doesn't always fire onChange
      }
      setMermaidText(''); setOpen(false);
    } catch {
      setMermaidErr('That Mermaid didn’t parse — check the syntax.');
    }
  };

  if (initial === undefined) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading the whiteboard…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'min(70vh, 640px)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 }}>Whiteboard</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>shapes · arrows · text · diagrams</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setOpen(o => !o)}
          style={{ fontSize: 12, padding: '5px 11px', borderRadius: 7, cursor: 'pointer', background: open ? 'var(--accent-soft)' : 'var(--surface-2)', border: `1px solid ${open ? 'var(--accent-line)' : 'var(--border)'}`, color: open ? 'oklch(0.82 0.18 295)' : 'var(--ink-2)' }}>
          Diagram from text
        </button>
      </div>

      {open && (
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-window)' }}>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 6, lineHeight: 1.5 }}>
            Paste Mermaid (or ask the Tutor for a Mermaid diagram) — it drops onto the board as editable shapes.
          </div>
          <textarea
            value={mermaidText} onChange={e => setMermaidText(e.target.value)}
            placeholder={'flowchart LR\n  A[Idea] --> B[Example]\n  B --> C[Mastery]'}
            spellCheck={false}
            style={{ width: '100%', minHeight: 90, resize: 'vertical', padding: 10, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 12.5, outline: 'none' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button onClick={drawMermaid} disabled={!mermaidText.trim()}
              style={{ fontSize: 12.5, padding: '6px 14px', borderRadius: 8, cursor: mermaidText.trim() ? 'pointer' : 'not-allowed', background: 'var(--brand)', border: 0, color: '#fff', opacity: mermaidText.trim() ? 1 : 0.5 }}>
              Add to board
            </button>
            {mermaidErr && <span style={{ fontSize: 11.5, color: 'var(--bad)' }}>{mermaidErr}</span>}
          </div>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        <Excalidraw
          theme="dark"
          initialData={{ elements: initial.elements || [], appState: { viewBackgroundColor: '#0b0e14' }, scrollToContent: true }}
          excalidrawAPI={(a) => setApiRef(a)}
          onChange={(elements) => persist(elements)}
          UIOptions={{ canvasActions: { toggleTheme: false } }}
        />
      </div>
    </div>
  );
}
