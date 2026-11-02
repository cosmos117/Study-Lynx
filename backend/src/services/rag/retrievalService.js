import prisma from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { embeddingService } from './embeddingService.js';
import { createMysqlVectorStoreService } from './vectorStoreService.js';

const MAX_TOP_K = 50;
// Question vectors are reused for repeated questions (suggestion chips, retries, follow-ups).
const QUERY_CACHE_SIZE = 300;

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
  const queryCache = new Map();

  async function embedQuestion(text) {
    const key = `${embedding.id || ''}::${text}`;
    if (queryCache.has(key)) {
      const vector = queryCache.get(key);
      queryCache.delete(key);
      queryCache.set(key, vector); // most recently used last
      return vector;
    }
    const vector = await (embedding.embedQuery || embedding.embedText)(text);
    queryCache.set(key, vector);
    if (queryCache.size > QUERY_CACHE_SIZE) queryCache.delete(queryCache.keys().next().value);
    return vector;
  }

  function normalizeOptions({ topK, threshold } = {}) {
    const k = Number.isFinite(Number(topK)) && Number(topK) >= 1
      ? Math.min(Math.floor(Number(topK)), MAX_TOP_K)
      : env.rag.topK;
    // Similarity scores differ a lot between embedding providers, so each brings its own default.
    const fallback = env.rag.similarityThreshold ?? embedding.defaultThreshold ?? 0.35;
    const t = Number.isFinite(threshold) ? Number(threshold) : fallback;
    return { topK: k, threshold: t };
  }

  async function retrieve({
    userId,
    question,
    topK = env.rag.topK,
    threshold,
    documentIds = [],
    topicId,
  } = {}) {
    if (!Number.isInteger(userId) || userId <= 0) throw new Error('userId is required for retrieval');
    const start = Date.now();
    const options = normalizeOptions({ topK, threshold });
    // If the embedding provider is down, search by keywords alone rather than failing the question.
    let queryEmbedding = null;
    try {
      queryEmbedding = await embedQuestion(String(question));
    } catch (error) {
      log({ event: 'rag.embedding_failed', userId, reason: error.message });
    }
    const chunks = await vectorStore.similaritySearch({
      userId,
      queryEmbedding,
      queryText: String(question),
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
      searchMode: queryEmbedding ? 'semantic+keyword' : 'keyword',
      topScore: chunks.length ? Number(chunks[0].score.toFixed(4)) : null,
      documentIds: [...new Set(chunks.map((chunk) => chunk.documentId))],
      durationMs: Date.now() - start,
    });

    return { queryEmbedding, chunks };
  }

  return { retrieve };
}

export const retrievalService = createRetrievalService();
