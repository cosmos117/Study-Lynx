import prisma from '../config/prisma.js';
import { createHttpError } from '../utils/httpError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';

async function findOwnedSubject(userId, subjectId) {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, exam: { userId } },
    select: { id: true },
  });

  if (!subject) {
    throw createHttpError(404, 'Subject not found');
  }

  return subject;
}

async function findOwnedTopic(userId, topicId) {
  const topic = await prisma.topic.findFirst({
    where: { id: topicId, subject: { exam: { userId } } },
    include: {
      _count: { select: { studySessions: true, quizResults: true } },
    },
  });

  if (!topic) {
    throw createHttpError(404, 'Topic not found');
  }

  return topic;
}

export async function createTopic(userId, subjectId, data) {
  await findOwnedSubject(userId, subjectId);
  return prisma.topic.create({
    data: { ...data, subjectId },
    include: {
      _count: { select: { studySessions: true, quizResults: true } },
    },
  });
}

export async function listTopics(userId, subjectId, paginationInput) {
  await findOwnedSubject(userId, subjectId);
  const pagination = getPagination(paginationInput);
  const where = { subjectId };
  const [items, total] = await Promise.all([
    prisma.topic.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: pagination.skip,
      take: pagination.limit,
      include: {
        _count: { select: { studySessions: true, quizResults: true } },
      },
    }),
    prisma.topic.count({ where }),
  ]);

  return paginatedResponse(items, total, pagination);
}

export async function updateTopic(userId, topicId, data) {
  await findOwnedTopic(userId, topicId);
  return prisma.topic.update({
    where: { id: topicId },
    data,
    include: {
      _count: { select: { studySessions: true, quizResults: true } },
    },
  });
}

export async function deleteTopic(userId, topicId) {
  await findOwnedTopic(userId, topicId);
  await prisma.topic.delete({ where: { id: topicId } });
}
