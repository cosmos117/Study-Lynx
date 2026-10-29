import prisma from '../config/prisma.js';
import { createHttpError } from '../utils/httpError.js';

// Subjects come with their topics, so the Subjects page needs a single request.
const subjectInclude = {
  topics: { select: { id: true, name: true, difficulty: true }, orderBy: { name: 'asc' } },
};

async function findOwnedSubject(userId, subjectId) {
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId }, select: { id: true } });
  if (!subject) throw createHttpError(404, 'Subject not found');
  return subject;
}

export async function createSubject(userId, data) {
  return prisma.subject.create({ data: { ...data, userId }, include: subjectInclude });
}

export async function listSubjects(userId) {
  return prisma.subject.findMany({
    where: { userId },
    orderBy: [{ examDate: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    include: subjectInclude,
  });
}

export async function updateSubject(userId, subjectId, data) {
  await findOwnedSubject(userId, subjectId);
  return prisma.subject.update({ where: { id: subjectId }, data, include: subjectInclude });
}

export async function deleteSubject(userId, subjectId) {
  await findOwnedSubject(userId, subjectId);
  await prisma.subject.delete({ where: { id: subjectId } });
}
