import { z } from 'zod';

export const topicAiParamsSchema = z.object({ topicId: z.coerce.number().int().positive() });
const idList = z.array(z.coerce.number().int().positive()).max(10).default([]);
export const aiGenerateSchema = z.object({
  regenerate: z.boolean().optional().default(false),
  // Ground the generation in these materials (uploaded documents / videos with a transcript).
  documentIds: idList,
  resourceIds: idList,
});
export const noteSaveSchema = z.object({ content: z.string().trim().min(1).max(50000) });
export const flashcardSchema = z.object({ question: z.string().trim().min(5).max(200), answer: z.string().trim().min(1).max(250) });
export const flashcardIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const reviewSchema = z.object({ rating: z.enum(['AGAIN', 'HARD', 'GOOD', 'EASY']) });
export const dueQuerySchema = z.object({
  topicId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export const quizSubmitSchema = z.object({
  answers: z.array(z.object({ questionIndex: z.number().int().nonnegative(), selectedIndex: z.number().int().min(-1).max(3) })).max(20),
});
