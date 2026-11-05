'use strict';
const vscode = require('vscode');

const CHANNEL_NAME = 'SVG Layers Editor';
let channel;

function init() {
  channel = vscode.window.createOutputChannel(CHANNEL_NAME);
  return channel;
}

function write(message, detail) {
  if (!channel) return;
  channel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
  if (detail) channel.appendLine(String(detail));
}

function fail(message, error) {
  write(`${message}: ${error && error.message ? error.message : error}`, error && error.stack);
  vscode.window
    .showErrorMessage(`${message}. See Output › ${CHANNEL_NAME} for details.`, 'Show details')
    .then((choice) => choice && channel.show(true));
}

module.exports = { init, write, fail };
