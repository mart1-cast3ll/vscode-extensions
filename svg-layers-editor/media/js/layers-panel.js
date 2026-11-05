import { root, state } from './state.js';
import { $ } from './util.js';
import { guard, listen } from './errors.js';
import { ICONS, kindIcon } from './icons.js';
import { isGroup, layerChildren, layerParent, nameOf } from './layers.js';
import { select } from './selection.js';
import { changed } from './document.js';
import { moveLayers } from './hierarchy.js';
import { drawOverlay } from './overlay.js';
import { onRender } from './render.js';

const list = $('layers');
const DROP_CLASSES = ['drop-before', 'drop-after', 'drop-in'];

function clearDrop() {
  list.querySelectorAll('.drop-before,.drop-after,.drop-in').forEach((r) => r.classList.remove(...DROP_CLASSES));
}

function dropZone(e, row, el) {
  const items = state.layerDrag;
  if (!items || items.some((d) => d === el || d.contains(el))) return null;
  const r = row.getBoundingClientRect();
  const f = (e.clientY - r.top) / r.height;
  if (isGroup(el) && f > 0.28 && f < 0.72) return 'in';
  return f < 0.5 ? 'before' : 'after';
}

function startRename(el, row) {
  const name = row.querySelector('.name');
  const input = document.createElement('input');
  input.className = 'rename';
  input.value = nameOf(el);
  row.replaceChild(input, name);
  row.draggable = false;
  input.focus();
  input.select();
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    const value = input.value.trim();
    if (save && value && value !== nameOf(el)) {
      el.setAttribute('data-name', value);
      changed();
    } else {
      renderLayers();
    }
  };
  input.onkeydown = (k) => {
    k.stopPropagation();
    if (k.key === 'Enter') finish(true);
    if (k.key === 'Escape') finish(false);
  };
  input.onblur = () => finish(true);
  input.onclick = (k) => k.stopPropagation();
}

export function renameSelected() {
  const row = list.querySelector('.row.sel');
  if (row && state.selection.length === 1) startRename(state.selection[0], row);
}

function button(className, html, title, onClick) {
  const b = document.createElement('button');
  b.className = className;
  b.innerHTML = html;
  b.title = title;
  b.tabIndex = -1;
  b.onclick = guard((e) => {
    e.stopPropagation();
    onClick();
  }, title);
  return b;
}

function toggleOpen(el, open) {
  if (open) {
    state.collapsed.add(el);
    state.expanded.delete(el);
  } else {
    state.collapsed.delete(el);
    state.expanded.add(el);
  }
  renderLayers();
}

function onRowClick(e, el) {
  const { selection } = state;
  if (e.shiftKey && selection.length && layerParent(selection[0]) === layerParent(el)) {
    const next = selection.includes(el) ? selection.filter((x) => x !== el) : selection.concat(el);
    select(next, true);
  } else {
    state.context = layerParent(el);
    select([el], true);
  }
}

function bindDrag(row, el) {
  row.ondragstart = (e) => {
    state.layerDrag = state.selection.includes(el) ? state.selection.slice() : [el];
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', nameOf(el));
    row.classList.add('dragging');
  };
  row.ondragover = (e) => {
    const zone = dropZone(e, row, el);
    clearDrop();
    if (!zone) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    row.classList.add(`drop-${zone}`);
  };
  row.ondragleave = () => row.classList.remove(...DROP_CLASSES);
  row.ondrop = guard((e) => {
    const zone = dropZone(e, row, el);
    const items = state.layerDrag;
    e.preventDefault();
    clearDrop();
    state.layerDrag = null;
    if (zone && items) moveLayers(items, el, zone);
  }, 'drop');
  row.ondragend = () => {
    state.layerDrag = null;
    clearDrop();
    row.classList.remove('dragging');
  };
}

function buildRow(el, kids, open) {
  const hidden = el.getAttribute('display') === 'none';
  const row = document.createElement('div');
  row.className = 'row';
  row.classList.toggle('sel', state.selection.includes(el));
  row.classList.toggle('ctx', el === state.context);
  row.classList.toggle('hidden', hidden);
  row.tabIndex = 0;
  row.draggable = true;
  row.setAttribute('role', 'treeitem');
  if (kids.length) row.setAttribute('aria-expanded', String(open));

  const twisty = button(`tw${kids.length ? (open ? '' : ' closed') : ' none'}`, ICONS.chevron, 'Expand or collapse', () => toggleOpen(el, open));
  const kind = document.createElement('span');
  kind.className = 'ico';
  kind.innerHTML = kindIcon(el.localName);
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = nameOf(el);
  name.title = `${nameOf(el)}  <${el.localName}>`;
  const rename = button('act', ICONS.pen, 'Rename', () => startRename(el, row));
  const eye = button('act eye', hidden ? ICONS.eyeOff : ICONS.eye, hidden ? 'Show' : 'Hide', () => {
    if (hidden) el.removeAttribute('display');
    else el.setAttribute('display', 'none');
    changed();
  });
  row.append(twisty, kind, name, rename, eye);

  row.onclick = guard((e) => onRowClick(e, el), 'layers');
  row.ondblclick = guard((e) => {
    e.stopPropagation();
    startRename(el, row);
  }, 'rename');
  row.onmouseenter = () => {
    state.hover = el;
    drawOverlay();
  };
  row.onmouseleave = () => {
    if (state.hover !== el) return;
    state.hover = null;
    drawOverlay();
  };
  row.onkeydown = guard((k) => {
    if (k.target !== row) return;
    if (k.key === 'Enter' || k.key === ' ') {
      k.preventDefault();
      onRowClick(k, el);
    } else if (k.key === 'F2') {
      k.preventDefault();
      startRename(el, row);
    }
  }, 'layers');
  bindDrag(row, el);
  return row;
}

function build(parent, into) {
  const focus = state.selection.concat(state.context === root ? [] : [state.context]);
  for (const el of layerChildren(parent).reverse()) {
    const kids = layerChildren(el);
    const containsFocus = focus.some((x) => x !== el && el.contains(x));
    const open = kids.length > 0 && !state.collapsed.has(el) && (state.expanded.has(el) || containsFocus);
    into.appendChild(buildRow(el, kids, open));
    if (open) {
      const group = document.createElement('div');
      group.className = 'kids';
      group.setAttribute('role', 'group');
      into.appendChild(group);
      build(el, group);
    }
  }
}

export function renderLayers() {
  list.replaceChildren();
  if (state.srcDoc) build(root, list);
}

listen(list, 'dragover', (e) => {
  if (state.layerDrag && e.target === list) {
    e.preventDefault();
    clearDrop();
  }
});
listen(list, 'drop', (e) => {
  if (!state.layerDrag || e.target !== list) return;
  e.preventDefault();
  const items = state.layerDrag;
  state.layerDrag = null;
  const last = layerChildren(root).pop();
  if (last && !items.includes(last)) moveLayers(items, last, 'before');
});

onRender(renderLayers);
