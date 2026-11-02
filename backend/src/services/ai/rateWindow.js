// A sliding one-minute window shared by everyone using this server, so the app stays inside the AI
// provider's per-minute quota instead of being rejected by it. Each call reserves its share
// (requests and, optionally, tokens); when the window is full the caller waits for room, or is told
// how long to wait if that would take too long.

const WINDOW_MS = 60 * 1000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class RateWindowFullError extends Error {
  constructor(retryAfterMs) {
    super('The per-minute AI quota is in use');
    this.name = 'RateWindowFullError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * @param {object} options
 * @param {number} options.requestsPerMinute  limit on requests (Infinity for none)
 * @param {number} [options.tokensPerMinute]  limit on tokens (Infinity for none)
 */
export function createRateWindow({ requestsPerMinute = Infinity, tokensPerMinute = Infinity, now = Date.now, sleep = wait } = {}) {
  const entries = [];
  let pending = Promise.resolve();

  const prune = (time) => {
    while (entries.length && entries[0].at <= time - WINDOW_MS) entries.shift();
  };
  const used = () => entries.reduce((sum, entry) => ({ requests: sum.requests + entry.requests, tokens: sum.tokens + entry.tokens }), { requests: 0, tokens: 0 });

  /** How long until `requests` and `tokens` fit, or 0 if they fit now. */
  function waitTime(requests, tokens, time) {
    prune(time);
    let { requests: usedRequests, tokens: usedTokens } = used();
    // A single reservation larger than the whole limit is allowed through once the window is empty.
    const fits = () => entries.length === 0 || (usedRequests + requests <= requestsPerMinute && usedTokens + tokens <= tokensPerMinute);
    for (const entry of entries) {
      if (fits()) break;
      usedRequests -= entry.requests;
      usedTokens -= entry.tokens;
      if (fits()) return entry.at + WINDOW_MS - time;
    }
    return fits() ? 0 : WINDOW_MS;
  }

  /**
   * Reserves room for a call, waiting up to `maxWaitMs` for it. Reservations are granted in order,
   * so a large batch can't be overtaken forever by small requests.
   */
  function acquire({ requests = 1, tokens = 0, maxWaitMs = 0 } = {}) {
    const turn = pending.then(async () => {
      const deadline = now() + maxWaitMs;
      for (;;) {
        const time = now();
        const delay = waitTime(requests, tokens, time);
        if (delay === 0) {
          entries.push({ at: time, requests, tokens });
          return;
        }
        if (time + delay > deadline) throw new RateWindowFullError(delay);
        await sleep(delay);
      }
    });
    pending = turn.catch(() => {});
    return turn;
  }

  return { acquire, usage: () => { prune(now()); return used(); } };
}
