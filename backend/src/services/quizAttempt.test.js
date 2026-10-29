import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  aiContent: { findUnique: vi.fn(), delete: vi.fn() },
  quizResult: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
}));
vi.mock('../config/prisma.js', () => ({ default: db }));
vi.mock('./aiContentService.js', () => ({ findOwnedTopic: vi.fn().mockResolvedValue({ id: 3 }), getOrGenerate: vi.fn() }));

const learning = await import('./learningService.js');

const generatedAt = new Date('2026-10-29T10:00:00Z');
const quiz = {
  id: 1,
  status: 'READY',
  updatedAt: generatedAt,
  content: { questions: [
    { question: 'Q1?', options: ['A', 'B', 'C', 'D'], correctIndex: 1, explanation: 'Because B.' },
    { question: 'Q2?', options: ['A', 'B', 'C', 'D'], correctIndex: 2, explanation: 'Because C.' },
  ] },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.aiContent.findUnique.mockResolvedValue(quiz);
});

describe('a submitted quiz keeps its state', () => {
  it('returns the latest attempt at this version of the quiz, with the chosen answers', async () => {
    const answers = [{ questionIndex: 0, selectedIndex: 1, correct: true, explanation: 'Because B.' }];
    const attemptedAt = new Date('2026-10-29T10:05:00Z');
    db.quizResult.findFirst.mockResolvedValue({ score: 1, totalQuestions: 2, answers, attemptedAt });

    const { quiz: loaded, attempt } = await learning.getQuizWithAttempt(7, 3);
    expect(loaded).toBe(quiz);
    expect(attempt).toEqual({ score: 1, totalQuestions: 2, answers, attemptedAt });

    const query = db.quizResult.findFirst.mock.calls[0][0];
    expect(query.where).toEqual({ userId: 7, topicId: 3, attemptedAt: { gte: generatedAt } });
    expect(query.orderBy).toEqual({ attemptedAt: 'desc' });
  });

  it('starts fresh when nothing was submitted since the quiz was generated', async () => {
    db.quizResult.findFirst.mockResolvedValue(null);
    expect((await learning.getQuizWithAttempt(7, 3)).attempt).toBeNull();
  });

  it('has no attempt while there is no ready quiz', async () => {
    db.aiContent.findUnique.mockResolvedValue(null);
    expect(await learning.getQuizWithAttempt(7, 3)).toEqual({ quiz: null, attempt: null });
    db.aiContent.findUnique.mockResolvedValue({ ...quiz, status: 'GENERATING' });
    expect((await learning.getQuizWithAttempt(7, 3)).attempt).toBeNull();
    expect(db.quizResult.findFirst).not.toHaveBeenCalled();
  });

  it('clearing deletes the quiz and its questions, but keeps past scores', async () => {
    db.quizResult.deleteMany = vi.fn();
    await learning.deleteQuiz(7, 3);
    expect(db.aiContent.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(db.quizResult.deleteMany).not.toHaveBeenCalled();
  });

  it("only looks up the signed-in user's quiz for the topic", async () => {
    await learning.deleteQuiz(7, 3);
    expect(db.aiContent.findUnique.mock.calls[0][0].where).toEqual({ userId_topicId_type: { userId: 7, topicId: 3, type: 'QUIZ' } });
  });

  it('cannot clear a quiz that does not exist', async () => {
    db.aiContent.findUnique.mockResolvedValue(null);
    await expect(learning.deleteQuiz(7, 3)).rejects.toMatchObject({ statusCode: 404 });
    expect(db.aiContent.delete).not.toHaveBeenCalled();
  });

  it('saves each answer, including unanswered ones, when the quiz is submitted', async () => {
    db.quizResult.create.mockResolvedValue({ id: 5 });
    db.quizResult.findMany.mockResolvedValue([{ score: 1, totalQuestions: 2 }]);
    const result = await learning.submitQuiz(7, 3, [{ questionIndex: 0, selectedIndex: 1 }]);
    expect(result.score).toBe(1);
    const saved = db.quizResult.create.mock.calls[0][0].data;
    expect(saved).toMatchObject({ userId: 7, topicId: 3, score: 1, totalQuestions: 2 });
    expect(saved.answers.map((item) => item.selectedIndex)).toEqual([1, -1]);
  });
});
