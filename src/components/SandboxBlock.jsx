import React from 'react';

// Lazy wrapper for the Sandpack sandbox, so the heavy editor+bundler only loads
// on lessons that embed one. Shows a light placeholder while the chunk resolves.
const Impl = React.lazy(() => import('./SandboxBlockImpl.jsx'));

export default function SandboxBlock({ spec }) {
  return (
    <React.Suspense fallback={
      <div style={{ margin: '16px 0', padding: 16, border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', background: 'var(--surface)' }}>
        Loading interactive sandbox…
      </div>
    }>
      <Impl spec={spec} />
    </React.Suspense>
  );
}
