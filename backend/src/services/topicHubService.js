import prisma from '../config/prisma.js';
import { findOwnedTopic } from './aiContentService.js';
import { dueCardsWhere } from './learningService.js';

const percent = (fraction) => Math.round(fraction * 100);

/**
 * Everything the topic page shows in one request: its sources and videos, how many flashcards are
 * due, and the latest quiz score. Every query is scoped to the user.
 */
export function createTopicHubService({ db = prisma, ownedTopic = findOwnedTopic } = {}) {
  async function getHub(userId, topicId) {
    const topic = await ownedTopic(userId, topicId);

    const [documents, videos, transcriptRows, cardsTotal, cardsDue, latestResult, attempts] = await Promise.all([
      // The subject's sources (and any topic-only ones saved before sources moved to subjects).
      db.document.findMany({
        where: { userId, OR: [{ topicId }, { subjectId: topic.subject.id }] },
        select: { id: true, subjectId: true, name: true, type: true, status: true, pageCount: true, errorMessage: true, sourceUrl: true, _count: { select: { chunks: true } } },
        orderBy: [{ subjectId: { sort: 'asc', nulls: 'first' } }, { updatedAt: 'desc' }],
      }),
      db.learningResource.findMany({
        where: { userId, topicId },
        select: { id: true, title: true, url: true, watchedPercent: true, positionSeconds: true, completedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      db.learningResource.findMany({ where: { userId, topicId, NOT: { transcript: null } }, select: { id: true } }),
      db.flashcard.count({ where: { userId, topicId } }),
      db.cardReview.count({ where: dueCardsWhere(userId, topicId) }),
      db.quizResult.findFirst({ where: { userId, topicId }, orderBy: { attemptedAt: 'desc' }, select: { score: true, totalQuestions: true, attemptedAt: true } }),
      db.quizResult.count({ where: { userId, topicId } }),
    ]);

    const hasTranscript = new Set(transcriptRows.map((row) => row.id));

    return {
      topic: {
        id: topic.id,
        name: topic.name,
        subject: { id: topic.subject.id, name: topic.subject.name, examDate: topic.subject.examDate },
      },
      learn: {
        videos: videos.map((video) => ({
          id: video.id,
          title: video.title,
          url: video.url,
          watchedPercent: video.watchedPercent,
          positionSeconds: video.positionSeconds,
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
          fromSubject: Boolean(document.subjectId),
        })),
      },
      recall: { cardsTotal, cardsDue },
      practice: {
        attempts,
        latest: latestResult && {
          percent: latestResult.totalQuestions ? percent(latestResult.score / latestResult.totalQuestions) : 0,
          score: latestResult.score,
          total: latestResult.totalQuestions,
          attemptedAt: latestResult.attemptedAt,
        },
      },
    };
  }

  return { getHub };
}

export const topicHubService = createTopicHubService();
