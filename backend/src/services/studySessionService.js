import prisma from '../config/prisma.js';
import { createHttpError } from '../utils/httpError.js';

const includeSession = {
  topic: { select: { id: true, name: true, difficulty: true, subject: { select: { id: true, name: true, exam: { select: { id: true, name: true, examDate: true } } } } } },
};

const dayStart = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const dayEnd = (value) => {
  const date = dayStart(value);
  date.setDate(date.getDate() + 1);
  return date;
};

async function ownedSession(userId, id) {
  const session = await prisma.studySession.findFirst({ where: { id, userId }, include: includeSession });
  if (!session) throw createHttpError(404, 'Study session not found');
  return session;
}

async function ownedTopic(userId, topicId) {
  const topic = await prisma.topic.findFirst({ where: { id: topicId, subject: { exam: { userId } } }, include: { subject: { include: { exam: true } } } });
  if (!topic) throw createHttpError(404, 'Topic not found');
  return topic;
}

export async function listSessions(userId, from, to) {
  const start = from || dayStart(new Date());
  const end = to || dayEnd(start);
  return prisma.studySession.findMany({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    include: includeSession,
  });
}

export async function listSessionsByRange(userId, from, to) {
  if (!from || !to) throw createHttpError(400, 'Both from and to dates are required');
  return listSessions(userId, from, to);
}

export async function createSession(userId, data) {
  await ownedTopic(userId, data.topicId);
  const plannedDuration = data.plannedDuration || data.duration;
  return prisma.studySession.create({
    data: {
      userId, topicId: data.topicId, date: data.date,
      startTime: data.startTime || data.date,
      duration: plannedDuration, plannedDuration, technique: data.technique,
    },
    include: includeSession,
  });
}

export async function updateSession(userId, id, data) {
  await ownedSession(userId, id);
  const plannedDuration = data.plannedDuration || data.duration;
  return prisma.studySession.update({
    where: { id },
    data: { ...data, ...(plannedDuration ? { plannedDuration, duration: plannedDuration } : {}) },
    include: includeSession,
  });
}

export async function startSession(userId, id) {
  const session = await ownedSession(userId, id);
  if (session.status === 'COMPLETED') throw createHttpError(409, 'Completed sessions cannot be started');
  return prisma.studySession.update({ where: { id }, data: { status: 'IN_PROGRESS', startTime: new Date() }, include: includeSession });
}

export async function completeSession(userId, id, actualDuration) {
  const session = await ownedSession(userId, id);
  if (session.status === 'SKIPPED') throw createHttpError(409, 'Skipped sessions cannot be completed');
  const actual = actualDuration || session.actualDuration || session.plannedDuration || session.duration;
  return prisma.studySession.update({
    where: { id },
    data: { status: 'COMPLETED', actualDuration: actual, completedAt: new Date(), duration: session.plannedDuration || session.duration },
    include: includeSession,
  });
}

export async function skipSession(userId, id) {
  await ownedSession(userId, id);
  return prisma.studySession.update({ where: { id }, data: { status: 'SKIPPED' }, include: includeSession });
}

export async function generatePlan(userId, { examId, from = new Date(), dailyAvailableHours, topicIds, technique }) {
  const exam = await prisma.exam.findFirst({ where: { id: examId, userId }, include: { subjects: { include: { topics: true } } } });
  if (!exam) throw createHttpError(404, 'Exam not found');
  const topics = exam.subjects.flatMap((subject) => subject.topics)
    .filter((topic) => !topicIds || topicIds.includes(topic.id))
    .sort((a, b) => ({ WEAK: 0, AVERAGE: 1, STRONG: 2 }[a.difficulty] - ({ WEAK: 0, AVERAGE: 1, STRONG: 2 }[b.difficulty]) || a.id - b.id));
  if (!topics.length) throw createHttpError(400, 'Add topics to this exam before generating a plan');
  const minutesPerDay = Math.max(25, Math.round((dailyAvailableHours || exam.dailyStudyHours) * 60));
  const start = dayStart(from);
  const end = dayStart(exam.examDate);
  const sessions = [];
  let cursor = 0;
  for (let date = new Date(start); date < end && cursor < topics.length; date.setDate(date.getDate() + 1)) {
    let used = 0;
    while (used + 25 <= minutesPerDay && cursor < topics.length) {
      const topic = topics[cursor % topics.length];
      const duration = technique === 'DEEP_FOCUS' ? Math.min(50, minutesPerDay - used) : Math.min(25, minutesPerDay - used);
      const sessionDate = new Date(date);
      sessionDate.setHours(9 + Math.floor(used / 60), used % 60, 0, 0);
      sessions.push({ userId, topicId: topic.id, date: sessionDate, startTime: sessionDate, duration, plannedDuration: duration, technique });
      used += duration;
      cursor += 1;
    }
  }
  if (!sessions.length) throw createHttpError(400, 'The exam date must be in the future');
  await prisma.studySession.createMany({ data: sessions });
  return listSessionsByRange(userId, start, new Date(Math.min(end.getTime(), new Date(start).setDate(start.getDate() + 7))));
}

/**
 * "Study now" for a topic: resume the session already in progress, otherwise start today's
 * planned session for the topic, otherwise create and start a new one.
 */
export async function studyNow(userId, topicId, { plannedDuration = 25, technique = 'POMODORO' } = {}) {
  await ownedTopic(userId, topicId);
  const active = await prisma.studySession.findFirst({
    where: { userId, topicId, status: 'IN_PROGRESS' },
    orderBy: { startTime: 'desc' },
    include: includeSession,
  });
  if (active) return active;

  const today = await prisma.studySession.findFirst({
    where: { userId, topicId, status: 'PLANNED', date: { gte: dayStart(new Date()), lt: dayEnd(new Date()) } },
    orderBy: [{ startTime: 'asc' }],
  });
  if (today) return startSession(userId, today.id);

  const created = await createSession(userId, { topicId, date: new Date(), plannedDuration, technique });
  return startSession(userId, created.id);
}
