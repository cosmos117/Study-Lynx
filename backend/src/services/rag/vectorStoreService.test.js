import { describe, expect, it, vi } from 'vitest';
import { createMemoryVectorStore, createMysqlVectorStoreService, scoreChunks } from './vectorStoreService.js';
import { createLocalEmbeddingService } from './embeddingService.js';

describe('scoreChunks (pure)', () => {
  const query = new Array(8).fill(0).map((_, i) => i % 2 === 0 ? 1 : 0);

  it('filters chunks with wrong embedding dimension', () => {
    const chunks = [
      { id: 1, documentId: 1, userId: 1, embedding: [1, 0] },
      { id: 2, documentId: 1, userId: 1, embedding: new Array(8).fill(1) },
    ];
    const scored = scoreChunks(chunks, query, 10, 0);
    expect(scored).toHaveLength(1);
    expect(scored[0].id).toBe(2);
  });

  it('applies threshold and topK and sorts by score desc', () => {
    const chunks = [
      { id: 1, documentId: 1, userId: 1, embedding: new Array(8).fill(1) },
      { id: 2, documentId: 1, userId: 1, embedding: new Array(8).fill(0) },
      { id: 3, documentId: 1, userId: 1, embedding: [1, 0, 1, 0, 1, 0, 1, 0] },
    ];
    const top2 = scoreChunks(chunks, query, 2, 0);
    expect(top2).toHaveLength(2);
    expect(top2[0].id).toBe(3);
    expect(top2[0].score).toBeGreaterThanOrEqual(top2[1].score);

    const aboveThreshold = scoreChunks(chunks, query, 10, 0.9);
    expect(aboveThreshold).toHaveLength(1);
    expect(aboveThreshold[0].id).toBe(3);
  });

  it('strips embeddings from results', () => {
    const chunks = [{ id: 1, documentId: 1, userId: 1, content: 'x', embedding: new Array(8).fill(1) }];
    const scored = scoreChunks(chunks, query, 10, 0);
    expect(scored[0].embedding).toBeUndefined();
  });
});

describe('memory vector store', () => {
  const embedding = createLocalEmbeddingService({ dimension: 32 });

  async function seed(store, userId, documents) {
    let id = 1;
    for (const document of documents) {
      await store.addChunks(document.documentId, userId, document.chunks.map((content, index) => ({
        chunkIndex: index,
        content,
        documentName: document.name,
        metadata: { source: document.name },
      })));
      id += 1;
    }
  }

  it('returns the most similar chunks for a user', async () => {
    const store = createMemoryVectorStore({ embeddingService: embedding });
    await seed(store, 1, [
      { documentId: 101, name: 'DBMS Notes.pdf', chunks: ['BCNF is stricter than 3NF because every determinant is a candidate key', 'Normalization reduces data redundancy'] },
    ]);
    const results = await store.similaritySearch({ userId: 1, queryEmbedding: await embedding.embedText('BCNF vs 3NF'), topK: 5, threshold: 0 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('BCNF');
    expect(results[0].documentName).toBe('DBMS Notes.pdf');
    expect(results[0].chunkIndex).toBe(0);
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].embedding).toBeUndefined();
  });

  it('never returns another user\'s chunks', async () => {
    const store = createMemoryVectorStore({ embeddingService: embedding });
    await seed(store, 1, [{ documentId: 101, name: 'User A.pdf', chunks: ['secret material of user A'] }]);
    await seed(store, 2, [{ documentId: 102, name: 'User B.pdf', chunks: ['secret material of user B'] }]);

    const queryEmbedding = await embedding.embedText('secret material');
    const results = await store.similaritySearch({ userId: 1, queryEmbedding, topK: 5, threshold: 0 });
    expect(results).toHaveLength(1);
    expect(results[0].documentName).toBe('User A.pdf');
  });

  it('respects topK', async () => {
    const store = createMemoryVectorStore({ embeddingService: embedding });
    await seed(store, 1, [{ documentId: 101, name: 'Doc.pdf', chunks: ['aaa aaa aaa', 'bbb bbb bbb', 'ccc ccc ccc', 'ddd ddd ddd', 'eee eee eee'] }]);
    const results = await store.similaritySearch({ userId: 1, queryEmbedding: await embedding.embedText('aaa'), topK: 2, threshold: 0 });
    expect(results).toHaveLength(2);
  });

  it('removeDocument deletes only that document\'s chunks', async () => {
    const store = createMemoryVectorStore({ embeddingService: embedding });
    await seed(store, 1, [
      { documentId: 101, name: 'One.pdf', chunks: ['content one'] },
      { documentId: 102, name: 'Two.pdf', chunks: ['content two'] },
    ]);
    await store.removeDocument(101, 1);
    const results = await store.similaritySearch({ userId: 1, queryEmbedding: await embedding.embedText('content'), topK: 5, threshold: 0 });
    expect(results).toHaveLength(1);
    expect(results[0].documentName).toBe('Two.pdf');
  });

  it('removeDocument cannot delete chunks owned by another user', async () => {
    const store = createMemoryVectorStore({ embeddingService: embedding });
    await seed(store, 1, [{ documentId: 101, name: 'One.pdf', chunks: ['content one'] }]);
    await store.removeDocument(101, 2);
    const results = await store.similaritySearch({ userId: 1, queryEmbedding: await embedding.embedText('content'), topK: 5, threshold: 0 });
    expect(results).toHaveLength(1);
  });

  it('filters by document ids before applying topK', async () => {
    const store = createMemoryVectorStore({ embeddingService: embedding });
    await seed(store, 1, [
      { documentId: 101, name: 'Strong.pdf', chunks: ['gamma gamma gamma', 'gamma gamma delta'] },
      { documentId: 102, name: 'Weak.pdf', chunks: ['delta only'] },
    ]);
    const results = await store.similaritySearch({
      userId: 1, queryEmbedding: await embedding.embedText('gamma'), topK: 1, threshold: 0, documentIds: [102],
    });
    expect(results.map((chunk) => chunk.documentName)).toEqual(['Weak.pdf']);
  });

  it('fails closed without a userId', async () => {
    const store = createMemoryVectorStore({ embeddingService: embedding });
    await expect(store.similaritySearch({ queryEmbedding: [1], topK: 5 })).rejects.toThrow(/userId/);
    await expect(store.addChunks(1, undefined, [{ chunkIndex: 0, content: 'x' }])).rejects.toThrow(/userId/);
    await expect(store.removeDocument(1)).rejects.toThrow(/userId/);
    await expect(store.removeUser(undefined)).rejects.toThrow(/userId/);
  });
});

describe('mysql vector store (query scoping)', () => {
  const embedding = createLocalEmbeddingService({ dimension: 32 });

  /** Fake Prisma that stores rows and honours the where-clause the store builds. */
  function createFakePrisma({ documents }) {
    const chunks = [];
    const inScope = (chunk, where) => {
      const document = documents.find((item) => item.id === chunk.documentId);
      if (where.userId !== undefined && chunk.userId !== where.userId) return false;
      if (where.documentId?.in && !where.documentId.in.includes(chunk.documentId)) return false;
      if (typeof where.documentId === 'number' && chunk.documentId !== where.documentId) return false;
      const documentWhere = where.document;
      if (documentWhere) {
        if (documentWhere.userId !== undefined && document.userId !== documentWhere.userId) return false;
        if (documentWhere.status && document.status !== documentWhere.status) return false;
        if (documentWhere.topicId && document.topicId !== documentWhere.topicId) return false;
      }
      return true;
    };
    return {
      chunks,
      document: { findFirst: async ({ where }) => documents.find((item) => item.id === where.id && item.userId === where.userId) || null },
      documentChunk: {
        create: async ({ data }) => { chunks.push({ ...data }); return data; },
        findMany: vi.fn(async ({ where }) => chunks.filter((chunk) => inScope(chunk, where)).map((chunk) => ({
          ...chunk, document: { name: documents.find((item) => item.id === chunk.documentId).name },
        }))),
        deleteMany: async ({ where }) => {
          const doomed = chunks.filter((chunk) => inScope(chunk, where));
          doomed.forEach((chunk) => chunks.splice(chunks.indexOf(chunk), 1));
          return { count: doomed.length };
        },
      },
      $transaction: async (operations) => Promise.all(operations),
    };
  }

  const documents = [
    { id: 1, userId: 1, name: 'A.pdf', status: 'READY', topicId: 10 },
    { id: 2, userId: 1, name: 'B.pdf', status: 'READY', topicId: 11 },
    { id: 3, userId: 2, name: 'C.pdf', status: 'READY', topicId: 10 },
    { id: 4, userId: 1, name: 'Pending.pdf', status: 'PROCESSING', topicId: 10 },
  ];

  async function seeded() {
    const prisma = createFakePrisma({ documents: documents.map((document) => ({ ...document })) });
    const store = createMysqlVectorStoreService({ prisma, embeddingService: embedding });
    for (const document of documents) {
      await store.addChunks(document.id, document.userId, [{ chunkIndex: 0, content: 'shared database normalization text' }]);
    }
    return { prisma, store };
  }
  const query = () => embedding.embedText('database normalization');

  it('stamps every stored chunk with its owner', async () => {
    const { prisma } = await seeded();
    expect(prisma.chunks.map((chunk) => [chunk.documentId, chunk.userId])).toEqual([[1, 1], [2, 1], [3, 2], [4, 1]]);
  });

  it('always scopes the query to the user and only returns READY documents', async () => {
    const { prisma, store } = await seeded();
    const results = await store.similaritySearch({ userId: 1, queryEmbedding: await query(), topK: 10, threshold: 0 });

    expect(results.map((chunk) => chunk.documentName).sort()).toEqual(['A.pdf', 'B.pdf']);
    const { where } = prisma.documentChunk.findMany.mock.calls[0][0];
    expect(where.userId).toBe(1);
    expect(where.document.userId).toBe(1);
    expect(results.every((chunk) => chunk.embedding === undefined)).toBe(true);
  });

  it('narrows by document ids and topic', async () => {
    const { store } = await seeded();
    const queryEmbedding = await query();
    const byDocument = await store.similaritySearch({ userId: 1, queryEmbedding, topK: 10, threshold: 0, documentIds: [2, 3] });
    expect(byDocument.map((chunk) => chunk.documentName)).toEqual(['B.pdf']);
    const byTopic = await store.similaritySearch({ userId: 1, queryEmbedding, topK: 10, threshold: 0, topicId: 11 });
    expect(byTopic.map((chunk) => chunk.documentName)).toEqual(['B.pdf']);
  });

  it('refuses to write chunks into a document the user does not own', async () => {
    const { store, prisma } = await seeded();
    await expect(store.addChunks(3, 1, [{ chunkIndex: 1, content: 'injected' }])).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.chunks.some((chunk) => chunk.content === 'injected')).toBe(false);
  });

  it('refuses to delete chunks of a document owned by someone else', async () => {
    const { store, prisma } = await seeded();
    await expect(store.removeDocument(3, 1)).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.chunks.filter((chunk) => chunk.documentId === 3)).toHaveLength(1);
    await store.removeDocument(1, 1);
    expect(prisma.chunks.filter((chunk) => chunk.documentId === 1)).toHaveLength(0);
  });

  it('fails closed without a userId', async () => {
    const { store } = await seeded();
    await expect(store.similaritySearch({ queryEmbedding: await query(), topK: 5 })).rejects.toThrow(/userId/);
  });
});
