import { NS, root, state, vscode } from './state.js';
import { $ } from './util.js';
import { guard } from './errors.js';
import { isContainer, byPath, pathOf } from './layers.js';
import { EDITOR_ATTRS } from './transform.js';
import { fitBox, sameBox, applyFit } from './bounds.js';
import { fitView, setView } from './view.js';
import { showCode, revealCode, renderCode } from './code-panel.js';
import { renderAll } from './render.js';

const XMLNS = 'http://www.w3.org/2000/xmlns/';
const BLANK = `<svg xmlns="${NS}" viewBox="0 0 400 300">\n</svg>\n`;
const ROOT_SKIP = new Set([
  'viewBox', 'width', 'height', 'x', 'y', 'version', 'baseProfile', 'preserveAspectRatio',
  'zoomAndPan', 'contentScriptType', 'contentStyleType', 'transform', 'xmlns', 'id',
]);

let commitTimer = 0;

function parseError(message) {
  const m = /line (\d+) at column (\d+):\s*([^\n]+)/i.exec(message || '');
  if (m) return { line: +m[1], col: +m[2], text: m[3].trim() };
  return { line: 0, col: 0, text: (message || '').trim().split('\n').pop() };
}

function setBroken(message, line = 0, action = null) {
  state.broken = true;
  state.errLine = line;
  document.body.classList.add('broken');
  $('bannerMsg').textContent = message;
  const button = $('bannerAct');
  button.hidden = !action;
  if (action) {
    button.textContent = action.label;
    button.onclick = guard(action.run, 'banner');
  }
  $('banner').hidden = false;
  state.selection = [];
  state.hover = null;
  if (line) showCode(true);
  renderAll();
}

function clearBroken() {
  state.broken = false;
  state.errLine = 0;
  document.body.classList.remove('broken');
  $('banner').hidden = true;
}

function replaceText(text) {
  vscode.postMessage({ type: 'edit', text });
  load(text, false);
}

function parse(text) {
  if (!text.trim()) {
    setBroken('The file is empty.', 0, { label: 'Create a blank canvas', run: () => replaceText(BLANK) });
    return null;
  }
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const error = doc.getElementsByTagName('parsererror')[0];
  if (error) {
    const e = parseError(error.textContent);
    const where = e.line ? ` (line ${e.line}, column ${e.col})` : '';
    const goTo = { label: 'Go to line', run: () => { showCode(true); revealCode(true); } };
    setBroken(`Syntax error${where}: ${e.text}. Fix it and the drawing will reload.`, e.line, e.line ? goTo : null);
    return null;
  }
  const svgEl = doc.documentElement;
  if (!svgEl || svgEl.localName !== 'svg') {
    setBroken(`Not an SVG: the root element is <${svgEl ? svgEl.localName : '?'}>.`);
    return null;
  }
  if (svgEl.namespaceURI !== NS) {
    const fix = () => replaceText(text.replace(/<svg\b/, `<svg xmlns="${NS}"`));
    setBroken(`The <svg> element is missing xmlns="${NS}", so nothing can be drawn.`, 0, { label: 'Add it', run: fix });
    return null;
  }
  return doc;
}

function mountRoot(svgEl) {
  while (root.attributes.length) root.removeAttributeNode(root.attributes[0]);
  for (const a of svgEl.attributes) {
    if (a.namespaceURI === XMLNS || ROOT_SKIP.has(a.localName)) continue;
    try {
      root.setAttributeNS(a.namespaceURI, a.name, a.value);
    } catch {
      // Attributes the HTML document cannot hold are kept in the source only.
    }
  }
  root.setAttribute('id', svgEl.getAttribute('id') || 'se-root');
  const fragment = document.createDocumentFragment();
  for (const n of svgEl.childNodes) fragment.appendChild(document.importNode(n, true));
  root.replaceChildren(fragment);
}

function readViewBox(svgEl) {
  const v = (svgEl.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (v.length === 4 && v.every(Number.isFinite) && v[2] > 0 && v[3] > 0) return { x: v[0], y: v[1], w: v[2], h: v[3] };
  const ws = svgEl.getAttribute('width') || '';
  const hs = svgEl.getAttribute('height') || '';
  const plain = /^\s*[\d.]+(px)?\s*$/;
  if (plain.test(ws) && plain.test(hs) && parseFloat(ws) > 0 && parseFloat(hs) > 0) {
    return { x: 0, y: 0, w: parseFloat(ws), h: parseFloat(hs) };
  }
  try {
    const b = root.getBBox();
    if (b.width > 0 && b.height > 0) return { x: b.x, y: b.y, w: b.width, h: b.height };
  } catch {
    // Not rendered yet.
  }
  return { x: 0, y: 0, w: 300, h: 150 };
}

export function load(text, keep = false) {
  state.text = text;
  const doc = parse(text);
  if (!doc) return;
  clearBroken();

  const selectionPaths = keep ? state.selection.map(pathOf) : [];
  const contextPath = keep && state.context !== root ? pathOf(state.context) : null;
  const svgEl = doc.documentElement;
  const start = text.search(/<svg[\s>/]/);
  const end = text.lastIndexOf('</svg>');
  state.srcDoc = doc;
  state.prolog = start > 0 ? text.slice(0, start) : '';
  state.epilog = end >= 0 ? text.slice(end + 6) : '';

  mountRoot(svgEl);
  state.vb = readViewBox(svgEl);
  state.frame = null;
  if (keep && state.view) setView();
  else fitView();

  const context = contextPath && byPath(contextPath);
  state.context = context && isContainer(context) ? context : root;
  state.selection = selectionPaths.map(byPath).filter(Boolean);
  state.hover = null;
  renderAll();
}

export function serialize(overrides) {
  const out = state.srcDoc.documentElement.cloneNode(false);
  if (!overrides || !overrides.viewBox) {
    const fit = fitBox();
    if (!sameBox(fit, state.vb)) applyFit(out, fit);
  }
  if (overrides) for (const [k, v] of Object.entries(overrides)) out.setAttribute(k, v);
  for (const n of root.childNodes) out.appendChild(state.srcDoc.importNode(n, true));
  for (const n of [out, ...out.getElementsByTagName('*')]) {
    for (const attr of EDITOR_ATTRS) n.removeAttribute(attr);
  }
  return state.prolog + new XMLSerializer().serializeToString(out) + state.epilog;
}

export function commitNow() {
  clearTimeout(commitTimer);
  commitTimer = 0;
  if (!state.srcDoc || state.broken) return;
  const text = serialize();
  if (text === state.text) return;
  state.text = text;
  vscode.postMessage({ type: 'edit', text });
  renderCode();
}

export function commit(later = false) {
  clearTimeout(commitTimer);
  if (later) commitTimer = setTimeout(guard(commitNow, 'save'), 350);
  else commitNow();
}

export function flush() {
  if (commitTimer) commitNow();
}

export function cancelPendingCommit() {
  clearTimeout(commitTimer);
  commitTimer = 0;
}

export function changed(later = false) {
  commit(later);
  renderAll();
}
