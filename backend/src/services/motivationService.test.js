import { describe, expect, it } from 'vitest';
import { getMotivationToday } from './motivationService.js';

describe('daily motivation', () => {
  it('is stable during a day and changes deterministically on later days', () => {
    const morning = getMotivationToday(new Date('2026-04-10T01:00:00.000Z'));
    const evening = getMotivationToday(new Date('2026-04-10T23:00:00.000Z'));
    const nextDay = getMotivationToday(new Date('2026-04-11T01:00:00.000Z'));
    expect(morning).toBe(evening);
    expect(nextDay).not.toBe(morning);
  });
});
