import { describe, expect, it } from 'vitest';
import { computeStreak, localDateKey, rankTopics, summarizeSignals } from './topicProgress.js';

describe('summarizeSignals', () => {
  it('reports nothing for a topic the student has not touched', () => {
    expect(summarizeSignals({})).toMatchObject({ recallRate: null, quizAverage: null, latestQuizFraction: null, studyMinutes: 0, mastery: { score: null } });
  });

  it('uses the last three quiz attempts, the last 50 reviews and completed sessions only', () => {
    const quizResults = [{ score: 5, totalQuestions: 5 }, { score: 0, totalQuestions: 5 }, { score: 5, totalQuestions: 5 }, { score: 0, totalQuestions: 5 }];
    const reviews = [...Array(25).fill({ rating: 'GOOD' }), ...Array(25).fill({ rating: 'AGAIN' }), ...Array(30).fill({ rating: 'GOOD' })];
    const sessions = [
      { status: 'COMPLETED', actualDuration: 30 },
      { status: 'COMPLETED', plannedDuration: 20 },
      { status: 'SKIPPED', actualDuration: 99 },
      { status: 'PLANNED', plannedDuration: 99 },
    ];
    const signals = summarizeSignals({ reviews, quizResults, sessions });
    expect(signals.quizAverage).toBeCloseTo(2 / 3);
    expect(signals.latestQuizFraction).toBe(1);
    expect(signals.quizAttempts).toBe(4);
    expect(signals.recallReviews).toBe(50);
    expect(signals.recallRate).toBe(0.5);
    expect(signals.studyMinutes).toBe(50);
    expect(signals.sessionsCompleted).toBe(2);
  });
});

describe('rankTopics', () => {
  const now = new Date('2026-06-01T10:00:00');
  const topic = (id, extra = {}) => ({ id, name: `T${id}`, cardsDue: 0, mastery: { score: 80 }, examDate: null, ...extra });

  it('puts topics with due cards first and says why', () => {
    const ranked = rankTopics([topic(1, { mastery: { score: 10 } }), topic(2, { cardsDue: 12 })], now);
    expect(ranked.map((t) => t.id)).toEqual([2, 1]);
    expect(ranked[0].priority.reasons).toEqual(['12 cards due', 'Mastery 80%']);
  });

  it('prefers weaker topics and treats unknown mastery as needing a start', () => {
    const ranked = rankTopics([topic(1), topic(2, { mastery: { score: null } }), topic(3, { mastery: { score: 30 } })], now);
    expect(ranked.map((t) => t.id)).toEqual([3, 2, 1]);
    expect(ranked[1].priority.reasons).toContain('Not started yet');
  });

  it('adds urgency for a near exam but ignores past or far exams', () => {
    const soon = rankTopics([topic(1, { examDate: '2026-06-04T00:00:00' })], now)[0];
    expect(soon.priority.reasons).toContain('Exam in 3 days');
    const far = rankTopics([topic(1, { examDate: '2027-01-01T00:00:00' })], now)[0];
    const past = rankTopics([topic(1, { examDate: '2026-05-01T00:00:00' })], now)[0];
    expect(far.priority.reasons).toHaveLength(1);
    expect(past.priority.reasons).toHaveLength(1);
  });

  it('is stable for equal scores', () => {
    expect(rankTopics([topic(2), topic(1)], now).map((t) => t.id)).toEqual([1, 2]);
  });
});

describe('computeStreak', () => {
  const today = new Date('2026-06-10T15:00:00');
  const day = (offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    return localDateKey(d);
  };

  it('is zero without activity', () => {
    expect(computeStreak(new Set(), today)).toBe(0);
  });

  it('counts consecutive days including today', () => {
    expect(computeStreak(new Set([day(0), day(1), day(2), day(4)]), today)).toBe(3);
  });

  it('keeps yesterday-ending streaks alive until the day is over', () => {
    expect(computeStreak(new Set([day(1), day(2)]), today)).toBe(2);
  });

  it('breaks after a full missed day', () => {
    expect(computeStreak(new Set([day(2), day(3)]), today)).toBe(0);
  });
});
