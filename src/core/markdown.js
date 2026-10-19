/**
 * Lightweight and safe Markdown to HTML converter.
 * Converts headings, paragraphs, lists, code blocks, blockquotes, bold/italic,
 * tables, and horizontal rules with full HTML-escaping of raw text.
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function markdownToHtml(mdText = '') {
  if (!mdText || typeof mdText !== 'string') return '';

  const lines = mdText.split(/\r?\n/);
  const out = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeLines = [];
  let inList = false;
  let listType = 'ul'; // 'ul' or 'ol'
  let inTable = false;
  let tableHeaders = [];
  let tableRows = [];

  function closeList() {
    if (inList) {
      out.push(`</${listType}>`);
      inList = false;
    }
  }

  function closeTable() {
    if (inTable) {
      let tableHtml = '<table class="prose-table"><thead><tr>';
      for (const th of tableHeaders) {
        tableHtml += `<th>${inlineFormat(th.trim())}</th>`;
      }
      tableHtml += '</tr></thead><tbody>';
      for (const row of tableRows) {
        tableHtml += '<tr>';
        for (const td of row) {
          tableHtml += `<td>${inlineFormat(td.trim())}</td>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody></table>';
      out.push(tableHtml);
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    }
  }

  function inlineFormat(text) {
    let s = escapeHtml(text);
    // Inline code `code`
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold **text** or __text__
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // Italic *text* or _text_
    s = s.replace(/(^|[^\*])\*([^*]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');
    s = s.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1<em>$2</em>$3');
    return s;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Code blocks ```
    if (line.trim().startsWith('```')) {
      closeList();
      closeTable();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        const escapedCode = escapeHtml(codeLines.join('\n'));
        const langAttr = codeBlockLang ? ` class="language-${escapeHtml(codeBlockLang)}"` : '';
        out.push(`<pre><code${langAttr}>${escapedCode}</code></pre>`);
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // 2. Empty lines
    if (!line.trim()) {
      closeList();
      closeTable();
      continue;
    }

    // 3. Headings #, ##, ###, ####
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      closeTable();
      const level = headingMatch[1].length;
      const title = inlineFormat(headingMatch[2]);
      out.push(`<h${level}>${title}</h${level}>`);
      continue;
    }

    // 4. Horizontal rule --- or ***
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      closeList();
      closeTable();
      out.push('<hr />');
      continue;
    }

    // 5. Blockquotes >
    if (line.startsWith('>')) {
      closeList();
      closeTable();
      const quoteText = inlineFormat(line.replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${quoteText}</p></blockquote>`);
      continue;
    }

    // 6. Tables | col | col |
    if (line.includes('|') && line.trim().startsWith('|') && line.trim().endsWith('|')) {
      closeList();
      const rawCols = line.trim().slice(1, -1).split('|');
      // Check if it's separator line |---|---|
      const isSep = rawCols.every(c => /^[\s\-:]+$/.test(c));
      if (isSep) {
        // separator, skip
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableHeaders = rawCols;
        tableRows = [];
      } else {
        tableRows.push(rawCols);
      }
      continue;
    } else {
      closeTable();
    }

    // 7. Unordered lists - or *
    const ulMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (ulMatch) {
      closeTable();
      if (!inList || listType !== 'ul') {
        closeList();
        inList = true;
        listType = 'ul';
        out.push('<ul>');
      }
      out.push(`<li>${inlineFormat(ulMatch[2])}</li>`);
      continue;
    }

    // 8. Ordered lists 1.
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      closeTable();
      if (!inList || listType !== 'ol') {
        closeList();
        inList = true;
        listType = 'ol';
        out.push('<ol>');
      }
      out.push(`<li>${inlineFormat(olMatch[2])}</li>`);
      continue;
    }

    // 9. Standard paragraph
    closeList();
    closeTable();
    out.push(`<p>${inlineFormat(line.trim())}</p>`);
  }

  closeList();
  closeTable();

  return out.join('\n');
}
