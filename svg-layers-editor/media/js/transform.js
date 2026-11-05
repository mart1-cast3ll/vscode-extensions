import { svg } from './state.js';
import { pt, matrixOf, bboxOf, cornersOf } from './geometry.js';
import { clamp, round } from './util.js';

const KEYS = ['seTx', 'seTy', 'seR', 'seS', 'seCx', 'seCy', 'seBase'];

export const EDITOR_ATTRS = KEYS.map((k) => `data-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);

// The element's own transform is kept in data-se-base; move/rotate/scale are layered on top of it.
export function transformOf(el) {
  const d = el.dataset;
  if (d.seBase === undefined) d.seBase = el.getAttribute('transform') || '';
  return { tx: +d.seTx || 0, ty: +d.seTy || 0, r: +d.seR || 0, s: d.seS ? +d.seS : 1, base: d.seBase };
}

export function pivotOf(el, fresh = false) {
  if (!fresh && el.dataset.seCx !== undefined) return { x: +el.dataset.seCx, y: +el.dataset.seCy };
  const b = bboxOf(el);
  const p = pt(b.x + b.width / 2, b.y + b.height / 2).matrixTransform(matrixOf(transformOf(el).base));
  el.dataset.seCx = round(p.x);
  el.dataset.seCy = round(p.y);
  return { x: round(p.x), y: round(p.y) };
}

export function applyTransform(el) {
  const t = transformOf(el);
  const c = pivotOf(el, t.r === 0 && t.s === 1);
  const parts = [];
  if (t.tx || t.ty) parts.push(`translate(${round(t.tx)} ${round(t.ty)})`);
  if (t.r) parts.push(`rotate(${round(t.r)} ${c.x} ${c.y})`);
  if (t.s !== 1) parts.push(`translate(${c.x} ${c.y}) scale(${round(t.s)}) translate(${-c.x} ${-c.y})`);
  if (t.base) parts.push(t.base);
  const value = parts.join(' ').trim();
  if (value) el.setAttribute('transform', value);
  else el.removeAttribute('transform');
}

export function resetTransform(el, base = '') {
  for (const k of KEYS) delete el.dataset[k];
  el.dataset.seBase = base.trim();
  applyTransform(el);
}

export function setTransformPart(el, key, value) {
  const t = transformOf(el);
  if ((key === 'seR' || key === 'seS') && t.r === 0 && t.s === 1) pivotOf(el, true);
  if (key === 'seR') value = ((value + 540) % 360) - 180;
  if (key === 'seS') value = clamp(value, 0.05, 20);
  el.dataset[key] = round(value);
  applyTransform(el);
}

export function moveBy(el, dx, dy) {
  const t = transformOf(el);
  const m = el.parentNode.getScreenCTM().inverse().multiply(svg.getScreenCTM());
  const a = pt(dx, dy).matrixTransform(m);
  const o = pt(0, 0).matrixTransform(m);
  el.dataset.seTx = round(t.tx + a.x - o.x);
  el.dataset.seTy = round(t.ty + a.y - o.y);
  applyTransform(el);
}

export function positionOf(el) {
  const q = cornersOf(el);
  return { x: Math.min(...q.map((p) => p.x)), y: Math.min(...q.map((p) => p.y)) };
}
