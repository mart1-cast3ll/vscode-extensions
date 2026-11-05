import { state, saveUi } from './state.js';
import { $ } from './util.js';
import { guard, listen } from './errors.js';
import { applyText } from './document.js';
import { onRender } from './render.js';

const pane = $('sourcePane');
const ta = $('source');
const splitter = $('sourceSplit');

function sync(origin) {
  if (origin === 'source' || ta.value === state.text) return;
  const { selectionStart, selectionEnd } = ta;
  ta.value = state.text;
  if (document.activeElement === ta) ta.setSelectionRange(selectionStart, selectionEnd);
}

export function showSource(visible = !state.ui.source) {
  state.ui.source = visible;
  document.body.classList.toggle('with-source', visible);
  $('bSource').classList.toggle('on', visible);
  $('bSource').setAttribute('aria-pressed', String(visible));
  saveUi();
  if (visible) sync('show');
}

export function revealSourceLine(line) {
  if (!state.ui.source) return;
  const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 18;
  ta.scrollTop = Math.max(0, line * lineHeight - 40);
}

function startResize(e) {
  const area = $('workspace').getBoundingClientRect();
  splitter.setPointerCapture(e.pointerId);
  splitter.classList.add('drag');
  splitter.onpointermove = guard((ev) => {
    state.ui.sourceWidth = Math.round(Math.max(220, Math.min(area.width - 280, ev.clientX - area.left)));
    pane.style.width = `${state.ui.sourceWidth}px`;
  }, 'resize');
  splitter.onpointerup = () => {
    splitter.onpointermove = null;
    splitter.classList.remove('drag');
    saveUi();
  };
  splitter.onpointercancel = splitter.onpointerup;
}

listen(ta, 'input', () => applyText(ta.value, 'source'));
listen(ta, 'focus', () => {
  state.lastTextarea = ta;
});
listen(splitter, 'pointerdown', startResize);
if (state.ui.sourceWidth) pane.style.width = `${state.ui.sourceWidth}px`;
showSource(state.ui.source);
onRender(sync);
