import { z } from 'zod';

const technique = z.enum(['POMODORO', 'DEEP_FOCUS', 'CUSTOM']);
const date = z.coerce.date().refine((value) => !Number.isNaN(value.getTime()), 'A valid date is required');
const duration = z.coerce.number().int().min(1).max(1440);

export const sessionIdSchema = z.object({ id: z.coerce.number().int().positive() });

export const sessionQuerySchema = z.object({
  date: date.optional(),
  from: date.optional(),
  to: date.optional(),
});

export const createSessionSchema = z.object({
  topicId: z.coerce.number().int().positive(),
  date,
  startTime: date.optional(),
  plannedDuration: duration.optional(),
  duration: duration.optional(),
  technique: technique.default('POMODORO'),
}).refine((value) => value.plannedDuration || value.duration, 'A planned duration is required');

export const updateSessionSchema = z.object({
  date: date.optional(),
  startTime: date.nullish(),
  plannedDuration: duration.optional(),
  duration: duration.optional(),
  technique: technique.optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const completeSessionSchema = z.object({
  actualDuration: duration.optional(),
});

export const planSchema = z.object({
  examId: z.coerce.number().int().positive(),
  from: date.optional(),
  dailyAvailableHours: z.coerce.number().finite().min(0.25).max(24).optional(),
  topicIds: z.array(z.coerce.number().int().positive()).min(1).optional(),
  technique: technique.default('POMODORO'),
});

export const studyNowSchema = z.object({
  plannedDuration: duration.optional(),
  technique: technique.optional(),
});
