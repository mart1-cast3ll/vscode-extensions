'use strict';
const vscode = require('vscode');
const fs = require('fs');
const crypto = require('crypto');

function renderHtml(webview, mediaUri) {
  const template = fs.readFileSync(vscode.Uri.joinPath(mediaUri, 'editor.html').fsPath, 'utf8');
  const nonce = crypto.randomBytes(16).toString('base64');
  return template
    .replace(/{{csp}}/g, webview.cspSource)
    .replace(/{{nonce}}/g, nonce)
    .replace(/{{media}}/g, webview.asWebviewUri(mediaUri).toString());
}

module.exports = { renderHtml };
