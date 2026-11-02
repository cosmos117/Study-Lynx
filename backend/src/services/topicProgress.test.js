import { describe, expect, it } from 'vitest';
import { computeMastery } from './topicProgress.js';

describe('computeMastery', () => {
  it('has no score before the student has produced any signal', () => {
    expect(computeMastery({})).toMatchObject({ score: null, level: null });
  });

  it('weights quiz 50%, recall 35% and study time 15%', () => {
    const { score } = computeMastery({ quizAverage: 1, recallRate: 0, studyMinutes: 120 });
    expect(score).toBe(65);
  });

  it('rescales the weights when a signal is missing instead of counting it as zero', () => {
    expect(computeMastery({ quizAverage: 0.8 }).score).toBe(80);
    expect(computeMastery({ quizAverage: 0.8, recallRate: 0.6 }).score).toBe(72);
  });

  it('caps study time at two hours and clamps bad input', () => {
    expect(computeMastery({ studyMinutes: 600 }).score).toBe(100);
    expect(computeMastery({ quizAverage: 3, recallRate: -1 }).components).toMatchObject({ quiz: 1, recall: 0 });
  });

  it.each([[0.3, 'WEAK'], [0.5, 'AVERAGE'], [0.74, 'AVERAGE'], [0.75, 'STRONG']])('maps %s to %s', (quizAverage, level) => {
    expect(computeMastery({ quizAverage }).level).toBe(level);
  });
});

