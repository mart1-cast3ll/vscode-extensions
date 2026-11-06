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

const isMarkdown = (uri) => !!uri && /\.(md|markdown)$/i.test(uri.path);

// Explorer/title menus pass the file; from the palette, a keybinding or the built-in preview
// there is none, so fall back to the active tab, then any visible Markdown editor.
function findMarkdownUri() {
  const editor = vscode.window.activeTextEditor;
  if (editor && (editor.document.languageId === 'markdown' || isMarkdown(editor.document.uri))) return editor.document.uri;
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
  const tabUri = tab && tab.input && tab.input.uri;
  if (isMarkdown(tabUri)) return tabUri;
  const visible = vscode.window.visibleTextEditors.find((e) => e.document.languageId === 'markdown');
  return visible ? visible.document.uri : null;
}

async function openCommand(uri) {
  try {
    if (!(uri instanceof vscode.Uri)) uri = findMarkdownUri();
    if (!uri) {
      const picked = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: 'Open in Markdown Live Editor',
        filters: { Markdown: ['md', 'markdown'] },
      });
      uri = picked && picked[0];
    }
    if (!uri) return;
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
