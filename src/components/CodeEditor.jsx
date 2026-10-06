import React from 'react';

// A real code editor (CodeMirror 6, syntax highlighting + line numbers),
// lazy-loaded so it only costs bytes on screens that actually show code (labs
// and coding steps). Until the chunk resolves, or if it ever fails to load, it
// falls back to a plain styled textarea, so the editor is always usable and
// typing never blocks on a download.
const LazyImpl = React.lazy(() => import('./CodeEditorImpl.jsx'));

function FallbackEditor({ value, onChange, disabled, minHeight = 240 }) {
  return (
    <textarea
      value={value || ''}
      disabled={disabled}
      spellCheck={false}
      onChange={e => onChange && onChange(e.target.value)}
      onKeyDown={e => {
        // Tab indents instead of escaping the editor.
        if (e.key === 'Tab' && !disabled) {
          e.preventDefault();
          const el = e.target, s = el.selectionStart, en = el.selectionEnd;
          const v = value || '';
          const next = `${v.slice(0, s)}    ${v.slice(en)}`;
          onChange && onChange(next);
          requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; });
        }
      }}
      style={{
        width: '100%', minHeight, padding: 14, borderRadius: 10, resize: 'vertical',
        background: 'oklch(0.16 0.02 270)', color: 'oklch(0.92 0.02 270)',
        border: '1px solid var(--border)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12.5, lineHeight: 1.6, tabSize: 4,
      }}
    />
  );
}

class EditorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { hit: false }; }
  static getDerivedStateFromError() { return { hit: true }; }
  componentDidCatch() { this.props.onError && this.props.onError(); }
  render() { return this.state.hit ? null : this.props.children; }
}

export default function CodeEditor(props) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return <FallbackEditor {...props} />;
  return (
    <EditorBoundary onError={() => setFailed(true)}>
      <React.Suspense fallback={<FallbackEditor {...props} />}>
        <LazyImpl {...props} />
      </React.Suspense>
    </EditorBoundary>
  );
}
