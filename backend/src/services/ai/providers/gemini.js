import { AiProviderError, AiTimeoutError } from '../errors.js';

const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models';

export function createGeminiProvider({ apiKey, model, fetchImpl = fetch }) {
  return {
    name: 'gemini',
    model,
    async generate({ system, user, temperature, maxOutputTokens, timeoutMs, jsonMode }) {
      if (!apiKey || !model) throw new AiProviderError('Gemini provider is not configured');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(
          `${endpoint}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: 'user', parts: [{ text: user }] }],
              generationConfig: {
                temperature,
                maxOutputTokens,
                ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
              },
            }),
          },
        );

        if (!response.ok) {
          const retryAfter = response.headers.get('retry-after');
          throw new AiProviderError('Gemini provider request failed', {
            providerStatus: response.status,
            retryAfter: retryAfter ? Number(retryAfter) : undefined,
          });
        }

        const payload = await response.json();
        const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new AiProviderError('Gemini provider returned no text');
        return {
          text,
          usage: payload.usageMetadata,
          model,
        };
      } catch (error) {
        if (error.name === 'AbortError') throw new AiTimeoutError();
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

