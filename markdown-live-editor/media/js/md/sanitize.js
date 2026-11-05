const ALIGN = ['align'];
const CELL = ['align', 'colspan', 'rowspan'];

const ALLOWED = {
  a: ['href', 'title', 'name', 'id'], img: ['src', 'alt', 'title', 'width', 'height', 'align'],
  p: ALIGN, div: ALIGN, span: [], br: [], hr: [], b: [], i: [], em: [], strong: [], del: [], s: [],
  code: [], pre: [], kbd: [], sub: [], sup: [], mark: [], small: [], u: [], center: [],
  details: ['open'], summary: [], ul: [], ol: ['start'], li: [], blockquote: [],
  h1: ['id', 'align'], h2: ['id', 'align'], h3: ['id', 'align'], h4: ['id', 'align'], h5: ['id', 'align'], h6: ['id', 'align'],
  table: [], thead: [], tbody: [], tr: [], th: CELL, td: CELL, picture: [], source: ['srcset', 'media'],
  input: ['type', 'checked', 'disabled'], button: ['type'],
};
const GLOBAL = ['class', 'data-line'];
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'textarea', 'select', 'link', 'meta', 'base', 'svg', 'math', 'template']);
const SAFE_HREF = /^(https?:|mailto:|#|[^:]*$)/i;
const SAFE_SRC = /^(https?:|data:image\/(png|gif|jpe?g|webp);|[^:]*$)/i;

function resolve(url, baseUri) {
  if (!baseUri || /^[a-z][\w+.-]*:/i.test(url) || url.startsWith('#')) return url;
  try {
    return new URL(url, baseUri).toString();
  } catch {
    return url;
  }
}

function cleanAttributes(el, tag, baseUri) {
  const allowed = ALLOWED[tag];
  for (const attr of [...el.attributes]) {
    const name = attr.name.toLowerCase();
    if (!allowed.includes(name) && !GLOBAL.includes(name)) el.removeAttribute(attr.name);
  }
  if (tag === 'a' && el.hasAttribute('href') && !SAFE_HREF.test(el.getAttribute('href').trim())) el.removeAttribute('href');
  if (tag === 'img' || tag === 'source') {
    const attr = tag === 'img' ? 'src' : 'srcset';
    const value = (el.getAttribute(attr) || '').trim();
    if (!SAFE_SRC.test(value)) el.removeAttribute(attr);
    else if (value) el.setAttribute(attr, resolve(value, baseUri));
  }
  if (tag === 'input') {
    if (el.getAttribute('type') !== 'checkbox') el.remove();
  }
}

function clean(node, baseUri) {
  for (const el of [...node.children]) {
    const tag = el.localName;
    if (DROP.has(tag)) {
      el.remove();
      continue;
    }
    clean(el, baseUri);
    if (!ALLOWED[tag]) {
      el.replaceWith(...el.childNodes);
      continue;
    }
    cleanAttributes(el, tag, baseUri);
  }
}

// Keeps a safe subset of HTML (what GitHub READMEs commonly use) and resolves relative image paths.
export function sanitize(html, baseUri) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  clean(doc.body, baseUri);
  return doc.body.innerHTML;
}
