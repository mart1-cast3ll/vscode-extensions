import { state, vscode } from './state.js';
import { $, toast } from './util.js';
import { listen } from './errors.js';
import { load, cancelPendingCommit } from './document.js';
import { closePicker } from './color-picker.js';
import './pointer.js';
import './props.js';
import './layers-panel.js';
import './toolbar.js';
import './keyboard.js';
import './file-drop.js';

const handlers = {
  load(message) {
    if (typeof message.text !== 'string') return;
    cancelPendingCommit();
    if (message.name) state.docName = message.name;
    closePicker();
    load(message.text, !!message.keep);
  },
  dirty(message) {
    $('bSave').classList.toggle('dirty', !!message.value);
  },
  toast(message) {
    if (message.text) toast(message.text);
  },
};

listen(window, 'message', (event) => {
  const message = event.data;
  const handler = message && handlers[message.type];
  if (handler) handler(message);
});

vscode.postMessage({ type: 'ready' });
