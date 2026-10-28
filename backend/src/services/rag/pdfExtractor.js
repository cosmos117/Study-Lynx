import pdfParse from 'pdf-parse';
import { createHttpError } from '../../utils/httpError.js';

const MAX_PAGES = 500;

/**
 * Extract text from a PDF buffer, page by page.
 * Returns `{ pages: [{ page, text }], pageCount }` so chunks can carry page references.
 * Malformed, encrypted or image-only PDFs raise a 422 with a user-facing message.
 */
export async function extractPdfPages(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw createHttpError(400, 'PDF file is empty');
  }
  if (!buffer.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
    throw createHttpError(422, 'File is not a valid PDF document');
  }

  const pages = [];
  async function renderPage(pageData) {
    const content = await pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
    let lastY;
    let text = '';
    for (const item of content.items) {
      text += lastY === item.transform[5] || lastY === undefined ? item.str : `\n${item.str}`;
      lastY = item.transform[5];
    }
    pages.push({ page: pageData.pageNumber, text });
    return text;
  }

  let parsed;
  try {
    parsed = await pdfParse(buffer, { pagerender: renderPage, max: MAX_PAGES });
  } catch {
    throw createHttpError(422, 'This PDF is damaged, encrypted, or could not be read');
  }

  return { pages, pageCount: parsed.numpages };
}
