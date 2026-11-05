import { listen } from './errors.js';
import { continueList, indent } from './format.js';
import { cancelEdit, commitEdit } from './block-editor.js';
import { runFormat } from './toolbar.js';

const SHORTCUTS = { b: 'bold', i: 'italic', k: 'link', e: 'code' };

function handle(e, ta) {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  const inBlock = ta.classList.contains('block-input');

  if (mod && e.shiftKey && key === 'x') runFormat('strike');
  else if (mod && !e.shiftKey && SHORTCUTS[key]) runFormat(SHORTCUTS[key]);
  else if (mod && key === 'enter' && inBlock) commitEdit();
  else if (key === 'escape' && inBlock) cancelEdit();
  else if (key === 'tab' && !mod) indent(ta, e.shiftKey);
  else if (key === 'enter' && !mod && !e.shiftKey && !e.altKey) return continueList(ta);
  else return false;
  return true;
}

// Captured and stopped so VS Code does not also run its own binding (Ctrl+B = sidebar, Ctrl+K chords, ...).
listen(window, 'keydown', (e) => {
  if (e.target.tagName !== 'TEXTAREA' || e.isComposing) return;
  if (!handle(e, e.target)) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}, true);
