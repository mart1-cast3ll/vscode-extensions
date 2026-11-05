import { svg, root, state } from './state.js';
import { clientTo, clientToRoot, rootMatrix, pt, screenUnit } from './geometry.js';
import { chainOf, layerChildren, layerParent } from './layers.js';
import { pickAt, select } from './selection.js';
import { transformOf, pivotOf, applyTransform, setTransformPart } from './transform.js';
import { changed } from './document.js';
import { setView } from './view.js';
import { drawOverlay, hitTest } from './overlay.js';
import { renderProps } from './props.js';
import { listen } from './errors.js';
import { round } from './util.js';

const DOUBLE_CLICK_MS = 350;
const DRAG_THRESHOLD = 3;
let lastDown = { time: 0, x: 0, y: 0 };

function isDoubleClick(e) {
  const now = Date.now();
  const double = now - lastDown.time < DOUBLE_CLICK_MS && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 8;
  lastDown = { time: double ? 0 : now, x: e.clientX, y: e.clientY };
  return double;
}

function startPan(e, onClick = null) {
  const { x, y } = state.view;
  state.drag = { kind: 'pan', moved: false, sx: e.clientX, sy: e.clientY, x, y, unit: screenUnit(), onClick };
}

function startMove(e) {
  const items = state.selection.map((el) => {
    const t = transformOf(el);
    return { el, tx: t.tx, ty: t.ty, start: clientTo(el.parentNode, e) };
  });
  state.drag = { kind: 'move', moved: false, sx: e.clientX, sy: e.clientY, items };
}

function startTransform(e, kind) {
  const el = state.selection[0];
  const t = transformOf(el);
  const pivot = pivotOf(el, t.r === 0 && t.s === 1);
  const center = pt(pivot.x, pivot.y).matrixTransform(rootMatrix(el.parentNode));
  const p = clientToRoot(e);
  state.drag = {
    kind, el, moved: false, sx: e.clientX, sy: e.clientY, r0: t.r, s0: t.s, center,
    angle0: Math.atan2(p.y - center.y, p.x - center.x),
    dist0: Math.hypot(p.x - center.x, p.y - center.y) || 1,
  };
}

function enterGroup(e, under) {
  const chain = chainOf(under);
  if (!chain || !chain.includes(state.selection[0])) return false;
  state.context = state.selection[0];
  const pick = pickAt(under);
  select(pick && pick.el ? [pick.el] : [], true);
  if (state.selection.length) startMove(e);
  return true;
}

function toggleInSelection(el) {
  const list = state.selection.slice();
  const index = list.indexOf(el);
  if (index >= 0) list.splice(index, 1);
  else if (list.length && layerParent(list[0]) !== layerParent(el)) list.splice(0, list.length, el);
  else list.push(el);
  select(list, true);
}

function onPointerDown(e) {
  if (!state.srcDoc || state.broken) return;
  if (e.button === 1) {
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    startPan(e);
    return;
  }
  if (e.button !== 0) return;
  svg.setPointerCapture(e.pointerId);
  const double = isDoubleClick(e);
  const handle = e.target.getAttribute && e.target.getAttribute('data-h');
  if (handle === 'rotate' || handle === 'scale') return startTransform(e, handle);

  const under = hitTest(e);
  const one = state.selection.length === 1 ? state.selection[0] : null;
  if (double && one && layerChildren(one).length && enterGroup(e, under)) return;

  let pick = pickAt(under);
  if (pick && pick.exit) {
    state.context = root;
    pick = pickAt(under);
  }
  if (!pick || !pick.el) {
    if (handle === 'move' && state.selection.length) return startMove(e);
    return startPan(e, () => {
      if (!state.selection.length && state.context !== root) state.context = layerParent(state.context);
      select([], true);
    });
  }
  if (e.shiftKey) return toggleInSelection(pick.el);
  if (!state.selection.includes(pick.el)) select([pick.el], true);
  startMove(e);
}

function updateHover(e) {
  const pick = pickAt(hitTest(e));
  const hover = pick && pick.el ? pick.el : null;
  if (hover === state.hover) return;
  state.hover = hover;
  svg.style.cursor = hover ? 'move' : '';
  drawOverlay();
}

function dragTo(e) {
  const d = state.drag;
  if (d.kind === 'pan') {
    svg.style.cursor = 'grabbing';
    state.view.x = d.x - (e.clientX - d.sx) * d.unit;
    state.view.y = d.y - (e.clientY - d.sy) * d.unit;
    setView();
    return;
  }
  if (d.kind === 'move') {
    for (const it of d.items) {
      const p = clientTo(it.el.parentNode, e);
      it.el.dataset.seTx = round(it.tx + p.x - it.start.x);
      it.el.dataset.seTy = round(it.ty + p.y - it.start.y);
      applyTransform(it.el);
    }
  } else {
    const p = clientToRoot(e);
    if (d.kind === 'rotate') {
      let r = d.r0 + ((Math.atan2(p.y - d.center.y, p.x - d.center.x) - d.angle0) * 180) / Math.PI;
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      setTransformPart(d.el, 'seR', r);
    } else {
      setTransformPart(d.el, 'seS', (d.s0 * Math.hypot(p.x - d.center.x, p.y - d.center.y)) / d.dist0);
    }
  }
  drawOverlay();
  renderProps();
}

function onPointerMove(e) {
  if (!state.srcDoc || state.broken) return;
  const d = state.drag;
  if (!d) return updateHover(e);
  if (!d.moved) {
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < DRAG_THRESHOLD) return;
    d.moved = true;
  }
  dragTo(e);
}

function onPointerUp() {
  const d = state.drag;
  if (!d) return;
  state.drag = null;
  if (d.kind === 'pan') {
    svg.style.cursor = '';
    if (!d.moved && d.onClick) d.onClick();
  } else if (d.moved) {
    changed();
  }
}

listen(svg, 'pointerdown', onPointerDown);
listen(svg, 'pointermove', onPointerMove);
listen(svg, 'pointerup', onPointerUp);
listen(svg, 'pointercancel', onPointerUp);
listen(svg, 'pointerleave', () => {
  if (state.drag || !state.hover) return;
  state.hover = null;
  drawOverlay();
});
