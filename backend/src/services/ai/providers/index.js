import { env } from '../../../config/env.js';
import { createGeminiProvider } from './gemini.js';
import { createGroqProvider } from './groq.js';

export function createConfiguredProviders({ fetchImpl = fetch } = {}) {
  const factories = {
    gemini: () => createGeminiProvider({
      apiKey: env.ai.geminiApiKey,
      model: env.ai.model,
      fetchImpl,
    }),
    groq: () => createGroqProvider({
      apiKey: env.ai.groqApiKey,
      model: env.ai.fallbackModel,
      fetchImpl,
    }),
  };

  return {
    primary: factories[env.ai.provider]?.() || null,
    fallback: factories[env.ai.fallbackProvider]?.() || null,
  };
}

