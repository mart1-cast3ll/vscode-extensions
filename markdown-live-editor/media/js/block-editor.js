import { state } from './state.js';
import { $ } from './util.js';
import { guard } from './errors.js';
import { insertBlock, replaceLines } from './document.js';
import { renderAll } from './render.js';
import { revealSourceLine } from './source-pane.js';

const view = $('view');

function autosize(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${ta.scrollHeight + 2}px`;
}

function mount(host, value, target, select) {
  const wrap = document.createElement('div');
  wrap.className = 'block editing';
  const ta = document.createElement('textarea');
  ta.className = 'block-input';
  ta.value = value;
  ta.spellcheck = true;
  const hint = document.createElement('div');
  hint.className = 'edit-hint';
  hint.textContent = 'Ctrl+Enter or click outside to apply · Esc to cancel';
  wrap.append(ta, hint);
  if (target.insertAt === undefined) host.replaceWith(wrap);
  else host.after(wrap);

  state.editing = { ta, original: value, ...target };
  state.lastTextarea = ta;
  ta.addEventListener('input', () => autosize(ta));
  ta.addEventListener('blur', () => {
    setTimeout(guard(() => {
      if (state.editing && state.editing.ta === ta && document.activeElement !== ta) commitEdit();
    }, 'blur'), 0);
  });
  autosize(ta);
  ta.focus();
  const [s, e] = select || [value.length, value.length];
  ta.setSelectionRange(s, e);
  wrap.scrollIntoView({ block: 'nearest' });
}

export function editBlock(index) {
  const block = state.blocks[index];
  const host = view.querySelector(`.block[data-index="${index}"]`);
  if (!block || !host) return;
  mount(host, state.lines.slice(block.start, block.end).join('\n'), { start: block.start, end: block.end });
  revealSourceLine(block.start);
}

export function editNew(at, initial = '', select) {
  const host = view.querySelector(`.gap[data-at="${at}"]`) || view.lastElementChild;
  if (!host) {
    view.replaceChildren();
    const anchor = document.createElement('div');
    view.append(anchor);
    mount(anchor, initial, { insertAt: at }, select);
    return;
  }
  mount(host, initial, { insertAt: at }, select);
}

export function commitEdit() {
  const e = state.editing;
  if (!e) return false;
  state.editing = null;
  const value = e.ta.value.replace(/\s+$/, '');
  if (e.insertAt !== undefined) {
    if (value.trim()) insertBlock(e.insertAt, value);
    else renderAll();
  } else if (value === e.original.replace(/\s+$/, '')) {
    renderAll();
  } else {
    replaceLines(e.start, e.end, value.trim() ? value : null);
  }
  return true;
}

export function cancelEdit() {
  if (!state.editing) return;
  state.editing = null;
  renderAll();
}
