import dotenv from 'dotenv';

dotenv.config();

const port = Number(process.env.PORT || 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

function readNumber(name, fallback, { integer = false, min = 0, max = Infinity } = {}) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
    throw new Error(`${name} must be a ${integer ? 'whole ' : ''}number between ${min} and ${max}`);
  }
  return parsed;
}

export const env = {
  port,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  ai: {
    provider: process.env.AI_PROVIDER || 'gemini',
    fallbackProvider: process.env.AI_FALLBACK_PROVIDER || 'groq',
    model: process.env.AI_MODEL || '',
    fallbackModel: process.env.AI_FALLBACK_MODEL || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    groqApiKey: process.env.GROQ_API_KEY || '',
    temperature: readNumber('AI_TEMPERATURE', 0.3, { min: 0 }),
    timeoutMs: readNumber('AI_TIMEOUT_MS', 30000, { integer: true, min: 1 }),
    maxRetries: readNumber('AI_MAX_RETRIES', 3, { integer: true, min: 0 }),
    dailyLimit: readNumber('AI_DAILY_LIMIT', null, { integer: true, min: 1 }),
    userDailyLimit: readNumber('AI_USER_DAILY_LIMIT', 30, { integer: true, min: 1 }),
    lockTimeoutSeconds: readNumber('AI_LOCK_TIMEOUT_SECONDS', 90, { integer: true, min: 1 }),
    inputMaxChars: readNumber('AI_INPUT_MAX_CHARS', 12000, { integer: true, min: 1 }),
  },
  rag: {
    topK: readNumber('RAG_TOP_K', 5, { integer: true, min: 1, max: 50 }),
    similarityThreshold: readNumber('RAG_SIMILARITY_THRESHOLD', 0.35, { min: 0, max: 1 }),
    maxChunkChars: readNumber('RAG_MAX_CHUNK_CHARS', 1200, { integer: true, min: 100 }),
    chunkOverlapChars: readNumber('RAG_CHUNK_OVERLAP_CHARS', 200, { integer: true, min: 0 }),
    maxDocumentChars: readNumber('RAG_MAX_DOCUMENT_CHARS', 300000, { integer: true, min: 1000 }),
    maxFileSizeBytes: readNumber('RAG_MAX_FILE_SIZE_MB', 10, { integer: true, min: 1 }) * 1024 * 1024,
    allowedMimeTypes: (process.env.RAG_ALLOWED_MIME_TYPES || 'application/pdf,text/plain')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    embeddingProvider: process.env.RAG_EMBEDDING_PROVIDER || 'local',
  },
};
