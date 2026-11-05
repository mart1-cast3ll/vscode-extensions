export const $ = (id) => document.getElementById(id);

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const round = (value) => Math.round(value * 100) / 100;
export const round1 = (value) => Math.round(value * 10) / 10;

export function parseNum(value) {
  const n = parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
export const escapeHtml = (text) => text.replace(/[&<>]/g, (c) => HTML_ESCAPES[c]);

let toastTimer = 0;

export function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
}
