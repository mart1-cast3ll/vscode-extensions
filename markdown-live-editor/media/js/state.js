export const vscode = acquireVsCodeApi();

function loadUiState() {
  try {
    return vscode.getState() || {};
  } catch {
    return {};
  }
}

const savedUi = loadUiState();

export const state = {
  text: '',
  lines: [],
  blocks: [],
  baseUri: '',
  docName: 'Document',
  editing: null,
  lastTextarea: null,
  ui: {
    source: savedUi.source === true,
    outline: savedUi.outline !== false,
    sourceWidth: Number(savedUi.sourceWidth) || 0,
  },
};

export function saveUi() {
  try {
    vscode.setState(state.ui);
  } catch {
    // Webview state is optional.
  }
}
