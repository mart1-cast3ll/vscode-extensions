import { root, state } from './state.js';
import { $ } from './util.js';
import { listen } from './errors.js';
import { layerChildren, layerParent } from './layers.js';
import { select } from './selection.js';
import { group, lift, ungroup } from './hierarchy.js';
import { deleteSelection, duplicate, nudge, reorder } from './edit.js';
import { renameSelected } from './layers-panel.js';
import { closePicker, isPickerOpen } from './color-picker.js';

const ARROWS = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };

function escape() {
  const { selection, context } = state;
  if (selection.length && context !== root) {
    state.context = layerParent(context);
    select([context], true);
  } else if (selection.length) {
    select([], true);
  } else if (context !== root) {
    state.context = layerParent(context);
    select([], true);
  } else {
    return false;
  }
  return true;
}

function enterGroup(e) {
  const one = state.selection.length === 1 ? state.selection[0] : null;
  if (!one || !layerChildren(one).length || e.target !== document.body) return false;
  state.context = one;
  select([layerChildren(one)[0]], true);
  return true;
}

function withModifier(e, key) {
  if (key === 'g') e.shiftKey ? ungroup() : group();
  else if (key === 'l' && e.shiftKey) lift();
  else if (key === 'd') duplicate();
  else if (key === 'a' && !$('codePre').contains(e.target)) select(layerChildren(state.context), true);
  else return false;
  return true;
}

function plain(e, key) {
  const hasSelection = state.selection.length > 0;
  if (key === 'delete' || key === 'backspace') {
    if (!hasSelection) return false;
    deleteSelection();
  } else if (key === ']') reorder(1);
  else if (key === '[') reorder(-1);
  else if (key === 'f2') renameSelected();
  else if (key === 'escape') return escape();
  else if (key === 'enter') return enterGroup(e);
  else if (ARROWS[key] && hasSelection && !e.target.closest('.layers')) {
    const step = e.shiftKey ? 10 : 1;
    nudge(ARROWS[key][0] * step, ARROWS[key][1] * step);
  } else return false;
  return true;
}

// Captured and stopped so VS Code does not also run its own binding (Ctrl+G = Go to Line, ...).
// Ctrl+Z / Ctrl+Y / Ctrl+S are left to VS Code, which owns the document history.
listen(window, 'keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const key = e.key.toLowerCase();
  let handled;
  if (key === 'escape' && isPickerOpen()) {
    closePicker();
    handled = true;
  } else if (!state.srcDoc || state.broken) {
    handled = false;
  } else {
    handled = e.ctrlKey || e.metaKey ? withModifier(e, key) : plain(e, key);
  }
  if (!handled) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}, true);
