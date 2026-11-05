// Formatting commands for a <textarea>. Edits go through execCommand('insertText') so the
// textarea's own undo history keeps working.

function replaceRange(ta, start, end, text, selStart = start + text.length, selEnd = selStart) {
  ta.focus();
  ta.setSelectionRange(start, end);
  if (!document.execCommand('insertText', false, text)) {
    ta.setRangeText(text, start, end, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  ta.setSelectionRange(selStart, selEnd);
}

function selectedLines(ta) {
  const v = ta.value;
  const start = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
  const last = ta.selectionEnd > ta.selectionStart && v[ta.selectionEnd - 1] === '\n' ? ta.selectionEnd - 1 : ta.selectionEnd;
  let end = v.indexOf('\n', last);
  if (end < 0) end = v.length;
  return { start, end, lines: v.slice(start, end).split('\n') };
}

function mapLines(ta, fn) {
  const collapsed = ta.selectionStart === ta.selectionEnd;
  const { start, end, lines } = selectedLines(ta);
  const out = lines.map(fn).join('\n');
  if (collapsed) replaceRange(ta, start, end, out);
  else replaceRange(ta, start, end, out, start, start + out.length);
}

function wrap(ta, left, right = left, placeholder = 'text') {
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  const selected = v.slice(s, e);
  if (selected.length >= left.length + right.length && selected.startsWith(left) && selected.endsWith(right)) {
    replaceRange(ta, s, e, selected.slice(left.length, selected.length - right.length), s, e - left.length - right.length);
  } else if (v.slice(s - left.length, s) === left && v.slice(e, e + right.length) === right) {
    replaceRange(ta, s - left.length, e + right.length, selected, s - left.length, e - left.length);
  } else {
    const inner = selected || placeholder;
    replaceRange(ta, s, e, left + inner + right, s + left.length, s + left.length + inner.length);
  }
}

const PREFIX = /^(\s*)(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|>\s?|#{1,6}\s+)?/;
const KINDS = {
  bullet: { test: /^\s*[-*+]\s+(?!\[[ xX]\])/, make: () => '- ' },
  numbered: { test: /^\s*\d+[.)]\s+/, make: (n) => `${n}. ` },
  task: { test: /^\s*[-*+]\s+\[[ xX]\]\s+/, make: () => '- [ ] ' },
  quote: { test: /^\s*>/, make: () => '> ' },
};

function setLinePrefix(ta, kind) {
  const { test, make } = KINDS[kind];
  const filled = selectedLines(ta).lines.filter((l) => l.trim());
  const remove = filled.length > 0 && filled.every((l) => test.test(l));
  let n = 0;
  mapLines(ta, (line) => {
    if (!line.trim() && filled.length) return line;
    const m = PREFIX.exec(line);
    const rest = line.slice(m[0].length);
    return remove ? m[1] + rest : m[1] + make(++n) + rest;
  });
}

function cycleHeading(ta) {
  const first = selectedLines(ta).lines[0];
  const current = /^(#{1,6})\s/.exec(first);
  const next = current ? (current[1].length >= 3 ? 0 : current[1].length + 1) : 1;
  mapLines(ta, (line) => (next ? '#'.repeat(next) + ' ' : '') + line.replace(/^#{1,6}\s+/, ''));
}

function insertBlock(ta, snippet, select = [0, 0]) {
  const { end } = selectedLines(ta);
  const lineHasText = ta.value.slice(ta.value.lastIndexOf('\n', end - 1) + 1, end).trim() !== '';
  const lead = end === 0 ? '' : lineHasText ? '\n\n' : '\n';
  const text = `${lead}${snippet}`;
  const base = end + lead.length;
  replaceRange(ta, end, end, text, base + select[0], base + select[1]);
}

function link(ta) {
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  const selected = v.slice(s, e);
  if (/^https?:\/\/\S+$/.test(selected)) {
    replaceRange(ta, s, e, `[link](${selected})`, s + 1, s + 5);
  } else {
    const label = selected || 'link';
    const text = `[${label}](https://)`;
    replaceRange(ta, s, e, text, s + label.length + 3, s + text.length - 1);
  }
}

function codeBlock(ta) {
  if (ta.selectionStart === ta.selectionEnd) return insertBlock(ta, '```\ncode\n```', [4, 8]);
  const { start, end, lines } = selectedLines(ta);
  const text = ['```', ...lines, '```'].join('\n');
  return replaceRange(ta, start, end, text, start + 3, start + 3);
}

export const ACTIONS = {
  bold: (ta) => wrap(ta, '**'),
  italic: (ta) => wrap(ta, '*'),
  strike: (ta) => wrap(ta, '~~'),
  code: (ta) => wrap(ta, '`', '`', 'code'),
  link,
  image: (ta) => insertBlock(ta, '![description](image.png)', [2, 13]),
  heading: cycleHeading,
  bullet: (ta) => setLinePrefix(ta, 'bullet'),
  numbered: (ta) => setLinePrefix(ta, 'numbered'),
  task: (ta) => setLinePrefix(ta, 'task'),
  quote: (ta) => setLinePrefix(ta, 'quote'),
  codeblock: codeBlock,
  table: (ta) => insertBlock(ta, '| Column | Column |\n| --- | --- |\n| Cell | Cell |', [2, 8]),
  hr: (ta) => insertBlock(ta, '---', [3, 3]),
};

// Starting text for a new block when no textarea is active.
export const SNIPPETS = {
  heading: { text: '## Heading', select: [3, 10] },
  bullet: { text: '- Item', select: [2, 6] },
  numbered: { text: '1. Item', select: [3, 7] },
  task: { text: '- [ ] Task', select: [6, 10] },
  quote: { text: '> Quote', select: [2, 7] },
  codeblock: { text: '```\ncode\n```', select: [4, 8] },
  table: { text: '| Column | Column |\n| --- | --- |\n| Cell | Cell |', select: [2, 8] },
  hr: { text: '---', select: [3, 3] },
  image: { text: '![description](image.png)', select: [2, 13] },
  link: { text: '[link](https://)', select: [7, 15] },
};

const ITEM = /^(\s*)([-*+]|(\d+)([.)]))(\s+)(\[[ xX]\]\s+)?(.*)$/;

export function continueList(ta) {
  if (ta.selectionStart !== ta.selectionEnd) return false;
  const v = ta.value;
  const pos = ta.selectionStart;
  const start = v.lastIndexOf('\n', pos - 1) + 1;
  const stop = v.indexOf('\n', pos) < 0 ? v.length : v.indexOf('\n', pos);
  const m = ITEM.exec(v.slice(start, stop));
  if (!m) return false;
  if (!m[7].trim()) {
    replaceRange(ta, start, stop, '');
    return true;
  }
  const marker = m[3] ? `${Number(m[3]) + 1}${m[4]}` : m[2];
  replaceRange(ta, pos, pos, `\n${m[1]}${marker}${m[5]}${m[6] ? '[ ] ' : ''}`);
  return true;
}

export function indent(ta, outdent) {
  mapLines(ta, (line) => (outdent ? line.replace(/^ {1,2}/, '') : `  ${line}`));
}
