import { describe, expect, it } from 'vitest';
import { createLocalEmbeddingService, cosineSimilarity } from './embeddingService.js';

describe('local embedding service', () => {
  const service = createLocalEmbeddingService({ dimension: 64 });

  it('has the configured dimension', () => {
    expect(service.dimension).toBe(64);
  });

  it('returns a vector of the configured dimension', async () => {
    const vector = await service.embedText('hello world');
    expect(vector).toHaveLength(64);
    expect(vector.every((value) => Number.isFinite(value))).toBe(true);
  });

  it('is deterministic: same text yields the same vector', async () => {
    const a = await service.embedText('Study Lynx DBMS notes');
    const b = await service.embedText('Study Lynx DBMS notes');
    expect(a).toEqual(b);
  });

  it('returns a zero vector for empty text', async () => {
    const vector = await service.embedText('');
    expect(vector.every((value) => value === 0)).toBe(true);
  });

  it('scores identical vectors as 1 and orthogonal as 0', async () => {
    const vector = await service.embedText('database normalization');
    expect(cosineSimilarity(vector, vector)).toBeCloseTo(1, 5);
    expect(cosineSimilarity(vector, new Array(64).fill(0))).toBe(0);
  });

  it('produces more similar vectors for overlapping texts', async () => {
    const [shared, aOnly, bOnly] = await Promise.all([
      service.embedText('BCNF is stricter than 3NF because every determinant must be a candidate key'),
      service.embedText('BCNF is stricter than 3NF'),
      service.embedText('The quick brown fox jumps over the lazy dog'),
    ]);
    const related = cosineSimilarity(shared, aOnly);
    const unrelated = cosineSimilarity(shared, bOnly);
    expect(related).toBeGreaterThan(unrelated);
    expect(related).toBeGreaterThan(0);
  });

  it('batch embedding matches individual embedding', async () => {
    const texts = ['one', 'two three', 'four five six'];
    const batch = await service.embedTexts(texts);
    for (let i = 0; i < texts.length; i += 1) {
      expect(batch[i]).toEqual(await service.embedText(texts[i]));
    }
  });

  it('ignores stopwords so unrelated questions do not look similar', async () => {
    const chunk = await service.embedText('BCNF is stricter than 3NF because every determinant must be a candidate key.');
    const related = cosineSimilarity(await service.embedText('Why is BCNF stricter than 3NF?'), chunk);
    const unrelated = cosineSimilarity(await service.embedText('What is the capital of France?'), chunk);
    expect(related).toBeGreaterThan(0.35);
    expect(unrelated).toBeLessThan(0.1);
  });

  it('matches simple plurals', async () => {
    const singular = await service.embedText('candidate key');
    const plural = await service.embedText('candidate keys');
    expect(cosineSimilarity(singular, plural)).toBeCloseTo(1, 5);
  });
});
