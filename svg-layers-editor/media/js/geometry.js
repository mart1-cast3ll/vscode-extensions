import { NS, svg, overlay } from './state.js';

export function pt(x, y) {
  const p = svg.createSVGPoint();
  p.x = x;
  p.y = y;
  return p;
}

export const rootMatrix = (el) => svg.getScreenCTM().inverse().multiply(el.getScreenCTM());
export const clientToRoot = (e) => pt(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
export const clientTo = (el, e) => pt(e.clientX, e.clientY).matrixTransform(el.getScreenCTM().inverse());

export function screenUnit() {
  const m = svg.getScreenCTM();
  return m && m.a ? 1 / m.a : 1;
}

export function matrixOf(transform) {
  if (!transform) return svg.createSVGMatrix();
  const probe = document.createElementNS(NS, 'g');
  probe.setAttribute('transform', transform);
  overlay.appendChild(probe);
  const consolidated = probe.transform.baseVal.consolidate();
  const matrix = consolidated ? consolidated.matrix : svg.createSVGMatrix();
  overlay.removeChild(probe);
  return matrix;
}

export function matrixStr(m) {
  const f = (v) => Math.round(v * 10000) / 10000;
  return `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map(f).join(' ')})`;
}

export function isIdentity(m) {
  return (
    Math.abs(m.a - 1) < 1e-6 && Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6 &&
    Math.abs(m.d - 1) < 1e-6 && Math.abs(m.e) < 1e-4 && Math.abs(m.f) < 1e-4
  );
}

export function bboxOf(el) {
  try {
    return el.getBBox();
  } catch {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
}

export function cornersOf(el) {
  const b = bboxOf(el);
  const m = rootMatrix(el);
  return [
    pt(b.x, b.y), pt(b.x + b.width, b.y), pt(b.x + b.width, b.y + b.height), pt(b.x, b.y + b.height),
  ].map((p) => p.matrixTransform(m));
}

export function mapBox(b, m) {
  const pts = [
    [b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height],
  ].map(([x, y]) => pt(x, y).matrixTransform(m));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function unionBox(a, b) {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

export function intersectBox(a, b) {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x;
  const h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}
