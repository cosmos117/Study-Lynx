import prisma from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { cleanText, chunkPages } from './chunking.js';
import { extractPdfPages } from './pdfExtractor.js';
import { findOwnedTopic } from '../aiContentService.js';
import { createHttpError } from '../../utils/httpError.js';
import { embeddingService as defaultEmbeddingService } from './embeddingService.js';
import { createMysqlVectorStoreService } from './vectorStoreService.js';

/**
 * DocumentIngestionService orchestrates:
 *   upload → validate → extract text → clean → chunk → embed → store
 *
 * Uploads are validated synchronously and then processed in the background, so the
 * document row moves PROCESSING → READY | FAILED while the client polls. Raw files
 * are never written to disk: only cleaned chunks and their embeddings are stored,
 * and every row is owned by a single user.
 *
 * Uploaded material is untrusted data. It is only ever parsed and stored here;
 * it never reaches a prompt except as quoted source data (see ragService).
 */
const TEXT_TYPES = new Set(['NOTE', 'YOUTUBE']);
const MAX_NAME_LENGTH = 190;
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const documentInclude = {
  topic: { select: { id: true, name: true } },
  _count: { select: { chunks: true } },
};

function sanitizeName(name) {
  // eslint-disable-next-line no-control-regex
  return String(name || '').replace(/[\u0000-\u001f\u007f/\\]+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

export function createDocumentIngestionService({
  db = prisma,
  embeddingService = defaultEmbeddingService,
  vectorStore = createMysqlVectorStoreService({ prisma: db, embeddingService }),
  extractPages = extractPdfPages,
  assertTopicOwned = findOwnedTopic,
  config = env.rag,
  log = (event) => console.log(JSON.stringify(event)),
} = {}) {
  const inFlight = new Set();

  function validateFile({ mimeType, size, buffer }) {
    if (!config.allowedMimeTypes.includes(mimeType)) {
      throw createHttpError(415, `Unsupported file type: ${mimeType || 'unknown'}`);
    }
    if (!Buffer.isBuffer(buffer) || buffer.length === 0 || !Number.isFinite(size) || size <= 0) {
      throw createHttpError(400, 'Empty file');
    }
    if (buffer.length > config.maxFileSizeBytes) {
      throw createHttpError(413, `File exceeds the ${Math.floor(config.maxFileSizeBytes / 1024 / 1024)} MB size limit`);
    }
    // Trust the bytes, not the declared mime type.
    if (mimeType === 'application/pdf' && !buffer.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
      throw createHttpError(422, 'File is not a valid PDF document');
    }
    if (mimeType === 'text/plain' && buffer.includes(0)) {
      throw createHttpError(422, 'File is not a valid text document');
    }
  }

  async function ensureTopic(userId, topicId) {
    if (topicId) await assertTopicOwned(userId, topicId);
  }

  async function createRow({ userId, topicId, name, type, mimeType, sizeBytes, sourceUrl }) {
    const cleanName = sanitizeName(name);
    if (!cleanName) throw createHttpError(400, 'Document name is required');
    return db.document.create({
      data: {
        userId,
        topicId: topicId || null,
        name: cleanName,
        type,
        status: 'PROCESSING',
        sourceUrl: sourceUrl || '',
        mimeType,
        sizeBytes,
      },
    });
  }

  async function processDocument(document, { buffer, text }) {
    const { userId } = document;
    try {
      let pages;
      let pageCount = null;
      if (buffer && document.mimeType === 'application/pdf') {
        const extracted = await extractPages(buffer);
        pages = extracted.pages;
        pageCount = extracted.pageCount;
      } else {
        pages = [{ page: null, text: buffer ? buffer.toString('utf-8') : text }];
      }

      pages = pages
        .map((page) => ({ page: page.page, text: cleanText(page.text) }))
        .filter((page) => page.text);
      if (pages.length === 0) {
        throw createHttpError(422, 'No readable text was found in this document. Scanned or image-only files are not supported.');
      }
      const totalChars = pages.reduce((sum, page) => sum + page.text.length, 0);
      if (totalChars > config.maxDocumentChars) {
        throw createHttpError(413, `Document is too long to index (limit ${config.maxDocumentChars.toLocaleString('en-US')} characters). Split it into smaller files.`);
      }

      const chunks = chunkPages(pages, { maxChars: config.maxChunkChars, overlapChars: config.chunkOverlapChars });
      await vectorStore.addChunks(document.id, userId, chunks.map((chunk) => ({
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        topicId: document.topicId,
        documentName: document.name,
        metadata: {
          source: document.name,
          type: document.type,
          ...(chunk.page ? { page: chunk.page } : {}),
          charCount: chunk.charCount,
        },
      })));

      await db.document.update({
        where: { id: document.id },
        data: { status: 'READY', processedAt: new Date(), pageCount, errorMessage: null },
      });
      log({ event: 'rag.ingestion', userId, documentId: document.id, type: document.type, status: 'READY', chunks: chunks.length });
    } catch (error) {
      const expected = error.statusCode && error.statusCode < 500;
      log({ event: 'rag.ingestion', userId, documentId: document.id, type: document.type, status: 'FAILED', reason: expected ? error.message : error.name });
      await vectorStore.removeDocument(document.id, userId).catch(() => {});
      await db.document.update({
        where: { id: document.id },
        data: { status: 'FAILED', errorMessage: expected ? error.message : 'Processing failed unexpectedly. Please try again.' },
      }).catch(() => {});
    }
  }

  function enqueue(document, input) {
    const job = processDocument(document, input).finally(() => inFlight.delete(job));
    inFlight.add(job);
  }

  /** Validate and accept an uploaded file; processing continues in the background. */
  async function ingestFile({ userId, topicId, name, mimeType, buffer, size }) {
    validateFile({ mimeType, size, buffer });
    await ensureTopic(userId, topicId);
    const document = await createRow({
      userId,
      topicId,
      name,
      type: mimeType === 'application/pdf' ? 'PDF' : 'NOTE',
      mimeType,
      sizeBytes: buffer.length,
    });
    enqueue(document, { buffer });
    return document;
  }

  /** Accept pasted text (user notes or a YouTube transcript). */
  async function ingestText({ userId, topicId, name, type, text, sourceUrl }) {
    if (!TEXT_TYPES.has(type)) throw createHttpError(400, `Unsupported document type: ${type}`);
    if (!cleanText(text)) throw createHttpError(400, 'Document text is empty');
    await ensureTopic(userId, topicId);
    const document = await createRow({
      userId,
      topicId,
      name,
      type,
      mimeType: type === 'YOUTUBE' ? 'text/x-youtube-transcript' : 'text/plain',
      sizeBytes: Buffer.byteLength(text, 'utf-8'),
      sourceUrl,
    });
    enqueue(document, { text });
    return document;
  }

  async function getDocument(userId, id) {
    const document = await db.document.findFirst({ where: { id, userId }, include: documentInclude });
    if (!document) throw createHttpError(404, 'Document not found');
    return document;
  }

  async function listDocuments(userId, { topicId, status, type } = {}) {
    return db.document.findMany({
      where: {
        userId,
        ...(topicId ? { topicId } : {}),
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
      include: documentInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Stored chunks of a document, for the "source details" view. */
  async function listChunks(userId, id, { limit = 50, offset = 0 } = {}) {
    await getDocument(userId, id);
    return db.documentChunk.findMany({
      where: { documentId: id, userId },
      select: { id: true, chunkIndex: true, content: true, metadata: true },
      orderBy: { chunkIndex: 'asc' },
      skip: offset,
      take: limit,
    });
  }

  async function deleteDocument(userId, id) {
    const document = await getDocument(userId, id);
    await vectorStore.removeDocument(document.id, userId);
    await db.document.deleteMany({ where: { id: document.id, userId } });
    return document;
  }

  async function attachToTopic(userId, id, topicId) {
    const document = await getDocument(userId, id);
    await ensureTopic(userId, topicId);
    return db.document.update({
      where: { id: document.id },
      data: { topicId: topicId || null },
      include: documentInclude,
    });
  }

  /** Fail documents left mid-processing by a crash or restart. */
  async function failStaleDocuments(now = new Date()) {
    const result = await db.document.updateMany({
      where: { status: { in: ['UPLOADING', 'PROCESSING'] }, updatedAt: { lt: new Date(now.getTime() - STALE_PROCESSING_MS) } },
      data: { status: 'FAILED', errorMessage: 'Processing was interrupted. Please upload the file again.' },
    });
    return result.count;
  }

  /** Resolves when all background processing has finished (used by tests and shutdown). */
  async function whenIdle() {
    while (inFlight.size) await Promise.all([...inFlight]);
  }

  return {
    ingestFile,
    ingestText,
    getDocument,
    listDocuments,
    listChunks,
    deleteDocument,
    attachToTopic,
    failStaleDocuments,
    whenIdle,
  };
}

export const documentIngestionService = createDocumentIngestionService();
