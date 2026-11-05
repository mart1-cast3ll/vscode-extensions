import { state, vscode } from './state.js';
import { guard } from './errors.js';
import { renderAll } from './render.js';
import { isBlank } from './md/blocks.js';

const TYPING_DELAY = 300;
let timer = 0;

export function flush() {
  clearTimeout(timer);
  timer = 0;
  vscode.postMessage({ type: 'edit', text: state.text });
}

export function flushPending() {
  if (timer) flush();
}

export function load(text) {
  clearTimeout(timer);
  timer = 0;
  state.text = text.replace(/\r\n/g, '\n');
  renderAll('host');
}

export function applyText(text, origin = 'edit') {
  if (text === state.text) return;
  state.text = text;
  if (origin === 'source') {
    clearTimeout(timer);
    timer = setTimeout(guard(flush, 'save'), TYPING_DELAY);
  } else {
    flush();
  }
  renderAll(origin);
}

export function replaceLines(start, end, replacement) {
  const lines = state.text.split('\n');
  if (replacement === null) {
    lines.splice(start, end - start);
    if (isBlank(lines[start]) && (start === 0 || isBlank(lines[start - 1]))) lines.splice(start, 1);
  } else {
    lines.splice(start, end - start, ...replacement.split('\n'));
  }
  applyText(lines.join('\n'));
}

// Inserts a new block at a line index, keeping one blank line on each side.
export function insertBlock(at, text) {
  const lines = state.text.split('\n');
  const insert = text.split('\n');
  if (at > 0 && !isBlank(lines[at - 1])) insert.unshift('');
  if (at < lines.length && !isBlank(lines[at])) insert.push('');
  if (lines.length === 1 && lines[0] === '') lines.length = 0;
  lines.splice(at, 0, ...insert);
  applyText(lines.join('\n'));
}

export function toggleTask(line) {
  const lines = state.text.split('\n');
  if (!lines[line]) return;
  lines[line] = lines[line].replace(/\[([ xX])\]/, (m, mark) => (mark === ' ' ? '[x]' : '[ ]'));
  applyText(lines.join('\n'));
}
