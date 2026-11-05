import { svg, root, state } from './state.js';
import { isContainer, layerChildren } from './layers.js';
import { rootMatrix, mapBox, unionBox, intersectBox, matrixOf } from './geometry.js';
import { round } from './util.js';

function isHidden(el) {
  return el.getAttribute('display') === 'none' || getComputedStyle(el).display === 'none';
}

function strokePadding(el, m) {
  const cs = getComputedStyle(el);
  if (!cs.stroke || cs.stroke === 'none') return 0;
  return ((parseFloat(cs.strokeWidth) || 0) * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c))) / 2;
}

function clipBox(el, m) {
  const ref = /url\(\s*['"]?#([^'")\s]+)/.exec(el.getAttribute('clip-path') || el.style.clipPath || '');
  const clip = ref && document.getElementById(ref[1]);
  if (!clip || clip.getAttribute('clipPathUnits') === 'objectBoundingBox') return null;
  let box = null;
  for (const shape of clip.children) {
    try {
      box = unionBox(box, mapBox(shape.getBBox(), m.multiply(matrixOf(shape.getAttribute('transform')))));
    } catch {
      // Non-geometric child.
    }
  }
  return box;
}

function boxOf(el) {
  if (el !== root && isHidden(el)) return null;
  const m = el === root ? null : rootMatrix(el);
  let box = null;

  if (el === root || isContainer(el)) {
    for (const child of layerChildren(el)) box = unionBox(box, boxOf(child));
  } else {
    let b;
    try {
      b = el.getBBox();
    } catch {
      return null;
    }
    if (!b.width && !b.height) return null;
    box = mapBox(b, m);
    const pad = strokePadding(el, m);
    box = { x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad };
  }

  const clip = box && m ? clipBox(el, m) : null;
  return clip ? intersectBox(box, clip) : box;
}

export function contentBox() {
  try {
    return svg.getScreenCTM() ? boxOf(root) : null;
  } catch {
    return null;
  }
}

// The exported image covers every visible object: the original viewBox only grows, never shrinks.
export function fitBox() {
  const content = contentBox();
  if (!content) return state.vb;
  const u = unionBox(state.vb, content);
  const x = Math.floor(u.x * 100) / 100;
  const y = Math.floor(u.y * 100) / 100;
  return {
    x,
    y,
    w: round(Math.ceil((u.x + u.w) * 100) / 100 - x),
    h: round(Math.ceil((u.y + u.h) * 100) / 100 - y),
  };
}

export function sameBox(a, b) {
  return ['x', 'y', 'w', 'h'].every((k) => Math.abs(a[k] - b[k]) < 0.01);
}

export function applyFit(svgEl, box) {
  svgEl.setAttribute('viewBox', [box.x, box.y, box.w, box.h].join(' '));
  const scale = { width: box.w / state.vb.w, height: box.h / state.vb.h };
  for (const attr of ['width', 'height']) {
    const match = /^\s*([\d.]+)\s*([a-z]*)\s*$/i.exec(svgEl.getAttribute(attr) || '');
    if (match) svgEl.setAttribute(attr, round(+match[1] * scale[attr]) + match[2]);
  }
}
