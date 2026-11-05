import { state, vscode } from './state.js';
import { toast } from './util.js';
import { guard } from './errors.js';
import { fitBox } from './bounds.js';
import { commitNow, serialize } from './document.js';

const MAX_SIDE = 2048;

export function exportPng() {
  if (!state.srcDoc || state.broken) return;
  commitNow();
  const box = fitBox();
  const scale = MAX_SIDE / Math.max(box.w, box.h);
  const width = Math.max(1, Math.round(box.w * scale));
  const height = Math.max(1, Math.round(box.h * scale));
  const text = serialize({ width, height, viewBox: `${box.x} ${box.y} ${box.w} ${box.h}` });

  const img = new Image();
  img.onload = guard(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    let data;
    try {
      data = canvas.toDataURL('image/png').split(',')[1];
    } catch {
      toast('Could not create the PNG: the SVG uses external images.');
      return;
    }
    vscode.postMessage({ type: 'png', data });
  }, 'png');
  img.onerror = () => toast('Could not render this SVG as PNG.');
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text.slice(state.prolog.length))}`;
}
