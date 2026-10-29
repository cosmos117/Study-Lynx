import { z } from 'zod';

// Optional exam date: a valid date, or null to clear it.
const examDateSchema = z.coerce.date().refine((date) => !Number.isNaN(date.getTime()), 'A valid exam date is required');

export const createSubjectSchema = z.object({
  name: z.string().trim().min(1).max(150),
  examDate: examDateSchema.nullable().optional(),
});

export const updateSubjectSchema = createSubjectSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  'At least one field is required',
);

export const subjectIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});
