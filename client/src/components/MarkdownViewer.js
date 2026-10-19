import React, { createElement as h } from 'react';

/**
 * Native React Markdown Viewer
 * ZERO innerHTML / dangerouslySetInnerHTML.
 * Full XSS immunity through React virtual DOM escaping.
 * Handles headings, paragraphs, lists, code blocks, blockquotes, tables,
 * bold/italic/inline-code, and teacher-only solution boxes.
 */

function parseInline(text, keyPrefix = 'in') {
  if (!text) return [];

  // Match bold, italic, code, or plain text
  const tokens = [];
  let remaining = text;
  let idx = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/);
    if (boldMatch) {
      tokens.push(h('strong', { key: `${keyPrefix}-b-${idx++}` }, boldMatch[2]));
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic: *text* or _text_
    const italicMatch = remaining.match(/^(\*|_)(.*?)\1/);
    if (italicMatch) {
      tokens.push(h('em', { key: `${keyPrefix}-i-${idx++}` }, italicMatch[2]));
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Inline code: `text`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      tokens.push(h('code', { key: `${keyPrefix}-c-${idx++}` }, codeMatch[1]));
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Plain text up to next special char
    const nextSpecial = remaining.search(/[\*_`]/);
    if (nextSpecial === -1) {
      tokens.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      // Stray special char
      tokens.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      tokens.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return tokens;
}

export function MarkdownViewer({ content = '' }) {
  if (!content || typeof content !== 'string') {
    return h('div', { className: 'empty-text' }, h('p', null, 'Nessun contenuto disponibile'));
  }

  const lines = content.split(/\r?\n/);
  const elements = [];

  let inCode = false;
  let codeLang = '';
  let codeLines = [];

  let inSolution = false;
  let solutionLines = [];

  let inUl = false;
  let ulItems = [];

  let inOl = false;
  let olItems = [];

  let inTable = false;
  let tableHeaders = [];
  let tableRows = [];

  function flushList() {
    if (inUl) {
      elements.push(h('ul', { key: `ul-${elements.length}` }, ulItems));
      inUl = false;
      ulItems = [];
    }
    if (inOl) {
      elements.push(h('ol', { key: `ol-${elements.length}` }, olItems));
      inOl = false;
      olItems = [];
    }
  }

  function flushTable() {
    if (inTable) {
      elements.push(
        h('table', { key: `table-${elements.length}`, className: 'prose-table' }, [
          h('thead', { key: 'thd' }, h('tr', null, tableHeaders.map((th, i) => h('th', { key: `th-${i}` }, parseInline(th.trim()))))),
          h('tbody', { key: 'tbd' }, tableRows.map((row, rIdx) => h('tr', { key: `tr-${rIdx}` }, row.map((cell, cIdx) => h('td', { key: `td-${cIdx}` }, parseInline(cell.trim()))))))
        ])
      );
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Solution box markers
    if (line.includes('[TEACHER_ONLY_SOLUTION]') || line.includes('<!-- TEACHER_ONLY_START -->')) {
      flushList();
      flushTable();
      inSolution = true;
      solutionLines = [];
      continue;
    }
    if (line.includes('[/TEACHER_ONLY_SOLUTION]') || line.includes('<!-- TEACHER_ONLY_END -->')) {
      inSolution = false;
      elements.push(
        h('div', { key: `sol-${i}`, className: 'solution-box' }, [
          h('div', { key: 'stitle', className: 'solution-box-title' }, '🔒 SOLUZIONE RISERVATA DOCENTE'),
          h('div', { key: 'sbody', className: 'solution-box-content' }, h(MarkdownViewer, { content: solutionLines.join('\n') }))
        ])
      );
      solutionLines = [];
      continue;
    }
    if (inSolution) {
      solutionLines.push(line);
      continue;
    }

    // Code blocks
    if (line.startsWith('```')) {
      flushList();
      flushTable();
      if (inCode) {
        elements.push(
          h('pre', { key: `pre-${i}` }, h('code', { className: codeLang ? `language-${codeLang}` : undefined }, codeLines.join('\n')))
        );
        inCode = false;
        codeLines = [];
        codeLang = '';
      } else {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Unordered lists
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (ulMatch) {
      flushTable();
      if (inOl) flushList();
      inUl = true;
      ulItems.push(h('li', { key: `li-${i}` }, parseInline(ulMatch[2])));
      continue;
    }

    // Ordered lists
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch) {
      flushTable();
      if (inUl) flushList();
      inOl = true;
      olItems.push(h('li', { key: `oli-${i}` }, parseInline(olMatch[2])));
      continue;
    }

    // Flush active lists if line is not a list item
    if (inUl || inOl) {
      flushList();
    }

    // Markdown Table
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.trim().slice(1, -1).split('|');
      if (!inTable) {
        // Table header
        tableHeaders = cells;
        inTable = true;
      } else if (line.includes('---')) {
        // Separator line, ignore
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(h('h3', { key: `h3-${i}` }, parseInline(line.slice(4))));
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(h('h2', { key: `h2-${i}` }, parseInline(line.slice(3))));
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(h('h1', { key: `h1-${i}` }, parseInline(line.slice(2))));
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(h('blockquote', { key: `bq-${i}` }, parseInline(line.slice(2))));
      continue;
    }

    // Horizontal Rule
    if (line.match(/^(\*\*\*|---|___)$/)) {
      elements.push(h('hr', { key: `hr-${i}` }));
      continue;
    }

    // Paragraph
    if (line.trim().length > 0) {
      elements.push(h('p', { key: `p-${i}` }, parseInline(line)));
    }
  }

  flushList();
  flushTable();

  return h('div', { className: 'prose' }, elements);
}
