import { root, state, vscode, saveUi } from './state.js';
import { $ } from './util.js';
import { guard, listen } from './errors.js';
import { layerParent, nameOf } from './layers.js';
import { select } from './selection.js';
import { canGroup, canLift, canUngroup, group, lift, ungroup } from './hierarchy.js';
import { deleteSelection, duplicate, reorder } from './edit.js';
import { fitView } from './view.js';
import { showCode } from './code-panel.js';
import { flush } from './document.js';
import { exportPng } from './png.js';
import { drawOverlay } from './overlay.js';
import { onRender } from './render.js';

const toHost = (type) => () => {
  flush();
  vscode.postMessage({ type });
};

const BUTTONS = {
  bOpen: toHost('open'),
  bSave: toHost('save'),
  bDownload: toHost('download'),
  bUndo: toHost('undo'),
  bRedo: toHost('redo'),
  bGroup: group,
  bUngroup: ungroup,
  bLift: lift,
  bFront: () => reorder(1),
  bBack: () => reorder(-1),
  bDup: duplicate,
  bDel: deleteSelection,
  bFit: () => state.srcDoc && fitView(),
  bCode: () => showCode(),
  bText: toHost('source'),
  bPng: exportPng,
};

for (const [id, action] of Object.entries(BUTTONS)) listen($(id), 'click', action);

const boundsToggle = $('showBounds');
boundsToggle.checked = state.ui.bounds;
listen(boundsToggle, 'change', () => {
  state.ui.bounds = boundsToggle.checked;
  saveUi();
  drawOverlay();
});

function crumb(label, target) {
  const el = document.createElement(target === undefined ? 'span' : 'button');
  el.textContent = label;
  if (target === undefined) {
    el.className = 'cur';
  } else {
    el.onclick = guard(() => {
      state.context = target;
      select([], true);
    }, 'breadcrumb');
  }
  return el;
}

function renderCrumbs() {
  const chain = [];
  for (let n = state.context; n && n !== root; n = layerParent(n)) chain.unshift(n);
  const parts = [crumb(state.docName, chain.length ? root : undefined)];
  chain.forEach((g, i) => {
    parts.push(document.createTextNode('›'), crumb(nameOf(g), i === chain.length - 1 ? undefined : g));
  });
  $('crumbs').replaceChildren(...parts);
}

function refreshButtons() {
  const locked = state.broken;
  const none = !state.selection.length;
  const disabled = {
    bGroup: !canGroup(), bUngroup: !canUngroup(), bLift: !canLift(),
    bFront: none, bBack: none, bDup: none, bDel: none,
    bFit: !state.srcDoc, bPng: !state.srcDoc,
  };
  for (const [id, off] of Object.entries(disabled)) $(id).disabled = locked || off;
}

onRender(renderCrumbs);
onRender(refreshButtons);
