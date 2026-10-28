import { AiProviderError, AiTimeoutError } from '../errors.js';

export function createGroqProvider({ apiKey, model, fetchImpl = fetch }) {
  return {
    name: 'groq',
    model,
    async generate({ system, user, temperature, maxOutputTokens, timeoutMs, jsonMode }) {
      if (!apiKey || !model) throw new AiProviderError('Groq provider is not configured');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            temperature,
            max_tokens: maxOutputTokens,
            ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
          }),
        });

        if (!response.ok) {
          const retryAfter = response.headers.get('retry-after');
          throw new AiProviderError('Groq provider request failed', {
            providerStatus: response.status,
            retryAfter: retryAfter ? Number(retryAfter) : undefined,
          });
        }

        const payload = await response.json();
        const text = payload.choices?.[0]?.message?.content;
        if (!text) throw new AiProviderError('Groq provider returned no text');
        return { text, usage: payload.usage, model };
      } catch (error) {
        if (error.name === 'AbortError') throw new AiTimeoutError();
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

