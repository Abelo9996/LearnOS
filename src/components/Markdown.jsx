import React from 'react';
import 'katex/dist/katex.min.css';

/**
 * Markdown rendering for generated course content.
 *
 * The generator writes real teaching material: the 424 lessons in this database
 * carry 554 code fences, 520 table rows, 1200+ list items — and 773 pieces of
 * LaTeX. Maths was the glaring hole. Every `$V^\pi(s)$` and every
 * `\begin{cases}` block was printed to the learner as raw source, which on a
 * reinforcement-learning course is most of the actual content.
 *
 * KaTeX is loaded on demand rather than bundled into the main chunk, because a
 * philosophy lesson should not pay for a renderer it never uses. Until it
 * resolves — milliseconds, from local disk — a formula shows as monospace
 * source, which is what it looked like before and is honest about what it is.
 */
let katexMod = null;
let katexPromise = null;
function loadKatex() {
  if (katexMod) return Promise.resolve(katexMod);
  katexPromise ||= import('katex').then(m => (katexMod = m.default || m));
  return katexPromise;
}

function TeX({ tex, display }) {
  const [html, setHtml] = React.useState(() => {
    if (!katexMod) return null;
    try { return katexMod.renderToString(tex, { displayMode: display, throwOnError: false }); } catch { return null; }
  });
  React.useEffect(() => {
    if (html) return;
    let alive = true;
    loadKatex().then(k => {
      if (!alive) return;
      try { setHtml(k.renderToString(tex, { displayMode: display, throwOnError: false })); } catch { /* leave the source visible */ }
    }).catch(() => {});
    return () => { alive = false; };
  }, [tex, display, html]);

  if (!html) return <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.92em', opacity: 0.75 }}>{tex}</code>;
  return display
    ? <div style={{ margin: '18px 0', overflowX: 'auto', overflowY: 'hidden', textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: html }} />
    : <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * `$…$` is ambiguous with prices, so treat it as maths only when it looks like
 * maths — a backslash command, a sub/superscript, braces, or a lone symbol —
 * and leave "it costs $30 to $40" as text.
 */
const MATH_INLINE = /\$(?!\s)((?:[^$\n\\]|\\.)+?)(?<!\s)\$/;
const looksMathy = (s) => /[\\^_{}]/.test(s) || /^[A-Za-z]'?$/.test(s.trim());

/**
 * formatInline — bold, italic, strikethrough, code, links, images, citations
 * and inline maths. Maths is matched first so `**` or `_` inside a formula is
 * never mistaken for emphasis.
 */
export function formatInline(text, citationMap) {
  if (!text) return null;
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const mathMatch   = (() => { const m = remaining.match(MATH_INLINE); return m && looksMathy(m[1]) ? m : null; })();
    const linkMatch   = remaining.match(/(!?)\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/);
    const citeMatch   = citationMap ? remaining.match(/\[(\d+)\]/) : null;
    const boldMatch   = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch   = remaining.match(/`([^`]+)`/);
    const strikeMatch = remaining.match(/~~([^~]+)~~/);
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);

    let firstMatch = null, type = null;
    for (const [m, t] of [[mathMatch, 'math'], [linkMatch, 'link'], [citeMatch, 'cite'],
                          [boldMatch, 'bold'], [codeMatch, 'code'], [strikeMatch, 'strike'], [italicMatch, 'italic']]) {
      if (m && (!firstMatch || m.index < firstMatch.index)) { firstMatch = m; type = t; }
    }

    if (!firstMatch) { parts.push(<span key={key++}>{remaining}</span>); break; }
    if (firstMatch.index > 0) parts.push(<span key={key++}>{remaining.slice(0, firstMatch.index)}</span>);

    if (type === 'math') {
      parts.push(<TeX key={key++} tex={firstMatch[1]} display={false} />);
    } else if (type === 'link') {
      if (firstMatch[1] === '!') {
        parts.push(
          <img key={key++} src={firstMatch[3]} alt={firstMatch[2]} loading="lazy"
            style={{ maxWidth: '100%', height: 'auto', borderRadius: 10, border: '1px solid var(--border)', display: 'block', margin: '14px 0' }} />
        );
      } else {
        parts.push(
          <a key={key++} href={firstMatch[3]} target="_blank" rel="noopener noreferrer"
            style={{ color: 'oklch(0.78 0.16 195)', textDecoration: 'none', borderBottom: '1px solid oklch(0.78 0.16 195 / 0.4)' }}>{firstMatch[2]}</a>
        );
      }
    } else if (type === 'cite') {
      const num = parseInt(firstMatch[1], 10);
      const url = citationMap?.[num];
      if (url) {
        parts.push(
          <a key={key++} href={url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 10, verticalAlign: 'super', color: 'oklch(0.78 0.16 195)', textDecoration: 'none', margin: '0 1px', padding: '0 3px', borderRadius: 3, background: 'oklch(0.78 0.16 195 / 0.12)', border: '1px solid oklch(0.78 0.16 195 / 0.3)', lineHeight: 1 }}
            title={`Source [${num}]`}>{firstMatch[1]}</a>
        );
      } else {
        parts.push(<span key={key++} style={{ fontSize: 10, verticalAlign: 'super', color: 'var(--muted)' }}>{firstMatch[0]}</span>);
      }
    } else if (type === 'bold') {
      // Recurse: emphasis nests. "**it is a *choice* about…**" was rendering the
      // inner asterisks literally because the bold match swallowed the span.
      parts.push(<strong key={key++} style={{ fontWeight: 650, color: 'var(--ink)' }}>{formatInline(firstMatch[1], citationMap)}</strong>);
    } else if (type === 'code') {
      // Code is literal by definition — never recurse into it.
      parts.push(
        <code key={key++} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88em', padding: '1.5px 5px', borderRadius: 5, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}>{firstMatch[1]}</code>
      );
    } else if (type === 'strike') {
      parts.push(<span key={key++} style={{ textDecoration: 'line-through', opacity: 0.65 }}>{formatInline(firstMatch[1], citationMap)}</span>);
    } else {
      parts.push(<em key={key++} style={{ fontStyle: 'italic' }}>{formatInline(firstMatch[1], citationMap)}</em>);
    }

    remaining = remaining.slice(firstMatch.index + firstMatch[0].length);
  }
  return <>{parts}</>;
}

/**
 * Mermaid diagrams from a ```mermaid fence.
 *
 * LLMs emit Mermaid more reliably than any other diagram syntax, so letting the
 * generator draw flowcharts, sequences and trees turns walls of prose into
 * something you can see. Loaded on demand (a philosophy lesson shouldn't pay
 * for a diagram engine), rendered with securityLevel 'strict' since the source
 * is model-generated, and it falls back to the raw fence if the diagram doesn't
 * parse — a broken diagram should never blank the lesson.
 */
let mermaidMod = null, mermaidPromise = null;
function loadMermaid() {
  if (mermaidMod) return Promise.resolve(mermaidMod);
  mermaidPromise ||= import('mermaid').then((m) => {
    const mm = m.default || m;
    mm.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark', fontFamily: 'inherit' });
    mermaidMod = mm;
    return mm;
  });
  return mermaidPromise;
}
let mermaidSeq = 0;
function Mermaid({ code }) {
  const [svg, setSvg] = React.useState(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let alive = true; setFailed(false); setSvg(null);
    loadMermaid()
      .then(async (mm) => {
        try {
          // parse() throws on invalid syntax without touching the DOM — check
          // first so a bad diagram falls back cleanly instead of leaving mermaid
          // error markup on the page.
          await mm.parse(code);
          const { svg } = await mm.render(`mmd-${mermaidSeq++}`, code);
          if (alive) setSvg(svg);
        } catch { if (alive) setFailed(true); }
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [code]);

  if (failed) return <CodeBlock code={code} lang="mermaid" />;
  if (!svg) return <div style={{ padding: 18, textAlign: 'center', color: 'var(--muted)', fontSize: 12.5 }}>Rendering diagram…</div>;
  return (
    <div className="mermaid-diagram"
      style={{ margin: '16px 0', padding: 14, textAlign: 'center', overflowX: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}
      dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

/* ── Code block: says what language it is, and lets you take it away ───────── */
function CodeBlock({ code, lang }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); })
      .catch(() => {});
  };
  return (
    <div style={{ margin: '16px 0', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', background: 'oklch(0.14 0.02 270)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{lang || 'code'}</span>
        <button onClick={copy} style={{ background: 'none', border: 0, cursor: 'pointer', fontSize: 11, color: copied ? 'var(--good)' : 'var(--muted)', padding: '2px 4px', transition: 'color var(--dur-fast)' }}>
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '13px 15px', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.65, color: 'var(--ink-2)', overflowX: 'auto', whiteSpace: 'pre' }}>{code}</pre>
    </div>
  );
}

// A heading scale you can actually see. The generator leans on `###` (424 of
// them) and these were rendering at 14.5px against 14px body text, so section
// breaks were invisible and every lesson read as one undifferentiated block.
const H = {
  1: { fontSize: 25,   weight: 700, mt: 30, mb: 12, rule: true },
  2: { fontSize: 19.5, weight: 700, mt: 28, mb: 10, rule: true },
  3: { fontSize: 16,   weight: 650, mt: 22, mb: 7,  rule: false },
  4: { fontSize: 14,   weight: 650, mt: 18, mb: 5,  rule: false },
};

/**
 * MarkdownText — renders generated content.
 *
 * `prose` turns on long-form reading: a measure of about 68 characters and a
 * larger body size. Lesson bodies ran the full width of the window at roughly
 * 150 characters a line — twice what is comfortable — which is the main reason
 * a well-written lesson still felt like a wall of text.
 */
export default function MarkdownText({ text, citationMap, prose = false, stripTitle }) {
  if (!text) return null;

  const normalized = text.includes('```') ? text : text.replace(/\\n/g, '\n');
  let lines = normalized.split('\n');

  // The generator usually opens a lesson body with an H1 repeating the lesson's
  // own title, so the reader showed the same heading twice in a row. Drop it
  // when it is genuinely the same heading, not merely a similar one.
  if (stripTitle) {
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const first = lines.findIndex(l => l.trim());
    const h1 = first >= 0 ? lines[first].match(/^#\s+(.*)$/) : null;
    if (h1 && norm(h1[1]) === norm(stripTitle)) lines = lines.slice(first + 1);
  }
  const elements = [];
  let para = [];
  let listItems = [];
  let listOrdered = false;

  const body = prose ? { fontSize: 15.5, lineHeight: 1.78 } : { fontSize: 14, lineHeight: 1.62 };

  const flushPara = () => {
    if (!para.length) return;
    // Consecutive lines are one paragraph — hard-wrapped source should not turn
    // into one <p> per line.
    elements.push(
      <p key={`p-${elements.length}`} style={{ ...body, color: 'var(--ink)', margin: '0 0 14px' }}>
        {formatInline(para.join(' '), citationMap)}
      </p>
    );
    para = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    const Tag = listOrdered ? 'ol' : 'ul';
    elements.push(
      <Tag key={`l-${elements.length}`} style={{ margin: '0 0 14px', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {listItems.map((it, i) => (
          <li key={i} style={{ ...body, color: 'var(--ink)', marginLeft: it.depth * 18, listStyleType: it.task !== undefined ? 'none' : undefined }}>
            {it.task !== undefined && <span style={{ marginRight: 8, color: it.task ? 'var(--good)' : 'var(--muted)' }}>{it.task ? '☑' : '☐'}</span>}
            {it.content}
          </li>
        ))}
      </Tag>
    );
    listItems = [];
  };

  const flushAll = () => { flushPara(); flushList(); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code
    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      flushAll();
      const code = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { code.push(lines[i]); i++; }
      const body = code.join('\n');
      elements.push(fence[1] === 'mermaid'
        ? <Mermaid key={`m-${i}`} code={body} />
        : <CodeBlock key={`c-${i}`} code={body} lang={fence[1]} />);
      continue;
    }

    // Display maths — `$$ … $$`, on one line or spanning several.
    const dollars = line.match(/^\s*\$\$(.*)$/);
    if (dollars) {
      flushAll();
      let tex = dollars[1];
      if (/\$\$\s*$/.test(tex)) {
        tex = tex.replace(/\$\$\s*$/, '');
      } else {
        const buf = [tex];
        i++;
        while (i < lines.length && !/\$\$/.test(lines[i])) { buf.push(lines[i]); i++; }
        if (i < lines.length) buf.push(lines[i].replace(/\$\$.*$/, ''));
        tex = buf.join('\n');
      }
      elements.push(<TeX key={`m-${i}`} tex={tex.trim()} display />);
      continue;
    }

    // Headings
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushAll();
      const h = H[heading[1].length] || H[4];
      const Tag = `h${Math.min(heading[1].length + 1, 6)}`;
      elements.push(
        <Tag key={`h-${i}`} style={{
          fontSize: h.fontSize, fontWeight: h.weight, color: 'var(--ink)',
          margin: `${elements.length ? h.mt : 0}px 0 ${h.mb}px`, lineHeight: 1.3, letterSpacing: '-0.01em',
          paddingBottom: h.rule ? 7 : 0,
          borderBottom: h.rule ? '1px solid var(--border)' : 'none',
        }}>{formatInline(heading[2], citationMap)}</Tag>
      );
      continue;
    }

    // Horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushAll();
      elements.push(<hr key={`hr-${i}`} style={{ border: 0, borderTop: '1px solid var(--border)', margin: '22px 0' }} />);
      continue;
    }

    // Table
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      flushAll();
      const parseRow = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const header = parseRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]) && !/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) { rows.push(parseRow(lines[i])); i++; }
      i--;
      const cellPad = '9px 13px';
      elements.push(
        <div key={`t-${i}`} style={{ overflowX: 'auto', margin: '16px 0', border: '1px solid var(--border)', borderRadius: 10 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13.5 }}>
            <thead>
              <tr>{header.map((h, k) => (
                <th key={k} style={{ textAlign: 'left', padding: cellPad, background: 'var(--surface-2)', color: 'var(--ink)', fontWeight: 650, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{formatInline(h, citationMap)}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, k) => (
                  <td key={k} style={{ padding: cellPad, color: 'var(--ink-2)', borderBottom: ri < rows.length - 1 ? '1px solid var(--border)' : 0, lineHeight: 1.6, verticalAlign: 'top' }}>{formatInline(c, citationMap)}</td>
                ))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Blockquote — consecutive `>` lines are one quote.
    if (/^\s*>\s?/.test(line)) {
      flushAll();
      const quote = [line.replace(/^\s*>\s?/, '')];
      while (i + 1 < lines.length && /^\s*>\s?/.test(lines[i + 1])) { i++; quote.push(lines[i].replace(/^\s*>\s?/, '')); }
      elements.push(
        <blockquote key={`q-${i}`} style={{ borderLeft: '3px solid var(--accent-line)', background: 'var(--surface)', borderRadius: '0 8px 8px 0', padding: '11px 15px', margin: '16px 0', color: 'var(--ink-2)', ...body }}>
          {formatInline(quote.join(' '), citationMap)}
        </blockquote>
      );
      continue;
    }

    // Lists — indentation becomes nesting, `[ ]` / `[x]` become checkboxes.
    const ul = line.match(/^(\s*)[-*•]\s+(.*)$/);
    const ol = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const m = ul || ol;
      const ordered = !!ol;
      if (listItems.length && ordered !== listOrdered) flushList();
      listOrdered = ordered;
      const depth = Math.min(Math.floor(m[1].length / 2), 3);
      let content = m[2];
      let task;
      const t = content.match(/^\[([ xX])\]\s+(.*)$/);
      if (t) { task = t[1].toLowerCase() === 'x'; content = t[2]; }
      listItems.push({ content: formatInline(content, citationMap), depth, task });
      continue;
    }

    // A blank line closes the current block.
    if (!line.trim()) { flushAll(); continue; }

    flushList();
    para.push(line);
  }
  flushAll();

  return <div style={prose ? { maxWidth: '68ch' } : undefined}>{elements}</div>;
}
