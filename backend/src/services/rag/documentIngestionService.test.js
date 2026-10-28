import { readFileSync } from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocumentIngestionService } from './documentIngestionService.js';
import { createLocalEmbeddingService } from './embeddingService.js';
import { createMemoryVectorStore } from './vectorStoreService.js';
import { createRetrievalService } from './retrievalService.js';
import { createHttpError } from '../../utils/httpError.js';

const config = {
  allowedMimeTypes: ['application/pdf', 'text/plain'],
  maxFileSizeBytes: 1024 * 1024,
  maxDocumentChars: 5000,
  maxChunkChars: 300,
  chunkOverlapChars: 50,
};

const pdfFixture = readFileSync(new URL('./__fixtures__/two-page.pdf', import.meta.url));

const matches = (item, where = {}) => Object.entries(where).every(([key, expected]) => {
  if (expected && typeof expected === 'object' && 'in' in expected) return expected.in.includes(item[key]);
  if (expected && typeof expected === 'object' && 'lt' in expected) return item[key] < expected.lt;
  return item[key] === expected;
});

/** Minimal in-memory stand-in for the Prisma calls the service makes. */
function createFakeDb() {
  const documents = [];
  let sequence = 0;
  const touch = (document, data) => Object.assign(document, data, { updatedAt: new Date() });
  return {
    documents,
    document: {
      create: async ({ data }) => {
        const document = { id: (sequence += 1), updatedAt: new Date(), ...data };
        documents.push(document);
        return { ...document };
      },
      update: async ({ where, data }) => ({ ...touch(documents.find((item) => item.id === where.id), data) }),
      updateMany: async ({ where, data }) => {
        const found = documents.filter((item) => matches(item, where));
        found.forEach((item) => touch(item, data));
        return { count: found.length };
      },
      findFirst: async ({ where }) => documents.find((item) => matches(item, where)) || null,
      findMany: async ({ where }) => documents.filter((item) => matches(item, where)),
      deleteMany: async ({ where }) => {
        const found = documents.filter((item) => matches(item, where));
        found.forEach((item) => documents.splice(documents.indexOf(item), 1));
        return { count: found.length };
      },
    },
    documentChunk: { findMany: async () => [] },
  };
}

function setup(overrides = {}) {
  const db = createFakeDb();
  const embeddingService = createLocalEmbeddingService({ dimension: 64 });
  const vectorStore = createMemoryVectorStore({ embeddingService });
  const ownedTopics = { 7: [1], 8: [2] };
  const service = createDocumentIngestionService({
    db,
    embeddingService,
    vectorStore,
    config,
    log: () => {},
    assertTopicOwned: async (userId, topicId) => {
      if (!ownedTopics[userId]?.includes(topicId)) throw createHttpError(404, 'Topic not found');
    },
    ...overrides,
  });
  const retrieval = createRetrievalService({ vectorStore, embedding: embeddingService, log: () => {} });
  return { db, service, vectorStore, retrieval };
}

const notes = 'BCNF is stricter than 3NF. Every determinant must be a candidate key in BCNF. Normalization reduces redundancy.';
let ctx;
beforeEach(() => { ctx = setup(); });

async function ingestNotes(userId, name = 'DBMS Notes', text = notes, extra = {}) {
  const document = await ctx.service.ingestText({ userId, name, type: 'NOTE', text, ...extra });
  await ctx.service.whenIdle();
  return ctx.service.getDocument(userId, document.id);
}

describe('ingestion pipeline', () => {
  it('accepts text immediately as PROCESSING, then marks it READY with searchable chunks', async () => {
    const accepted = await ctx.service.ingestText({ userId: 7, topicId: 1, name: 'DBMS Notes', type: 'NOTE', text: notes });
    expect(accepted).toMatchObject({ status: 'PROCESSING', userId: 7, topicId: 1, type: 'NOTE' });

    await ctx.service.whenIdle();
    const ready = await ctx.service.getDocument(7, accepted.id);
    expect(ready.status).toBe('READY');
    expect(ready.processedAt).toBeInstanceOf(Date);

    const { chunks } = await ctx.retrieval.retrieve({ userId: 7, question: 'Why is BCNF stricter than 3NF?', threshold: 0.1 });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toMatchObject({ documentId: accepted.id, documentName: 'DBMS Notes', userId: 7 });
    expect(chunks[0].content).toContain('BCNF');
  });

  it('stores YouTube transcripts with their source url', async () => {
    const document = await ingestNotes(7, 'Lecture 3', 'Today we cover transactions and isolation levels.', {
      type: 'YOUTUBE',
      sourceUrl: 'https://youtu.be/abc123',
    });
    expect(document).toMatchObject({ type: 'YOUTUBE', status: 'READY', sourceUrl: 'https://youtu.be/abc123' });
  });

  it('extracts a real PDF and keeps page references on chunks', async () => {
    const accepted = await ctx.service.ingestFile({
      userId: 7, name: 'book.pdf', mimeType: 'application/pdf', buffer: pdfFixture, size: pdfFixture.length,
    });
    expect(accepted).toMatchObject({ type: 'PDF', status: 'PROCESSING' });
    await ctx.service.whenIdle();

    const document = await ctx.service.getDocument(7, accepted.id);
    expect(document).toMatchObject({ status: 'READY', pageCount: 2 });

    const { chunks } = await ctx.retrieval.retrieve({ userId: 7, question: 'normalization redundancy anomalies', threshold: 0.1 });
    expect(chunks[0].metadata).toMatchObject({ page: 2, source: 'book.pdf', type: 'PDF' });
  });

  it('treats an uploaded .txt file as a note', async () => {
    const buffer = Buffer.from('Plain text study notes about indexes and B-trees.');
    const document = await ctx.service.ingestFile({ userId: 7, name: 'notes.txt', mimeType: 'text/plain', buffer, size: buffer.length });
    expect(document.type).toBe('NOTE');
    await ctx.service.whenIdle();
    expect((await ctx.service.getDocument(7, document.id)).status).toBe('READY');
  });

  it('cleans control characters and hostile file names before saving', async () => {
    const document = await ingestNotes(7, '../..\\evil\u0000name.pdf', 'Some\u0000 clean text about joins.');
    expect(document.name).not.toMatch(/[\\/\u0000]/);
    const { chunks } = await ctx.retrieval.retrieve({ userId: 7, question: 'joins', threshold: 0 });
    expect(chunks[0].content).not.toContain('\u0000');
  });
});

describe('validation and malformed documents', () => {
  const upload = (overrides) => ctx.service.ingestFile({
    userId: 7, name: 'file', mimeType: 'application/pdf', buffer: pdfFixture, size: pdfFixture.length, ...overrides,
  });

  it('rejects unsupported mime types without creating a row', async () => {
    await expect(upload({ mimeType: 'image/png', buffer: Buffer.from('x'), size: 1 })).rejects.toMatchObject({ statusCode: 415 });
    expect(ctx.db.documents).toHaveLength(0);
  });

  it('rejects empty files', async () => {
    await expect(upload({ buffer: Buffer.alloc(0), size: 0 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects files over the size limit, judged by the real byte length', async () => {
    const big = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(config.maxFileSizeBytes)]);
    await expect(upload({ buffer: big, size: 10 })).rejects.toMatchObject({ statusCode: 413 });
  });

  it('rejects a file labelled PDF that does not contain PDF data', async () => {
    const buffer = Buffer.from('MZ\u0090\u0000 this is an executable pretending to be a pdf');
    await expect(upload({ buffer, size: buffer.length })).rejects.toMatchObject({ statusCode: 422 });
    expect(ctx.db.documents).toHaveLength(0);
  });

  it('rejects a "text" file containing binary data', async () => {
    const buffer = Buffer.from([0x68, 0x69, 0x00, 0x01, 0x02]);
    await expect(upload({ mimeType: 'text/plain', buffer, size: buffer.length })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('marks a corrupt PDF FAILED with a readable reason and stores no chunks', async () => {
    const corrupt = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from(Array.from({ length: 400 }, (_, i) => (i * 31) % 256))]);
    const accepted = await upload({ buffer: corrupt, size: corrupt.length });
    await ctx.service.whenIdle();

    const document = await ctx.service.getDocument(7, accepted.id);
    expect(document.status).toBe('FAILED');
    expect(document.errorMessage).toMatch(/damaged|could not be read/i);
    const { chunks } = await ctx.retrieval.retrieve({ userId: 7, question: 'anything', threshold: -1 });
    expect(chunks).toHaveLength(0);
  });

  it('marks a PDF with no extractable text (scanned) FAILED', async () => {
    const service = setup({ extractPages: async () => ({ pages: [{ page: 1, text: '  \n ' }], pageCount: 1 }) }).service;
    const accepted = await service.ingestFile({ userId: 7, name: 'scan.pdf', mimeType: 'application/pdf', buffer: pdfFixture, size: pdfFixture.length });
    await service.whenIdle();
    const document = await service.getDocument(7, accepted.id);
    expect(document.status).toBe('FAILED');
    expect(document.errorMessage).toMatch(/no readable text/i);
  });

  it('fails documents longer than the configured limit instead of silently truncating', async () => {
    const document = await ingestNotes(7, 'Huge', 'word '.repeat(2000));
    expect(document.status).toBe('FAILED');
    expect(document.errorMessage).toMatch(/too long/i);
  });

  it('hides internal error details from the stored failure message', async () => {
    const service = setup({ extractPages: async () => { throw new Error('ECONNREFUSED 10.0.0.5:3306 password=hunter2'); } }).service;
    const accepted = await service.ingestFile({ userId: 7, name: 'x.pdf', mimeType: 'application/pdf', buffer: pdfFixture, size: pdfFixture.length });
    await service.whenIdle();
    const document = await service.getDocument(7, accepted.id);
    expect(document.status).toBe('FAILED');
    expect(document.errorMessage).not.toContain('hunter2');
  });

  it('rejects empty text and unsupported text types', async () => {
    await expect(ctx.service.ingestText({ userId: 7, name: 'Empty', type: 'NOTE', text: '  \n ' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(ctx.service.ingestText({ userId: 7, name: 'X', type: 'PDF', text: 'text' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('requires the topic to belong to the user', async () => {
    await expect(ctx.service.ingestText({ userId: 7, topicId: 2, name: 'Notes', type: 'NOTE', text: notes }))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(ctx.db.documents).toHaveLength(0);
  });
});

describe('ownership isolation', () => {
  it('never returns another user\'s chunks from retrieval, even with explicit document ids', async () => {
    const mine = await ingestNotes(7, 'My Notes', 'BCNF is stricter than 3NF because of determinants.');
    const theirs = await ingestNotes(8, 'Their Notes', 'BCNF is stricter than 3NF because of determinants.');

    const own = await ctx.retrieval.retrieve({ userId: 7, question: 'BCNF 3NF determinants', threshold: 0 });
    expect(own.chunks.every((chunk) => chunk.documentId === mine.id && chunk.userId === 7)).toBe(true);

    const probing = await ctx.retrieval.retrieve({ userId: 7, question: 'BCNF 3NF determinants', threshold: 0, documentIds: [theirs.id] });
    expect(probing.chunks).toEqual([]);
  });

  it('hides other users\' documents from get, list, chunks, attach and delete', async () => {
    const document = await ingestNotes(7, 'Private');

    await expect(ctx.service.getDocument(8, document.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(ctx.service.listChunks(8, document.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(ctx.service.attachToTopic(8, document.id, 2)).rejects.toMatchObject({ statusCode: 404 });
    await expect(ctx.service.deleteDocument(8, document.id)).rejects.toMatchObject({ statusCode: 404 });
    expect(await ctx.service.listDocuments(8)).toEqual([]);

    expect((await ctx.service.getDocument(7, document.id)).name).toBe('Private');
    const { chunks } = await ctx.retrieval.retrieve({ userId: 7, question: 'BCNF', threshold: 0 });
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('refuses to attach a document to someone else\'s topic', async () => {
    const document = await ingestNotes(7, 'Mine');
    await expect(ctx.service.attachToTopic(7, document.id, 2)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('document management', () => {
  it('lists documents filtered by topic, status and type', async () => {
    await ingestNotes(7, 'Attached', notes, { topicId: 1 });
    await ingestNotes(7, 'Loose');
    await ingestNotes(7, 'Huge', 'word '.repeat(2000));

    expect(await ctx.service.listDocuments(7)).toHaveLength(3);
    expect((await ctx.service.listDocuments(7, { topicId: 1 })).map((d) => d.name)).toEqual(['Attached']);
    expect((await ctx.service.listDocuments(7, { status: 'FAILED' })).map((d) => d.name)).toEqual(['Huge']);
  });

  it('attaches and detaches a topic', async () => {
    const document = await ingestNotes(7, 'Notes');
    expect((await ctx.service.attachToTopic(7, document.id, 1)).topicId).toBe(1);
    expect((await ctx.service.attachToTopic(7, document.id, null)).topicId).toBeNull();
  });

  it('deleting a document removes its chunks from retrieval', async () => {
    const document = await ingestNotes(7, 'Doomed');
    await ctx.service.deleteDocument(7, document.id);

    expect(await ctx.service.listDocuments(7)).toEqual([]);
    const { chunks } = await ctx.retrieval.retrieve({ userId: 7, question: 'BCNF', threshold: -1 });
    expect(chunks).toEqual([]);
  });

  it('fails documents stuck in PROCESSING after a crash', async () => {
    const stuck = await ctx.db.document.create({ data: { userId: 7, name: 'Stuck', type: 'PDF', status: 'PROCESSING' } });
    ctx.db.documents.find((item) => item.id === stuck.id).updatedAt = new Date(Date.now() - 60 * 60 * 1000);
    const fresh = await ctx.db.document.create({ data: { userId: 7, name: 'Fresh', type: 'PDF', status: 'PROCESSING' } });

    expect(await ctx.service.failStaleDocuments()).toBe(1);
    expect(ctx.db.documents.find((item) => item.id === stuck.id).status).toBe('FAILED');
    expect(ctx.db.documents.find((item) => item.id === fresh.id).status).toBe('PROCESSING');
  });
});

describe('background processing safety', () => {
  it('never leaves an unhandled rejection when failure bookkeeping itself fails', async () => {
    const { service, db } = setup({ extractPages: async () => { throw new Error('boom'); } });
    db.document.update = vi.fn().mockRejectedValue(new Error('db down'));
    await service.ingestFile({ userId: 7, name: 'x.pdf', mimeType: 'application/pdf', buffer: pdfFixture, size: pdfFixture.length });
    await expect(service.whenIdle()).resolves.toBeUndefined();
  });
});
