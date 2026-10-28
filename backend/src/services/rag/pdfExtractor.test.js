import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { extractPdfPages } from './pdfExtractor.js';

const pdf = readFileSync(new URL('./__fixtures__/two-page.pdf', import.meta.url));

describe('extractPdfPages', () => {
  it('returns text page by page with page numbers', async () => {
    const { pages, pageCount } = await extractPdfPages(pdf);
    expect(pageCount).toBe(2);
    expect(pages.map((page) => page.page)).toEqual([1, 2]);
    expect(pages[0].text).toContain('BCNF is stricter than 3NF');
    expect(pages[1].text).toContain('normalization reduces redundancy');
  });

  it('rejects an empty buffer', async () => {
    await expect(extractPdfPages(Buffer.alloc(0))).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects data that is not a PDF', async () => {
    await expect(extractPdfPages(Buffer.from('just some text'))).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects a PDF header followed by garbage', async () => {
    const garbage = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from(Array.from({ length: 500 }, (_, i) => (i * 37) % 256))]);
    await expect(extractPdfPages(garbage)).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects a truncated PDF without crashing', async () => {
    await expect(extractPdfPages(pdf.subarray(0, Math.floor(pdf.length / 3)))).rejects.toMatchObject({ statusCode: 422 });
  });
});
