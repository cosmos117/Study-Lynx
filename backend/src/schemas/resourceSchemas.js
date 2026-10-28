import { z } from 'zod';

const id = z.coerce.number().int().positive();
const youtubeUrl = z.string().trim().url().max(2048);
const percent = z.coerce.number().int().min(0).max(100);

export const resourceIdSchema = z.object({ id });
export const topicResourceParamsSchema = z.object({ topicId: id });
export const resourceQuerySchema = z.object({ topicId: id.optional() });
export const youtubeResourceSchema = z.object({
  topicId: id,
  url: youtubeUrl,
  title: z.string().trim().min(1).max(250).optional(),
  transcript: z.string().max(200000).optional(),
});
export const resourceProgressSchema = z.object({
  watchedPercent: percent,
  completed: z.boolean().optional().default(false),
});
