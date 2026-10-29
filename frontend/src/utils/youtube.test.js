import { describe, expect, it } from 'vitest';
import { formatTimestamp, percentAt, shouldSave } from './youtube.js';

describe('percentAt', () => {
  it('gives the whole percent of the video reached', () => {
    expect(percentAt(0, 600)).toBe(0);
    expect(percentAt(299, 600)).toBe(49);
    expect(percentAt(600, 600)).toBe(100);
  });

  it('is 0 before the player knows the length, and never above 100', () => {
    expect(percentAt(10, 0)).toBe(0);
    expect(percentAt(Number.NaN, 600)).toBe(0);
    expect(percentAt(700, 600)).toBe(100);
  });
});

describe('shouldSave', () => {
  const base = { saved: 20, lastSavedAt: 0, now: 1000 };

  it('saves after a 5% jump', () => {
    expect(shouldSave({ ...base, furthest: 25 })).toBe(true);
    expect(shouldSave({ ...base, furthest: 24 })).toBe(false);
  });

  it('saves a small gain once 20 seconds have passed', () => {
    expect(shouldSave({ ...base, furthest: 21, now: 20000 })).toBe(true);
  });

  it('saves a new playback position after a rewind, once 20 seconds have passed', () => {
    expect(shouldSave({ ...base, furthest: 20, position: 100, savedPosition: 400, now: 25000 })).toBe(true);
    expect(shouldSave({ ...base, furthest: 20, position: 100, savedPosition: 400, now: 5000 })).toBe(false);
    expect(shouldSave({ ...base, furthest: 20, position: 405, savedPosition: 400, now: 25000 })).toBe(false);
  });

  it('never saves without progress', () => {
    expect(shouldSave({ ...base, furthest: 20, now: 99999 })).toBe(false);
    expect(shouldSave({ ...base, furthest: 10, now: 99999 })).toBe(false);
  });
});

describe('formatTimestamp', () => {
  it.each([[0, '0:00'], [65, '1:05'], [3910, '1:05:10'], [42126, '11:42:06'], [-5, '0:00']])('%i seconds is %s', (seconds, text) => {
    expect(formatTimestamp(seconds)).toBe(text);
  });
});
