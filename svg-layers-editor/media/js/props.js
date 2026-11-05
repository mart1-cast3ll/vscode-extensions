import { state } from './state.js';
import { $, clamp, parseNum, round, round1, toast } from './util.js';
import { guard, listen } from './errors.js';
import { nameOf } from './layers.js';
import { transformOf, setTransformPart, moveBy, positionOf } from './transform.js';
import { applyFill, currentFill, parseHex } from './color.js';
import { commit, commitNow } from './document.js';
import { drawOverlay } from './overlay.js';
import { onRender } from './render.js';

const field = { x: $('fX'), y: $('fY'), rotation: $('fR'), scale: $('fS'), opacity: $('fO'), fill: $('fFill') };
const slider = { scale: $('rS'), opacity: $('rO') };

const single = () => (state.selection.length === 1 && !state.broken ? state.selection[0] : null);

function show(input, value) {
  if (document.activeElement !== input) input.value = value;
}

function paintSlider(range) {
  const pct = ((range.value - range.min) / (range.max - range.min)) * 100;
  range.style.setProperty('--p', `${pct}%`);
}

function emptyMessage() {
  if (state.broken) return 'Editing is locked until the code is fixed.';
  if (state.selection.length > 1) return 'Group, reorder, duplicate or move them together.';
  return 'Click the drawing or a layer.';
}

export function renderProps() {
  const el = single();
  const count = state.selection.length;
  $('selName').textContent = el ? nameOf(el) : count > 1 ? `${count} items selected` : 'Nothing selected';
  $('props').classList.toggle('none', !el);
  $('propsEmpty').hidden = !!el;
  $('propsEmpty').textContent = emptyMessage();
  if (!el) return;

  const t = transformOf(el);
  const pos = positionOf(el);
  show(field.x, round1(pos.x));
  show(field.y, round1(pos.y));
  show(field.rotation, round1(t.r));
  $('needle').style.transform = `rotate(${t.r}deg)`;
  show(field.scale, Math.round(t.s * 100));
  slider.scale.value = clamp(t.s * 100, 5, 400);
  paintSlider(slider.scale);

  const opacity = el.hasAttribute('opacity') ? +el.getAttribute('opacity') : 1;
  show(field.opacity, Math.round(opacity * 100));
  slider.opacity.value = opacity * 100;
  paintSlider(slider.opacity);

  const fill = currentFill(el);
  $('fillRow').hidden = !fill;
  if (fill) {
    $('swatchIn').style.background = fill;
    show(field.fill, fill);
  }
}

function afterEdit(later = true) {
  drawOverlay();
  renderProps();
  commit(later);
}

function setPart(key, value, later) {
  const el = single();
  if (!el || value === null) return;
  setTransformPart(el, key, value);
  afterEdit(later);
}

function setOpacity(value) {
  const el = single();
  if (!el || value === null) return;
  const v = clamp(value, 0, 1);
  if (v === 1) el.removeAttribute('opacity');
  else el.setAttribute('opacity', round(v));
  el.style.opacity = '';
  afterEdit();
}

function setPosition(axis, value) {
  const el = single();
  if (!el || value === null) return;
  const pos = positionOf(el);
  if (axis === 'x') moveBy(el, value - pos.x, 0);
  else moveBy(el, 0, value - pos.y);
  afterEdit();
}

export function setFill(hex) {
  const el = single();
  if (!el) return;
  applyFill(el, hex);
  $('swatchIn').style.background = hex;
  show(field.fill, hex);
  commit(true);
}

function bindNumber(input, apply) {
  listen(input, 'change', () => {
    apply(parseNum(input.value));
    commitNow();
    renderProps();
  });
  listen(input, 'keydown', (e) => {
    if (e.key === 'Enter') return input.blur();
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const value = (parseNum(input.value) || 0) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1);
    input.value = round1(value);
    apply(value);
  });
}

function bindScrub(label, axis) {
  listen(label, 'pointerdown', (e) => {
    const el = single();
    if (!el) return;
    label.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const start = positionOf(el)[axis];
    const unit = Math.max(state.vb.w, state.vb.h) / 500;
    label.onpointermove = guard((ev) => {
      setPosition(axis, round(start + (ev.clientX - startX) * unit * (ev.shiftKey ? 5 : 1)));
    }, 'scrub');
    label.onpointerup = () => {
      label.onpointermove = null;
      commitNow();
    };
    label.onpointercancel = label.onpointerup;
  });
}

function bindDial(dial) {
  const turn = guard((e) => {
    const r = dial.getBoundingClientRect();
    let angle = (Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180) / Math.PI;
    if (e.shiftKey) angle = Math.round(angle / 15) * 15;
    setPart('seR', Math.round(angle));
  }, 'dial');
  listen(dial, 'pointerdown', (e) => {
    if (!single()) return;
    dial.setPointerCapture(e.pointerId);
    dial.classList.add('drag');
    turn(e);
    dial.onpointermove = turn;
    dial.onpointerup = () => {
      dial.onpointermove = null;
      dial.classList.remove('drag');
      commitNow();
    };
    dial.onpointercancel = dial.onpointerup;
  });
  listen(dial, 'dblclick', () => setPart('seR', 0, false));
}

function rotateBy(delta) {
  const el = single();
  if (el) setPart('seR', transformOf(el).r + delta, false);
}

bindNumber(field.x, (v) => setPosition('x', v));
bindNumber(field.y, (v) => setPosition('y', v));
bindNumber(field.rotation, (v) => setPart('seR', v));
bindNumber(field.scale, (v) => setPart('seS', v === null ? null : v / 100));
bindNumber(field.opacity, (v) => setOpacity(v === null ? null : v / 100));
bindScrub($('sX'), 'x');
bindScrub($('sY'), 'y');
bindDial($('dial'));

listen(slider.scale, 'input', () => setPart('seS', slider.scale.value / 100));
listen(slider.opacity, 'input', () => setOpacity(slider.opacity.value / 100));
listen(slider.scale, 'change', commitNow);
listen(slider.opacity, 'change', commitNow);
listen($('rotL'), 'click', () => rotateBy(-90));
listen($('rotR'), 'click', () => rotateBy(90));
listen(field.fill, 'change', () => {
  const hex = parseHex(field.fill.value);
  if (hex) {
    setFill(hex);
    commitNow();
  } else {
    toast('Invalid color. Use #rrggbb.');
    renderProps();
  }
});

onRender(renderProps);
