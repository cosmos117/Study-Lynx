import { env } from '../../config/env.js';
import prisma from '../../config/prisma.js';
import { AiError, AiInvalidOutputError, AiProviderError, AiTimeoutError } from './errors.js';
import { createAiLimits, createPrismaUsageStore } from './limits.js';
import { parseAndValidateJson } from './json.js';
import { createConfiguredProviders } from './providers/index.js';
import { RateWindowFullError, createRateWindow } from './rateWindow.js';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
// A request waits up to this long for a free per-minute slot before the student is asked to retry.
const MAX_QUEUE_MS = 20 * 1000;

function isRetryable(error) {
  return error instanceof AiTimeoutError
    || (error instanceof AiProviderError && error.retryable)
    || error.retryable;
}

function backoffDelay(attempt, retryAfter) {
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return retryAfter * 1000;
  const base = 250 * (2 ** attempt);
  return base + Math.floor(Math.random() * 100);
}

export function createAiService({
  providers = createConfiguredProviders(),
  limits = createAiLimits({
    usageStore: createPrismaUsageStore(prisma, { quotaTimeZone: env.ai.quotaTimeZone }),
    userDailyLimit: env.ai.userDailyLimit,
    globalDailyLimit: env.ai.dailyLimit,
  }),
  temperature = env.ai.temperature,
  timeoutMs = env.ai.timeoutMs,
  maxRetries = env.ai.maxRetries,
  sleepImpl = sleep,
  // Shared per-minute cap for the primary provider; the fallback has its own, separate quota.
  primaryWindow = createRateWindow({ requestsPerMinute: env.ai.requestsPerMinute }),
  maxQueueMs = MAX_QUEUE_MS,
} = {}) {
  async function reserveSlot(provider) {
    if (provider !== providers.primary) return;
    try {
      await primaryWindow.acquire({ maxWaitMs: maxQueueMs });
    } catch (error) {
      if (!(error instanceof RateWindowFullError)) throw error;
      const seconds = Math.ceil(error.retryAfterMs / 1000);
      throw new AiError('AI_RATE_LIMITED', `Lots of people are using AI right now. Please try again in ${seconds} seconds.`, { retryAfter: seconds });
    }
  }

  async function callProvider(provider, input) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        await reserveSlot(provider);
        const result = await provider.generate(input);
        await limits.increment(input.userId);
        return { ...result, provider: provider.name, model: result.model || provider.model };
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === maxRetries) break;
        await sleepImpl(backoffDelay(attempt, error.retryAfter));
      }
    }
    throw lastError;
  }

  async function generateStructured({ feature, system, user, schema, userId, maxOutputTokens = 2048 }) {
    await limits.assertAvailable(userId);
    const input = {
      system,
      user,
      temperature,
      maxOutputTokens,
      timeoutMs,
      jsonMode: true,
      userId,
    };
    let providerError;

    for (const provider of [providers.primary, providers.fallback]) {
      if (!provider) continue;
      try {
        const result = await callProvider(provider, input);
        try {
          return { data: parseAndValidateJson(result.text, schema), provider: result.provider, model: result.model };
        } catch (error) {
          if (!(error instanceof AiInvalidOutputError)) throw error;
          const repair = await callProvider(provider, {
            ...input,
            user: `${user}\n\nInvalid output:\n${result.text}\n\nValidation error:\n${error.message}\n\nReturn corrected JSON only.`,
          });
          return {
            data: parseAndValidateJson(repair.text, schema),
            provider: repair.provider,
            model: repair.model,
          };
        }
      } catch (error) {
        // When the primary's per-minute quota is busy, the fallback (its own quota) can still answer;
        // if it can't, the student is better served by "try again in N seconds" than its error.
        if (provider === providers.fallback) throw providerError?.code === 'AI_RATE_LIMITED' ? providerError : error;
        providerError = error;
        const canFallBack = error.retryable || error instanceof AiProviderError || error instanceof AiTimeoutError || error.code === 'AI_RATE_LIMITED';
        if (!canFallBack) throw error;
      }
    }

    throw providerError || new AiProviderError(`No provider configured for ${feature}`);
  }

  return { generateStructured };
}

export const aiService = createAiService();
