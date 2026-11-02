/**
 * VectorStoreService interface
 * ----------------------------
 * Stores document chunks with their embedding vectors and answers
 * similarity queries. The application depends on this interface, not on a
 * specific vector database.
 *
 * interface VectorStoreService {
 *   addChunks(documentId, userId, chunks: { chunkIndex, content, metadata? }[]): Promise<void>
 *   similaritySearch({ userId, queryEmbedding, queryText?, topK, threshold, documentIds?, topicId? }): Promise<ScoredChunk[]>
 *   removeDocument(documentId, userId): Promise<void>
 *   removeUser(userId): Promise<void>
 * }
 *
 * interface ScoredChunk {
 *   id, documentId, documentName, chunkIndex, content, metadata, score
 * }
 *
 * Isolation contract: every operation requires a userId. Implementations must
 * only ever read or write chunks owned by that user, and must fail closed
 * (throw) when userId is missing.
 *
 * MySQL implementation notes: embeddings are stored as JSON arrays on
 * DocumentChunk.embedding and cosine similarity is computed in application
 * memory, after the user/document/topic filters are applied in SQL. This works
 * with any MySQL version and needs no vector extension. When the dataset
 * grows, swap this implementation for pgvector / MySQL 8.4+ vector storage
 * behind the same interface.
 */

import { cosineSimilarity } from './embeddingService.js';
import { documentFrequencies, keywordScore, terms } from './lexical.js';

// How much exact keyword overlap adds to the meaning score, and how much overlap alone is enough
// to include a passage (for when meaning-based search misses an exact term, or is unavailable).
const KEYWORD_WEIGHT = 0.25;
const KEYWORD_ONLY_MIN = 0.5;
const REINDEX_BATCH = 100;
// Documents whose chunks (with their embedding vectors) are kept in memory between questions.
const CACHE_DOCUMENTS = 200;
// After the embedding provider refuses (e.g. its daily quota is used up), wait this long before
// trying to re-embed passages again, rather than retrying on every question.
const REINDEX_PAUSE_MS = 10 * 60 * 1000;

function requireUserId(userId) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('userId is required for vector store operations');
  }
}

/**
 * Ranks chunks for a question. A chunk is kept when its meaning is close enough (cosine similarity
 * at or above `threshold`) or, given `queryText`, when it contains most of the question's key terms.
 * `queryEmbedding` may be null (embedding provider down): then keywords alone decide.
 */
export function scoreChunks(chunks, queryEmbedding, topK, threshold, queryText) {
  const queryTerms = queryText ? terms(queryText) : [];
  const chunkTerms = queryTerms.length ? chunks.map((chunk) => terms(chunk.content)) : [];
  const frequencies = documentFrequencies(chunkTerms);
  const scored = chunks
    .map((chunk, index) => {
      const comparable = Array.isArray(queryEmbedding) && Array.isArray(chunk.embedding) && chunk.embedding.length === queryEmbedding.length;
      const semantic = comparable ? cosineSimilarity(queryEmbedding, chunk.embedding) : null;
      const keyword = queryTerms.length ? keywordScore(queryTerms, chunkTerms[index], frequencies, chunks.length) : 0;
      const keep = (semantic !== null && semantic >= threshold) || keyword >= KEYWORD_ONLY_MIN;
      if (!keep) return null;
      const score = semantic === null ? keyword : queryTerms.length ? semantic * (1 - KEYWORD_WEIGHT) + keyword * KEYWORD_WEIGHT : semantic;
      return { ...chunk, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return scored.map(({ embedding, ...rest }) => rest);
}

/**
 * MySQL-backed vector store (Prisma + DocumentChunk.embedding JSON).
 */
export function createMysqlVectorStoreService({ prisma, embeddingService, onReindex = (event) => console.log(JSON.stringify({ event: 'rag.reindex', ...event })) }) {
  /**
   * Chunks of recently searched documents, keyed by document id. Each entry is stamped with the
   * document's updatedAt: ingestion changes it, so a changed document is reloaded, while a search
   * only reads the (tiny) document list instead of every chunk's embedding vector.
   */
  const chunkCache = new Map();
  let reindexPausedUntil = 0;

  function remember(documentId, version, chunks) {
    chunkCache.delete(documentId);
    chunkCache.set(documentId, { version, chunks });
    while (chunkCache.size > CACHE_DOCUMENTS) chunkCache.delete(chunkCache.keys().next().value);
  }

  async function loadChunks(userId, documents) {
    const result = [];
    const missing = [];
    for (const document of documents) {
      const cached = chunkCache.get(document.id);
      if (cached && cached.version === document.updatedAt.getTime()) {
        chunkCache.delete(document.id);
        chunkCache.set(document.id, cached); // most recently used last
        result.push(...cached.chunks);
      } else {
        missing.push(document);
      }
    }
    if (missing.length) {
      const rows = await prisma.documentChunk.findMany({
        where: { userId, documentId: { in: missing.map((document) => document.id) } },
        select: { id: true, documentId: true, chunkIndex: true, content: true, metadata: true, embedding: true },
      });
      for (const document of missing) {
        const chunks = rows.filter((row) => row.documentId === document.id).map((row) => ({ ...row, documentName: document.name }));
        remember(document.id, document.updatedAt.getTime(), chunks);
        result.push(...chunks);
      }
    }
    return result;
  }

  async function assertDocumentOwnership(documentId, userId) {
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
      select: { id: true },
    });
    if (!document) {
      const error = new Error('Document not found');
      error.statusCode = 404;
      throw error;
    }
  }

  async function addChunks(documentId, userId, chunks = []) {
    requireUserId(userId);
    await assertDocumentOwnership(documentId, userId);
    chunkCache.delete(documentId);
    if (chunks.length === 0) return;
    // If embedding fails (provider down, or its daily quota used up), the passages are still saved:
    // keyword search finds them now, and they are embedded the next time they are searched.
    let embeddings;
    try {
      embeddings = await embeddingService.embedTexts(chunks.map((chunk) => chunk.content));
    } catch (error) {
      onReindex?.({ count: 0, deferred: chunks.length, reason: error.message });
      reindexPausedUntil = Date.now() + REINDEX_PAUSE_MS;
      embeddings = chunks.map(() => []);
    }
    await prisma.$transaction(
      chunks.map((chunk, index) =>
        prisma.documentChunk.create({
          data: {
            userId,
            documentId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            metadata: chunk.metadata || {},
            embedding: embeddings[index],
          },
        })
      )
    );
  }

  /**
   * Chunks indexed by an older or different embedding provider can't be compared with today's
   * question vector, so they are re-embedded the first time they are searched. If that fails,
   * keyword matching still covers them for this search, and it is retried next time.
   */
  async function refreshStaleEmbeddings(chunks, size) {
    const stale = chunks.filter((chunk) => !Array.isArray(chunk.embedding) || chunk.embedding.length !== size);
    if (!stale.length || embeddingService.dimension !== size || Date.now() < reindexPausedUntil) return;
    try {
      for (let start = 0; start < stale.length; start += REINDEX_BATCH) {
        const batch = stale.slice(start, start + REINDEX_BATCH);
        const vectors = await embeddingService.embedTexts(batch.map((chunk) => chunk.content));
        await prisma.$transaction(batch.map((chunk, index) => prisma.documentChunk.update({
          where: { id: chunk.id },
          data: { embedding: vectors[index] },
        })));
        batch.forEach((chunk, index) => { chunk.embedding = vectors[index]; });
      }
      onReindex?.({ count: stale.length });
    } catch (error) {
      reindexPausedUntil = Date.now() + REINDEX_PAUSE_MS;
      onReindex?.({ count: 0, failed: stale.length, reason: error.message });
    }
  }

  async function similaritySearch({ userId, queryEmbedding, queryText, topK = 10, threshold = 0, documentIds = [], topicId }) {
    requireUserId(userId);
    const documents = await prisma.document.findMany({
      where: {
        userId,
        status: 'READY',
        ...(documentIds.length ? { id: { in: documentIds } } : {}),
        // A topic searches its own sources and the ones shared by its subject.
        ...(topicId ? { OR: [{ topicId }, { subject: { topics: { some: { id: topicId } } } }] } : {}),
      },
      select: { id: true, name: true, updatedAt: true },
    });
    const chunks = await loadChunks(userId, documents);
    // Re-embedding updates the cached chunk objects in place, so the cache stays current.
    if (Array.isArray(queryEmbedding)) await refreshStaleEmbeddings(chunks, queryEmbedding.length);
    return scoreChunks(chunks, queryEmbedding, topK, threshold, queryText);
  }

  async function removeDocument(documentId, userId) {
    requireUserId(userId);
    await assertDocumentOwnership(documentId, userId);
    chunkCache.delete(documentId);
    await prisma.documentChunk.deleteMany({ where: { documentId, userId } });
  }

  async function removeUser(userId) {
    requireUserId(userId);
    await prisma.documentChunk.deleteMany({ where: { userId } });
  }

  return { addChunks, similaritySearch, removeDocument, removeUser };
}

/**
 * In-memory vector store (tests / local development without a database).
 */
export function createMemoryVectorStore({ embeddingService }) {
  const chunks = new Map();
  let sequence = 0;

  async function addChunks(documentId, userId, items = []) {
    requireUserId(userId);
    if (items.length === 0) return;
    const embeddings = await embeddingService.embedTexts(items.map((item) => item.content));
    for (let i = 0; i < items.length; i += 1) {
      sequence += 1;
      chunks.set(sequence, {
        id: sequence,
        documentId,
        userId,
        topicId: items[i].topicId,
        chunkIndex: items[i].chunkIndex,
        content: items[i].content,
        metadata: items[i].metadata || {},
        documentName: items[i].documentName ?? items[i].metadata?.source,
        embedding: embeddings[i],
      });
    }
  }

  async function similaritySearch({ userId, queryEmbedding, queryText, topK = 10, threshold = 0, documentIds = [], topicId }) {
    requireUserId(userId);
    const candidates = [...chunks.values()].filter((chunk) =>
      chunk.userId === userId
      && (!documentIds.length || documentIds.includes(chunk.documentId))
      && (!topicId || chunk.topicId === topicId));
    return scoreChunks(candidates, queryEmbedding, topK, threshold, queryText);
  }

  async function removeDocument(documentId, userId) {
    requireUserId(userId);
    for (const [id, chunk] of chunks) {
      if (chunk.documentId === documentId && chunk.userId === userId) chunks.delete(id);
    }
  }

  async function removeUser(userId) {
    requireUserId(userId);
    for (const [id, chunk] of chunks) {
      if (chunk.userId === userId) chunks.delete(id);
    }
  }

  return { addChunks, similaritySearch, removeDocument, removeUser };
}
