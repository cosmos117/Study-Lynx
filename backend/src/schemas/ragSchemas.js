import { z } from 'zod';
import { env } from '../config/env.js';

export const TUTOR_MODES = ['ask', 'simpler', 'example', 'quiz', 'flashcards'];

const id = z.coerce.number().int().positive();

export const documentIdSchema = z.object({ id });
// A source belongs to one topic, or is shared by a whole subject: exactly one of the two.
// Without either it would be shown nowhere and could never be deleted.
const oneOwner = (value) => Boolean(value.topicId) !== Boolean(value.subjectId);
const ONE_OWNER_MESSAGE = 'A source belongs to either a topic or a subject';
const maxChars = env.rag.maxDocumentChars;

export const documentUploadSchema = z.object({
  topicId: id.optional(),
  subjectId: id.optional(),
  name: z.string().trim().min(1).max(190).optional(),
}).refine(oneOwner, ONE_OWNER_MESSAGE);
export const documentTextSchema = z.object({
  topicId: id.optional(),
  subjectId: id.optional(),
  name: z.string().trim().min(1).max(190),
  type: z.enum(['NOTE', 'YOUTUBE']),
  text: z.string().trim().min(1).max(maxChars, `This is too long (limit ${maxChars.toLocaleString('en-US')} characters). Split it into smaller parts.`),
  sourceUrl: z.string().url().max(2048).optional(),
}).refine(oneOwner, ONE_OWNER_MESSAGE);

// Models often send null for an optional field they have nothing for; treat it as left out.
const orDefault = (schema, fallback) => z.preprocess((value) => value ?? undefined, schema.default(fallback));

export const tutorAnswerSchema = z.object({
  answer: z.string().min(1).max(6000),
  generalExplanation: orDefault(z.string().max(4000), ''),
  sourceBacked: orDefault(z.boolean(), false),
  needsMoreSources: orDefault(z.boolean(), false),
  citedSourceIndices: orDefault(z.array(z.number().int()).max(50), []),
});

export const tutorHistoryQuerySchema = z.object({ topicId: id });

export const tutorAskSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  mode: z.enum(TUTOR_MODES).default('ask'),
  topicId: id.optional(),
  documentIds: z.array(id).max(50).default([]),
  topK: z.coerce.number().int().min(1).max(50).default(env.rag.topK),
  // Optional: without it, retrieval uses the configured or the embedding provider's default.
  threshold: z.coerce.number().min(0).max(1).optional(),
});
