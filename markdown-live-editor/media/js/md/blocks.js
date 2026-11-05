export const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)])(?=\s|$)( *)/;
export const HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/;
export const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)/;
const HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}>/;
const HTML_START = /^ {0,3}<(?:\/?[a-zA-Z][\w-]*(?:[\s/>]|$)|!--)/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const TABLE_DELIM = /^ *\|? *:?-+:? *(\| *:?-+:? *)*\|? *$/;

export const isBlank = (line) => !line || !line.trim();
export const indentOf = (line) => line.length - line.trimStart().length;

const isTableStart = (lines, i) =>
  lines[i].includes('|') && i + 1 < lines.length && lines[i + 1].includes('-') && TABLE_DELIM.test(lines[i + 1]);

function startsBlock(lines, i) {
  const line = lines[i];
  return (
    FENCE.test(line) || HEADING.test(line) || HR.test(line) || QUOTE.test(line) ||
    HTML_START.test(line) || isTableStart(lines, i) || /^ {0,3}([-*+]|1[.)])\s+\S/.test(line)
  );
}

function untilBlank(lines, i) {
  let j = i;
  while (j < lines.length && !isBlank(lines[j])) j++;
  return j;
}

function fenceEnd(lines, i, marker) {
  const close = new RegExp(`^ {0,3}\\${marker[0]}{${marker.length},}\\s*$`);
  let j = i + 1;
  while (j < lines.length && !close.test(lines[j])) j++;
  return Math.min(j + 1, lines.length);
}

function tableEnd(lines, i) {
  let j = i + 2;
  while (j < lines.length && !isBlank(lines[j]) && lines[j].includes('|')) j++;
  return j;
}

function listEnd(lines, i) {
  const base = indentOf(lines[i]);
  let j = i + 1;
  while (j < lines.length) {
    const line = lines[j];
    if (isBlank(line)) {
      let k = j;
      while (k < lines.length && isBlank(lines[k])) k++;
      const next = lines[k];
      const continues = next !== undefined && (indentOf(next) > base || (LIST_ITEM.test(next) && !HR.test(next) && indentOf(next) >= base));
      if (!continues) return j;
      j = k;
      continue;
    }
    const sibling = LIST_ITEM.test(line) && !HR.test(line);
    if (indentOf(line) <= base && !sibling && startsBlock(lines, j)) return j;
    j++;
  }
  return j;
}

function frontMatterEnd(lines) {
  if (lines[0] === undefined || lines[0].trim() !== '---') return 0;
  for (let j = 1; j < lines.length; j++) {
    if (lines[j].trim() === '---' || lines[j].trim() === '...') return j + 1;
  }
  return 0;
}

// Splits Markdown into top-level blocks with their [start, end) line range.
export function parseBlocks(lines) {
  const blocks = [];
  let i = frontMatterEnd(lines);
  if (i) blocks.push({ type: 'frontmatter', start: 0, end: i });

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }
    const start = i;
    const push = (type, end, extra = {}) => {
      blocks.push({ type, start, end, ...extra });
      i = end;
    };
    const fence = FENCE.exec(line);
    if (fence) push('code', fenceEnd(lines, i, fence[1]), { lang: fence[2] || '' });
    else if (HEADING.test(line)) push('heading', i + 1);
    else if (HR.test(line)) push('hr', i + 1);
    else if (QUOTE.test(line)) push('quote', untilBlank(lines, i));
    else if (LIST_ITEM.test(line)) push('list', listEnd(lines, i));
    else if (isTableStart(lines, i)) push('table', tableEnd(lines, i));
    else if (HTML_START.test(line)) push('html', untilBlank(lines, i));
    else paragraph(lines, i, push);
  }
  return blocks;
}

function paragraph(lines, i, push) {
  let j = i + 1;
  while (j < lines.length && !isBlank(lines[j])) {
    if (SETEXT.test(lines[j])) return push('heading', j + 1, { setext: lines[j].trim()[0] === '=' ? 1 : 2 });
    if (startsBlock(lines, j)) break;
    j++;
  }
  return push('paragraph', j);
}
