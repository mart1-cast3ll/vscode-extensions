'use strict';
const vscode = require('vscode');
const log = require('./log');
const { VIEW_TYPE, COMMAND_OPEN, COMMAND_OPEN_FILE } = require('./constants');
const { renderHtml } = require('./html');
const { EditorSession } = require('./session');
const { openInEditor, pickAndOpen } = require('./files');

class SvgLayersEditorProvider {
  constructor(context) {
    this.mediaUri = vscode.Uri.joinPath(context.extensionUri, 'media');
  }

  resolveCustomTextEditor(document, panel) {
    panel.webview.options = { enableScripts: true, localResourceRoots: [this.mediaUri] };
    try {
      panel.webview.html = renderHtml(panel.webview, this.mediaUri);
    } catch (error) {
      log.fail('Could not load the editor UI', error);
      panel.webview.html = '<p style="padding:16px">The editor could not be loaded. See Output › SVG Layers Editor.</p>';
      return;
    }
    new EditorSession(document, panel);
  }
}

async function openCommand(uri) {
  try {
    if (!(uri instanceof vscode.Uri)) {
      const editor = vscode.window.activeTextEditor;
      uri = editor && /\.svg$/i.test(editor.document.uri.path) ? editor.document.uri : null;
    }
    await (uri ? openInEditor(uri) : pickAndOpen());
  } catch (error) {
    log.fail('Could not open SVG Layers Editor', error);
  }
}

function activate(context) {
  context.subscriptions.push(
    log.init(),
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, new SvgLayersEditorProvider(context), {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: true,
    }),
    vscode.commands.registerCommand(COMMAND_OPEN, openCommand),
    vscode.commands.registerCommand(COMMAND_OPEN_FILE, () => pickAndOpen())
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
