import { NS, svg, root } from './state.js';

const CONTAINERS = new Set(['g', 'a', 'switch']);
const SHAPES = new Set([
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'use', 'image', 'foreignObject', 'svg',
]);
const NON_RENDERED = new Set([
  'defs', 'clipPath', 'mask', 'pattern', 'symbol', 'marker', 'linearGradient', 'radialGradient', 'filter',
]);
const METADATA = new Set(['title', 'desc', 'metadata']);
const INKSCAPE = 'http://www.inkscape.org/namespaces/inkscape';
const LABELS = {
  g: 'Group', a: 'Link', switch: 'Switch', path: 'Path', rect: 'Rectangle', circle: 'Circle',
  ellipse: 'Ellipse', line: 'Line', polyline: 'Polyline', polygon: 'Polygon', text: 'Text',
  use: 'Use', image: 'Image', foreignObject: 'Object', svg: 'SVG',
};

export const isSvgElement = (n) => !!n && n.nodeType === 1 && n.namespaceURI === NS;
export const isContainer = (n) => isSvgElement(n) && CONTAINERS.has(n.localName);
export const isShape = (n) => isSvgElement(n) && SHAPES.has(n.localName);
export const isGroup = (n) => isSvgElement(n) && (n.localName === 'g' || n.localName === 'a');
export const isLayerTag = (n) => isContainer(n) || isShape(n);
export const isMetadata = (n) => METADATA.has(n.localName);

export function isLayer(n) {
  if (!n || n === root || !isLayerTag(n)) return false;
  const parent = n.parentNode;
  return parent === root || (isContainer(parent) && isLayer(parent));
}

export function layerParent(el) {
  const parent = el.parentNode;
  return parent && parent !== root && isLayer(parent) ? parent : root;
}

export function layerChildren(group) {
  if (group !== root && !isContainer(group)) return [];
  return [...group.children].filter(isLayer);
}

export function chainOf(target) {
  const chain = [];
  let n = target;
  while (n && n !== root && n !== svg && n.nodeType === 1) {
    if (isLayer(n)) chain.unshift(n);
    n = n.parentNode;
  }
  return n === root ? chain : null;
}

export function documentOrder(list) {
  return list.slice().sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
}

export function inNonRendered(n, stop) {
  for (let p = n.parentNode; p && p !== stop; p = p.parentNode) {
    if (NON_RENDERED.has(p.localName)) return true;
  }
  return false;
}

export function nameOf(el) {
  const explicit =
    el.getAttribute('data-name') ||
    el.getAttributeNS(INKSCAPE, 'label') ||
    el.getAttribute('inkscape:label') ||
    el.getAttribute('aria-label');
  if (explicit) return explicit;

  const title = [...el.children].find((c) => c.localName === 'title' && c.textContent.trim());
  if (title) return title.textContent.trim();

  const label = LABELS[el.localName] || el.localName;
  if (el.localName === 'text') {
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    if (text) return `Text "${text.length > 24 ? `${text.slice(0, 24)}…` : text}"`;
  }
  return el.id ? `${label} #${el.id}` : label;
}

export function pathOf(el) {
  const path = [];
  while (el && el !== root) {
    const parent = el.parentNode;
    if (!parent) return [];
    path.unshift([...parent.children].indexOf(el));
    el = parent;
  }
  return path;
}

export function byPath(path) {
  if (!path || !path.length) return null;
  let el = root;
  for (const index of path) el = el && el.children[index];
  return isLayer(el) ? el : null;
}
