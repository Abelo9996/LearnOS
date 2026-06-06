import React from 'react';

/**
 * formatInline — processes inline markdown: bold, italic, code, links, citations.
 *
 * Supported syntax:
 *   **bold**          → <strong>
 *   *italic*          → <em>
 *   `code`            → <code>
 *   [text](url)       → <a>  (http/https only)
 *   [N]  (citation)  → <a>  if citationMap provided, else plain text
 */
export function formatInline(text, citationMap) {
  if (!text) return null;
  const parts = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    // Link [text](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
    // Citation [N] — only when citationMap is provided
    const citeMatch = citationMap ? remaining.match(/\[(\d+)\]/) : null;
    // Bold **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Code `text`
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Italic *text*
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);

    // Find the earliest match
    let firstMatch = null;
    let type = null;
    for (const [m, t] of [[linkMatch, 'link'], [citeMatch, 'cite'], [boldMatch, 'bold'], [codeMatch, 'code'], [italicMatch, 'italic']]) {
      if (m && (!firstMatch || m.index < firstMatch.index)) {
        firstMatch = m;
        type = t;
      }
    }

    if (!firstMatch) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    // Text before match
    if (firstMatch.index > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, firstMatch.index)}</span>);
    }

    // The match itself
    if (type === 'link') {
      parts.push(<a key={key++} href={firstMatch[2]} target="_blank" rel="noopener noreferrer" style={{ color: 'oklch(0.78 0.16 195)', textDecoration: 'underline' }}>{firstMatch[1]}</a>);
    } else if (type === 'cite') {
      const num = parseInt(firstMatch[1], 10);
      const url = citationMap?.[num];
      if (url) {
        parts.push(
          <a key={key++} href={url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 10, verticalAlign: 'super', color: 'oklch(0.78 0.16 195)', textDecoration: 'none', margin: '0 1px', padding: '0 3px', borderRadius: 3, background: 'oklch(0.78 0.16 195 / 0.12)', border: '1px solid oklch(0.78 0.16 195 / 0.3)', lineHeight: 1 }}
            title={`Source [${num}]`}>
            {firstMatch[1]}
          </a>
        );
      } else {
        parts.push(<span key={key++} style={{ fontSize: 10, verticalAlign: 'super', color: 'var(--muted)' }}>{firstMatch[0]}</span>);
      }
    } else if (type === 'bold') {
      parts.push(<strong key={key++} style={{ fontWeight: 700 }}>{firstMatch[1]}</strong>);
    } else if (type === 'code') {
      parts.push(<code key={key++} style={{ background: 'oklch(0.22 0.03 270)', padding: '1px 5px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{firstMatch[1]}</code>);
    } else if (type === 'italic') {
      parts.push(<em key={key++} style={{ fontStyle: 'italic' }}>{firstMatch[1]}</em>);
    }

    remaining = remaining.slice(firstMatch.index + firstMatch[0].length);
  }
  return <>{parts}</>;
}

/**
 * MarkdownText — renders a subset of Markdown into React elements.
 *
 * Supports:
 *   # ## ### #### headings
 *   ``` fenced code blocks ```
 *   > blockquotes
 *   - * • unordered lists
 *   1. ordered lists
 *   **bold**, *italic*, `code`, [links](url)
 *   [N] citations (when citationMap is passed)
 *
 * @param {string} text
 * @param {Object} [citationMap] — { 1: url, 2: url, ... } for [N] → link rendering
 */
export default function MarkdownText({ text, citationMap }) {
  if (!text) return null;
  // Some stored/generated content escapes newlines as a literal "\n" sequence.
  // Normalize those to real line breaks — but skip when a code fence is present
  // so genuine "\n" inside code samples is preserved verbatim.
  const normalized = text.includes('```') ? text : text.replace(/\\n/g, '\n');
  const lines = normalized.split('\n');
  const elements = [];
  let listItems = [];
  let listOrdered = false;

  const flushList = () => {
    if (listItems.length > 0) {
      const Tag = listOrdered ? 'ol' : 'ul';
      elements.push(
        <Tag key={`list-${elements.length}`} style={{ margin: '6px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {listItems.map((item, i) => <li key={i} style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink)' }}>{item}</li>)}
        </Tag>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code block ``` ... ```
    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      flushList();
      const code = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { code.push(lines[i]); i++; }
      elements.push(
        <pre key={`code-${i}`} style={{ margin: '8px 0', padding: 12, background: 'oklch(0.12 0.02 270)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6, color: 'var(--ink-2)', overflowX: 'auto', whiteSpace: 'pre' }}>{code.join('\n')}</pre>
      );
      continue;
    }

    // Headings # ## ###
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const sizes = { 1: 18, 2: 16, 3: 14.5, 4: 13.5 };
      elements.push(
        <div key={`h-${i}`} style={{ fontSize: sizes[level], fontWeight: 700, color: 'var(--ink)', margin: '10px 0 4px', lineHeight: 1.3 }}>{formatInline(heading[2], citationMap)}</div>
      );
      continue;
    }

    // Blockquote >
    if (/^\s*>\s?/.test(line)) {
      flushList();
      elements.push(
        <div key={`q-${i}`} style={{ borderLeft: '3px solid var(--accent-line)', paddingLeft: 10, margin: '6px 0', color: 'var(--muted)', fontSize: 14, lineHeight: 1.55 }}>{formatInline(line.replace(/^\s*>\s?/, ''), citationMap)}</div>
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*•]\s/.test(line)) {
      if (listOrdered && listItems.length) flushList();
      listOrdered = false;
      listItems.push(formatInline(line.replace(/^\s*[-*•]\s/, ''), citationMap));
      continue;
    }
    // Ordered list
    if (/^\s*\d+\.\s/.test(line)) {
      if (!listOrdered && listItems.length) flushList();
      listOrdered = true;
      listItems.push(formatInline(line.replace(/^\s*\d+\.\s/, ''), citationMap));
      continue;
    }

    flushList();
    // Empty line → vertical gap
    if (!line.trim()) {
      elements.push(<div key={`br-${i}`} style={{ height: 6 }} />);
      continue;
    }
    // Regular paragraph
    elements.push(<p key={`p-${i}`} style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink)', margin: 0 }}>{formatInline(line, citationMap)}</p>);
  }
  flushList();

  return <div>{elements}</div>;
}
