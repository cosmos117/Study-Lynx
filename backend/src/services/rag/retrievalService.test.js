import { describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';
import { createRetrievalService } from './retrievalService.js';

const queryEmbedding = [0.5, 0.5];
const chunk = (id, documentId, score) => ({ id, documentId, documentName: `Doc ${documentId}`, chunkIndex: id, content: `chunk ${id}`, metadata: {}, score });

function build(results = []) {
  const vectorStore = { similaritySearch: vi.fn().mockResolvedValue(results) };
  const embedding = { embedText: vi.fn().mockResolvedValue(queryEmbedding) };
  const log = vi.fn();
  return { vectorStore, embedding, log, service: createRetrievalService({ vectorStore, embedding, log }) };
}

describe('retrievalService', () => {
  it('embeds the question and passes the full user-scoped query to the vector store', async () => {
    const { service, vectorStore, embedding } = build([chunk(1, 10, 0.9), chunk(2, 10, 0.8)]);

    const result = await service.retrieve({ userId: 7, question: 'BCNF vs 3NF', topK: 3, threshold: 0.5, documentIds: [10], topicId: 4 });

    expect(embedding.embedText).toHaveBeenCalledWith('BCNF vs 3NF');
    expect(vectorStore.similaritySearch).toHaveBeenCalledWith({
      userId: 7, queryEmbedding, queryText: 'BCNF vs 3NF', topK: 3, threshold: 0.5, documentIds: [10], topicId: 4,
    });
    expect(result.chunks).toHaveLength(2);
    expect(result.queryEmbedding).toBe(queryEmbedding);
  });

  it('uses configured topK and threshold when they are omitted', async () => {
    const { service, vectorStore } = build();
    await service.retrieve({ userId: 7, question: 'x' });
    expect(vectorStore.similaritySearch).toHaveBeenCalledWith(expect.objectContaining({ topK: 5, threshold: 0.35 }));
  });

  it('clamps an excessive topK', async () => {
    const { service, vectorStore } = build();
    await service.retrieve({ userId: 7, question: 'x', topK: 999 });
    expect(vectorStore.similaritySearch).toHaveBeenCalledWith(expect.objectContaining({ topK: 50 }));
  });

  it('refuses to search without a user', async () => {
    const { service, vectorStore } = build();
    await expect(service.retrieve({ question: 'x' })).rejects.toThrow(/userId/);
    await expect(service.retrieve({ userId: 'abc', question: 'x' })).rejects.toThrow(/userId/);
    expect(vectorStore.similaritySearch).not.toHaveBeenCalled();
  });

  it('logs retrieval metadata but never the question text or chunk contents', async () => {
    const { service, log } = build([chunk(1, 10, 0.91234), chunk(2, 11, 0.5)]);
    await service.retrieve({ userId: 7, question: 'my secret question about passwords', documentIds: [10, 11] });

    expect(log).toHaveBeenCalledTimes(1);
    const event = log.mock.calls[0][0];
    expect(event).toMatchObject({
      event: 'rag.retrieval', userId: 7, returnedCount: 2, topScore: 0.9123, scopedDocuments: 2, documentIds: [10, 11],
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('secret question');
    expect(serialized).not.toContain('chunk 1');
  });

  it('returns an empty result when nothing passes the threshold', async () => {
    const { service, log } = build([]);
    const result = await service.retrieve({ userId: 7, question: 'unrelated' });
    expect(result.chunks).toEqual([]);
    expect(log.mock.calls[0][0].topScore).toBeNull();
  });

  it("embeds questions with the provider's query mode when it has one", async () => {
    const { service, vectorStore, embedding } = build();
    embedding.embedQuery = vi.fn().mockResolvedValue([0.1, 0.9]);
    await service.retrieve({ userId: 7, question: 'what is BCNF?' });
    expect(embedding.embedQuery).toHaveBeenCalledWith('what is BCNF?');
    expect(embedding.embedText).not.toHaveBeenCalled();
    expect(vectorStore.similaritySearch.mock.calls[0][0].queryEmbedding).toEqual([0.1, 0.9]);
  });

  it('falls back to keyword search when the embedding provider fails', async () => {
    const { service, vectorStore, embedding, log } = build([chunk(1, 10, 0.7)]);
    embedding.embedText.mockRejectedValue(new Error('quota exceeded'));
    const result = await service.retrieve({ userId: 7, question: 'BCNF' });
    expect(vectorStore.similaritySearch.mock.calls[0][0]).toMatchObject({ queryEmbedding: null, queryText: 'BCNF' });
    expect(result.chunks).toHaveLength(1);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'rag.embedding_failed' }));
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'rag.retrieval', searchMode: 'keyword' }));
  });

  it("uses the embedding provider's own threshold when none is configured", async () => {
    const { service, vectorStore, embedding } = build();
    embedding.defaultThreshold = 0.6;
    await service.retrieve({ userId: 7, question: 'x' });
    const used = vectorStore.similaritySearch.mock.calls[0][0].threshold;
    expect([0.6, env.rag.similarityThreshold]).toContain(used);
  });

  it('reuses the vector for a question it has already embedded', async () => {
    const { service, embedding } = build();
    await service.retrieve({ userId: 7, question: 'what is BCNF?' });
    await service.retrieve({ userId: 7, question: 'what is BCNF?' });
    await service.retrieve({ userId: 7, question: 'what is 3NF?' });
    expect(embedding.embedText).toHaveBeenCalledTimes(2);
  });

  it('does not remember a failed embedding', async () => {
    const { service, embedding } = build();
    embedding.embedText.mockRejectedValueOnce(new Error('offline'));
    await service.retrieve({ userId: 7, question: 'BCNF' });
    await service.retrieve({ userId: 7, question: 'BCNF' });
    expect(embedding.embedText).toHaveBeenCalledTimes(2);
  });
});
