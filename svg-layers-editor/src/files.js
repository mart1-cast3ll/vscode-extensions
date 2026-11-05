'use strict';
const vscode = require('vscode');
const path = require('path');
const { VIEW_TYPE } = require('./constants');
const { fail } = require('./log');

const normalizeEol = (text) => text.replace(/\r\n/g, '\n');

const openInEditor = (uri) => vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE);

async function pickAndOpen(defaultUri) {
  try {
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: 'Open in SVG Layers Editor',
      filters: { SVG: ['svg'] },
      defaultUri,
    });
    for (const uri of picked || []) await openInEditor(uri);
  } catch (error) {
    fail('Could not open the SVG', error);
  }
}

async function exists(uri) {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

// A file dropped from outside VS Code opens as an unsaved document that keeps its name.
async function openDropped(name, text, folder) {
  const base = path.basename(String(name || 'drawing.svg')).replace(/[\\/:*?"<>|]/g, '_');
  const fileName = /\.svg$/i.test(base) ? base : `${base}.svg`;
  const dir = folder || (vscode.workspace.workspaceFolders || [])[0]?.uri;
  const target = dir ? vscode.Uri.joinPath(dir, fileName) : vscode.Uri.file(fileName);

  if (await exists(target)) {
    const current = Buffer.from(await vscode.workspace.fs.readFile(target)).toString('utf8');
    if (normalizeEol(current) === normalizeEol(text)) return openInEditor(target);
  }
  const copyName = fileName.replace(/\.svg$/i, ' (copy).svg');
  const untitled = ((await exists(target)) ? vscode.Uri.joinPath(target, '..', copyName) : target).with({ scheme: 'untitled' });
  const doc = await vscode.workspace.openTextDocument(untitled);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(untitled, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), text);
  await vscode.workspace.applyEdit(edit);
  return openInEditor(untitled);
}

module.exports = { normalizeEol, openInEditor, pickAndOpen, openDropped };
