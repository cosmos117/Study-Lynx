import prisma from '../config/prisma.js';

export async function getDashboardSummary(userId) {
  const [exams, subjects, topics, recentStudySessions, topicProgress] = await Promise.all([
    prisma.exam.count({ where: { userId } }),
    prisma.subject.count({ where: { exam: { userId } } }),
    prisma.topic.count({ where: { subject: { exam: { userId } } } }),
    prisma.studySession.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 5,
      include: {
        topic: {
          select: {
            id: true,
            name: true,
            subject: { select: { name: true } },
          },
        },
      },
    }),
    prisma.topic.findMany({
      where: { subject: { exam: { userId } } },
      select: {
        id: true,
        name: true,
        difficulty: true,
        _count: { select: { studySessions: true, quizResults: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ]);

  return {
    totals: { exams, subjects, topics },
    recentStudySessions,
    topicProgress,
  };
}
