import { describe, expect, it } from 'vitest';
import { errorMessage, quotaResetTime } from './aiErrors.js';

const failure = (code, message) => ({ response: { data: { code, message } } });

describe('AI error messages', () => {
  it('tells the student when the shared daily quota comes back', () => {
    expect(errorMessage(failure('AI_LIMIT_REACHED'))).toMatch(/resets at .+/);
  });

  it("passes on the server's own wording for a busy minute, which says how long to wait", () => {
    expect(errorMessage(failure('AI_RATE_LIMITED', 'Lots of people are using AI right now. Please try again in 42 seconds.')))
      .toContain('42 seconds');
  });

  it('falls back to the given text when there is nothing better', () => {
    expect(errorMessage({}, 'Unable to load')).toBe('Unable to load');
  });
});

describe('quotaResetTime', () => {
  it('is the next midnight in Pacific time, shown in local time', () => {
    // 20:00 UTC on 15 Oct is 13:00 in California (daylight time, UTC-7), so the reset is 11 hours later.
    const now = new Date('2026-10-15T20:00:00Z');
    const expected = new Date('2026-10-16T07:00:00Z').toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    expect(quotaResetTime(now)).toBe(expected);
  });

  it('follows the clock change: in winter California is UTC-8', () => {
    const now = new Date('2026-12-01T20:00:00Z'); // 12:00 in California
    const expected = new Date('2026-12-02T08:00:00Z').toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    expect(quotaResetTime(now)).toBe(expected);
  });
});
