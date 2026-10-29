import prisma from '../config/prisma.js';
import { dueCardsWhere } from './learningService.js';
import { computeStreak, localDateKey, rankTopics, summarizeSignals } from './topicProgress.js';

const HISTORY_LIMIT = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const percent = (fraction) => (fraction === null ? null : Math.round(fraction * 100));

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const k = key(row);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(row);
  }
  return groups;
}

/**
 * Cross-topic view of the learning data: one entry per topic with the same mastery rules the
 * Topic Learning Hub uses, ranked by what to study first and why.
 * Powers the Dashboard, Quizzes and Analytics pages. Every query is scoped to the user.
 */
export function createInsightsService({ db = prisma } = {}) {
  async function getOverview(userId, now = new Date()) {
    const todayStart = startOfDay(now);
    const [topicRows, cardGroups, dueRows, reviews, quizResults, sessions, quizzes] = await Promise.all([
      db.topic.findMany({
        where: { subject: { userId } },
        select: {
          id: true,
          name: true,
          difficulty: true,
          subject: { select: { id: true, name: true, examDate: true } },
        },
      }),
      db.flashcard.groupBy({ by: ['topicId'], where: { userId }, _count: { _all: true } }),
      db.cardReview.findMany({ where: dueCardsWhere(userId), select: { flashcard: { select: { topicId: true } } } }),
      db.recallReview.findMany({
        where: { userId },
        orderBy: { reviewedAt: 'desc' },
        take: HISTORY_LIMIT,
        select: { rating: true, reviewedAt: true, flashcard: { select: { topicId: true } } },
      }),
      db.quizResult.findMany({
        where: { userId },
        orderBy: { attemptedAt: 'desc' },
        take: HISTORY_LIMIT,
        select: { topicId: true, score: true, totalQuestions: true },
      }),
      db.studySession.findMany({
        where: { userId },
        select: { topicId: true, status: true, date: true, completedAt: true, actualDuration: true, plannedDuration: true },
      }),
      db.aiContent.findMany({ where: { userId, type: 'QUIZ', status: 'READY' }, select: { topicId: true } }),
    ]);

    const cards = new Map(cardGroups.map((group) => [group.topicId, group._count._all]));
    const due = groupBy(dueRows, (row) => row.flashcard.topicId);
    const reviewsByTopic = groupBy(reviews, (row) => row.flashcard.topicId);
    const quizzesByTopic = groupBy(quizResults, (row) => row.topicId);
    const sessionsByTopic = groupBy(sessions, (row) => row.topicId);
    const quizReady = new Set(quizzes.map((quiz) => quiz.topicId));

    const topics = rankTopics(topicRows.map((topic) => {
      const signals = summarizeSignals({
        reviews: reviewsByTopic.get(topic.id) || [],
        quizResults: quizzesByTopic.get(topic.id) || [],
        sessions: sessionsByTopic.get(topic.id) || [],
      });
      return {
        id: topic.id,
        name: topic.name,
        difficulty: topic.difficulty,
        subject: { id: topic.subject.id, name: topic.subject.name },
        examDate: topic.subject.examDate,
        cardsTotal: cards.get(topic.id) || 0,
        cardsDue: (due.get(topic.id) || []).length,
        mastery: signals.mastery,
        recallRate: percent(signals.recallRate),
        studyMinutes: signals.studyMinutes,
        quiz: {
          ready: quizReady.has(topic.id),
          attempts: signals.quizAttempts,
          latestPercent: percent(signals.latestQuizFraction),
          averagePercent: percent(signals.quizAverage),
        },
      };
    }), now);

    const doneToday = sessions.filter((session) => session.status === 'COMPLETED' && session.completedAt && session.completedAt >= todayStart);
    const plannedToday = sessions.filter((session) => ['PLANNED', 'IN_PROGRESS'].includes(session.status) && startOfDay(session.date).getTime() === todayStart.getTime());
    // The nearest upcoming exam across the subjects the student has topics in.
    const nextExam = topicRows
      .map((topic) => topic.subject)
      .filter((subject) => subject.examDate && subject.examDate >= todayStart)
      .sort((a, b) => a.examDate - b.examDate)[0] || null;

    const activeDays = new Set([
      ...sessions.filter((session) => session.status === 'COMPLETED' && session.completedAt).map((session) => localDateKey(session.completedAt)),
      ...reviews.map((review) => localDateKey(review.reviewedAt)),
    ]);

    return {
      today: {
        studyMinutes: doneToday.reduce((sum, session) => sum + (session.actualDuration || session.plannedDuration || 0), 0),
        sessionsDone: doneToday.length,
        sessionsPlanned: plannedToday.length,
      },
      streakDays: computeStreak(activeDays, now),
      nextExam: nextExam && {
        id: nextExam.id,
        name: nextExam.name,
        examDate: nextExam.examDate,
        daysLeft: Math.ceil((nextExam.examDate - now) / DAY_MS),
      },
      topics,
    };
  }

  /** Daily study time and recall activity plus recent quiz scores, for the Analytics page. */
  async function getAnalytics(userId, days = 14, now = new Date()) {
    const since = startOfDay(now);
    since.setDate(since.getDate() - (days - 1));
    const [sessions, reviews, quizzes] = await Promise.all([
      db.studySession.findMany({
        where: { userId, status: 'COMPLETED', completedAt: { gte: since } },
        select: { completedAt: true, actualDuration: true, plannedDuration: true },
      }),
      db.recallReview.findMany({ where: { userId, reviewedAt: { gte: since } }, select: { reviewedAt: true, rating: true } }),
      db.quizResult.findMany({
        where: { userId },
        orderBy: { attemptedAt: 'desc' },
        take: 10,
        select: { score: true, totalQuestions: true, attemptedAt: true, topic: { select: { id: true, name: true } } },
      }),
    ]);

    const series = Array.from({ length: days }, (_, index) => {
      const date = new Date(since);
      date.setDate(since.getDate() + index);
      return { date: localDateKey(date), studyMinutes: 0, cardsReviewed: 0 };
    });
    const byDate = new Map(series.map((day) => [day.date, day]));
    for (const session of sessions) {
      const day = byDate.get(localDateKey(session.completedAt));
      if (day) day.studyMinutes += session.actualDuration || session.plannedDuration || 0;
    }
    for (const review of reviews) {
      const day = byDate.get(localDateKey(review.reviewedAt));
      if (day) day.cardsReviewed += 1;
    }

    const remembered = reviews.filter((review) => review.rating === 'GOOD' || review.rating === 'EASY').length;
    return {
      days,
      series,
      totals: {
        studyMinutes: series.reduce((sum, day) => sum + day.studyMinutes, 0),
        activeDays: series.filter((day) => day.studyMinutes > 0 || day.cardsReviewed > 0).length,
        cardsReviewed: reviews.length,
        recallRate: reviews.length ? Math.round((remembered / reviews.length) * 100) : null,
      },
      quizTrend: quizzes
        .map((quiz) => ({
          percent: quiz.totalQuestions ? Math.round((quiz.score / quiz.totalQuestions) * 100) : 0,
          attemptedAt: quiz.attemptedAt,
          topic: quiz.topic,
        }))
        .reverse(),
    };
  }

  return { getOverview, getAnalytics };
}

export const insightsService = createInsightsService();
