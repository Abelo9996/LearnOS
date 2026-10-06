import React from 'react';
import { Sandpack } from '@codesandbox/sandpack-react';

// A live, editable in-browser sandbox (CodeSandbox's Sandpack). Kept in its own
// module so the lazy wrapper in SandboxBlock.jsx code-splits it out of the main
// bundle; it only downloads when a lesson actually embeds a `sandbox` fence.
//
// The fence body is either a JSON spec ({template, files} or {template, code})
// or, if it is not JSON, a single file of code dropped into a vanilla template.
export default function SandboxBlockImpl({ spec }) {
  let cfg = null;
  try { cfg = JSON.parse(spec); } catch { /* raw code, not a spec */ }

  let template = 'vanilla';
  let files;
  let code = null;
  if (cfg && typeof cfg === 'object' && (cfg.files || cfg.code || cfg.template)) {
    template = cfg.template || 'vanilla';
    if (cfg.files && typeof cfg.files === 'object') files = cfg.files;
    else if (typeof cfg.code === 'string') code = cfg.code;
  } else {
    code = spec;
  }
  if (!files && code != null) {
    files = template === 'static' ? { '/index.html': code } : { '/index.js': code };
  }

  return (
    <div style={{ margin: '16px 0', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <Sandpack
        template={template}
        files={files}
        theme="dark"
        options={{ showLineNumbers: true, showTabs: true, editorHeight: 340 }}
      />
    </div>
  );
}
