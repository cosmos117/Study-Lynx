import prisma from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { embeddingService } from './embeddingService.js';
import { createMysqlVectorStoreService } from './vectorStoreService.js';

const MAX_TOP_K = 50;

/**
 * RetrievalService: turns a user question into ranked, relevant chunks.
 * Every search is scoped to the authenticated user (and optionally to specific
 * documents or a topic) inside the vector store, so top-K is computed within
 * the requested scope and no other user's material can ever be returned.
 */
export function createRetrievalService({
  vectorStore = createMysqlVectorStoreService({ prisma, embeddingService }),
  embedding = embeddingService,
  log = (event) => console.log(JSON.stringify(event)),
} = {}) {
  function normalizeOptions({ topK, threshold } = {}) {
    const k = Number.isFinite(Number(topK)) && Number(topK) >= 1
      ? Math.min(Math.floor(Number(topK)), MAX_TOP_K)
      : env.rag.topK;
    const t = Number.isFinite(threshold) ? Number(threshold) : env.rag.similarityThreshold;
    return { topK: k, threshold: t };
  }

  async function retrieve({
    userId,
    question,
    topK = env.rag.topK,
    threshold = env.rag.similarityThreshold,
    documentIds = [],
    topicId,
  } = {}) {
    if (!Number.isInteger(userId) || userId <= 0) throw new Error('userId is required for retrieval');
    const start = Date.now();
    const options = normalizeOptions({ topK, threshold });
    const queryEmbedding = await embedding.embedText(String(question));
    const chunks = await vectorStore.similaritySearch({
      userId,
      queryEmbedding,
      topK: options.topK,
      threshold: options.threshold,
      documentIds,
      topicId,
    });

    // Retrieval metadata only: no API keys, no document contents, no question text.
    log({
      event: 'rag.retrieval',
      userId,
      questionLength: String(question).length,
      topK: options.topK,
      threshold: options.threshold,
      scopedDocuments: documentIds.length,
      topicId: topicId ?? null,
      returnedCount: chunks.length,
      topScore: chunks.length ? Number(chunks[0].score.toFixed(4)) : null,
      documentIds: [...new Set(chunks.map((chunk) => chunk.documentId))],
      durationMs: Date.now() - start,
    });

    return { queryEmbedding, chunks };
  }

  return { retrieve };
}

export const retrievalService = createRetrievalService();
