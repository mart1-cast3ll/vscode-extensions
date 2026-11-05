import { root } from './state.js';
import { isShape, inNonRendered } from './layers.js';

const FILLABLE = 'path,rect,circle,ellipse,line,polyline,polygon,text,use';

export function toHex(css) {
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(css || '');
  if (!m) return '#000000';
  return `#${m.slice(1, 4).map((v) => (+v).toString(16).padStart(2, '0')).join('')}`;
}

export function parseHex(value) {
  let s = String(value || '').trim().replace(/^#?/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.replace(/./g, '$&$&');
  return /^[0-9a-f]{6}$/i.test(s) ? `#${s.toLowerCase()}` : null;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgbToHex = (r, g, b) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export function hsvToRgb(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return [f(5), f(3), f(1)];
}

export function rgbToHsv(r, g, b) {
  [r, g, b] = [r / 255, g / 255, b / 255];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

export const hexToHsv = (hex) => rgbToHsv(...hexToRgb(hex));
export const hsvToHex = ({ h, s, v }) => rgbToHex(...hsvToRgb(h, s, v));

function hasSolidFill(n) {
  const fill = getComputedStyle(n).fill;
  return !!fill && fill !== 'none' && !fill.includes('url(');
}

export function fillTargets(el) {
  const shapes = isShape(el) ? [el] : [...el.querySelectorAll(FILLABLE)].filter((n) => !inNonRendered(n, el));
  return shapes.filter(hasSolidFill);
}

export function currentFill(el) {
  const targets = fillTargets(el);
  return targets.length ? toHex(getComputedStyle(targets[0]).fill) : null;
}

// Inline style wins over the document's CSS classes and fill attributes.
export function applyFill(el, hex) {
  for (const n of fillTargets(el)) n.style.fill = hex;
}

export function documentColors(limit = 16) {
  const colors = new Set();
  const shapes = root.querySelectorAll(FILLABLE);
  for (let i = 0; i < shapes.length && i < 400 && colors.size < limit; i++) {
    if (!inNonRendered(shapes[i], root) && hasSolidFill(shapes[i])) colors.add(toHex(getComputedStyle(shapes[i]).fill));
  }
  return [...colors];
}
