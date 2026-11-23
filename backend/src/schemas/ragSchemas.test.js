import { describe, expect, it } from 'vitest';
import { documentTextSchema, documentUploadSchema } from './ragSchemas.js';

describe('source ownership: sources belong to a subject', () => {
  const text = { name: 'Textbook', type: 'NOTE', text: 'Some notes' };
  const message = (result) => result.error.issues[0].message;

  it('accepts a source added to a subject', () => {
    expect(documentTextSchema.safeParse({ ...text, subjectId: 1 }).success).toBe(true);
    expect(documentUploadSchema.safeParse({ subjectId: 1 }).success).toBe(true);
  });

  it('refuses a topic-only source, explaining where to add it', () => {
    const result = documentTextSchema.safeParse({ ...text, topicId: 1 });
    expect(result.success).toBe(false);
    expect(message(result)).toMatch(/subject/);
    expect(documentUploadSchema.safeParse({ topicId: 1 }).success).toBe(false);
  });

  it('refuses a source that also names a topic', () => {
    expect(documentTextSchema.safeParse({ ...text, topicId: 1, subjectId: 2 }).success).toBe(false);
    expect(documentUploadSchema.safeParse({ topicId: 1, subjectId: 2 }).success).toBe(false);
  });

  it('refuses a source with no subject, which would be shown nowhere', () => {
    expect(documentTextSchema.safeParse(text).success).toBe(false);
    expect(documentUploadSchema.safeParse({}).success).toBe(false);
    expect(documentUploadSchema.safeParse({ subjectId: 'abc' }).success).toBe(false);
  });

  it('reads the subject id from a multipart upload, where it arrives as a string', () => {
    expect(documentUploadSchema.parse({ subjectId: '3' }).subjectId).toBe(3);
  });
});
