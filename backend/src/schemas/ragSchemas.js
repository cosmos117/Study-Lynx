import { z } from 'zod';
import { env } from '../config/env.js';

export const TUTOR_MODES = ['ask', 'simpler', 'example', 'quiz', 'flashcards'];

const id = z.coerce.number().int().positive();

export const documentIdSchema = z.object({ id });
// Sources belong to a subject, and every topic in it uses them. A topic-only source is refused
// rather than silently saved without its owner.
const SUBJECT_REQUIRED = 'Add sources to a subject; every topic in it can then use them.';
const subjectOwner = {
  subjectId: z.coerce.number({ required_error: SUBJECT_REQUIRED, invalid_type_error: SUBJECT_REQUIRED }).int().positive(),
  topicId: z.unknown().optional(),
};
// Checked after the fields, so a topic-only request gets the message once, not once per field.
const noTopic = [(value) => value.topicId === undefined, { message: SUBJECT_REQUIRED, path: ['topicId'] }];
const maxChars = env.rag.maxDocumentChars;

export const documentUploadSchema = z.object({
  ...subjectOwner,
  name: z.string().trim().min(1).max(190).optional(),
}).refine(...noTopic);
export const documentTextSchema = z.object({
  ...subjectOwner,
  name: z.string().trim().min(1).max(190),
  type: z.enum(['NOTE', 'YOUTUBE']),
  text: z.string().trim().min(1).max(maxChars, `This is too long (limit ${maxChars.toLocaleString('en-US')} characters). Split it into smaller parts.`),
  sourceUrl: z.string().url().max(2048).optional(),
}).refine(...noTopic);

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
