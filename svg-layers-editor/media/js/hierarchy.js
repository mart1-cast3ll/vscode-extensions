import { NS, root, state } from './state.js';
import {
  isLayer, isLayerTag, isGroup, isMetadata, layerParent, layerChildren, documentOrder,
} from './layers.js';
import { matrixOf, matrixStr, isIdentity } from './geometry.js';
import { resetTransform } from './transform.js';
import { changed } from './document.js';
import { clamp, round, toast } from './util.js';

const INHERITED = [
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit', 'color', 'font-family',
  'font-size', 'font-weight', 'font-style', 'text-anchor', 'visibility', 'clip-rule', 'paint-order',
];
const EFFECTS_LOST = 'The source group’s clip, mask or filter no longer applies';

function effectiveOpacity(n) {
  let opacity = 1;
  for (let x = n; x && x !== root && x.nodeType === 1; x = x.parentNode) {
    const v = parseFloat(getComputedStyle(x).opacity);
    if (Number.isFinite(v)) opacity *= v;
  }
  return opacity;
}

function losesEffects(from, to) {
  for (let x = from; x && x !== root && !x.contains(to); x = x.parentNode) {
    if (x.hasAttribute('clip-path') || x.hasAttribute('mask') || x.hasAttribute('filter')) return true;
  }
  return false;
}

const isEmptyGroup = (g) => [...g.children].every(isMetadata);

function keepOpacity(el, before, parent) {
  const after = effectiveOpacity(parent);
  if (after <= 0 || Math.abs(before - after) < 1e-6) return;
  const own = el.hasAttribute('opacity') ? +el.getAttribute('opacity') : 1;
  const value = (own * before) / after;
  if (Math.abs(value - 1) < 1e-6) el.removeAttribute('opacity');
  else el.setAttribute('opacity', round(clamp(value, 0, 1)));
}

// Moves an element into another group while keeping its position, inherited paint and opacity.
export function reparent(el, parent, before = null) {
  const oldParent = el.parentNode;
  if (oldParent === parent) {
    parent.insertBefore(el, before);
    return;
  }
  const oldMatrix = oldParent.getScreenCTM();
  const oldOpacity = effectiveOpacity(oldParent);
  const style = getComputedStyle(el);
  const paint = Object.fromEntries(INHERITED.map((p) => [p, style.getPropertyValue(p)]));
  const own = el.getAttribute('transform') || '';
  const lifting = oldParent.parentNode === parent;
  const parentTransform = oldParent.getAttribute('transform') || '';

  parent.insertBefore(el, before);

  const now = getComputedStyle(el);
  for (const p of INHERITED) {
    if (now.getPropertyValue(p) !== paint[p]) el.style.setProperty(p, paint[p]);
  }
  keepOpacity(el, oldOpacity, parent);

  let base = own;
  const newMatrix = parent.getScreenCTM();
  if (lifting) {
    base = `${parentTransform} ${own}`;
  } else if (oldMatrix && newMatrix) {
    const delta = newMatrix.inverse().multiply(oldMatrix);
    if (!isIdentity(delta)) base = matrixStr(delta.multiply(matrixOf(own)));
  }
  resetTransform(el, base);
}

const sameParent = () =>
  state.selection.length > 0 && state.selection.every((el) => el.parentNode === state.selection[0].parentNode);

export const canGroup = () => state.selection.length > 1 && sameParent();
export const canUngroup = () =>
  state.selection.length === 1 && isGroup(state.selection[0]) && layerChildren(state.selection[0]).length > 0;
export const canLift = () => sameParent() && state.selection[0].parentNode !== root;

export function group() {
  if (!canGroup()) return;
  const items = documentOrder(state.selection);
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('data-name', `Group ${root.querySelectorAll('g[data-name^="Group"]').length + 1}`);
  items[0].parentNode.insertBefore(g, items[items.length - 1].nextSibling);
  items.forEach((el) => g.appendChild(el));
  state.context = layerParent(g);
  state.selection = [g];
  changed();
  toast('Grouped');
}

export function ungroup() {
  if (!canUngroup()) return;
  const g = state.selection[0];
  const parent = g.parentNode;
  const lost = losesEffects(g, parent);
  const moved = [];
  for (const child of [...g.children]) {
    if (isMetadata(child)) continue;
    if (isLayerTag(child)) {
      reparent(child, parent, g);
      moved.push(child);
    } else {
      parent.insertBefore(child, g);
    }
  }
  g.remove();
  state.context = layerParent(moved[0]);
  state.selection = moved;
  changed();
  toast(lost ? `Ungrouped. ${EFFECTS_LOST}.` : 'Ungrouped');
}

export function lift() {
  if (!canLift()) return;
  const g = state.selection[0].parentNode;
  const parent = g.parentNode;
  const next = g.nextSibling;
  const items = documentOrder(state.selection);
  const lost = losesEffects(g, parent);
  items.forEach((el) => reparent(el, parent, next));
  if (isEmptyGroup(g)) g.remove();
  state.context = layerParent(items[0]);
  state.selection = items;
  changed();
  toast(lost ? `Moved out of group. ${EFFECTS_LOST}.` : 'Moved out of group');
}

// zone: 'in' = last child of target, 'before' = in front of target, 'after' = behind target.
export function moveLayers(items, target, zone) {
  const parent = zone === 'in' ? target : target.parentNode;
  const next = zone === 'in' ? null : zone === 'before' ? target.nextSibling : target;
  let lost = false;
  for (const el of documentOrder(items)) {
    const oldParent = el.parentNode;
    if (oldParent !== parent && losesEffects(oldParent, parent)) lost = true;
    reparent(el, parent, next);
    if (oldParent !== root && oldParent !== parent && isLayer(oldParent) && isEmptyGroup(oldParent)) oldParent.remove();
  }
  if (zone === 'in') {
    state.collapsed.delete(target);
    state.expanded.add(target);
  }
  state.context = layerParent(items[0]);
  state.selection = items.filter((x) => x.isConnected);
  changed();
  if (lost) toast(EFFECTS_LOST);
}
