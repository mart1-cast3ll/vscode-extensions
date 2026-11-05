import { state, saveUi } from './state.js';
import { $, escapeHtml } from './util.js';
import { listen } from './errors.js';
import { headingOf } from './md/render.js';
import { plainText } from './md/inline.js';
import { onRender } from './render.js';

const list = $('outline');

function renderOutline() {
  if (!state.ui.outline) return;
  const items = [];
  state.blocks.forEach((block, index) => {
    if (block.type !== 'heading') return;
    const { level, text } = headingOf(block, state.lines);
    items.push(`<button class="o-item lvl${level}" data-index="${index}" type="button">${escapeHtml(plainText(text)) || '(empty)'}</button>`);
  });
  list.innerHTML = items.join('') || '<div class="o-empty">No headings yet</div>';
}

export function showOutline(visible = !state.ui.outline) {
  state.ui.outline = visible;
  document.body.classList.toggle('with-outline', visible);
  $('bOutline').classList.toggle('on', visible);
  $('bOutline').setAttribute('aria-pressed', String(visible));
  saveUi();
  if (visible) renderOutline();
}

listen(list, 'click', (e) => {
  const item = e.target.closest('.o-item');
  const block = item && $('view').querySelector(`.block[data-index="${item.dataset.index}"]`);
  if (block) block.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

showOutline(state.ui.outline);
onRender(renderOutline);
