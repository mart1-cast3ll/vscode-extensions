import { svg, state } from './state.js';
import { $, clamp } from './util.js';
import { guard, listen } from './errors.js';
import { clientToRoot } from './geometry.js';
import { fitBox } from './bounds.js';
import { drawOverlay } from './overlay.js';

export function setView() {
  const v = state.view;
  svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
  drawOverlay();
}

export function fitView() {
  const f = fitBox();
  const pad = Math.max(f.w, f.h) * 0.06;
  state.view = { x: f.x - pad, y: f.y - pad, w: f.w + pad * 2, h: f.h + pad * 2 };
  setView();
}

function zoom(e) {
  if (!state.view || !svg.getScreenCTM()) return;
  e.preventDefault();
  const p = clientToRoot(e);
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  const size = Math.max(state.vb.w, state.vb.h);
  const v = state.view;
  const width = clamp(v.w * Math.exp(dy * 0.0015), size * 0.02, size * 20);
  const f = width / v.w;
  state.view = { x: p.x - (p.x - v.x) * f, y: p.y - (p.y - v.y) * f, w: v.w * f, h: v.h * f };
  setView();
}

listen(svg, 'wheel', zoom, { passive: false });

if (window.ResizeObserver) {
  new ResizeObserver(guard(drawOverlay, 'resize')).observe($('stageWrap'));
}
