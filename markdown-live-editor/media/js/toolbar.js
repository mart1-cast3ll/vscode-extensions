import { state, vscode } from './state.js';
import { $, toast } from './util.js';
import { listen } from './errors.js';
import { ACTIONS, SNIPPETS } from './format.js';
import { flushPending } from './document.js';
import { commitEdit, editNew } from './block-editor.js';
import { showSource } from './source-pane.js';
import { showOutline } from './outline.js';

const toolbar = $('toolbar');

function activeTextarea() {
  const el = document.activeElement;
  if (el && el.tagName === 'TEXTAREA') return el;
  return state.lastTextarea && state.lastTextarea.isConnected ? state.lastTextarea : null;
}

export function runFormat(action) {
  const ta = activeTextarea();
  if (ta) {
    ACTIONS[action](ta);
    return;
  }
  const snippet = SNIPPETS[action];
  if (!snippet) {
    toast('Click a block to edit it, then apply the format.');
    return;
  }
  editNew(state.text.split('\n').length, snippet.text, snippet.select);
}

function toHost(type) {
  if (type !== 'source') commitEdit();
  flushPending();
  vscode.postMessage({ type });
}

const BUTTONS = {
  bUndo: () => toHost('undo'),
  bRedo: () => toHost('redo'),
  bSave: () => toHost('save'),
  bText: () => toHost('source'),
  bSource: () => showSource(),
  bOutline: () => showOutline(),
};

for (const [id, action] of Object.entries(BUTTONS)) listen($(id), 'click', action);

// Keep the focus in the textarea being edited while a toolbar button is pressed.
listen(toolbar, 'mousedown', (e) => {
  if (e.target.closest('button')) e.preventDefault();
});
listen(toolbar, 'click', (e) => {
  const button = e.target.closest('button[data-format]');
  if (button) runFormat(button.dataset.format);
});
