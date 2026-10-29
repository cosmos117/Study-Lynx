import prisma from '../config/prisma.js';
import { createHttpError } from '../utils/httpError.js';
import { findOwnedTopic, getOrGenerate } from './aiContentService.js';
import { featureDefinitions, notesToText } from './ai/features.js';
import { reviewCard } from './sm2.js';

async function ownedCard(userId, id) {
  const card = await prisma.flashcard.findFirst({ where: { id, userId }, include: { review: true } });
  if (!card) throw createHttpError(404, 'Flashcard not found');
  return card;
}

export async function getNotes(userId, topicId) {
  await findOwnedTopic(userId, topicId);
  const [note, content] = await Promise.all([
    prisma.note.findUnique({ where: { userId_topicId: { userId, topicId } } }),
    prisma.aiContent.findUnique({ where: { userId_topicId_type: { userId, topicId, type: 'NOTES' } } }),
  ]);
  return { note, aiContent: content };
}

export async function saveNote(userId, topicId, content) {
  await findOwnedTopic(userId, topicId);
  return prisma.note.upsert({
    where: { userId_topicId: { userId, topicId } },
    create: { userId, topicId, content, source: 'USER' },
    update: { content, source: 'USER' },
  });
}

export async function generateNotes(userId, topicId, regenerate, sources) {
  const result = await getOrGenerate({ userId, topicId, type: 'NOTES', regenerate, sources, feature: featureDefinitions.NOTES });
  return { ...result, text: notesToText(result.content) };
}

export async function listFlashcards(userId, topicId) {
  await findOwnedTopic(userId, topicId);
  return prisma.flashcard.findMany({ where: { userId, topicId }, include: { review: true }, orderBy: { createdAt: 'asc' } });
}

export async function createFlashcard(userId, topicId, data) {
  await findOwnedTopic(userId, topicId);
  return prisma.flashcard.create({
    data: { ...data, userId, topicId, source: 'USER', review: { create: { userId, dueAt: new Date() } } },
    include: { review: true },
  });
}

export async function updateFlashcard(userId, id, data) {
  await ownedCard(userId, id);
  return prisma.flashcard.update({ where: { id }, data, include: { review: true } });
}

export async function deleteFlashcard(userId, id) {
  await ownedCard(userId, id);
  await prisma.flashcard.delete({ where: { id } });
}

export async function reviewFlashcard(userId, id, rating) {
  const card = await ownedCard(userId, id);
  if (!card.review) throw createHttpError(409, 'Flashcard review state is missing');
  const update = reviewCard(card.review, rating);
  return prisma.$transaction(async (transaction) => {
    const review = await transaction.cardReview.update({ where: { flashcardId: id }, data: update });
    await transaction.recallReview.create({ data: { userId, flashcardId: Number(id), rating } });
    return review;
  });
}

/** Cards that are due for review now (the single definition of "due"). */
export const dueCardsWhere = (userId, topicId) => ({ userId, dueAt: { lte: new Date() }, ...(topicId ? { flashcard: { topicId } } : {}) });

export async function dueFlashcards(userId, topicId, limit = 20) {
  const where = dueCardsWhere(userId, topicId);
  return prisma.cardReview.findMany({
    where, take: limit, include: { flashcard: { include: { topic: { select: { id: true, name: true, subject: { select: { name: true } } } } } } }, orderBy: { dueAt: 'asc' },
  });
}

/** How many cards are due now, for the sidebar badge. A single COUNT query, cheap enough for every page. */
export function countDueFlashcards(userId) {
  return prisma.cardReview.count({ where: dueCardsWhere(userId) });
}

export async function getRecallSummary(userId) {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const [dueCards, overdueCards, reviewedToday, reviews, topicRows] = await Promise.all([
    prisma.cardReview.findMany({ where: { userId, dueAt: { gte: start, lt: end } }, include: { flashcard: { include: { topic: { select: { id: true, name: true, subject: { select: { name: true } } } } } } }, orderBy: { dueAt: 'asc' } }),
    prisma.cardReview.findMany({ where: { userId, dueAt: { lt: start } }, include: { flashcard: { include: { topic: { select: { id: true, name: true, subject: { select: { name: true } } } } } } }, orderBy: { dueAt: 'asc' } }),
    prisma.recallReview.count({ where: { userId, reviewedAt: { gte: start, lt: end } } }),
    prisma.recallReview.findMany({ where: { userId }, orderBy: { reviewedAt: 'desc' }, take: 500, select: { rating: true, reviewedAt: true, flashcardId: true } }),
    prisma.cardReview.findMany({ where: { userId, dueAt: { lte: now } }, select: { flashcard: { select: { topic: { select: { id: true, name: true, subject: { select: { name: true } } } } } } } }),
  ]);
  const dates = [...new Set(reviews.map((review) => review.reviewedAt.toISOString().slice(0, 10)))];
  let streak = 0;
  const cursor = new Date(start);
  if (dates[0] === cursor.toISOString().slice(0, 10)) {
    while (dates.includes(cursor.toISOString().slice(0, 10))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  }
  const difficultCards = new Set(reviews.filter((review) => review.rating === 'AGAIN' || review.rating === 'HARD').map((review) => review.flashcardId)).size;
  const remembered = reviews.filter((review) => review.rating === 'GOOD' || review.rating === 'EASY').length;
  const topicMap = new Map();
  topicRows.forEach(({ flashcard }) => topicMap.set(flashcard.topic.id, { ...flashcard.topic, cardsDue: (topicMap.get(flashcard.topic.id)?.cardsDue || 0) + 1 }));
  return {
    dueToday: dueCards,
    overdue: overdueCards,
    reviewedToday,
    streak,
    stats: { cardsReviewed: reviews.length, remembered: reviews.length ? Math.round((remembered / reviews.length) * 100) : 0, difficultCards },
    topics: [...topicMap.values()],
  };
}

export async function generateFlashcards(userId, topicId, regenerate, sources) {
  const content = await getOrGenerate({ userId, topicId, type: 'FLASHCARDS', regenerate, sources, feature: featureDefinitions.FLASHCARDS });
  const cards = content.content.cards;
  await prisma.$transaction(async (transaction) => {
    const existing = await transaction.flashcard.findMany({ where: { userId, topicId, source: 'AI' }, include: { review: true } });
    const removable = existing.filter((card) => card.review?.repetitions === 0);
    if (removable.length) await transaction.flashcard.deleteMany({ where: { id: { in: removable.map((card) => card.id) } } });
    for (const card of cards) {
      await transaction.flashcard.create({
        data: { userId, topicId, question: card.question, answer: card.answer, source: 'AI', review: { create: { userId, dueAt: new Date() } } },
      });
    }
  });
  return { content, kept: 0, generated: cards.length };
}

export async function getQuiz(userId, topicId) {
  await findOwnedTopic(userId, topicId);
  return prisma.aiContent.findUnique({ where: { userId_topicId_type: { userId, topicId, type: 'QUIZ' } } });
}

/**
 * The quiz plus the student's latest submitted attempt at this version of it, so a finished quiz
 * still shows its answers and score when the student comes back. A newly generated quiz has
 * a newer `updatedAt` than any attempt, so it starts fresh.
 */
export async function getQuizWithAttempt(userId, topicId) {
  const quiz = await getQuiz(userId, topicId);
  if (quiz?.status !== 'READY') return { quiz, attempt: null };
  const latest = await prisma.quizResult.findFirst({
    where: { userId, topicId, attemptedAt: { gte: quiz.updatedAt } },
    orderBy: { attemptedAt: 'desc' },
  });
  const attempt = latest && Array.isArray(latest.answers)
    ? { score: latest.score, totalQuestions: latest.totalQuestions, answers: latest.answers, attemptedAt: latest.attemptedAt }
    : null;
  return { quiz, attempt };
}

/**
 * Deletes the topic's quiz: its questions, and with them the student's answers and result.
 * Past scores are kept so they still count toward progress.
 */
export async function deleteQuiz(userId, topicId) {
  const quiz = await getQuiz(userId, topicId);
  if (!quiz) throw createHttpError(404, 'There is no quiz to clear');
  await prisma.aiContent.delete({ where: { id: quiz.id } });
}

function shuffledQuiz(content) {
  const questions = content.questions.map((question) => {
    const options = question.options.map((option, index) => ({ option, index }));
    options.sort(() => Math.random() - 0.5);
    return { ...question, options: options.map((item) => item.option), correctIndex: options.findIndex((item) => item.index === question.correctIndex) };
  });
  const maxShared = Math.ceil(questions.length * 0.7);
  const counts = [0, 1, 2, 3].map((index) => questions.filter((question) => question.correctIndex === index).length);
  const dominantIndex = counts.indexOf(Math.max(...counts));
  if (counts[dominantIndex] > maxShared) {
    const replacementIndexes = questions
      .map((question, index) => question.correctIndex === dominantIndex ? index : -1)
      .filter((index) => index !== -1)
      .slice(maxShared);
    replacementIndexes.forEach((questionIndex, offset) => {
      const targetIndex = (dominantIndex + offset + 1) % 4;
      const question = questions[questionIndex];
      [question.options[dominantIndex], question.options[targetIndex]] = [question.options[targetIndex], question.options[dominantIndex]];
      question.correctIndex = targetIndex;
    });
  }
  return questions;
}

export async function generateQuiz(userId, topicId, regenerate, sources) {
  const content = await getOrGenerate({ userId, topicId, type: 'QUIZ', regenerate, sources, feature: featureDefinitions.QUIZ });
  const quiz = { ...content, content: { ...content.content, questions: shuffledQuiz(content.content) } };
  return prisma.aiContent.update({ where: { id: content.id }, data: { content: quiz.content } });
}

export async function submitQuiz(userId, topicId, answers) {
  const quiz = await getQuiz(userId, topicId);
  if (!quiz?.content?.questions) throw createHttpError(404, 'Generate a quiz first');
  const results = quiz.content.questions.map((question, questionIndex) => {
    const answer = answers.find((item) => item.questionIndex === questionIndex);
    return { questionIndex, selectedIndex: answer?.selectedIndex ?? -1, correct: answer?.selectedIndex === question.correctIndex, explanation: question.explanation };
  });
  const score = results.filter((item) => item.correct).length;
  const saved = await prisma.quizResult.create({ data: { userId, topicId, score, totalQuestions: results.length, answers: results } });
  const recentResults = await prisma.quizResult.findMany({
    where: { userId, topicId },
    orderBy: { attemptedAt: 'desc' },
    take: 3,
    select: { score: true, totalQuestions: true },
  });
  const average = recentResults.reduce((total, result) => (
    total + (result.totalQuestions ? result.score / result.totalQuestions : 0)
  ), 0) / recentResults.length;
  return {
    score,
    totalQuestions: results.length,
    answers: results,
    resultId: saved.id,
    suggestion: average < 0.5 ? { type: 'MARK_WEAK' } : null,
  };
}

export async function getMindmap(userId, topicId) {
  await findOwnedTopic(userId, topicId);
  return prisma.aiContent.findUnique({ where: { userId_topicId_type: { userId, topicId, type: 'MINDMAP' } } });
}

export async function generateMindmap(userId, topicId, regenerate, sources) {
  return getOrGenerate({ userId, topicId, type: 'MINDMAP', regenerate, sources, feature: featureDefinitions.MINDMAP });
}
