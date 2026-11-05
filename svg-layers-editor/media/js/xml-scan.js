import { escapeHtml } from './util.js';

function tagEnd(text, start) {
  let quote = null;
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i + 1;
    }
  }
  return text.length;
}

function skipSpecial(text, lt) {
  if (text.startsWith('<!--', lt)) return end(text.indexOf('-->', lt + 4), 3, text);
  if (text.startsWith('<![CDATA[', lt)) return end(text.indexOf(']]>', lt), 3, text);
  if (text[lt + 1] === '?') return end(text.indexOf('?>', lt), 2, text);
  if (text[lt + 1] === '!') {
    const bracket = text.indexOf('[', lt);
    const gt = text.indexOf('>', lt);
    return bracket > 0 && bracket < gt ? end(text.indexOf(']>', bracket), 2, text) : end(gt, 1, text);
  }
  return -1;
}

const end = (index, length, text) => (index < 0 ? text.length : index + length);

// Maps element paths ("0.3.1" = child indexes from the root <svg>) to [start, end) offsets in the source.
export function scanElements(text) {
  const map = {};
  const stack = [];
  let i = 0;
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt < 0) break;
    const skipped = skipSpecial(text, lt);
    if (skipped >= 0) {
      i = skipped;
      continue;
    }
    if (text[lt + 1] === '/') {
      const close = end(text.indexOf('>', lt), 1, text);
      const open = stack.pop();
      if (open) map[open.path.join('.')] = [open.start, close];
      i = close;
      continue;
    }
    const e = tagEnd(text, lt);
    const parent = stack[stack.length - 1];
    const path = parent ? parent.path.concat(parent.count++) : [];
    if (text[e - 2] === '/') map[path.join('.')] = [lt, e];
    else stack.push({ path, count: 0, start: lt });
    i = e;
  }
  return map;
}

const TOKEN = /(<!--[\s\S]*?-->)|(<\/?)([\w:.-]+)|([\w:.-]+)(\s*=\s*)("[^"]*"|'[^']*')|(\/?>)|([&<>])/g;

export function highlightXml(text) {
  return text.replace(TOKEN, (m, comment, open, tag, attr, eq, value, close, ch) => {
    if (comment) return `<span class="c-com">${escapeHtml(comment)}</span>`;
    if (open) return `<span class="c-p">${escapeHtml(open)}</span><span class="c-tag">${tag}</span>`;
    if (attr) return `<span class="c-attr">${attr}</span>${eq}<span class="c-val">${escapeHtml(value)}</span>`;
    if (close) return `<span class="c-p">${escapeHtml(close)}</span>`;
    return escapeHtml(ch);
  });
}
