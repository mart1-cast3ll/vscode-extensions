import { escapeHtml } from '../util.js';

export const escapeAttr = (s) => escapeHtml(String(s)).replace(/"/g, '&quot;');

const IMAGE = /!\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+"([^"]*)")?\s*\)/g;
const LINK = /\[((?:[^\[\]]|\[[^\]]*\])+)\]\(\s*<?([^\s)>]*)>?(?:\s+"([^"]*)")?\s*\)/g;
const AUTOLINK = /<((?:https?:\/\/|mailto:)[^\s>]+)>/g;
const BARE_URL = /(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
const RAW_TAG = /<!--[\s\S]*?-->|<\/?[A-Za-z][\w-]*(?:\s[^<>]*)?\/?>/g;
const CODE = /(`+)([\s\S]*?[^`])\1(?!`)/g;
const ESCAPED = /\\([\\`*_{}[\]()#+\-.!|~<>])/g;
const HARD_BREAK = /(?: {2,}|\\)\n/g;

// Inline Markdown → HTML. Finished fragments are parked in `parts` behind \u0000n\u0000
// placeholders so later passes (escaping, emphasis) cannot touch them.
export function renderInline(source) {
  const parts = [];
  const park = (html) => `\u0000${parts.push(html) - 1}\u0000`;
  const title = (t) => (t ? ` title="${escapeAttr(t)}"` : '');

  let text = source
    .replace(HARD_BREAK, () => `${park('<br>')}\n`)
    .replace(CODE, (m, ticks, code) => park(`<code>${escapeHtml(code.trim())}</code>`))
    .replace(ESCAPED, (m, ch) => park(escapeHtml(ch)))
    .replace(AUTOLINK, (m, url) => park(`<a href="${escapeAttr(url)}">${escapeHtml(url.replace(/^mailto:/, ''))}</a>`))
    .replace(RAW_TAG, (tag) => (tag.startsWith('<!--') ? '' : park(tag)))
    .replace(IMAGE, (m, alt, src, t) => park(`<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"${title(t)}>`))
    .replace(LINK, (m, label, href, t) => park(`<a href="${escapeAttr(href)}"${title(t)}>${emphasis(escapeHtml(label))}</a>`))
    .replace(BARE_URL, (m, lead, url) => lead + park(`<a href="${escapeAttr(url)}">${escapeHtml(url)}</a>`));

  text = emphasis(escapeHtml(text));
  for (let guard = 0; guard < 5 && text.includes('\u0000'); guard++) {
    text = text.replace(/\u0000(\d+)\u0000/g, (m, n) => parts[+n]);
  }
  return text;
}

function emphasis(html) {
  return html
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?![\w])/g, '$1<strong>$2</strong>')
    .replace(/\*(?=\S)([^*]*?\S)\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?![\w])/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>')
    .replace(/==(?=\S)([^=]*?\S)==/g, '<mark>$1</mark>');
}

export function plainText(source) {
  return renderInline(source).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
