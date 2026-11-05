import { NS, svg, overlay, root, state } from './state.js';
import { pt, cornersOf, screenUnit } from './geometry.js';
import { fitBox } from './bounds.js';
import { onRender } from './render.js';

const ACCENT = '#1cb0f6';

// Styles go inline so the document's own CSS cannot restyle the handles.
function make(tag, attrs, style) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (style) n.setAttribute('style', style);
  overlay.appendChild(n);
  return n;
}

const points = (q) => q.map((p) => `${p.x},${p.y}`).join(' ');

function drawBounds(k) {
  if (!state.drag || !state.frame) state.frame = fitBox();
  const f = state.frame;
  make('rect', { x: f.x, y: f.y, width: f.w, height: f.h },
    `fill:none;stroke:rgba(40,44,52,.55);stroke-width:${k};stroke-dasharray:${5 * k} ${4 * k};pointer-events:none`);
  const label = make('text', { x: f.x, y: f.y - 6 * k },
    `fill:rgba(40,44,52,.75);font:600 ${11 * k}px Segoe UI,system-ui,sans-serif;pointer-events:none;user-select:none`);
  label.textContent = `Image · ${Math.round(f.w)} × ${Math.round(f.h)}`;
}

function drawHandles(el, k) {
  const q = cornersOf(el);
  const top = pt((q[0].x + q[1].x) / 2, (q[0].y + q[1].y) / 2);
  const center = pt((q[0].x + q[2].x) / 2, (q[0].y + q[2].y) / 2);
  let dx = top.x - center.x;
  let dy = top.y - center.y;
  let len = Math.hypot(dx, dy);
  if (len < 1e-6) [dx, dy, len] = [0, -1, 1];
  const knob = pt(top.x + (dx / len) * 26 * k, top.y + (dy / len) * 26 * k);

  make('line', { x1: top.x, y1: top.y, x2: knob.x, y2: knob.y },
    `stroke:${ACCENT};stroke-width:${2 * k};pointer-events:none`);
  make('circle', { cx: knob.x, cy: knob.y, r: 7 * k, 'data-h': 'rotate' },
    `fill:#fff;stroke:${ACCENT};stroke-width:${2.5 * k};cursor:grab`);
  q.forEach((p, i) => {
    make('rect', { x: p.x - 6 * k, y: p.y - 6 * k, width: 12 * k, height: 12 * k, rx: 3 * k, 'data-h': 'scale' },
      `fill:#fff;stroke:${ACCENT};stroke-width:${2.5 * k};cursor:${i % 2 ? 'nesw-resize' : 'nwse-resize'}`);
  });
}

export function drawOverlay() {
  overlay.replaceChildren();
  if (!state.srcDoc || state.broken || !svg.getScreenCTM()) return;
  const k = screenUnit();
  const { context, hover, selection } = state;

  if (state.ui.bounds) drawBounds(k);
  if (context !== root && context.isConnected) {
    make('polygon', { points: points(cornersOf(context)) },
      `fill:none;stroke:#9a9a9a;stroke-width:${1.5 * k};stroke-dasharray:${6 * k} ${5 * k};pointer-events:none`);
  }
  if (hover && hover.isConnected && !selection.includes(hover)) {
    make('polygon', { points: points(cornersOf(hover)) },
      `fill:none;stroke:#84d8ff;stroke-width:${2 * k};pointer-events:none`);
  }
  for (const el of selection) {
    if (!el.isConnected) continue;
    make('polygon', { points: points(cornersOf(el)), 'data-h': 'move' },
      `fill:rgba(28,176,246,0.06);stroke:${ACCENT};stroke-width:${2 * k};cursor:move`);
  }
  if (selection.length === 1 && selection[0].isConnected) drawHandles(selection[0], k);
}

export function hitTest(e) {
  overlay.style.display = 'none';
  const under = document.elementFromPoint(e.clientX, e.clientY);
  overlay.style.display = '';
  return under;
}

onRender(drawOverlay);
