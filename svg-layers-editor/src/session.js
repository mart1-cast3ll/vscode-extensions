'use strict';
const vscode = require('vscode');
const path = require('path');
const { write, fail } = require('./log');
const { normalizeEol, openInEditor, pickAndOpen, openDropped } = require('./files');

const ERRORS = {
  edit: 'Could not apply the change',
  save: 'Could not save the SVG',
  download: 'Could not download the SVG',
  png: 'Could not save the PNG',
  source: 'Could not open the source',
  importText: 'Could not open the dropped SVG',
  openUri: 'Could not open the dropped SVG',
  undo: 'Could not undo',
  redo: 'Could not redo',
};

// Connects one TextDocument with one webview. The canvas sends the full SVG text after
// each edit; changes made elsewhere (undo, text editor, git) are pushed back to the canvas.
class EditorSession {
  constructor(document, panel) {
    this.document = document;
    this.panel = panel;
    this.shown = null;
    this.dirty = null;
    this.disposed = false;
    this.warnedReadOnly = false;

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

  post(message) {
    if (this.disposed) return;
    this.panel.webview.postMessage(message).then(undefined, (error) => write('Could not message the webview', error));
  }

  send(keep) {
    this.shown = normalizeEol(this.document.getText());
    this.post({ type: 'load', text: this.document.getText(), keep, name: path.basename(this.document.uri.path) });
  }

  syncDirty() {
    if (this.document.isDirty === this.dirty) return;
    this.dirty = this.document.isDirty;
    this.post({ type: 'dirty', value: this.dirty });
  }

  folder() {
    const { uri } = this.document;
    return uri.scheme === 'file' ? vscode.Uri.joinPath(uri, '..') : undefined;
  }

  isOwn(doc) {
    return doc.uri.toString() === this.document.uri.toString();
  }

  onDocumentChange(e) {
    if (!this.isOwn(e.document) || !e.contentChanges.length) return;
    if (normalizeEol(this.document.getText()) !== this.shown) this.send(true);
  }

  async dispatch(message) {
    if (!message || typeof message.type !== 'string') return;
    const handler = this.handlers[message.type];
    if (!handler) return;
    try {
      await handler.call(this, message);
    } catch (error) {
      fail(ERRORS[message.type] || 'Editor error', error);
      if (message.type === 'edit') this.send(true);
    }
  }
}

EditorSession.prototype.handlers = {
  ready() {
    this.send(false);
  },

  async edit({ text }) {
    if (typeof text !== 'string') return;
    this.shown = normalizeEol(text);
    if (this.shown === normalizeEol(this.document.getText())) return;
    const edit = new vscode.WorkspaceEdit();
    const all = new vscode.Range(this.document.positionAt(0), this.document.positionAt(this.document.getText().length));
    edit.replace(this.document.uri, all, text);
    if (await vscode.workspace.applyEdit(edit)) return;
    write(`Edit rejected for ${this.document.uri.toString()}`);
    if (!this.warnedReadOnly) {
      this.warnedReadOnly = true;
      vscode.window.showWarningMessage('This file cannot be modified (read-only?). Canvas changes were discarded.');
    }
    this.send(true);
  },

  undo() {
    return vscode.commands.executeCommand('undo');
  },

  redo() {
    return vscode.commands.executeCommand('redo');
  },

  open() {
    return pickAndOpen(this.folder());
  },

  openUri({ uri }) {
    const target = vscode.Uri.parse(String(uri));
    return /\.svg$/i.test(target.path) ? openInEditor(target) : undefined;
  },

  importText({ name, text }) {
    return typeof text === 'string' ? openDropped(name, text, this.folder()) : undefined;
  },

  async save() {
    const saved = await vscode.workspace.save(this.document.uri);
    this.syncDirty();
    if (saved) this.post({ type: 'toast', text: `Saved ${path.basename(saved.path)}` });
  },

  async download() {
    const base = path.basename(this.document.uri.path).replace(/\.svg$/i, '');
    const dir = this.folder();
    const defaultUri = dir ? vscode.Uri.joinPath(dir, `${base} (copy).svg`) : vscode.Uri.file(`${base}.svg`);
    const target = await vscode.window.showSaveDialog({ defaultUri, filters: { SVG: ['svg'] }, saveLabel: 'Download SVG' });
    if (!target) return;
    await vscode.workspace.fs.writeFile(target, Buffer.from(this.document.getText(), 'utf8'));
    this.post({ type: 'toast', text: `Downloaded ${path.basename(target.path)}` });
  },

  async png({ data }) {
    if (typeof data !== 'string' || !data) throw new Error('empty PNG data');
    const defaultUri = this.document.uri.with({ path: this.document.uri.path.replace(/\.svg$/i, '') + '.png' });
    const target = await vscode.window.showSaveDialog({ defaultUri, filters: { PNG: ['png'] } });
    if (!target) return;
    await vscode.workspace.fs.writeFile(target, Buffer.from(data, 'base64'));
    this.post({ type: 'toast', text: `Exported ${path.basename(target.path)}` });
  },

  source() {
    return vscode.commands.executeCommand('vscode.openWith', this.document.uri, 'default', vscode.ViewColumn.Beside);
  },

  log({ message, stack }) {
    write(`Webview: ${message}`, stack);
  },
};

module.exports = { EditorSession };
