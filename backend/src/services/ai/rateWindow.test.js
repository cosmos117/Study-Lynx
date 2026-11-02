import { describe, expect, it } from 'vitest';
import { RateWindowFullError, createRateWindow } from './rateWindow.js';

/** A fake clock: sleeping just moves time forward. */
function clock(start = 1_000_000) {
  let time = start;
  return { now: () => time, sleep: async (ms) => { time += ms; }, advance: (ms) => { time += ms; } };
}

describe('per-minute rate window', () => {
  it('lets requests through until the minute is full, then refuses one that cannot wait', async () => {
    const t = clock();
    const window = createRateWindow({ requestsPerMinute: 3, now: t.now, sleep: t.sleep });
    for (let i = 0; i < 3; i += 1) await window.acquire();
    await expect(window.acquire({ maxWaitMs: 0 })).rejects.toBeInstanceOf(RateWindowFullError);
  });

  it('says how long to wait before a slot frees up', async () => {
    const t = clock();
    const window = createRateWindow({ requestsPerMinute: 1, now: t.now, sleep: t.sleep });
    await window.acquire();
    t.advance(20_000);
    const error = await window.acquire({ maxWaitMs: 1_000 }).catch((e) => e);
    expect(error.retryAfterMs).toBe(40_000);
  });

  it('waits for a slot when allowed to, then goes through', async () => {
    const t = clock();
    const window = createRateWindow({ requestsPerMinute: 1, now: t.now, sleep: t.sleep });
    await window.acquire();
    const start = t.now();
    await window.acquire({ maxWaitMs: 90_000 });
    expect(t.now() - start).toBe(60_000);
  });

  it('frees slots as the minute rolls on', async () => {
    const t = clock();
    const window = createRateWindow({ requestsPerMinute: 2, now: t.now, sleep: t.sleep });
    await window.acquire();
    t.advance(30_000);
    await window.acquire();
    t.advance(31_000);
    await expect(window.acquire()).resolves.toBeUndefined();
    expect(window.usage().requests).toBe(2);
  });

  it('also limits tokens, for embedding quotas measured in tokens per minute', async () => {
    const t = clock();
    const window = createRateWindow({ requestsPerMinute: 100, tokensPerMinute: 30_000, now: t.now, sleep: t.sleep });
    await window.acquire({ requests: 50, tokens: 20_000 });
    await expect(window.acquire({ requests: 10, tokens: 15_000 })).rejects.toBeInstanceOf(RateWindowFullError);
    await window.acquire({ requests: 10, tokens: 9_000 });
    expect(window.usage()).toEqual({ requests: 60, tokens: 29_000 });
  });

  it('lets a single reservation bigger than the whole limit through once the window is empty', async () => {
    const t = clock();
    const window = createRateWindow({ tokensPerMinute: 1_000, now: t.now, sleep: t.sleep });
    await expect(window.acquire({ tokens: 5_000 })).resolves.toBeUndefined();
  });

  it('serves waiting callers in order', async () => {
    const t = clock();
    const window = createRateWindow({ requestsPerMinute: 1, now: t.now, sleep: t.sleep });
    const order = [];
    await window.acquire();
    await Promise.all([
      window.acquire({ maxWaitMs: 200_000 }).then(() => order.push('first')),
      window.acquire({ maxWaitMs: 200_000 }).then(() => order.push('second')),
    ]);
    expect(order).toEqual(['first', 'second']);
  });
});
