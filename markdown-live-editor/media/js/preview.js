import { state, vscode } from './state.js';
import { $, toast } from './util.js';
import { listen } from './errors.js';
import { renderBlock } from './md/render.js';
import { sanitize } from './md/sanitize.js';
import { toggleTask } from './document.js';
import { commitEdit, editBlock, editNew } from './block-editor.js';
import { onRender } from './render.js';

const view = $('view');

const gap = (at) => `<div class="gap" data-at="${at}"><button class="add" type="button" title="Add a block here">+</button></div>`;

function renderPreview() {
  state.editing = null;
  const { blocks, lines } = state;
  if (!blocks.length) {
    view.innerHTML = '<div class="empty">This document is empty. Click here to start writing.</div>';
    return;
  }
  const first = blocks[0];
  const html = [gap(first.type === 'frontmatter' ? first.end : first.start)];
  blocks.forEach((block, index) => {
    const inner = sanitize(renderBlock(block, lines), state.baseUri);
    html.push(`<div class="block block-${block.type}" data-index="${index}" title="Click to edit">${inner}</div>`);
    html.push(gap(block.end));
  });
  view.innerHTML = html.join('');
}

function openLink(href) {
  if (href.startsWith('#')) {
    const target = document.getElementById(decodeURIComponent(href.slice(1)));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  vscode.postMessage({ type: 'openLink', href });
}

function copyCode(codeblock) {
  const text = codeblock.querySelector('code').textContent;
  navigator.clipboard.writeText(text).then(
    () => toast('Code copied'),
    () => toast('Could not access the clipboard')
  );
}

function onClick(e) {
  const t = e.target;
  if (t.closest('.editing')) return;
  if (state.editing) {
    commitEdit();
    return;
  }
  const link = t.closest('a[href]');
  if (link) {
    e.preventDefault();
    openLink(link.getAttribute('href'));
    return;
  }
  if (t.matches('input.task')) {
    e.preventDefault();
    toggleTask(Number(t.dataset.line));
    return;
  }
  if (t.closest('button.copy')) return copyCode(t.closest('.codeblock'));
  const gapEl = t.closest('.gap');
  if (gapEl) {
    if (t.closest('button.add')) editNew(Number(gapEl.dataset.at));
    return;
  }
  if (t.closest('.empty')) return editNew(0);
  if (String(window.getSelection())) return;
  const block = t.closest('.block[data-index]');
  if (block) editBlock(Number(block.dataset.index));
}

listen(view, 'click', onClick);
onRender(renderPreview);
