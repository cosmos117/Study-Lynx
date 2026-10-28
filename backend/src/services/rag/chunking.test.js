import { describe, expect, it } from 'vitest';
import { cleanText, chunkText, chunkPages } from './chunking.js';

describe('cleanText', () => {
  it('removes null bytes and control characters', () => {
    expect(cleanText('he\u0000llo\u0001world')).toBe('he llo world');
  });

  it('normalizes line endings and trims lines', () => {
    expect(cleanText('  one  \r\n  two  \r\r\n\n\n\nthree  ')).toBe('one\ntwo\n\nthree');
  });

  it('collapses excessive blank lines', () => {
    expect(cleanText('a\n\n\n\n\nb')).toBe('a\n\nb');
  });

  it('returns empty string for non-string input', () => {
    expect(cleanText(undefined)).toBe('');
    expect(cleanText(null)).toBe('');
  });
});

describe('chunkText', () => {
  it('returns no chunks for empty text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n   ')).toEqual([]);
  });

  it('keeps short text as a single chunk', () => {
    const chunks = chunkText('Hello world', { maxChars: 100, overlapChars: 20 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('Hello world');
  });

  it('splits long text into chunks below maxChars', () => {
    const text = 'word '.repeat(500);
    const chunks = chunkText(text, { maxChars: 100, overlapChars: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.charCount).toBeLessThanOrEqual(100);
    }
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[chunks.length - 1].chunkIndex).toBe(chunks.length - 1);
  });

  it('applies overlap between consecutive chunks', () => {
    const text = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu'.repeat(20);
    const chunks = chunkText(text, { maxChars: 120, overlapChars: 40 });
    expect(chunks.length).toBeGreaterThan(1);
    const tail = chunks[0].content.slice(-40);
    const head = chunks[1].content.slice(0, 40);
    const shared = tail.split(' ').filter((w) => w && head.includes(w));
    expect(shared.length).toBeGreaterThan(0);
  });

  it('packs short paragraphs together and keeps the paragraph break', () => {
    const chunks = chunkText('First paragraph.\n\nSecond paragraph.', { maxChars: 1000, overlapChars: 100 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('First paragraph.\n\nSecond paragraph.');
  });

  it('starts a new chunk rather than splitting a paragraph that fits', () => {
    const first = 'a'.repeat(60);
    const second = 'b'.repeat(60);
    const chunks = chunkText(`${first}\n\n${second}`,{ maxChars: 100, overlapChars: 0 });
    expect(chunks.map((chunk) => chunk.content)).toEqual([first, second]);
  });

  it('splits an oversized unbroken token', () => {
    const chunks = chunkText('x'.repeat(250), { maxChars: 100, overlapChars: 0 });
    expect(chunks).toHaveLength(3);
    expect(chunks.every((chunk) => chunk.charCount <= 100)).toBe(true);
  });

  it('throws for invalid maxChars or overlapChars', () => {
    expect(() => chunkText('a b c', { maxChars: 10, overlapChars: 20 })).toThrow();
    expect(() => chunkText('a b c', { maxChars: 50, overlapChars: 50 })).toThrow();
  });
});
describe('chunkPages', () => {
  it('keeps the page reference and numbers chunks continuously across pages', () => {
    const chunks = chunkPages([
      { page: 1, text: 'Page one text.' },
      { page: 2, text: '' },
      { page: 3, text: 'Page three text.' },
    ], { maxChars: 100, overlapChars: 0 });
    expect(chunks.map((chunk) => [chunk.chunkIndex, chunk.page])).toEqual([[0, 1], [1, 3]]);
  });
});
