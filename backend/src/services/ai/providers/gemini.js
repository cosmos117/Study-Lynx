import { AiProviderError, AiTimeoutError } from '../errors.js';

const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models';

export function createGeminiProvider({ apiKey, model, thinkingLevel = 'default', fetchImpl = fetch }) {
  // Models that don't support a thinking level reject it; then it is dropped for the rest of the run.
  let sendThinking = thinkingLevel && thinkingLevel !== 'default';

  const provider = {
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
                ...(sendThinking ? { thinkingConfig: { thinkingLevel } } : {}),
              },
            }),
          },
        );

        if (!response.ok && response.status === 400 && sendThinking) {
          const detail = await (response.clone?.() ?? response).text?.().catch(() => '') ?? '';
          if (/thinking/i.test(detail)) {
            sendThinking = false;
            return provider.generate({ system, user, temperature, maxOutputTokens, timeoutMs, jsonMode });
          }
        }

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
  return provider;
}
