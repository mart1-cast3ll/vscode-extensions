import { parseBlocks, LIST_ITEM, HEADING, isBlank } from './blocks.js';
import { renderInline, plainText, escapeAttr } from './inline.js';
import { escapeHtml } from '../util.js';

const ALERTS = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning', CAUTION: 'Caution' };

export function slugify(text) {
  return plainText(text).toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');
}

export function headingOf(block, lines) {
  if (block.setext) return { level: block.setext, text: lines.slice(block.start, block.end - 1).join(' ').trim() };
  const m = HEADING.exec(lines[block.start]);
  return { level: m[1].length, text: (m[2] || '').trim() };
}

export function renderMarkdown(text, offset = 0) {
  const lines = text.split('\n');
  return parseBlocks(lines).map((b) => renderBlock(b, lines, offset)).join('\n');
}

export function renderBlock(block, lines, offset = 0) {
  const src = lines.slice(block.start, block.end);
  const at = offset + block.start;
  switch (block.type) {
    case 'heading': {
      const { level, text } = headingOf(block, lines);
      return `<h${level} id="${escapeAttr(slugify(text))}">${renderInline(text)}</h${level}>`;
    }
    case 'paragraph':
      return `<p>${renderInline(src.map((l) => l.replace(/^\s+/, '')).join('\n'))}</p>`;
    case 'code':
      return renderCode(src, block.lang);
    case 'hr':
      return '<hr>';
    case 'quote':
      return renderQuote(src, at);
    case 'list':
      return renderList(src, at);
    case 'table':
      return renderTable(src);
    case 'html':
      return src.join('\n');
    case 'frontmatter':
      return `<pre class="frontmatter">${escapeHtml(src.join('\n'))}</pre>`;
    default:
      return '';
  }
}

function renderCode(src, lang) {
  const body = src.slice(1);
  if (body.length && /^ {0,3}(`{3,}|~{3,})\s*$/.test(body[body.length - 1])) body.pop();
  const label = lang ? `<span>${escapeHtml(lang)}</span>` : '<span></span>';
  return (
    `<div class="codeblock"><div class="code-head">${label}<button class="copy" type="button">Copy</button></div>` +
    `<pre><code class="language-${escapeAttr(lang || 'text')}">${escapeHtml(body.join('\n'))}</code></pre></div>`
  );
}

function renderQuote(src, at) {
  const inner = src.map((l) => l.replace(/^ {0,3}> ?/, ''));
  const alert = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(inner[0] || '');
  if (!alert) return `<blockquote>${renderMarkdown(inner.join('\n'), at)}</blockquote>`;
  const kind = alert[1].toUpperCase();
  const body = renderMarkdown(inner.slice(1).join('\n'), at + 1);
  return `<blockquote class="alert alert-${kind.toLowerCase()}"><p class="alert-title">${ALERTS[kind]}</p>${body}</blockquote>`;
}

function splitItems(src) {
  const items = [];
  let current = null;
  let pendingBlank = false;
  let loose = false;
  src.forEach((line, index) => {
    const m = LIST_ITEM.exec(line);
    if (m && (!current || m[1].length < current.indent)) {
      if (pendingBlank && current) loose = true;
      current = { line: index, indent: m[0].length || m[1].length + m[2].length + 1, lines: [line.slice(m[0].length)] };
      items.push(current);
      pendingBlank = false;
    } else if (current) {
      pendingBlank = isBlank(line);
      current.lines.push(pendingBlank ? '' : line.replace(new RegExp(`^ {0,${current.indent}}`), ''));
    }
  });
  return { items, loose };
}

function renderList(src, at) {
  const first = LIST_ITEM.exec(src[0]);
  const ordered = /\d/.test(first[2]);
  const startNumber = ordered ? parseInt(first[2], 10) : 1;
  const { items, loose } = splitItems(src);
  const body = items.map((item) => {
    while (item.lines.length > 1 && isBlank(item.lines[item.lines.length - 1])) item.lines.pop();
    let text = item.lines.join('\n');
    const task = /^\[([ xX])\][ \t]+/.exec(text);
    let box = '';
    if (task) {
      box = `<input type="checkbox" class="task" data-line="${at + item.line}"${task[1] === ' ' ? '' : ' checked'}> `;
      text = text.slice(task[0].length);
    }
    let inner = renderMarkdown(text, at + item.line);
    if (!loose) inner = inner.replace(/^<p>([\s\S]*?)<\/p>/, '$1');
    return `<li${task ? ' class="task-item"' : ''}>${box}${inner}</li>`;
  });
  const open = ordered ? `<ol${startNumber !== 1 ? ` start="${startNumber}"` : ''}>` : '<ul>';
  return `${open}${body.join('')}${ordered ? '</ol>' : '</ul>'}`;
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function renderTable(src) {
  const header = splitRow(src[0]);
  const aligns = splitRow(src[1]).map((c) => {
    if (c.startsWith(':') && c.endsWith(':')) return 'center';
    if (c.endsWith(':')) return 'right';
    return c.startsWith(':') ? 'left' : '';
  });
  const cell = (tag, text, i) => `<${tag}${aligns[i] ? ` align="${aligns[i]}"` : ''}>${renderInline(text || '')}</${tag}>`;
  const head = `<thead><tr>${header.map((t, i) => cell('th', t, i)).join('')}</tr></thead>`;
  const rows = src.slice(2).map((line) => {
    const cells = splitRow(line);
    return `<tr>${header.map((_, i) => cell('td', cells[i], i)).join('')}</tr>`;
  });
  return `<div class="table-wrap"><table>${head}<tbody>${rows.join('')}</tbody></table></div>`;
}
