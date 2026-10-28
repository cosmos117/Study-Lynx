/**
 * EmbeddingService interface
 * --------------------------
 * Produces vector representations of text so chunks can be stored and
 * searched by similarity. The rest of the application depends on this
 * interface (and VectorStoreService), never on a specific embedding
 * provider or vector database directly.
 *
 * interface EmbeddingService {
 *   readonly dimension: number;
 *   embedText(text: string): Promise<number[]>;
 *   embedTexts(texts: string[]): Promise<number[][]>;
 * }
 */

import { env } from '../../config/env.js';

const DEFAULT_DIMENSION = 256;

// Function words carry no topical signal and would make unrelated texts look similar.
const STOPWORDS = new Set((
  'a an and are as at be but by for from has have how if in into is it its of on or that the their there '
  + 'these they this to was were what when where which who why will with you your do does did can could should would'
).split(' '));

/**
 * Deterministic, dependency-free embedding provider.
 *
 * Each token is hashed to a seed that drives a pseudo-random projection
 * vector; the document vector is the normalized mean of its token vectors.
 * Same text always yields the same vector, and texts sharing tokens yield
 * similar vectors. No external API keys or network calls are required.
 * Swap this for a real provider (Gemini text-embedding, etc.) behind the
 * same interface when needed.
 */
export function createLocalEmbeddingService({ dimension = DEFAULT_DIMENSION } = {}) {
  if (!Number.isInteger(dimension) || dimension < 16 || dimension > 2048) {
    throw new Error('Embedding dimension must be an integer between 16 and 2048');
  }

  function hash32(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash || 1;
  }

  function tokenVector(token) {
    let seed = hash32(token);
    return new Array(dimension).fill(0).map(() => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 2147483648 - 1; // value in [-1, 1)
    });
  }

  function normalize(vector) {
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (!Number.isFinite(norm) || norm === 0) return vector;
    return vector.map((value) => value / norm);
  }

  async function embedText(text) {
    const tokens = String(text)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
      // Fold simple plurals so "keys" matches "key".
      .map((token) => (token.length > 3 && token.endsWith('s') && !token.endsWith('ss') ? token.slice(0, -1) : token));
    if (tokens.length === 0) return new Array(dimension).fill(0);
    const sum = new Array(dimension).fill(0);
    for (const token of tokens) {
      const vector = tokenVector(token);
      for (let i = 0; i < dimension; i += 1) sum[i] += vector[i];
    }
    return normalize(sum.map((value) => value / Math.sqrt(tokens.length)));
  }

  async function embedTexts(texts) {
    return Promise.all(texts.map((text) => embedText(text)));
  }

  return {
    dimension,
    embedText,
    embedTexts,
  };
}

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (!denominator || !Number.isFinite(denominator)) return 0;
  const score = dot / denominator;
  return Number.isFinite(score) ? score : 0;
}

export function createEmbeddingService({ provider = env.rag.embeddingProvider, dimension } = {}) {
  if (provider === 'local') {
    return createLocalEmbeddingService({ dimension });
  }
  throw new Error(`Unsupported embedding provider: ${provider}`);
}

export const embeddingService = createEmbeddingService();