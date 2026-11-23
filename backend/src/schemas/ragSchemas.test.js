import { describe, expect, it } from 'vitest';
import { documentTextSchema, documentUploadSchema } from './ragSchemas.js';

describe('source ownership', () => {
  const text = { name: 'Textbook', type: 'NOTE', text: 'Some notes' };

  it('accepts a topic or a subject', () => {
    expect(documentTextSchema.safeParse({ ...text, topicId: 1 }).success).toBe(true);
    expect(documentTextSchema.safeParse({ ...text, subjectId: 1 }).success).toBe(true);
  });

  it('rejects a source with no owner, which would be shown nowhere', () => {
    expect(documentTextSchema.safeParse(text).success).toBe(false);
    expect(documentUploadSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a source owned by both a topic and a subject', () => {
    expect(documentTextSchema.safeParse({ ...text, topicId: 1, subjectId: 2 }).success).toBe(false);
    expect(documentUploadSchema.safeParse({ topicId: 1, subjectId: 2 }).success).toBe(false);
  });

  it('reads the subject id from a multipart upload, where it arrives as a string', () => {
    expect(documentUploadSchema.parse({ subjectId: '3' }).subjectId).toBe(3);
  });
});
