import prisma from '../config/prisma.js';
import { createHttpError } from '../utils/httpError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';

const examInclude = {
  _count: {
    select: { subjects: true },
  },
};

async function findOwnedExam(userId, examId) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId },
    include: examInclude,
  });

  if (!exam) {
    throw createHttpError(404, 'Exam not found');
  }

  return exam;
}

export async function createExam(userId, data) {
  return prisma.exam.create({
    data: {
      ...data,
      userId,
    },
    include: examInclude,
  });
}

export async function listExams(userId, paginationInput) {
  const pagination = getPagination(paginationInput);
  const where = { userId };
  const [items, total] = await Promise.all([
    prisma.exam.findMany({
      where,
      orderBy: { examDate: 'asc' },
      skip: pagination.skip,
      take: pagination.limit,
      include: examInclude,
    }),
    prisma.exam.count({ where }),
  ]);

  return paginatedResponse(items, total, pagination);
}

export async function getExam(userId, examId) {
  return findOwnedExam(userId, examId);
}

export async function updateExam(userId, examId, data) {
  await findOwnedExam(userId, examId);

  return prisma.exam.update({
    where: { id: examId },
    data,
    include: examInclude,
  });
}

export async function deleteExam(userId, examId) {
  await findOwnedExam(userId, examId);
  await prisma.exam.delete({ where: { id: examId } });
}
