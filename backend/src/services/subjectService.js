import prisma from '../config/prisma.js';
import { createHttpError } from '../utils/httpError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';

const subjectInclude = {
  _count: {
    select: { topics: true },
  },
};

async function findOwnedExam(userId, examId) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId },
    select: { id: true },
  });

  if (!exam) {
    throw createHttpError(404, 'Exam not found');
  }

  return exam;
}

async function findOwnedSubject(userId, subjectId) {
  const subject = await prisma.subject.findFirst({
    where: {
      id: subjectId,
      exam: { userId },
    },
    include: subjectInclude,
  });

  if (!subject) {
    throw createHttpError(404, 'Subject not found');
  }

  return subject;
}

export async function createSubject(userId, examId, data) {
  await findOwnedExam(userId, examId);

  return prisma.subject.create({
    data: { ...data, examId },
    include: subjectInclude,
  });
}

export async function listSubjects(userId, examId, paginationInput) {
  await findOwnedExam(userId, examId);
  const pagination = getPagination(paginationInput);
  const where = { examId };
  const [items, total] = await Promise.all([
    prisma.subject.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: pagination.skip,
      take: pagination.limit,
      include: subjectInclude,
    }),
    prisma.subject.count({ where }),
  ]);

  return paginatedResponse(items, total, pagination);
}

export async function updateSubject(userId, subjectId, data) {
  await findOwnedSubject(userId, subjectId);

  return prisma.subject.update({
    where: { id: subjectId },
    data,
    include: subjectInclude,
  });
}

export async function deleteSubject(userId, subjectId) {
  await findOwnedSubject(userId, subjectId);
  await prisma.subject.delete({ where: { id: subjectId } });
}
