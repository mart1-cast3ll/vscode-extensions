import { state } from './state.js';
import { parseBlocks } from './md/blocks.js';

const renderers = [];

export function onRender(fn) {
  renderers.push(fn);
}

// origin: 'host' (document reloaded), 'source' (typed in the source pane) or 'edit' (preview edit).
export function renderAll(origin = 'edit') {
  state.lines = state.text.split('\n');
  state.blocks = parseBlocks(state.lines);
  for (const fn of renderers) fn(origin);
}
