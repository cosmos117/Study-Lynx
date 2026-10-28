/**
 * VectorStoreService interface
 * ----------------------------
 * Stores document chunks with their embedding vectors and answers
 * similarity queries. The application depends on this interface, not on a
 * specific vector database.
 *
 * interface VectorStoreService {
 *   addChunks(documentId, userId, chunks: { chunkIndex, content, metadata? }[]): Promise<void>
 *   similaritySearch({ userId, queryEmbedding, topK, threshold, documentIds?, topicId? }): Promise<ScoredChunk[]>
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

function requireUserId(userId) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('userId is required for vector store operations');
  }
}

export function scoreChunks(chunks, queryEmbedding, topK, threshold) {
  const scored = chunks
    .filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length === queryEmbedding.length)
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .filter((chunk) => chunk.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return scored.map(({ embedding, ...rest }) => rest);
}

/**
 * MySQL-backed vector store (Prisma + DocumentChunk.embedding JSON).
 */
export function createMysqlVectorStoreService({ prisma, embeddingService }) {
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
    if (chunks.length === 0) return;
    const embeddings = await embeddingService.embedTexts(chunks.map((chunk) => chunk.content));
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

  async function similaritySearch({ userId, queryEmbedding, topK = 10, threshold = 0, documentIds = [], topicId }) {
    requireUserId(userId);
    const chunks = await prisma.documentChunk.findMany({
      where: {
        userId,
        ...(documentIds.length ? { documentId: { in: documentIds } } : {}),
        document: { userId, status: 'READY', ...(topicId ? { topicId } : {}) },
      },
      include: { document: { select: { name: true } } },
    });
    return scoreChunks(chunks, queryEmbedding, topK, threshold).map(({ document, ...chunk }) => ({
      ...chunk,
      documentName: document.name,
    }));
  }

  async function removeDocument(documentId, userId) {
    requireUserId(userId);
    await assertDocumentOwnership(documentId, userId);
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

  async function similaritySearch({ userId, queryEmbedding, topK = 10, threshold = 0, documentIds = [], topicId }) {
    requireUserId(userId);
    const candidates = [...chunks.values()].filter((chunk) =>
      chunk.userId === userId
      && (!documentIds.length || documentIds.includes(chunk.documentId))
      && (!topicId || chunk.topicId === topicId));
    return scoreChunks(candidates, queryEmbedding, topK, threshold);
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
