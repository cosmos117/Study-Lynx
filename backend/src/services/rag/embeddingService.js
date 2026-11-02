/**
 * EmbeddingService interface
 * --------------------------
 * Produces vector representations of text so chunks can be stored and
 * searched by similarity. The rest of the application depends on this
 * interface (and VectorStoreService), never on a specific embedding
 * provider or vector database directly.
 *
 * interface EmbeddingService {
 *   readonly id: string;               // provider, model and size; vectors from different ids don't compare
 *   readonly dimension: number;
 *   readonly defaultThreshold: number; // a sensible minimum similarity for this provider
 *   embedText(text: string): Promise<number[]>;      // a passage to store
 *   embedTexts(texts: string[]): Promise<number[][]>;
 *   embedQuery(text: string): Promise<number[]>;     // a question to search with
 * }
 */

import { env } from '../../config/env.js';
import { createRateWindow } from '../ai/rateWindow.js';

const DEFAULT_DIMENSION = 256;
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_DIMENSION = 768;
const GEMINI_BATCH_SIZE = 100;
// A question waits only briefly for embedding quota (search then falls back to keywords); indexing
// an upload runs in the background, so it may wait a few minutes for room.
const QUERY_MAX_WAIT_MS = 3 * 1000;
const INDEX_MAX_WAIT_MS = 5 * 60 * 1000;
// Rough token count for quota pacing: about four characters per token.
const estimateTokens = (text) => Math.ceil(text.length / 4) + 4;

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
    id: `local:${dimension}`,
    dimension,
    defaultThreshold: 0.35,
    embedText,
    embedTexts,
    embedQuery: embedText,
  };
}

function normalizeVector(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm ? vector.map((value) => value / norm) : vector;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Gemini embeddings: real semantic vectors, so "BCNF" finds a passage about "Boyce-Codd normal form".
 * Passages and questions are embedded with different task types, as Google recommends for search.
 */
export function createGeminiEmbeddingService({
  apiKey,
  model = 'gemini-embedding-001',
  dimension = GEMINI_DIMENSION,
  fetchImpl = fetch,
  timeoutMs = 30000,
  maxRetries = 2,
  sleep = wait,
  requestsPerMinute = env.rag.embedRequestsPerMinute,
  tokensPerMinute = env.rag.embedTokensPerMinute,
  window = createRateWindow({ requestsPerMinute, tokensPerMinute }),
} = {}) {
  if (!apiKey) throw new Error('Gemini embeddings need GEMINI_API_KEY');
  // Each passage counts as one request; a batch also stays well under a minute's tokens, so a big
  // upload is spread over several minutes instead of hitting the provider's limit.
  const batchLimit = Math.max(1, Math.min(GEMINI_BATCH_SIZE, requestsPerMinute));
  const batchTokens = Number.isFinite(tokensPerMinute) ? Math.max(1000, Math.floor(tokensPerMinute / 3)) : Infinity;

  async function request(texts, taskType) {
    for (let attempt = 0; ; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:batchEmbedContents?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            requests: texts.map((text) => ({
              model: `models/${model}`,
              content: { parts: [{ text }] },
              taskType,
              outputDimensionality: dimension,
            })),
          }),
        });
        if (response.ok) {
          const payload = await response.json();
          const vectors = payload.embeddings?.map((item) => item.values);
          if (!Array.isArray(vectors) || vectors.length !== texts.length) throw new Error('Gemini returned an unexpected embedding response');
          // Shortened Gemini vectors are not unit length; normalising keeps cosine scores comparable.
          return vectors.map(normalizeVector);
        }
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt >= maxRetries) throw new Error(`Gemini embedding request failed (${response.status})`);
      } catch (error) {
        if (error.name !== 'AbortError' || attempt >= maxRetries) throw error;
      } finally {
        clearTimeout(timer);
      }
      await sleep(400 * 2 ** attempt);
    }
  }

  async function embedAll(texts, taskType, maxWaitMs) {
    // Empty text has no meaning to embed; Gemini also rejects it.
    const results = texts.map((text) => (String(text).trim() ? null : new Array(dimension).fill(0)));
    const pending = texts.map((text, index) => ({ text: String(text), index })).filter(({ index }) => !results[index]);

    const batches = [];
    let batch = [];
    let tokens = 0;
    for (const item of pending) {
      const size = estimateTokens(item.text);
      if (batch.length && (batch.length >= batchLimit || tokens + size > batchTokens)) {
        batches.push({ items: batch, tokens });
        batch = [];
        tokens = 0;
      }
      batch.push(item);
      tokens += size;
    }
    if (batch.length) batches.push({ items: batch, tokens });

    for (const { items, tokens: batchSize } of batches) {
      await window.acquire({ requests: items.length, tokens: batchSize, maxWaitMs });
      const vectors = await request(items.map(({ text }) => text), taskType);
      items.forEach(({ index }, position) => { results[index] = vectors[position]; });
    }
    return results;
  }

  return {
    id: `gemini:${model}:${dimension}`,
    dimension,
    // Related passages typically score 0.65+, unrelated ones around 0.5.
    defaultThreshold: 0.6,
    embedText: async (text) => (await embedAll([text], 'RETRIEVAL_DOCUMENT', INDEX_MAX_WAIT_MS))[0],
    embedTexts: (texts) => embedAll(texts, 'RETRIEVAL_DOCUMENT', INDEX_MAX_WAIT_MS),
    embedQuery: async (text) => (await embedAll([text], 'RETRIEVAL_QUERY', QUERY_MAX_WAIT_MS))[0],
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

export function createEmbeddingService({
  provider = env.rag.embeddingProvider,
  dimension,
  apiKey = env.ai.geminiApiKey,
  model = env.rag.embeddingModel,
} = {}) {
  const chosen = provider === 'auto' ? (apiKey ? 'gemini' : 'local') : provider;
  if (chosen === 'local') return createLocalEmbeddingService({ dimension });
  if (chosen === 'gemini') return createGeminiEmbeddingService({ apiKey, model, dimension });
  throw new Error(`Unsupported embedding provider: ${provider}`);
}

export const embeddingService = createEmbeddingService();