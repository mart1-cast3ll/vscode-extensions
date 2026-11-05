import { state } from './state.js';
import { $, clamp } from './util.js';
import { guard, listen } from './errors.js';
import { currentFill, documentColors, hexToHsv, hsvToHex, hsvToRgb, parseHex, rgbToHex } from './color.js';
import { commitNow } from './document.js';
import { setFill } from './props.js';
import { onRender } from './render.js';

const SIZE = 188;
const pop = $('colorPop');
const wheel = $('wheel');
const wheelArea = $('wheelWrap');
const dot = $('wheelDot');
const valueRange = $('valRange');
const hexInput = $('hexIn');
const swatch = $('swatch');

let hsv = { h: 0, s: 0, v: 1 };
let target = null;
let wheelImage = null;

function buildWheel() {
  const dpr = window.devicePixelRatio || 1;
  const size = Math.round(SIZE * dpr);
  const radius = size / 2;
  wheel.width = size;
  wheel.height = size;
  const image = wheel.getContext('2d').createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - radius;
      const dy = y + 0.5 - radius;
      const dist = Math.hypot(dx, dy);
      const alpha = clamp(radius - dist, 0, 1);
      if (!alpha) continue;
      const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      const [r, g, b] = hsvToRgb(hue, Math.min(dist / radius, 1), 1);
      const i = (y * size + x) * 4;
      image.data.set([r, g, b, alpha * 255], i);
    }
  }
  wheelImage = image;
}

function drawWheel() {
  if (!wheelImage) buildWheel();
  const ctx = wheel.getContext('2d');
  ctx.globalCompositeOperation = 'source-over';
  ctx.putImageData(wheelImage, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = `rgba(0,0,0,${1 - hsv.v})`;
  ctx.fillRect(0, 0, wheel.width, wheel.height);

  const angle = (hsv.h * Math.PI) / 180;
  const r = (hsv.s * SIZE) / 2;
  dot.style.left = `${SIZE / 2 + Math.cos(angle) * r}px`;
  dot.style.top = `${SIZE / 2 + Math.sin(angle) * r}px`;

  const hex = hsvToHex(hsv);
  dot.style.background = hex;
  valueRange.value = Math.round(hsv.v * 100);
  valueRange.style.background = `linear-gradient(to right,#000,${rgbToHex(...hsvToRgb(hsv.h, hsv.s, 1))})`;
  $('prev').style.background = hex;
  if (document.activeElement !== hexInput) hexInput.value = hex;
  return hex;
}

function renderSwatches() {
  const box = $('docColors');
  const colors = documentColors();
  box.replaceChildren(
    ...colors.map((hex) => {
      const b = document.createElement('button');
      b.style.background = hex;
      b.title = hex;
      b.setAttribute('aria-label', hex);
      b.onclick = guard(() => {
        hsv = hexToHsv(hex);
        setFill(drawWheel());
      }, 'swatch');
      return b;
    })
  );
  $('docColorsH').hidden = !colors.length;
}

function place() {
  const r = swatch.getBoundingClientRect();
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  const top = r.bottom + 8 + h > window.innerHeight ? r.top - h - 8 : r.bottom + 8;
  pop.style.left = `${clamp(r.right - w, 8, window.innerWidth - w - 8)}px`;
  pop.style.top = `${Math.max(8, top)}px`;
}

export const isPickerOpen = () => !pop.hidden;

export function openPicker() {
  const el = state.selection.length === 1 && !state.broken ? state.selection[0] : null;
  const fill = el && currentFill(el);
  if (!fill) return;
  target = el;
  hsv = hexToHsv(fill);
  pop.hidden = false;
  drawWheel();
  renderSwatches();
  place();
}

export function closePicker() {
  if (pop.hidden) return;
  pop.hidden = true;
  target = null;
  commitNow();
}

function pickFromWheel(e) {
  const r = wheelArea.getBoundingClientRect();
  const dx = e.clientX - r.left - SIZE / 2;
  const dy = e.clientY - r.top - SIZE / 2;
  hsv.h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  hsv.s = Math.min(Math.hypot(dx, dy) / (SIZE / 2), 1);
  if (hsv.v < 0.05) hsv.v = 1;
  setFill(drawWheel());
}

listen(swatch, 'click', () => (pop.hidden ? openPicker() : closePicker()));
listen(document, 'pointerdown', (e) => {
  if (!pop.hidden && !pop.contains(e.target) && !swatch.contains(e.target)) closePicker();
}, true);
listen(wheelArea, 'pointerdown', (e) => {
  wheelArea.setPointerCapture(e.pointerId);
  pickFromWheel(e);
  wheelArea.onpointermove = guard(pickFromWheel, 'wheel');
  wheelArea.onpointerup = () => {
    wheelArea.onpointermove = null;
    commitNow();
  };
  wheelArea.onpointercancel = wheelArea.onpointerup;
});
listen(valueRange, 'input', () => {
  hsv.v = valueRange.value / 100;
  setFill(drawWheel());
});
listen(valueRange, 'change', commitNow);
listen(hexInput, 'input', () => {
  const hex = parseHex(hexInput.value);
  if (!hex) return;
  hsv = hexToHsv(hex);
  drawWheel();
  setFill(hex);
});
listen(window, 'resize', closePicker);

onRender(() => {
  if (target && (state.broken || state.selection[0] !== target)) closePicker();
});
