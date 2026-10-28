import { z } from 'zod';

const subjectBodySchema = z.object({
  name: z.string().trim().min(1).max(150),
});

export const createSubjectSchema = subjectBodySchema;

export const updateSubjectSchema = subjectBodySchema.refine(
  (data) => Object.keys(data).length > 0,
  'At least one field is required',
);

export const examIdSchema = z.object({
  examId: z.coerce.number().int().positive(),
});

export const subjectIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});
