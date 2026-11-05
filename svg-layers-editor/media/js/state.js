export const NS = 'http://www.w3.org/2000/svg';

export const vscode = acquireVsCodeApi();

export const svg = document.getElementById('se-stage');
export const root = document.getElementById('se-root');
export const overlay = document.getElementById('se-overlay');

function loadUiState() {
  try {
    return vscode.getState() || {};
  } catch {
    return {};
  }
}

const savedUi = loadUiState();

export const state = {
  srcDoc: null,
  prolog: '',
  epilog: '',
  docName: 'Document',
  text: '',
  broken: false,
  errLine: 0,
  vb: { x: 0, y: 0, w: 100, h: 100 },
  view: null,
  frame: null,
  context: root,
  selection: [],
  hover: null,
  drag: null,
  layerDrag: null,
  expanded: new WeakSet(),
  collapsed: new WeakSet(),
  ui: {
    code: savedUi.code !== false,
    codeH: Number(savedUi.codeH) || 220,
    bounds: savedUi.bounds !== false,
  },
};

export function saveUi() {
  try {
    vscode.setState(state.ui);
  } catch {
    // Webview state is optional.
  }
}
