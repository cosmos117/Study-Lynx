import { describe, expect, it } from 'vitest';
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

