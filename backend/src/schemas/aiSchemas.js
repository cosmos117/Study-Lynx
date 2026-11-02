import { z } from 'zod';

export const topicAiParamsSchema = z.object({ topicId: z.coerce.number().int().positive() });
const idList = z.array(z.coerce.number().int().positive()).max(10).default([]);
export const aiGenerateSchema = z.object({
  regenerate: z.boolean().optional().default(false),
  // Ground the generation in these materials (uploaded documents / videos with a transcript).
  documentIds: idList,
  resourceIds: idList,
  // Quizzes only: which sections to generate (all, or only MCQs, 2-mark or 5-mark questions).
  quizType: z.enum(['all', 'mcq', 'short', 'long']).optional().default('all'),
});
export const noteSaveSchema = z.object({ content: z.string().trim().min(1).max(50000) });
export const flashcardIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const reviewSchema = z.object({ rating: z.enum(['AGAIN', 'HARD', 'GOOD', 'EASY']) });
export const quizSubmitSchema = z.object({
  answers: z.array(z.object({ questionIndex: z.number().int().nonnegative(), selectedIndex: z.number().int().min(-1).max(3) })).max(20),
});
