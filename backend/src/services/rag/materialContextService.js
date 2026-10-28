import prisma from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { createHttpError } from '../../utils/httpError.js';
import { retrievalService } from './retrievalService.js';

/**
 * MaterialContextService turns a student's chosen materials (uploaded documents and
 * saved YouTube transcripts) into one block of source text for the existing AI
 * generation pipeline (notes, flashcards, quiz, mind map).
 *
 * - Only READY documents / transcripts owned by the user can be used.
 * - If everything fits the input budget it is passed in reading order; otherwise the
 *   passages most relevant to the topic are selected through RAG retrieval.
 * - The result is data for a prompt, never instructions (see features.js).
 */
const MAX_SOURCES = 10;

export function createMaterialContextService({
  db = prisma,
  retrieval = retrievalService,
  maxChars = env.ai.inputMaxChars,
} = {}) {
  async function loadDocuments(userId, documentIds) {
    if (!documentIds.length) return [];
    const documents = await db.document.findMany({
      where: { id: { in: documentIds }, userId },
      select: { id: true, name: true, status: true },
    });
    if (documents.length !== new Set(documentIds).size) throw createHttpError(404, 'Material not found');
    const notReady = documents.find((document) => document.status !== 'READY');
    if (notReady) throw createHttpError(409, `"${notReady.name}" is not ready yet`);
    return documents;
  }

  async function loadTranscripts(userId, resourceIds) {
    if (!resourceIds.length) return [];
    const resources = await db.learningResource.findMany({
      where: { id: { in: resourceIds }, userId },
      select: { id: true, title: true, transcript: true },
    });
    if (resources.length !== new Set(resourceIds).size) throw createHttpError(404, 'Video not found');
    const missing = resources.find((resource) => !resource.transcript?.trim());
    if (missing) throw createHttpError(409, `"${missing.title}" has no transcript`);
    return resources;
  }

  /** Pick chunks of the given documents within the budget, in reading order. */
  async function documentText(userId, documents, topicName, budget) {
    const chunks = await db.documentChunk.findMany({
      where: { userId, documentId: { in: documents.map((document) => document.id) } },
      select: { id: true, documentId: true, chunkIndex: true, content: true },
      orderBy: [{ documentId: 'asc' }, { chunkIndex: 'asc' }],
    });
    let selected = chunks;
    if (chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) > budget) {
      // Too long: keep the passages most relevant to the topic until the budget is used.
      const { chunks: ranked } = await retrieval.retrieve({
        userId, question: topicName, documentIds: documents.map((document) => document.id), topK: 50, threshold: -1,
      });
      const rankedIds = new Set(ranked.map((chunk) => chunk.id));
      const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
      const order = [...ranked.map((chunk) => byId.get(chunk.id)), ...chunks.filter((chunk) => !rankedIds.has(chunk.id))];
      let used = 0;
      const picked = [];
      for (const chunk of order) {
        if (!chunk || used + chunk.content.length > budget) continue;
        picked.push(chunk);
        used += chunk.content.length;
      }
      selected = picked.sort((a, b) => a.documentId - b.documentId || a.chunkIndex - b.chunkIndex);
    }
    return documents.map((document) => {
      const text = selected.filter((chunk) => chunk.documentId === document.id).map((chunk) => chunk.content).join('\n\n');
      return text ? `### Source: ${document.name}\n${text}` : null;
    }).filter(Boolean);
  }

  /**
   * @returns {{ text: string, sources: { kind: 'document'|'video', id: number, name: string }[] } | null}
   */
  async function build(userId, { documentIds = [], resourceIds = [], topicName = '' } = {}) {
    if (documentIds.length + resourceIds.length === 0) return null;
    if (documentIds.length + resourceIds.length > MAX_SOURCES) throw createHttpError(400, `Choose at most ${MAX_SOURCES} sources`);

    const [documents, transcripts] = await Promise.all([loadDocuments(userId, documentIds), loadTranscripts(userId, resourceIds)]);
    const transcriptBudget = Math.floor(maxChars * (transcripts.length / (transcripts.length + documents.length)));
    const parts = [
      ...(documents.length ? await documentText(userId, documents, topicName, maxChars - transcriptBudget) : []),
      ...transcripts.map((resource) => `### Source: ${resource.title}\n${resource.transcript.trim().slice(0, Math.floor(transcriptBudget / transcripts.length))}`),
    ];
    if (!parts.length) throw createHttpError(409, 'The selected materials contain no readable text');

    return {
      text: parts.join('\n\n'),
      sources: [
        ...documents.map((document) => ({ kind: 'document', id: document.id, name: document.name })),
        ...transcripts.map((resource) => ({ kind: 'video', id: resource.id, name: resource.title })),
      ],
    };
  }

  return { build };
}

export const materialContextService = createMaterialContextService();
