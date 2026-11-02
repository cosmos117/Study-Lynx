import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createAiService } from './aiService.js';
import { AiInvalidOutputError, AiLimitError, AiTimeoutError } from './errors.js';
import { createAiLimits, createMemoryUsageStore } from './limits.js';
import { createMockProvider } from './providers/mock.js';

const schema = z.object({ answer: z.string() });
const input = {
  feature: 'test',
  system: 'Return JSON.',
  user: 'Say hello.',
  schema,
  userId: 1,
};

function createTestLimits(options = {}) {
  const usageStore = createMemoryUsageStore();
  return {
    limits: createAiLimits({
      usageStore,
      userDailyLimit: options.userDailyLimit || 15,
      globalDailyLimit: options.globalDailyLimit ?? null,
    }),
    usageStore,
  };
}

describe('aiService', () => {
  it('parses valid and fenced JSON output', async () => {
    const { limits } = createTestLimits();
    const service = createAiService({
      providers: {
        primary: createMockProvider({ generate: async () => ({ text: '```json\n{"answer":"hello"}\n```' }) }),
        fallback: null,
      },
      limits,
      maxRetries: 0,
    });

    await expect(service.generateStructured(input)).resolves.toMatchObject({
      data: { answer: 'hello' },
    });
  });

  it('makes exactly one repair call for invalid output', async () => {
    const { limits } = createTestLimits();
    let calls = 0;
    const service = createAiService({
      providers: {
        primary: createMockProvider({
          generate: async ({ user }) => {
            calls += 1;
            return { text: calls === 1 ? '{"wrong":true}' : '{"answer":"repaired"}' };
          },
        }),
        fallback: null,
      },
      limits,
      maxRetries: 0,
    });

    await expect(service.generateStructured(input)).resolves.toMatchObject({
      data: { answer: 'repaired' },
    });
    expect(calls).toBe(2);
  });

  it('throws AI_INVALID_OUTPUT when repair also fails', async () => {
    const { limits } = createTestLimits();
    const service = createAiService({
      providers: {
        primary: createMockProvider({ generate: async () => ({ text: '{"wrong":true}' }) }),
        fallback: null,
      },
      limits,
      maxRetries: 0,
    });

    await expect(service.generateStructured(input)).rejects.toBeInstanceOf(AiInvalidOutputError);
  });

  it('uses the fallback provider after transient primary failure', async () => {
    const { limits } = createTestLimits();
    const service = createAiService({
      providers: {
        primary: createMockProvider({
          generate: async () => {
            const error = new Error('temporary');
            error.retryable = true;
            throw error;
          },
        }),
        fallback: createMockProvider({
          name: 'fallback',
          generate: async () => ({ text: '{"answer":"fallback"}' }),
        }),
      },
      limits,
      maxRetries: 0,
      sleepImpl: async () => {},
    });

    await expect(service.generateStructured(input)).resolves.toMatchObject({
      data: { answer: 'fallback' },
      provider: 'fallback',
    });
  });

  it('propagates timeout errors without exposing provider output', async () => {
    const { limits } = createTestLimits();
    const service = createAiService({
      providers: {
        primary: createMockProvider({ generate: async () => { throw new AiTimeoutError(); } }),
        fallback: null,
      },
      limits,
      maxRetries: 0,
    });

    await expect(service.generateStructured(input)).rejects.toMatchObject({
      code: 'AI_TIMEOUT',
      statusCode: 503,
    });
  });

  it('enforces user and global limits before calling a provider', async () => {
    const userLimit = createTestLimits({ userDailyLimit: 1 });
    await userLimit.limits.increment(1);
    const service = createAiService({
      providers: { primary: createMockProvider(), fallback: null },
      limits: userLimit.limits,
      maxRetries: 0,
    });
    await expect(service.generateStructured(input)).rejects.toMatchObject({
      code: 'AI_USER_LIMIT_REACHED',
    });

    const globalLimit = createTestLimits({ globalDailyLimit: 1 });
    await globalLimit.limits.increment(2);
    const globalService = createAiService({
      providers: { primary: createMockProvider(), fallback: null },
      limits: globalLimit.limits,
      maxRetries: 0,
    });
    await expect(globalService.generateStructured({ ...input, userId: 3 })).rejects.toMatchObject({
      code: 'AI_LIMIT_REACHED',
    });
  });
});


describe('gemini thinking level', async () => {
  const { createGeminiProvider } = await import('./providers/gemini.js');
  const ok = { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }) };
  const input = { system: 's', user: 'u', temperature: 0.3, maxOutputTokens: 100, timeoutMs: 5000, jsonMode: true };
  const sent = (fetchImpl, call = 0) => JSON.parse(fetchImpl.mock.calls[call][1].body).generationConfig;

  it('asks for a low thinking level, which answers about 2-3x faster', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok);
    await createGeminiProvider({ apiKey: 'k', model: 'm', thinkingLevel: 'low', fetchImpl }).generate(input);
    expect(sent(fetchImpl).thinkingConfig).toEqual({ thinkingLevel: 'low' });
  });

  it('leaves thinking to the model when set to default', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok);
    await createGeminiProvider({ apiKey: 'k', model: 'm', thinkingLevel: 'default', fetchImpl }).generate(input);
    expect(sent(fetchImpl)).not.toHaveProperty('thinkingConfig');
  });

  it('retries without it, and stops sending it, when the model does not support it', async () => {
    const rejected = { ok: false, status: 400, headers: new Map(), text: async () => 'Thinking level is not supported for this model.' };
    const fetchImpl = vi.fn().mockResolvedValueOnce(rejected).mockResolvedValue(ok);
    const provider = createGeminiProvider({ apiKey: 'k', model: 'old', thinkingLevel: 'low', fetchImpl });
    expect((await provider.generate(input)).text).toBe('{}');
    expect(sent(fetchImpl, 1)).not.toHaveProperty('thinkingConfig');
    await provider.generate(input);
    expect(sent(fetchImpl, 2)).not.toHaveProperty('thinkingConfig');
  });
});

describe('shared per-minute cap', async () => {
  const { createRateWindow } = await import('./rateWindow.js');
  const { AiProviderError } = await import('./errors.js');
  const noSleep = async () => {};
  /** A provider that returns (or throws) the given responses in order. */
  const provider = (name, responses) => {
    const queue = [...responses];
    return {
      name,
      model: name,
      generate: vi.fn(async () => {
        const next = queue.shift();
        if (next instanceof Error) throw next;
        if (!next) throw new Error('no more responses');
        return next;
      }),
    };
  };
  const ask = (service) => service.generateStructured({ feature: 'TEST', system: 's', user: 'u', schema, userId: 1 });
  const fullWindow = async () => {
    let time = 0;
    const window = createRateWindow({ requestsPerMinute: 1, now: () => time, sleep: async (ms) => { time += ms; } });
    await window.acquire();
    return window;
  };

  it('tells the student how long to wait when the minute is full and there is no fallback', async () => {
    const primary = provider('gemini', [{ text: '{"answer":"ok"}' }]);
    const service = createAiService({ providers: { primary }, limits: createTestLimits().limits, primaryWindow: await fullWindow(), maxQueueMs: 0, sleepImpl: noSleep });
    const error = await ask(service).catch((e) => e);
    expect(error).toMatchObject({ code: 'AI_RATE_LIMITED', statusCode: 429, retryAfter: 60 });
    expect(primary.generate).not.toHaveBeenCalled();
  });

  it('answers from the fallback provider, which has its own quota, while the primary is busy', async () => {
    const primary = provider('gemini', [{ text: '{"answer":"primary"}' }]);
    const fallback = provider('groq', [{ text: '{"answer":"fallback"}' }]);
    const service = createAiService({ providers: { primary, fallback }, limits: createTestLimits().limits, primaryWindow: await fullWindow(), maxQueueMs: 0, sleepImpl: noSleep });
    expect((await ask(service)).data.answer).toBe('fallback');
    expect(primary.generate).not.toHaveBeenCalled();
  });

  it('still says "try again in N seconds" if the fallback fails too', async () => {
    const primary = provider('gemini', []);
    const fallback = provider('groq', [new AiProviderError('Groq down', { providerStatus: 503 })]);
    const service = createAiService({ providers: { primary, fallback }, limits: createTestLimits().limits, primaryWindow: await fullWindow(), maxQueueMs: 0, maxRetries: 0, sleepImpl: noSleep });
    await expect(ask(service)).rejects.toMatchObject({ code: 'AI_RATE_LIMITED' });
  });

  it('counts each call to the primary, and leaves the fallback unthrottled', async () => {
    let time = 0;
    const window = createRateWindow({ requestsPerMinute: 2, now: () => time, sleep: async (ms) => { time += ms; } });
    const primary = provider('gemini', [{ text: '{"answer":"a"}' }, { text: '{"answer":"b"}' }]);
    const service = createAiService({ providers: { primary }, limits: createTestLimits().limits, primaryWindow: window, maxQueueMs: 0, sleepImpl: noSleep });
    await ask(service);
    await ask(service);
    expect(window.usage().requests).toBe(2);
    await expect(ask(service)).rejects.toMatchObject({ code: 'AI_RATE_LIMITED' });
  });
});
