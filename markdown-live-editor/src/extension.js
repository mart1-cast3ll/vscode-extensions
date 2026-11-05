'use strict';
const vscode = require('vscode');
const log = require('./log');
const { VIEW_TYPE, COMMAND_OPEN, CHANNEL_NAME } = require('./constants');
const { renderHtml } = require('./html');
const { EditorSession } = require('./session');

class MarkdownLiveEditorProvider {
  constructor(context) {
    this.mediaUri = vscode.Uri.joinPath(context.extensionUri, 'media');
  }

  resolveCustomTextEditor(document, panel) {
    const roots = [this.mediaUri, ...(vscode.workspace.workspaceFolders || []).map((f) => f.uri)];
    if (document.uri.scheme === 'file') roots.push(vscode.Uri.joinPath(document.uri, '..'));
    panel.webview.options = { enableScripts: true, localResourceRoots: roots };
    try {
      panel.webview.html = renderHtml(panel.webview, this.mediaUri);
    } catch (error) {
      log.fail('Could not load the editor UI', error);
      panel.webview.html = `<p style="padding:16px">The editor could not be loaded. See Output › ${CHANNEL_NAME}.</p>`;
      return;
    }
    new EditorSession(document, panel);
  }
}

async function openCommand(uri) {
  try {
    if (!(uri instanceof vscode.Uri)) {
      const editor = vscode.window.activeTextEditor;
      uri = editor && editor.document.languageId === 'markdown' ? editor.document.uri : null;
    }
    if (!uri) {
      vscode.window.showInformationMessage('Open or select a Markdown file first.');
      return;
    }
    await vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE);
  } catch (error) {
    log.fail('Could not open Markdown Live Editor', error);
  }
}

function activate(context) {
  context.subscriptions.push(
    log.init(),
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, new MarkdownLiveEditorProvider(context), {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: true,
    }),
    vscode.commands.registerCommand(COMMAND_OPEN, openCommand)
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
