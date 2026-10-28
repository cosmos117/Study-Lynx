import { z } from 'zod';

const examDateSchema = z.coerce.date().refine(
  (date) => !Number.isNaN(date.getTime()),
  'A valid exam date is required',
);

const dailyStudyHoursSchema = z.coerce.number()
  .finite()
  .min(0.25, 'Daily study hours must be at least 0.25')
  .max(24, 'Daily study hours cannot exceed 24');

export const createExamSchema = z.object({
  name: z.string().trim().min(1).max(150),
  examDate: examDateSchema,
  dailyStudyHours: dailyStudyHoursSchema,
});

export const updateExamSchema = createExamSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  'At least one field is required',
);

export const examIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});
