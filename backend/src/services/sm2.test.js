import { describe, expect, it } from 'vitest';
import { reviewCard } from './sm2.js';

const initial = { easeFactor: 2.5, intervalDays: 0, repetitions: 0, lapses: 0 };

describe('SM-2 review scheduling', () => {
  it('resets repetitions, records a lapse, and schedules AGAIN soon', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const result = reviewCard(initial, 'AGAIN', now);
    expect(result.repetitions).toBe(0);
    expect(result.lapses).toBe(1);
    expect(result.dueAt.getTime() - now.getTime()).toBe(10 * 60000);
  });

  it('uses one and six day intervals for first and second successful reviews', () => {
    const first = reviewCard(initial, 'GOOD');
    const second = reviewCard(first, 'GOOD');
    expect(first.intervalDays).toBe(1);
    expect(second.intervalDays).toBe(6);
  });

  it('never lowers ease below 1.3', () => {
    let review = initial;
    for (let index = 0; index < 20; index += 1) review = reviewCard(review, 'AGAIN');
    expect(review.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});
