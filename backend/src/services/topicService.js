import prisma from '../config/prisma.js';
import { createHttpError } from '../utils/httpError.js';

async function findOwnedSubject(userId, subjectId) {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, userId },
    select: { id: true },
  });

  if (!subject) {
    throw createHttpError(404, 'Subject not found');
  }

  return subject;
}

async function findOwnedTopic(userId, topicId) {
  const topic = await prisma.topic.findFirst({
    where: { id: topicId, subject: { userId } },
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

export async function deleteTopic(userId, topicId) {
  await findOwnedTopic(userId, topicId);
  await prisma.topic.delete({ where: { id: topicId } });
}
