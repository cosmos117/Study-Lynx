import { z } from 'zod';
import { env } from '../config/env.js';

export const TUTOR_MODES = ['ask', 'simpler', 'example', 'quiz', 'flashcards'];

const id = z.coerce.number().int().positive();

export const documentIdSchema = z.object({ id });
export const documentQuerySchema = z.object({
  topicId: id.optional(),
  status: z.enum(['UPLOADING', 'PROCESSING', 'READY', 'FAILED']).optional(),
  type: z.enum(['PDF', 'NOTE', 'YOUTUBE']).optional(),
});
export const documentChunksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export const documentUploadSchema = z.object({
  topicId: id.optional(),
  name: z.string().trim().min(1).max(190).optional(),
});
export const documentAttachSchema = z.object({
  topicId: id.nullable().optional(),
});
export const documentTextSchema = z.object({
  topicId: id.optional(),
  name: z.string().trim().min(1).max(190),
  type: z.enum(['NOTE', 'YOUTUBE']),
  text: z.string().trim().min(1).max(env.rag.maxDocumentChars),
  sourceUrl: z.string().url().max(2048).optional(),
});

export const tutorAnswerSchema = z.object({
  answer: z.string().min(1).max(6000),
  generalExplanation: z.string().max(4000).default(''),
  sourceBacked: z.boolean().default(false),
  needsMoreSources: z.boolean().default(false),
  citedSourceIndices: z.array(z.number().int()).max(50).default([]),
});

export const tutorAskSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  mode: z.enum(TUTOR_MODES).default('ask'),
  topicId: id.optional(),
  documentIds: z.array(id).max(50).default([]),
  topK: z.coerce.number().int().min(1).max(50).default(env.rag.topK),
  threshold: z.coerce.number().min(0).max(1).default(env.rag.similarityThreshold),
});
