import { state } from './state.js';
import { isLayer, nameOf, documentOrder } from './layers.js';
import { moveBy } from './transform.js';
import { changed, commit } from './document.js';
import { drawOverlay } from './overlay.js';
import { renderProps } from './props.js';

function siblingLayer(el, direction) {
  const step = (n) => (direction > 0 ? n.nextElementSibling : n.previousElementSibling);
  let n = step(el);
  while (n && !isLayer(n)) n = step(n);
  return n;
}

export function reorder(direction) {
  if (!state.selection.length) return;
  const items = documentOrder(state.selection);
  if (direction > 0) items.reverse();
  let moved = false;
  for (const el of items) {
    const sibling = siblingLayer(el, direction);
    if (!sibling || state.selection.includes(sibling)) continue;
    el.parentNode.insertBefore(el, direction > 0 ? sibling.nextSibling : sibling);
    moved = true;
  }
  if (moved) changed();
}

const URL_REF = /url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g;

// Gives copied ids a unique suffix and points url(#id) / href="#id" inside the copy at the new ids.
function renameIds(clone) {
  const nodes = [clone, ...clone.querySelectorAll('*')];
  const renamed = {};
  const taken = new Set();
  for (const n of nodes) {
    if (!n.id) continue;
    let i = 2;
    let id = `${n.id}-${i}`;
    while (document.getElementById(id) || taken.has(id)) id = `${n.id}-${++i}`;
    taken.add(id);
    renamed[n.id] = id;
    n.id = id;
  }
  if (!taken.size) return;
  for (const n of nodes) {
    for (const a of [...n.attributes]) {
      let value = a.value.replace(URL_REF, (m, q, id) => (renamed[id] ? `url(#${renamed[id]})` : m));
      if (a.localName === 'href' && value.startsWith('#') && renamed[value.slice(1)]) value = `#${renamed[value.slice(1)]}`;
      if (value !== a.value) a.value = value;
    }
  }
}

export function duplicate() {
  if (!state.selection.length) return;
  const offset = Math.max(state.vb.w, state.vb.h) * 0.03;
  state.selection = documentOrder(state.selection).map((el) => {
    const copy = el.cloneNode(true);
    renameIds(copy);
    copy.setAttribute('data-name', `${nameOf(el)} copy`);
    el.parentNode.insertBefore(copy, el.nextSibling);
    moveBy(copy, offset, offset);
    return copy;
  });
  changed();
}

export function deleteSelection() {
  if (!state.selection.length) return;
  state.selection.forEach((el) => el.remove());
  state.selection = [];
  state.hover = null;
  changed();
}

export function nudge(dx, dy) {
  if (!state.selection.length) return;
  const unit = Math.max(state.vb.w, state.vb.h) / 500;
  state.selection.forEach((el) => moveBy(el, dx * unit, dy * unit));
  drawOverlay();
  renderProps();
  commit(true);
}
