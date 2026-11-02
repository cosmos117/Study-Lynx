import { describe, expect, it } from 'vitest';
import { createInsightsService } from './insightsService.js';

// A fixed "now" in local time, because the service buckets days by the local calendar.
const NOW = new Date(2026, 5, 15, 14, 0, 0); // Mon 15 Jun 2026, 14:00
const at = (daysAgo, hour = 10) => new Date(2026, 5, 15 - daysAgo, hour, 0, 0);
const inDays = (days) => new Date(2026, 5, 15 + days, 9, 0, 0);

// A subject with an optional exam date; topics belong to subjects.
const subject = (id, name, examDate = null) => ({ id, name, examDate });
const topic = (id, name, subjectRow, difficulty = 'AVERAGE') => ({
  id,
  name,
  difficulty,
  subject: subjectRow,
});

/** A fake database that records every query so tests can check user scoping. */
function fakeDb(data = {}) {
  const calls = [];
  const table = (name, rows = []) => ({
    findMany: async (args) => { calls.push({ name, args }); return rows; },
    groupBy: async (args) => { calls.push({ name, args }); return rows; },
  });
  return {
    calls,
    db: {
      topic: table('topic', data.topics),
      flashcard: table('flashcard', data.cardGroups),
      cardReview: table('cardReview', data.dueRows),
      recallReview: table('recallReview', data.reviews),
      quizResult: table('quizResult', data.quizResults),
      studySession: table('studySession', data.sessions),
      aiContent: table('aiContent', data.quizzes),
    },
  };
}

const overviewFor = (data) => {
  const { db, calls } = fakeDb(data);
  return createInsightsService({ db }).getOverview(7, NOW).then((overview) => ({ overview, calls }));
};

describe('dashboard overview', () => {
  it('handles a brand-new user with nothing set up', async () => {
    const { overview } = await overviewFor({});
    expect(overview).toEqual({
      today: { studyMinutes: 0, sessionsDone: 0, sessionsPlanned: 0 },
      streakDays: 0,
      nextExam: null,
      topics: [],
    });
  });

  it('only runs queries scoped to the signed-in user', async () => {
    const { calls } = await overviewFor({});
    expect(calls.length).toBeGreaterThan(0);
    for (const { name, args } of calls) {
      expect(JSON.stringify(args.where), `${name} query must be user scoped`).toContain('"userId":7');
    }
  });

  describe('next exam', () => {
    it('picks the subject with the soonest upcoming exam date', async () => {
      const soon = subject(1, 'Databases', inDays(12));
      const later = subject(2, 'Networks', inDays(40));
      const { overview } = await overviewFor({ topics: [topic(1, 'Normalization', later), topic(2, 'Joins', soon)] });
      expect(overview.nextExam).toMatchObject({ id: 1, name: 'Databases', daysLeft: 12 });
      expect(overview.today).not.toHaveProperty('goalMinutes');
    });

    it('ignores exams that have already passed', async () => {
      const past = subject(1, 'Old exam', inDays(-3));
      const { overview } = await overviewFor({ topics: [topic(1, 'Topic', past)] });
      expect(overview.nextExam).toBeNull();
    });

    it('ignores subjects that have no exam date', async () => {
      const { overview } = await overviewFor({ topics: [topic(1, 'Topic', subject(1, 'No date'))] });
      expect(overview.nextExam).toBeNull();
    });

    it('counts an exam later today as today (0 days left or fewer)', async () => {
      const today = subject(1, 'Quiz', new Date(2026, 5, 15, 18, 0, 0));
      const { overview } = await overviewFor({ topics: [topic(1, 'Topic', today)] });
      expect(overview.nextExam.daysLeft).toBeLessThanOrEqual(1);
      expect(overview.nextExam.daysLeft).toBeGreaterThanOrEqual(0);
    });
  });

  describe('today panel', () => {
    const base = { topicId: 1, plannedDuration: 30, actualDuration: null, completedAt: null };

    it('adds up only sessions completed today, preferring actual over planned minutes', async () => {
      const { overview } = await overviewFor({
        sessions: [
          { ...base, status: 'COMPLETED', date: at(0), completedAt: at(0, 9), actualDuration: 40 },
          { ...base, status: 'COMPLETED', date: at(0), completedAt: at(0, 11), plannedDuration: 25 },
          { ...base, status: 'COMPLETED', date: at(1), completedAt: at(1, 20), actualDuration: 90 },
          { ...base, status: 'SKIPPED', date: at(0) },
        ],
      });
      expect(overview.today.studyMinutes).toBe(65);
      expect(overview.today.sessionsDone).toBe(2);
    });

    it('counts planned and in-progress sessions scheduled for today only', async () => {
      const { overview } = await overviewFor({
        sessions: [
          { ...base, status: 'PLANNED', date: at(0) },
          { ...base, status: 'IN_PROGRESS', date: at(0, 16) },
          { ...base, status: 'PLANNED', date: inDays(1) },
          { ...base, status: 'PLANNED', date: at(1) },
        ],
      });
      expect(overview.today.sessionsPlanned).toBe(2);
    });
  });

  describe('study streak', () => {
    const session = (daysAgo) => ({ topicId: 1, status: 'COMPLETED', date: at(daysAgo), completedAt: at(daysAgo), actualDuration: 20, plannedDuration: 20 });
    const review = (daysAgo) => ({ rating: 'GOOD', reviewedAt: at(daysAgo), flashcard: { topicId: 1 } });

    it('counts consecutive days of study or card review', async () => {
      const { overview } = await overviewFor({ sessions: [session(0), session(2)], reviews: [review(1)] });
      expect(overview.streakDays).toBe(3);
    });

    it('keeps yesterday’s streak alive before studying today', async () => {
      const { overview } = await overviewFor({ sessions: [session(1), session(2)] });
      expect(overview.streakDays).toBe(2);
    });

    it('resets after a missed day', async () => {
      const { overview } = await overviewFor({ sessions: [session(2), session(3)] });
      expect(overview.streakDays).toBe(0);
    });
  });

  describe('topics', () => {
    const upcoming = subject(1, 'Databases', inDays(10));

    it('reports card totals, due cards and quiz readiness per topic', async () => {
      const { overview } = await overviewFor({
        topics: [topic(1, 'Normalization', upcoming)],
        cardGroups: [{ topicId: 1, _count: { _all: 8 } }],
        dueRows: [{ flashcard: { topicId: 1 } }, { flashcard: { topicId: 1 } }, { flashcard: { topicId: 1 } }],
        quizzes: [{ topicId: 1 }],
        quizResults: [{ topicId: 1, score: 4, totalQuestions: 5 }],
      });
      const [first] = overview.topics;
      expect(first).toMatchObject({ id: 1, cardsTotal: 8, cardsDue: 3 });
      expect(first.quiz).toMatchObject({ ready: true, attempts: 1, latestPercent: 80 });
      expect(first.subject).toEqual({ id: 1, name: 'Databases' });
      expect(first.examDate).toEqual(upcoming.examDate);
    });

    it('puts the topic with due cards first and explains why', async () => {
      const { overview } = await overviewFor({
        topics: [topic(1, 'Calm topic', upcoming), topic(2, 'Urgent topic', upcoming)],
        dueRows: [{ flashcard: { topicId: 2 } }],
      });
      expect(overview.topics.map((t) => t.name)).toEqual(['Urgent topic', 'Calm topic']);
      expect(overview.topics[0].priority.reasons.length).toBeGreaterThan(0);
    });

    it('shows unknown mastery as null for an untouched topic', async () => {
      const { overview } = await overviewFor({ topics: [topic(1, 'Fresh', upcoming)] });
      expect(overview.topics[0].mastery.score).toBeNull();
      expect(overview.topics[0].cardsDue).toBe(0);
    });
  });
});

