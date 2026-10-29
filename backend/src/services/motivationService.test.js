import { describe, expect, it } from 'vitest';
import motivations from '../data/motivation.json' with { type: 'json' };
import { getMotivationToday } from './motivationService.js';

describe('daily motivation', () => {
  it('is stable during a day and changes deterministically on later days', () => {
    const morning = getMotivationToday(new Date('2026-04-10T01:00:00.000Z'));
    const evening = getMotivationToday(new Date('2026-04-10T23:00:00.000Z'));
    const nextDay = getMotivationToday(new Date('2026-04-11T01:00:00.000Z'));
    expect(morning).toBe(evening);
    expect(nextDay).not.toBe(morning);
  });

  it('has a quote for every day of the year', () => {
    expect(motivations).toHaveLength(365);
    expect(motivations.every((quote) => typeof quote === 'string' && quote.trim().length > 0)).toBe(true);
  });

  it('shows the first quote on 1 January and the last on 31 December', () => {
    expect(getMotivationToday(new Date('2027-01-01T12:00:00.000Z'))).toBe(motivations[0]);
    expect(getMotivationToday(new Date('2027-12-31T12:00:00.000Z'))).toBe(motivations[364]);
  });
});
