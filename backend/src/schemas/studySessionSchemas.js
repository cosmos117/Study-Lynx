import { z } from 'zod';

const technique = z.enum(['POMODORO', 'DEEP_FOCUS', 'CUSTOM']);
const duration = z.coerce.number().int().min(1).max(1440);

export const sessionIdSchema = z.object({ id: z.coerce.number().int().positive() });

export const completeSessionSchema = z.object({
  actualDuration: duration.optional(),
});

export const studyNowSchema = z.object({
  plannedDuration: duration.optional(),
  technique: technique.optional(),
});
