/**
 * Text cleaning and chunking for document ingestion.
 * Pure functions — easy to unit test, no dependencies.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;

export function cleanText(text) {
  if (typeof text !== 'string') return '';
  let cleaned = String(text)
    .replace(CONTROL_CHARS, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
  while (cleaned.includes('\n\n\n')) {
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  }
  return cleaned.trim();
}

function sentenceSplit(text) {
  return text.split(/(?<=[.!?])\s+/);
}

function splitByWords(text, maxChars) {
  const parts = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      if (current) parts.push(current);
      if (word.length > maxChars) {
        for (let i = 0; i < word.length; i += maxChars) parts.push(word.slice(i, i + maxChars));
        current = '';
      } else {
        current = word;
      }
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function overlapTail(text, overlapChars) {
  if (overlapChars === 0) return '';
  const tail = text.slice(-overlapChars);
  const cut = tail.indexOf(' ');
  // Start the overlap on a word boundary so chunks never begin mid-word.
  return cut === -1 || text.length <= overlapChars ? '' : tail.slice(cut + 1);
}

/**
 * Split text into chunks of at most `maxChars`, packing whole paragraphs and
 * sentences greedily and carrying a word-aligned overlap into the next chunk.
 */
export function chunkText(text, { maxChars = 1200, overlapChars = 200 } = {}) {
  if (!Number.isFinite(maxChars) || maxChars < 100) {
    throw new Error('maxChars must be at least 100');
  }
  if (!Number.isFinite(overlapChars) || overlapChars < 0 || overlapChars >= maxChars) {
    throw new Error('overlapChars must be between 0 and maxChars');
  }

  const cleaned = cleanText(text);
  if (!cleaned) return [];

  // Break the text into units that each fit in one chunk, remembering how to rejoin them.
  const units = [];
  for (const paragraph of cleaned.split(/\n\n+/)) {
    const sentences = paragraph.length > maxChars ? sentenceSplit(paragraph) : [paragraph];
    sentences.forEach((sentence, sentenceIndex) => {
      const parts = sentence.length > maxChars ? splitByWords(sentence, maxChars) : [sentence];
      parts.forEach((part, partIndex) => {
        const startsParagraph = sentenceIndex === 0 && partIndex === 0;
        units.push({ text: part, separator: units.length === 0 ? '' : startsParagraph ? '\n\n' : ' ' });
      });
    });
  }

  const chunks = [];
  let current = '';
  const flush = () => chunks.push({ content: current, chunkIndex: chunks.length, charCount: current.length });

  for (const unit of units) {
    const candidate = current ? `${current}${unit.separator}${unit.text}` : unit.text;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    const carry = overlapTail(current, overlapChars);
    flush();
    current = carry && carry.length + 1 + unit.text.length <= maxChars ? `${carry} ${unit.text}` : unit.text;
  }
  if (current) flush();

  return chunks;
}

/**
 * Chunk page-addressed text (e.g. a PDF). Chunks never span pages, so each
 * chunk carries an exact page reference.
 */
export function chunkPages(pages, options) {
  const chunks = [];
  for (const { page, text } of pages) {
    for (const chunk of chunkText(text, options)) {
      chunks.push({ ...chunk, chunkIndex: chunks.length, page });
    }
  }
  return chunks;
}
