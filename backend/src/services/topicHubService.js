import prisma from '../config/prisma.js';
import { findOwnedTopic } from './aiContentService.js';
import { dueCardsWhere } from './learningService.js';
import { RECALL_WINDOW, recommendNextStep, summarizeSignals } from './topicProgress.js';

const MAX_WEAK_AREAS = 3;
const percent = (fraction) => Math.round(fraction * 100);

/**
 * Weak spots: questions missed on the latest quiz (at most two, so they don't crowd out
 * the other signal), then flashcards whose latest rating was hard.
 */
export function findWeakAreas({ latestResult, quizContent, quizUpdatedAt, hardCards }) {
  const missed = [];
  // Quiz answers are stored by position, so they only map to questions if the quiz hasn't been regenerated since.
  if (latestResult && quizContent?.questions && quizUpdatedAt <= latestResult.attemptedAt) {
    for (const answer of latestResult.answers || []) {
      const question = quizContent.questions[answer.questionIndex];
      if (!answer.correct && question) missed.push({ kind: 'quiz', text: question.question });
    }
  }
  const hard = hardCards.map((card) => ({ kind: 'flashcard', text: card.question }));
  return [...missed.slice(0, MAX_WEAK_AREAS - 1), ...hard].slice(0, MAX_WEAK_AREAS);
}

/** Cards whose most recent rating was AGAIN or HARD, newest first. */
function latestHardCardIds(reviews) {
  const seen = new Set();
  const hard = [];
  for (const review of reviews) {
    if (seen.has(review.flashcardId)) continue;
    seen.add(review.flashcardId);
    if (review.rating === 'AGAIN' || review.rating === 'HARD') hard.push(review.flashcardId);
  }
  return hard.slice(0, MAX_WEAK_AREAS);
}

export function createTopicHubService({ db = prisma, ownedTopic = findOwnedTopic } = {}) {
  async function getHub(userId, topicId) {
    const topic = await ownedTopic(userId, topicId);
    const flashcardScope = { userId, flashcard: { topicId } };

    const [documents, videos, transcriptRows, cardsTotal, cardsDue, reviews, aiContents, note, quizResults, sessions] = await Promise.all([
      db.document.findMany({
        where: { userId, topicId },
        select: { id: true, name: true, type: true, status: true, pageCount: true, errorMessage: true, sourceUrl: true, _count: { select: { chunks: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      db.learningResource.findMany({
        where: { userId, topicId },
        select: { id: true, title: true, url: true, watchedPercent: true, completedAt: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      db.learningResource.findMany({ where: { userId, topicId, NOT: { transcript: null } }, select: { id: true } }),
      db.flashcard.count({ where: { userId, topicId } }),
      db.cardReview.count({ where: dueCardsWhere(userId, topicId) }),
      db.recallReview.findMany({ where: flashcardScope, orderBy: { reviewedAt: 'desc' }, take: RECALL_WINDOW, select: { flashcardId: true, rating: true } }),
      db.aiContent.findMany({ where: { userId, topicId, status: 'READY', type: { in: ['QUIZ', 'MINDMAP'] } }, select: { type: true, content: true, updatedAt: true } }),
      db.note.findUnique({ where: { userId_topicId: { userId, topicId } }, select: { updatedAt: true } }),
      db.quizResult.findMany({ where: { userId, topicId }, orderBy: { attemptedAt: 'desc' }, take: 10, select: { score: true, totalQuestions: true, attemptedAt: true, answers: true } }),
      db.studySession.findMany({
        where: { userId, topicId },
        select: { id: true, status: true, date: true, plannedDuration: true, actualDuration: true, technique: true },
        orderBy: { date: 'desc' },
      }),
    ]);

    const hasTranscript = new Set(transcriptRows.map((row) => row.id));
    const quiz = aiContents.find((item) => item.type === 'QUIZ');
    const mindmap = aiContents.find((item) => item.type === 'MINDMAP');

    const signals = summarizeSignals({ reviews, quizResults, sessions });
    const { recallRate, quizAverage, studyMinutes, mastery } = signals;
    const fraction = (result) => (result.totalQuestions ? result.score / result.totalQuestions : 0);
    const latestResult = quizResults[0] || null;

    const hardIds = latestHardCardIds(reviews);
    const hardCards = hardIds.length ? await db.flashcard.findMany({ where: { id: { in: hardIds }, userId }, select: { id: true, question: true } }) : [];
    hardCards.sort((a, b) => hardIds.indexOf(a.id) - hardIds.indexOf(b.id));

    const completed = sessions.filter((session) => session.status === 'COMPLETED');
    const activeSession = sessions.find((session) => session.status === 'IN_PROGRESS') || null;
    const upcoming = sessions.filter((session) => session.status === 'PLANNED').sort((a, b) => a.date - b.date)[0] || null;

    const weakAreas = findWeakAreas({ latestResult, quizContent: quiz?.content, quizUpdatedAt: quiz?.updatedAt, hardCards });
    const readyDocuments = documents.filter((document) => document.status === 'READY');

    return {
      topic: {
        id: topic.id,
        name: topic.name,
        difficulty: topic.difficulty,
        subject: { id: topic.subject.id, name: topic.subject.name },
        exam: { id: topic.subject.exam.id, name: topic.subject.exam.name, examDate: topic.subject.exam.examDate },
      },
      learn: {
        videos: videos.map((video) => ({
          id: video.id,
          title: video.title,
          url: video.url,
          watchedPercent: video.watchedPercent,
          completed: Boolean(video.completedAt),
          hasTranscript: hasTranscript.has(video.id),
        })),
        documents: documents.map((document) => ({
          id: document.id,
          name: document.name,
          type: document.type,
          status: document.status,
          pageCount: document.pageCount,
          passages: document._count.chunks,
          errorMessage: document.errorMessage,
          sourceUrl: document.sourceUrl,
        })),
        hasNotes: Boolean(note),
        tutorSources: readyDocuments.length,
      },
      recall: {
        cardsTotal,
        cardsDue,
        reviews: signals.recallReviews,
        recallRate: recallRate === null ? null : percent(recallRate),
        hasMindmap: Boolean(mindmap),
      },
      practice: {
        quizReady: Boolean(quiz),
        attempts: quizResults.length,
        latest: latestResult && { percent: percent(fraction(latestResult)), score: latestResult.score, total: latestResult.totalQuestions, attemptedAt: latestResult.attemptedAt },
        history: quizResults.slice(0, 5).map((result) => ({ percent: percent(fraction(result)), attemptedAt: result.attemptedAt })),
        averagePercent: quizAverage === null ? null : percent(quizAverage),
      },
      progress: {
        mastery,
        studyMinutes,
        sessionsCompleted: signals.sessionsCompleted,
        activeSession: activeSession && { id: activeSession.id },
        nextSession: upcoming && { id: upcoming.id, date: upcoming.date, plannedDuration: upcoming.plannedDuration },
        weakAreas,
      },
      nextStep: recommendNextStep({
        documentCount: readyDocuments.length,
        videoCount: videos.length,
        cardsTotal,
        cardsDue,
        quizReady: Boolean(quiz),
        latestQuizFraction: latestResult ? fraction(latestResult) : null,
        mastery,
        weakAreaCount: weakAreas.length,
      }),
    };
  }

  return { getHub };
}

export const topicHubService = createTopicHubService();
