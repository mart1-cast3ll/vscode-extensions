import { state, vscode } from './state.js';
import { $, toast } from './util.js';
import { listen } from './errors.js';
import { load } from './document.js';
import './preview.js';
import './outline.js';
import './toolbar.js';
import './keyboard.js';

const handlers = {
  load(message) {
    if (typeof message.text !== 'string') return;
    state.docName = message.name || state.docName;
    state.baseUri = message.baseUri || '';
    $('docName').textContent = state.docName;
    load(message.text);
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
