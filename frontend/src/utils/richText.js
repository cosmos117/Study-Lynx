// A tiny, safe formatter for AI answers: paragraphs, "- " bullets, "1. " steps, **bold**, `code`
// and [1] citation markers. It produces plain data that React renders as elements, never HTML,
// so text from the AI or a document can't inject markup.

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

/** Splits text into blocks: { type: 'p', text } | { type: 'ul' | 'ol', items: [text] }. */
export function parseBlocks(text) {
  const blocks = [];
  let paragraph = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'p', text: paragraph.join(' ') });
    paragraph = [];
  };
  const addItem = (type, item) => {
    flushParagraph();
    const last = blocks[blocks.length - 1];
    if (last?.type === type) last.items.push(item);
    else blocks.push({ type, items: [item] });
  };

  for (const line of String(text ?? '').split(/\r?\n/)) {
    const bullet = line.match(BULLET);
    const numbered = line.match(NUMBERED);
    const heading = line.match(HEADING);
    if (bullet) addItem('ul', bullet[1].trim());
    else if (numbered) addItem('ol', numbered[1].trim());
    else if (!line.trim()) flushParagraph();
    // Headings aren't wanted in chat answers; keep their text as a bold line.
    else if (heading) { flushParagraph(); blocks.push({ type: 'p', text: `**${heading[1].trim()}**` }); }
    else paragraph.push(line.trim());
  }
  flushParagraph();
  return blocks;
}

/** Splits a line into pieces: { type: 'text' | 'bold' | 'code', value } and { type: 'cite', number }. */
export function parseInline(text) {
  const pieces = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`|\[(\d{1,2})\]/g;
  let last = 0;
  for (const match of String(text).matchAll(pattern)) {
    if (match.index > last) pieces.push({ type: 'text', value: text.slice(last, match.index) });
    if (match[1] !== undefined) pieces.push({ type: 'bold', value: match[1] });
    else if (match[2] !== undefined) pieces.push({ type: 'code', value: match[2] });
    else pieces.push({ type: 'cite', number: Number(match[3]) });
    last = match.index + match[0].length;
  }
  if (last < text.length) pieces.push({ type: 'text', value: text.slice(last) });
  return pieces;
}

/** Plain text for saving to notes: formatting kept readable, citation numbers removed. */
export function toPlainText(text) {
  return String(text ?? '').replace(/\s*\[\d{1,2}\]/g, '').replace(/\*\*([^*]+)\*\*/g, '$1').trim();
}
