import { z } from 'zod';

const topicBodySchema = z.object({
  name: z.string().trim().min(1).max(150),
  difficulty: z.enum(['WEAK', 'AVERAGE', 'STRONG']).default('AVERAGE'),
});

export const createTopicSchema = topicBodySchema;

export const subjectIdSchema = z.object({
  subjectId: z.coerce.number().int().positive(),
});

export const topicIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});
