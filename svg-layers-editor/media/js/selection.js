import { root, state } from './state.js';
import { layerParent, chainOf } from './layers.js';
import { renderAll } from './render.js';

export function select(list, keepContext = false) {
  state.selection = list.filter(Boolean);
  for (const el of state.selection) {
    for (let p = layerParent(el); p !== root; p = layerParent(p)) state.collapsed.delete(p);
  }
  if (!keepContext && state.selection.length) state.context = layerParent(state.selection[0]);
  renderAll();
}

export function pickAt(target) {
  const chain = chainOf(target);
  if (!chain || !chain.length) return null;
  const { context } = state;
  const index = chain.indexOf(context);
  if (context !== root && index === -1) return { exit: true };
  const next = chain[(context === root ? -1 : index) + 1];
  return { el: next || chain[chain.length - 1] };
}
