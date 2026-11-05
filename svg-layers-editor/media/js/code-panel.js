import { state, saveUi } from './state.js';
import { $, clamp, escapeHtml } from './util.js';
import { guard, listen } from './errors.js';
import { scanElements, highlightXml } from './xml-scan.js';
import { pathOf, byPath, layerParent } from './layers.js';
import { select } from './selection.js';
import { onRender } from './render.js';

const MAX_HIGHLIGHT = 400000;
const pre = $('codePre');
const gutter = $('gutter');
const body = $('codeBody');
const info = $('codeWhat');
const pane = $('code');

let scanned = { text: null, map: {} };
let renderedText = null;
let skipScroll = false;

function elementMap() {
  if (scanned.text !== state.text) scanned = { text: state.text, map: scanElements(state.text) };
  return scanned.map;
}

function rangeAt(start, stop) {
  const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let pos = 0;
  let started = false;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = n.data.length;
    if (!started && start <= pos + len) {
      range.setStart(n, start - pos);
      started = true;
    }
    if (started && stop <= pos + len) {
      range.setEnd(n, stop - pos);
      return range;
    }
    pos += len;
  }
  return started ? range : null;
}

function lineRange(line) {
  let start = 0;
  for (let i = 1; i < line; i++) {
    start = state.text.indexOf('\n', start) + 1;
    if (!start) return null;
  }
  const stop = state.text.indexOf('\n', start);
  return [start, stop < 0 ? state.text.length : stop];
}

const lineOf = (offset) => state.text.slice(0, offset).split('\n').length;

function scrollTo(range) {
  const r = range.getBoundingClientRect();
  const b = body.getBoundingClientRect();
  if (r.top < b.top + 8 || r.top > b.bottom - 30) body.scrollTop += r.top - b.top - 40;
  const gw = gutter.offsetWidth;
  if (r.left < b.left + gw || r.left > b.right - 40) {
    body.scrollLeft = Math.max(0, body.scrollLeft + r.left - b.left - gw - 20);
  }
}

function setHighlight(name, ranges) {
  if (!window.CSS || !CSS.highlights || !window.Highlight) return;
  CSS.highlights.delete(name);
  if (!ranges.length) return;
  const h = new Highlight();
  ranges.forEach((r) => h.add(r));
  CSS.highlights.set(name, h);
}

export function revealCode(scroll = true) {
  if (!state.ui.code) return;
  let ranges = [];
  let first = null;
  let text = '';

  if (state.broken && state.errLine) {
    const lr = lineRange(state.errLine);
    const r = lr && rangeAt(lr[0], Math.max(lr[1], lr[0] + 1));
    if (r) first = r;
    setHighlight('se-err', r ? [r] : []);
    text = `Error on line ${state.errLine}`;
  } else {
    setHighlight('se-err', []);
    const map = elementMap();
    for (const el of state.selection) {
      const span = map[pathOf(el).join('.')];
      const r = span && rangeAt(span[0], span[1]);
      if (!r) continue;
      ranges.push(r);
      if (!first) {
        first = r;
        text = `<${el.localName}> · line ${lineOf(span[0])}`;
      }
    }
  }
  setHighlight('se-sel', ranges);
  info.textContent = text;
  if (scroll && first) scrollTo(first);
}

export function renderCode() {
  if (!state.ui.code) return;
  if (renderedText !== state.text) {
    renderedText = state.text;
    pre.innerHTML = state.text.length > MAX_HIGHLIGHT ? escapeHtml(state.text) : highlightXml(state.text);
    const lines = state.text.split('\n').length;
    gutter.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
  }
  revealCode(!skipScroll);
  skipScroll = false;
}

export function showCode(visible = !state.ui.code) {
  state.ui.code = visible;
  document.body.classList.toggle('no-code', !visible);
  $('bCode').classList.toggle('on', visible);
  $('bCode').setAttribute('aria-pressed', String(visible));
  saveUi();
  if (visible) {
    renderedText = null;
    renderCode();
  }
}

function selectFromCode() {
  if (state.broken || !state.srcDoc) return;
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.isCollapsed || !pre.contains(sel.anchorNode)) return;
  const before = document.createRange();
  before.setStart(pre, 0);
  before.setEnd(sel.anchorNode, sel.anchorOffset);
  const offset = before.toString().length;

  let best = null;
  let bestSize = Infinity;
  for (const [key, [start, stop]] of Object.entries(elementMap())) {
    if (key && offset >= start && offset < stop && stop - start < bestSize) {
      best = key;
      bestSize = stop - start;
    }
  }
  if (best === null) return;
  const path = best.split('.').map(Number);
  while (path.length && !byPath(path)) path.pop();
  const el = byPath(path);
  if (!el) return;
  state.context = layerParent(el);
  skipScroll = true;
  select([el], true);
}

function startResize(e) {
  const handle = $('split');
  const area = $('work').getBoundingClientRect();
  handle.setPointerCapture(e.pointerId);
  handle.classList.add('drag');
  handle.onpointermove = guard((ev) => {
    state.ui.codeH = Math.round(clamp(area.bottom - ev.clientY, 90, area.height - 120));
    pane.style.setProperty('--code-h', `${state.ui.codeH}px`);
  }, 'resize');
  handle.onpointerup = () => {
    handle.onpointermove = null;
    handle.classList.remove('drag');
    saveUi();
  };
  handle.onpointercancel = handle.onpointerup;
}

listen(pre, 'click', selectFromCode);
listen($('split'), 'pointerdown', startResize);
pane.style.setProperty('--code-h', `${state.ui.codeH}px`);
showCode(state.ui.code);
onRender(renderCode);
