import { describe, expect, it, vi } from 'vitest';
import { createEmbeddingService, createGeminiEmbeddingService, createLocalEmbeddingService } from './embeddingService.js';
import { documentFrequencies, keywordScore, terms } from './lexical.js';
import { createMysqlVectorStoreService, scoreChunks } from './vectorStoreService.js';

const okResponse = (vectors) => ({ ok: true, status: 200, json: async () => ({ embeddings: vectors.map((values) => ({ values })) }) });

describe('Gemini embeddings', () => {
  const build = (fetchImpl, options = {}) => createGeminiEmbeddingService({
    apiKey: 'test-key', dimension: 3, fetchImpl, sleep: async () => {}, requestsPerMinute: Infinity, tokensPerMinute: Infinity, ...options,
  });

  it('embeds passages and questions with the matching task type, normalised to unit length', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse([[3, 4, 0]]));
    const service = build(fetchImpl);

    expect(await service.embedQuery('what is BCNF?')).toEqual([0.6, 0.8, 0]);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.requests[0]).toMatchObject({ taskType: 'RETRIEVAL_QUERY', outputDimensionality: 3, content: { parts: [{ text: 'what is BCNF?' }] } });

    await service.embedTexts(['A passage.']);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).requests[0].taskType).toBe('RETRIEVAL_DOCUMENT');
  });

  it('sends large batches in groups of 100 and keeps results in order', async () => {
    const fetchImpl = vi.fn(async (_url, { body }) => okResponse(JSON.parse(body).requests.map((_, index) => [index + 1, 0, 0])));
    const vectors = await build(fetchImpl).embedTexts(Array.from({ length: 150 }, (_, index) => `passage ${index}`));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(vectors).toHaveLength(150);
    expect(vectors.every((vector) => vector[0] === 1)).toBe(true);
  });

  it('never sends empty text, which has nothing to embed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse([[0, 1, 0]]));
    const vectors = await build(fetchImpl).embedTexts(['', 'real text', '   ']);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).requests).toHaveLength(1);
    expect(vectors).toEqual([[0, 0, 0], [0, 1, 0], [0, 0, 0]]);
  });

  it('retries a rate limit or server error, but not a bad request', async () => {
    const busy = { ok: false, status: 429, json: async () => ({}) };
    const fetchImpl = vi.fn().mockResolvedValueOnce(busy).mockResolvedValueOnce(okResponse([[1, 0, 0]]));
    expect(await build(fetchImpl).embedQuery('x')).toEqual([1, 0, 0]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const rejected = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) });
    await expect(build(rejected).embedQuery('x')).rejects.toThrow(/400/);
    expect(rejected).toHaveBeenCalledTimes(1);
  });

  it('paces indexing: smaller batches that fit the per-minute token quota, reserved before each call', async () => {
    const fetchImpl = vi.fn(async (_url, { body }) => okResponse(JSON.parse(body).requests.map(() => [1, 0, 0])));
    const window = { acquire: vi.fn(async () => {}) };
    // 3,000 tokens a minute, so each batch carries at most ~1,000 tokens (about 4,000 characters).
    const service = build(fetchImpl, { requestsPerMinute: 90, tokensPerMinute: 3000, window });
    const passage = 'x'.repeat(1600); // ~404 tokens each
    await service.embedTexts(Array.from({ length: 6 }, () => passage));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(window.acquire.mock.calls.map(([options]) => options.requests)).toEqual([2, 2, 2]);
    expect(window.acquire.mock.calls[0][0].tokens).toBeGreaterThan(700);
  });

  it('lets a question wait only briefly for quota, but an upload wait for minutes', async () => {
    const fetchImpl = vi.fn(async (_url, { body }) => okResponse(JSON.parse(body).requests.map(() => [1, 0, 0])));
    const window = { acquire: vi.fn(async () => {}) };
    const service = build(fetchImpl, { window });
    await service.embedQuery('what is BCNF?');
    await service.embedTexts(['a passage']);
    const [question, upload] = window.acquire.mock.calls.map(([options]) => options.maxWaitMs);
    expect(question).toBeLessThanOrEqual(5000);
    expect(upload).toBeGreaterThanOrEqual(60000);
  });

  it('is chosen automatically when a Gemini key is set, and the offline fallback otherwise', () => {
    expect(createEmbeddingService({ provider: 'auto', apiKey: 'k', model: 'gemini-embedding-001' }).id).toBe('gemini:gemini-embedding-001:768');
    expect(createEmbeddingService({ provider: 'auto', apiKey: '' }).id).toMatch(/^local:/);
    expect(() => createGeminiEmbeddingService({ apiKey: '' })).toThrow(/GEMINI_API_KEY/);
  });
});

describe('keyword matching', () => {
  it('reads content words and folds plurals', () => {
    expect(terms('What are the Candidate Keys in BCNF?')).toEqual(['candidate', 'key', 'bcnf']);
  });

  it('scores the share of question terms a passage contains, weighting rare terms more', () => {
    const passages = [terms('BCNF requires every determinant to be a candidate key'), terms('a key identifies a row'), terms('another key example')];
    const frequencies = documentFrequencies(passages);
    const query = terms('BCNF key');
    const withBoth = keywordScore(query, passages[0], frequencies, passages.length);
    const withCommonOnly = keywordScore(query, passages[1], frequencies, passages.length);
    expect(withBoth).toBe(1);
    expect(withCommonOnly).toBeGreaterThan(0);
    expect(withCommonOnly).toBeLessThan(0.5);
  });
});

describe('scoring passages', () => {
  const chunk = (id, content, embedding) => ({ id, content, embedding });

  it('keeps an exact-term match even when its meaning score is below the threshold', () => {
    const chunks = [chunk(1, 'BCNF: every determinant is a candidate key', [0, 1]), chunk(2, 'Photosynthesis in plants', [0.1, 0.99])];
    const results = scoreChunks(chunks, [1, 0], 5, 0.6, 'BCNF determinant');
    expect(results.map((item) => item.id)).toEqual([1]);
  });

  it('ranks by meaning plus a small keyword boost', () => {
    const chunks = [chunk(1, 'unrelated words here', [0.8, 0.6]), chunk(2, 'normalization removes redundancy', [0.8, 0.6])];
    const results = scoreChunks(chunks, [0.8, 0.6], 5, 0.6, 'normalization redundancy');
    expect(results[0].id).toBe(2);
  });

  it('searches by keywords alone when there is no question vector', () => {
    const chunks = [chunk(1, 'third normal form 3NF', [1, 0]), chunk(2, 'cooking pasta', [1, 0])];
    expect(scoreChunks(chunks, null, 5, 0.6, '3NF normal form').map((item) => item.id)).toEqual([1]);
  });
});

describe('re-indexing older passages', () => {
  function fakePrisma(rows) {
    return {
      rows,
      document: { findMany: vi.fn(async () => [{ id: 9, name: 'Notes.pdf', updatedAt: new Date('2026-11-01') }]) },
      documentChunk: {
        findMany: vi.fn(async () => rows.map((row) => ({ ...row, documentId: 9 }))),
        update: vi.fn(async ({ where, data }) => { rows.find((row) => row.id === where.id).embedding = data.embedding; }),
      },
      $transaction: async (operations) => Promise.all(operations),
    };
  }

  it('re-embeds passages stored with a different embedding size, saves them, then finds them', async () => {
    const prisma = fakePrisma([{ id: 1, chunkIndex: 0, content: 'BCNF candidate key', embedding: new Array(256).fill(0.1), metadata: {} }]);
    const embeddingService = { dimension: 2, embedTexts: vi.fn(async (texts) => texts.map(() => [1, 0])) };
    const onReindex = vi.fn();
    const store = createMysqlVectorStoreService({ prisma, embeddingService, onReindex });

    const results = await store.similaritySearch({ userId: 1, queryEmbedding: [1, 0], queryText: 'BCNF', topK: 5, threshold: 0.6 });

    expect(embeddingService.embedTexts).toHaveBeenCalledWith(['BCNF candidate key']);
    expect(prisma.rows[0].embedding).toEqual([1, 0]);
    expect(onReindex).toHaveBeenCalledWith({ count: 1 });
    expect(results).toHaveLength(1);
  });

  it('still answers by keywords if re-embedding fails, and pauses retries for a while', async () => {
    const prisma = fakePrisma([{ id: 1, chunkIndex: 0, content: 'BCNF candidate key', embedding: [0.5, 0.5, 0.5], metadata: {} }]);
    const embeddingService = { dimension: 2, embedTexts: vi.fn().mockRejectedValue(new Error('offline')) };
    const store = createMysqlVectorStoreService({ prisma, embeddingService, onReindex: vi.fn() });

    const results = await store.similaritySearch({ userId: 1, queryEmbedding: [1, 0], queryText: 'BCNF candidate key', topK: 5, threshold: 0.6 });
    expect(results).toHaveLength(1);
    expect(prisma.documentChunk.update).not.toHaveBeenCalled();
  });

  it('leaves passages alone when they already match', async () => {
    const local = createLocalEmbeddingService({ dimension: 16 });
    const stored = await local.embedText('x');
    const prisma = fakePrisma([{ id: 1, chunkIndex: 0, content: 'x', embedding: stored, metadata: {} }]);
    const embeddingService = { ...local, embedTexts: vi.fn() };
    await createMysqlVectorStoreService({ prisma, embeddingService, onReindex: vi.fn() })
      .similaritySearch({ userId: 1, queryEmbedding: stored, topK: 5, threshold: 0 });
    expect(embeddingService.embedTexts).not.toHaveBeenCalled();
  });

  it('pauses re-embedding after a refusal instead of retrying on every question', async () => {
    const prisma = fakePrisma([{ id: 1, chunkIndex: 0, content: 'BCNF candidate key', embedding: [], metadata: {} }]);
    const embeddingService = { dimension: 2, embedTexts: vi.fn().mockRejectedValue(new Error('quota exceeded')) };
    const store = createMysqlVectorStoreService({ prisma, embeddingService, onReindex: vi.fn() });
    const search = () => store.similaritySearch({ userId: 1, queryEmbedding: [1, 0], queryText: 'BCNF candidate key', topK: 5, threshold: 0.6 });
    await search();
    await search();
    expect(embeddingService.embedTexts).toHaveBeenCalledTimes(1);
  });
});

describe('saving passages when embedding is unavailable', () => {
  it('still saves an upload (without vectors) so keyword search works, instead of failing it', async () => {
    const created = [];
    const prisma = {
      document: { findFirst: async () => ({ id: 9 }) },
      documentChunk: { create: vi.fn(async ({ data }) => { created.push(data); return data; }) },
      $transaction: async (operations) => Promise.all(operations),
    };
    const embeddingService = { dimension: 768, embedTexts: vi.fn().mockRejectedValue(new Error('daily quota used up')) };
    const onReindex = vi.fn();
    const store = createMysqlVectorStoreService({ prisma, embeddingService, onReindex });

    await expect(store.addChunks(9, 1, [{ chunkIndex: 0, content: 'BCNF text' }, { chunkIndex: 1, content: '3NF text' }])).resolves.toBeUndefined();
    expect(created.map((row) => [row.content, row.embedding])).toEqual([['BCNF text', []], ['3NF text', []]]);
    expect(onReindex).toHaveBeenCalledWith(expect.objectContaining({ deferred: 2 }));
  });
});
