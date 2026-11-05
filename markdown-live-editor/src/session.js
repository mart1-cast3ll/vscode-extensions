'use strict';
const vscode = require('vscode');
const path = require('path');
const { VIEW_TYPE } = require('./constants');
const { write, fail } = require('./log');

const normalizeEol = (text) => text.replace(/\r\n/g, '\n');

const ERRORS = {
  edit: 'Could not apply the change',
  save: 'Could not save the file',
  source: 'Could not open the source',
  openLink: 'Could not open the link',
  undo: 'Could not undo',
  redo: 'Could not redo',
};

// Connects one Markdown TextDocument with one webview. The webview sends the full text
// after each edit; changes made elsewhere (undo, text editor, git) are pushed back.
class EditorSession {
  constructor(document, panel) {
    this.document = document;
    this.panel = panel;
    this.shown = null;
    this.dirty = null;
    this.disposed = false;

    const subscriptions = [
      vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChange(e)),
      vscode.workspace.onDidSaveTextDocument((d) => this.isOwn(d) && this.syncDirty()),
      panel.webview.onDidReceiveMessage((m) => this.dispatch(m)),
    ];
    const timer = setInterval(() => this.syncDirty(), 400);
    panel.onDidDispose(() => {
      this.disposed = true;
      clearInterval(timer);
      subscriptions.forEach((s) => s.dispose());
    });
  }

  isOwn(doc) {
    return doc.uri.toString() === this.document.uri.toString();
  }

  folder() {
    const { uri } = this.document;
    if (uri.scheme === 'file') return vscode.Uri.joinPath(uri, '..');
    return (vscode.workspace.workspaceFolders || [])[0]?.uri;
  }

  post(message) {
    if (this.disposed) return;
    this.panel.webview.postMessage(message).then(undefined, (error) => write('Could not message the webview', error));
  }

  send() {
    const text = this.document.getText();
    this.shown = normalizeEol(text);
    const folder = this.folder();
    this.post({
      type: 'load',
      text,
      name: path.basename(this.document.uri.path),
      baseUri: folder ? `${this.panel.webview.asWebviewUri(folder).toString()}/` : '',
    });
  }

  syncDirty() {
    if (this.document.isDirty === this.dirty) return;
    this.dirty = this.document.isDirty;
    this.post({ type: 'dirty', value: this.dirty });
  }

  onDocumentChange(e) {
    if (!this.isOwn(e.document) || !e.contentChanges.length) return;
    if (normalizeEol(this.document.getText()) !== this.shown) this.send();
  }

  async dispatch(message) {
    if (!message || typeof message.type !== 'string') return;
    const handler = this.handlers[message.type];
    if (!handler) return;
    try {
      await handler.call(this, message);
    } catch (error) {
      fail(ERRORS[message.type] || 'Editor error', error);
      if (message.type === 'edit') this.send();
    }
  }
}

EditorSession.prototype.handlers = {
  ready() {
    this.send();
  },

  async edit({ text }) {
    if (typeof text !== 'string') return;
    this.shown = normalizeEol(text);
    if (this.shown === normalizeEol(this.document.getText())) return;
    const edit = new vscode.WorkspaceEdit();
    const all = new vscode.Range(this.document.positionAt(0), this.document.positionAt(this.document.getText().length));
    edit.replace(this.document.uri, all, text);
    if (await vscode.workspace.applyEdit(edit)) return;
    vscode.window.showWarningMessage('This file cannot be modified (read-only?). The change was discarded.');
    this.send();
  },

  undo() {
    return vscode.commands.executeCommand('undo');
  },

  redo() {
    return vscode.commands.executeCommand('redo');
  },

  async save() {
    const saved = await vscode.workspace.save(this.document.uri);
    this.syncDirty();
    if (saved) this.post({ type: 'toast', text: `Saved ${path.basename(saved.path)}` });
  },

  source() {
    return vscode.commands.executeCommand('vscode.openWith', this.document.uri, 'default', vscode.ViewColumn.Beside);
  },

  async openLink({ href }) {
    const link = String(href || '');
    if (/^(https?|mailto):/i.test(link)) return vscode.env.openExternal(vscode.Uri.parse(link));
    const folder = this.folder();
    const file = decodeURIComponent(link.split('#')[0]);
    if (!folder || !file) return undefined;
    const target = vscode.Uri.joinPath(folder, file);
    if (/\.(md|markdown)$/i.test(target.path)) return vscode.commands.executeCommand('vscode.openWith', target, VIEW_TYPE);
    return vscode.commands.executeCommand('vscode.open', target);
  },

  log({ message, stack }) {
    write(`Webview: ${message}`, stack);
  },
};

module.exports = { EditorSession };
