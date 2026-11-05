import { state, vscode } from './state.js';
import { $, toast } from './util.js';
import { listen, report } from './errors.js';

const overlay = $('drop');
const URI_TYPES = ['text/uri-list', 'application/vnd.code.uri-list'];
let depth = 0;

function isFileDrag(e) {
  if (state.layerDrag) return false;
  const types = [...((e.dataTransfer && e.dataTransfer.types) || [])];
  return types.includes('Files') || URI_TYPES.some((t) => types.includes(t));
}

function svgUris(dataTransfer) {
  const raw = URI_TYPES.map((t) => dataTransfer.getData(t)).find(Boolean) || '';
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#') && /\.svg$/i.test(s));
}

function openFiles(files) {
  const svgs = files.filter((f) => /\.svg$/i.test(f.name) || f.type === 'image/svg+xml');
  for (const file of svgs) {
    file.text().then(
      (text) => vscode.postMessage({ type: 'importText', name: file.name, text }),
      (error) => report(error, `read ${file.name}`)
    );
  }
  return svgs.length;
}

function hide() {
  depth = 0;
  overlay.hidden = true;
}

listen(window, 'dragenter', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  depth++;
  overlay.hidden = false;
});
listen(window, 'dragleave', (e) => {
  if (isFileDrag(e) && --depth <= 0) hide();
});
listen(window, 'dragover', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
listen(window, 'drop', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  hide();
  const files = [...(e.dataTransfer.files || [])];
  let opened = openFiles(files);
  if (!files.length) {
    const uris = svgUris(e.dataTransfer);
    uris.forEach((uri) => vscode.postMessage({ type: 'openUri', uri }));
    opened = uris.length;
  }
  if (!opened) toast('Only .svg files can be opened.');
});
