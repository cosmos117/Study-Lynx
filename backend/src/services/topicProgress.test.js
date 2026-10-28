import { describe, expect, it } from 'vitest';
import { computeMastery, recommendNextStep } from './topicProgress.js';
import { findWeakAreas } from './topicHubService.js';

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

describe('recommendNextStep', () => {
  const base = { documentCount: 1, cardsTotal: 10, quizReady: true, latestQuizFraction: 0.8, mastery: { score: 60 } };

  it('puts due cards first, whatever else is missing', () => {
    expect(recommendNextStep({ cardsDue: 3 })).toMatchObject({ key: 'REVIEW_RECALL', stage: 'RECALL' });
  });

  it('asks for material when the topic has nothing to learn from', () => {
    expect(recommendNextStep({})).toMatchObject({ key: 'ADD_MATERIAL', stage: 'LEARN' });
  });

  it('suggests flashcards once there is material but no cards', () => {
    expect(recommendNextStep({ videoCount: 1 })).toMatchObject({ key: 'GENERATE_FLASHCARDS' });
  });

  it('moves on to the quiz: create it, then take it', () => {
    expect(recommendNextStep({ ...base, quizReady: false, latestQuizFraction: null })).toMatchObject({ key: 'GENERATE_QUIZ', stage: 'QUIZ' });
    expect(recommendNextStep({ ...base, latestQuizFraction: null })).toMatchObject({ key: 'TAKE_QUIZ' });
  });

  it('sends a student with a poor quiz result to revise with AI Tutor, or to study if there is no material', () => {
    expect(recommendNextStep({ ...base, latestQuizFraction: 0.4 })).toMatchObject({ key: 'ASK_TUTOR', stage: 'REVISE' });
    expect(recommendNextStep({ ...base, documentCount: 0, latestQuizFraction: 0.4 })).toMatchObject({ key: 'STUDY_NOW', stage: 'REVISE' });
  });

  it('suggests a confirming quiz when mastery is strong, otherwise keeps studying', () => {
    expect(recommendNextStep({ ...base, mastery: { score: 90 } })).toMatchObject({ key: 'TAKE_QUIZ' });
    expect(recommendNextStep(base)).toMatchObject({ key: 'STUDY_NOW', stage: 'LEARN' });
  });
});

describe('findWeakAreas', () => {
  const quizContent = { questions: [{ question: 'Q0' }, { question: 'Q1' }, { question: 'Q2' }, { question: 'Q3' }] };
  const answers = [0, 1, 2, 3].map((questionIndex) => ({ questionIndex, correct: false }));
  const attemptedAt = new Date('2026-01-02');
  const base = { latestResult: { attemptedAt, answers }, quizContent, quizUpdatedAt: new Date('2026-01-01'), hardCards: [{ question: 'Card A' }, { question: 'Card B' }] };

  it('mixes missed quiz questions with hard cards so neither crowds out the other', () => {
    expect(findWeakAreas(base).map((area) => area.text)).toEqual(['Q0', 'Q1', 'Card A']);
  });

  it('ignores quiz answers once the quiz has been regenerated', () => {
    const regenerated = { ...base, quizUpdatedAt: new Date('2026-02-01') };
    expect(findWeakAreas(regenerated).map((area) => area.text)).toEqual(['Card A', 'Card B']);
  });

  it('is empty when nothing was missed and no card is hard', () => {
    expect(findWeakAreas({ ...base, latestResult: null, hardCards: [] })).toEqual([]);
  });
});
