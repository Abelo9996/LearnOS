import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { go } from '@codemirror/lang-go';

// The real CodeMirror 6 editor. Kept in its own module so the lazy wrapper in
// CodeEditor.jsx can code-split all of this out of the main bundle, and only
// screens that show code (labs, coding steps) ever download it.
const LANG = {
  javascript: javascript, js: javascript,
  python: python, py: python,
  cpp: cpp, c: cpp,
  java: java,
  go: go,
};

export default function CodeEditorImpl({ value, onChange, language, disabled, minHeight = 240 }) {
  const make = LANG[(language || '').toLowerCase()];
  const extensions = [keymap.of([indentWithTab])];
  if (make) extensions.push(make());
  return (
    <CodeMirror
      value={value || ''}
      minHeight={`${minHeight}px`}
      theme={oneDark}
      editable={!disabled}
      readOnly={!!disabled}
      extensions={extensions}
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: !disabled, tabSize: 4 }}
      onChange={(v) => onChange && onChange(v)}
      style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', fontSize: 12.5 }}
    />
  );
}
